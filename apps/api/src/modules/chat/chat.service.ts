import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CHAT_PAGE,
  type ChatBody,
  type ChatMessage,
  type ChatPage,
  type ChatSender,
  type ChatThread,
  chatPreview,
  installment,
  type SendChatBody,
  type ViewingItem,
} from '@maqar/shared';
import sharp from 'sharp';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import type { Env } from '../../core/config/env.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ListingCounter } from '../insights/insights.service.js';
import { PropertiesService } from '../properties/properties.service.js';
import { UsersRepository } from '../users/users.repository.js';
import { cairoClock } from '../viewings/slots.js';
import { ViewingsService } from '../viewings/viewings.service.js';
import { isWorkingTime, needsAwayReply } from './away.js';
import { ChatRealtime } from './chat.realtime.js';
import { ChatRepository } from './chat.repository.js';
import type { ChatMessageRow, ChatThreadRow } from './chat.schema.js';

/** The out-of-hours reply (contract §16.1 #12), in the client's language. */
const AWAY = {
  ar: 'أهلاً بيك! إحنا دلوقتي برّه مواعيد الشغل. سيب رسالتك وهنرد عليك أول ما نرجع، أو كلّم مقر في مواعيد العمل.',
  en: 'Hi! We’re outside working hours right now. Leave your message and we’ll reply as soon as we’re back, or contact Maqar during working hours.',
};

/** Photos are resized to this on their longest side. */
const PHOTO_MAX_PX = 1600;

