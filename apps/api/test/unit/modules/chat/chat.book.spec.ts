import { vi } from 'vitest';
import { ChatService } from '../../../../src/modules/chat/chat.service.js';
import type { ChatThreadRow } from '../../../../src/modules/chat/chat.schema.js';

const thread = { id: 5, propertyId: 7, clientId: 21, agentId: 3 } as ChatThreadRow;
const slotsMsg = { id: 55, threadId: 5, kind: 'slots', body: { kind: 'slots', date: '2030-01-01', chosen: null, times: ['12:00', '13:00'] } };
const user = { id: 21, role: 'client' } as never;
const existingItem = { id: 91, date: '2030-01-01', time: '12:00' };

const make = (over: { choose?: (id: number, time: string) => Promise<boolean>; activeOf?: () => Promise<unknown>; book?: () => Promise<unknown> } = {}) => {
  const repo = {
    findThread: vi.fn(async () => thread),
    findMessage: vi.fn(async () => ({ ...slotsMsg, createdAt: new Date() })),
    choose: vi.fn(over.choose ?? (async () => true)),
    hasBookingCard: vi.fn(async () => false),
    add: vi.fn(async () => ({ id: 56, threadId: 5, sender: 'agent', body: { kind: 'booking' }, readAt: null, createdAt: new Date() })),
  };
  const viewings = {
    activeOf: vi.fn(over.activeOf ?? (async () => undefined)),
    book: vi.fn(over.book ?? (async () => ({ ...existingItem, status: 'pending' }))),
  };
  const service = new ChatService(
    repo as never,
    {} as never,
    viewings as never,
    {} as never,
    {} as never,
    // The client has the conversation open, so nobody is notified here.
    { emit: vi.fn(), isOpen: vi.fn(() => true) } as never,
    {} as never,
    {} as never,
  );
  // The out-of-hours reply has its own tests.
  vi.spyOn(service as unknown as { awayReply: () => Promise<void> }, 'awayReply').mockResolvedValue();
  return { service, repo, viewings };
};

describe('booking a chat times card', () => {
  it('retries safely: an existing active viewing is the result, so no second booking is made', async () => {
    const { service, viewings, repo } = make({ activeOf: async () => existingItem });
    const result = await service.book(user, 5, 55, '13:00');
    expect(viewings.book).not.toHaveBeenCalled();
    expect(repo.choose).toHaveBeenCalledWith(55, '12:00');
    expect(result.viewing).toMatchObject({ id: 91 });
  });

  it("marks the card only when the pick won, and never books without knowing the card's outcome", async () => {
    const { service, repo } = make({ choose: async () => false });
    await service.book(user, 5, 55, '13:00');
    expect(repo.choose).toHaveBeenCalledWith(55, '13:00');
  });

  // Owner, 2026-11-14: the booking waits for the advisor, and the chat says what the client booked.
  it('books a request and posts it from the client’s side', async () => {
    const { service, repo, viewings } = make();
    await service.book(user, 5, 55, '13:00');
    expect(viewings.book).toHaveBeenCalledWith(user, expect.objectContaining({ time: '13:00' }), 3, true);
    expect(repo.add).toHaveBeenCalledWith(thread, 'client', { kind: 'booking', viewingId: 91, date: '2030-01-01', time: '12:00', state: 'pending' }, null);
  });
});