const toMessage = (r: ChatMessageRow): ChatMessage => ({
  id: r.id,
  threadId: r.threadId,
  sender: r.sender,
  body: r.body,
  readAt: r.readAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

/** Live chat between a client and a home's advisor (contract §8.12, §10.3). */
@Injectable()
export class ChatService {
  constructor(
    private readonly repo: ChatRepository,
    private readonly properties: PropertiesService,
    private readonly viewings: ViewingsService,
    private readonly users: UsersRepository,
    private readonly notifications: NotificationsService,
    private readonly realtime: ChatRealtime,
    private readonly config: ConfigService<Env, true>,
    private readonly counter: ListingCounter,
  ) {}

  /** Opens the client's conversation about this home, starting it the first time. */
  async start(user: AuthUser, propertyId: number): Promise<ChatThread> {
    const home = await this.properties.bookingTarget(propertyId);
    const thread = await this.repo.openThread(user.id, home.id, home.agent.id);
    await this.counter.interest(home.id, user.id, 'chatted');
    return (await this.threads([thread], 'client'))[0]!;
  }

  async list(user: AuthUser): Promise<ChatThread[]> {
    const side = sideOf(user);
    return this.threads(await this.repo.threadsOf({ id: user.id, side }), side);
  }

  async get(user: AuthUser, id: number): Promise<ChatThread> {
    const thread = await this.own(user, id);
    const [item] = await this.threads([thread], sideOf(user));
    if (!item) throw new NotFoundException('Conversation not found');
    return item;
  }

  async page(user: AuthUser, id: number, before?: number): Promise<ChatPage> {
    await this.own(user, id);
    const { items, hasMore } = await this.repo.page(id, CHAT_PAGE, before);
    return { items: items.map(toMessage), hasMore };
  }

  /** Clients send text; agents also send cards about the conversation's home. */
  async send(user: AuthUser, id: number, body: SendChatBody): Promise<ChatMessage> {
    const thread = await this.own(user, id);
    const side = sideOf(user);
    if (side === 'client' && body.kind !== 'text') throw new ForbiddenException('Clients send text and photos');
    return this.post(thread, side, await this.cardFor(thread, body));
  }

  /** Photos (JPEG, PNG, WebP or HEIC), resized and stored as JPEG, then sent as one message. */
  async sendImages(user: AuthUser, id: number, files: { buffer: Buffer; mimetype: string }[]): Promise<ChatMessage> {
    const thread = await this.own(user, id);
    if (!files.length) throw new BadRequestException('Add at least one photo');
    const dir = path.resolve(this.config.get('UPLOADS_DIR', { infer: true }), 'chat', String(thread.id));
    await mkdir(dir, { recursive: true });
    const urls: string[] = [];
    for (const f of files) {
      const name = `${randomUUID()}.jpg`;
      const jpeg = await sharp(f.buffer)
        .rotate()
        .resize(PHOTO_MAX_PX, PHOTO_MAX_PX, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer()
        .catch(() => {
          throw new BadRequestException('That file is not a photo we can read');
        });
      await writeFile(path.join(dir, name), jpeg);
      urls.push(`/uploads/chat/${thread.id}/${name}`);
    }
    return this.post(thread, sideOf(user), { kind: 'images', urls });
  }

  /** Marks the other side's messages read and tells them (the ticks turn gold). */
  async read(user: AuthUser, id: number): Promise<void> {
    const thread = await this.own(user, id);
    const side = sideOf(user);
    const at = await this.repo.markRead(thread.id, side);
    if (at) this.realtime.emit([otherOf(thread, side)], 'read', { threadId: thread.id, reader: side, at: at.toISOString() });
  }

  /**
   * Books a time from an agent's slots card in one step (contract §8.12), with the same rules as
   * the booking screen. The card shows the time picked, and a confirmation card follows.
   */
  async book(user: AuthUser, id: number, messageId: number, time: string): Promise<{ viewing: ViewingItem; card: ChatMessage }> {
    const thread = await this.own(user, id);
    if (sideOf(user) !== 'client') throw new ForbiddenException('Only the client books');
    const msg = await this.repo.findMessage(messageId);
    if (!msg || msg.threadId !== thread.id || msg.body.kind !== 'slots') throw new NotFoundException('Times card not found');
    const card = msg.body;
    if (card.chosen) throw new ConflictException('A time was already picked on this card');
    if (!card.times.includes(time)) throw new BadRequestException('That time is not on the card');
    const viewing = await this.viewings.book(user, { propertyId: thread.propertyId, date: card.date, time, reminders: ['1d', '2h'] });
    // Two taps at once: the booking rules let one through, and the card takes one time.
    await this.repo.choose(msg.id, time);
    const picked = toMessage((await this.repo.findMessage(msg.id))!);
    this.realtime.emit([thread.clientId, thread.agentId], 'updated', { message: picked });
    // The confirmation comes from the advisor's side, already seen by the client who just booked.
    await this.post(thread, 'agent', { kind: 'booking', viewingId: viewing.id, date: viewing.date, time: viewing.time }, new Date());
    return { viewing, card: picked };
  }

  /** The conversation, only for its client or its agent. Anyone else gets 404. */
  private async own(user: AuthUser, id: number): Promise<ChatThreadRow> {
    const thread = await this.repo.findThread(id);
    const mine = thread && (user.role === 'client' ? thread.clientId === user.id : user.role === 'agent' && thread.agentId === user.id);
    if (!thread || !mine) throw new NotFoundException('Conversation not found');
    return thread;
  }

  /** What a card holds, from the conversation's home. */
  private async cardFor(thread: ChatThreadRow, body: SendChatBody): Promise<ChatBody> {
    if (body.kind === 'text') return { kind: 'text', text: body.text.trim() };
    if (body.kind === 'property') return { kind: 'property' };
    const card = (await this.properties.cardsById([thread.propertyId])).get(thread.propertyId);
    if (!card) throw new NotFoundException('Listing not found');
    if (body.kind === 'tour') {
      if (!card.tour) throw new BadRequestException('This home has no 360° tour');
      return { kind: 'tour' };
    }
    if (body.kind === 'plan') {
      if (!card.plan) throw new BadRequestException('This home has no installment plan');
      const { downPct, years } = card.plan;
      return { kind: 'plan', price: card.price, downPct, years, monthly: Math.round(installment(card.price, downPct, years).payment) };
    }
    const { days } = await this.viewings.slots(thread.propertyId);
    const day = days.find((d) => d.date === body.date);
    const times = day?.slots.filter((s) => s.state === 'free').map((s) => s.time) ?? [];
    if (!times.length) throw new BadRequestException('No free times that day');
    return { kind: 'slots', date: body.date, times, chosen: null };
  }

  /**
   * Stores a message and brings it to both sides at once. The other side gets a notification
   * unless they have the conversation open. A client writing out of hours gets the away reply.
   */
  private async post(thread: ChatThreadRow, sender: ChatSender, body: ChatBody, readAt: Date | null = null): Promise<ChatMessage> {
    const message = toMessage(await this.repo.add(thread, sender, body, readAt));
    this.realtime.emit([thread.clientId, thread.agentId], 'message', { message });
    const to = sender === 'client' ? thread.agentId : thread.clientId;
    if (!readAt && !this.realtime.isOpen(to, thread.id)) await this.notify(thread, sender, to, body);
    if (sender === 'client') await this.awayReply(thread);
    return message;
  }

  private async notify(thread: ChatThreadRow, sender: ChatSender, to: number, body: ChatBody): Promise<void> {
    const [agents, from] = await Promise.all([this.properties.agentsById([thread.agentId]), this.users.findActiveById(thread.clientId)]);
    const agent = agents.get(thread.agentId);
    const name = sender === 'agent' ? { ar: agent?.nameAr ?? 'مقر', en: agent?.nameEn ?? 'Maqar' } : { ar: from?.name || 'عميل', en: from?.name || 'Client' };
    await this.notifications.notify(to, {
      kind: 'chat',
      titleAr: name.ar,
      titleEn: name.en,
      bodyAr: chatPreview(body, 'ar'),
      bodyEn: chatPreview(body, 'en'),
      href: sender === 'agent' ? `/chat/${thread.id}` : `/agent/chat/${thread.id}`,
    });
  }

  /** Out of the agent's hours, the client's message gets one automatic reply until the agent answers. */
  private async awayReply(thread: ChatThreadRow): Promise<void> {
    const now = new Date();
    const { hours, daysOff } = await this.viewings.agentSchedule(thread.agentId, cairoClock(now).date);
    if (isWorkingTime(hours, daysOff, now)) return;
    const recent = await this.repo.recent(thread.id);
    if (!needsAwayReply(recent.map((m) => ({ sender: m.sender, auto: m.body.kind === 'text' && !!m.body.auto })))) return;
    const client = await this.users.findActiveById(thread.clientId);
    await this.post(thread, 'agent', { kind: 'text', text: client?.lang === 'en' ? AWAY.en : AWAY.ar, auto: true });
  }

  private async threads(rows: ChatThreadRow[], side: ChatSender): Promise<ChatThread[]> {
    const ids = rows.map((r) => r.id);
    const [cards, agents, last, unread, clients] = await Promise.all([
      this.properties.cardsById(rows.map((r) => r.propertyId)),
      this.properties.agentsById(rows.map((r) => r.agentId)),
      this.repo.lastMessages(ids),
      this.repo.unread(ids, side),
      side === 'agent' ? this.repo.clients(rows.map((r) => r.clientId)) : undefined,
    ]);
    return rows.flatMap((r) => {
      const found = cards.get(r.propertyId);
      const agent = agents.get(r.agentId);
      if (!found || !agent) return [];
      const { location: _location, ...property } = found;
      const lastRow = last.get(r.id);
      return {
        id: r.id,
        property,
        agent,
        client: clients?.get(r.clientId) ?? null,
        leadId: side === 'agent' ? r.leadId : null,
        last: lastRow ? toMessage(lastRow) : null,
        unread: unread.get(r.id) ?? 0,
      };
    });
  }
}

const sideOf = (user: AuthUser): ChatSender => (user.role === 'agent' ? 'agent' : 'client');
const otherOf = (thread: ChatThreadRow, side: ChatSender) => (side === 'client' ? thread.agentId : thread.clientId);
