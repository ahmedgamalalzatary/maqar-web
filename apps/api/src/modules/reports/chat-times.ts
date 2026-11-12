import type { MessageFact, ThreadFact } from './reports.repository.js';
import { type Win, within } from './reports.util.js';

/**
 * For each conversation started in the range: how many minutes passed between the client's first
 * message and the advisor's first message after it. Null when the advisor has not answered yet;
 * a conversation the client never wrote in (the advisor wrote first) is left out.
 */
export function firstReplies(threads: ThreadFact[], messages: MessageFact[], w: Pick<Win, 'from' | 'to'>): { threadId: number; agentId: number; minutes: number | null }[] {
  const byThread = new Map<number, MessageFact[]>();
  for (const m of messages) {
    const list = byThread.get(m.threadId);
    if (list) list.push(m);
    else byThread.set(m.threadId, [m]);
  }
  const out: { threadId: number; agentId: number; minutes: number | null }[] = [];
  for (const t of threads) {
    if (!within(t.createdAt, w)) continue;
    const ms = (byThread.get(t.id) ?? []).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const asked = ms.find((m) => m.sender === 'client');
    if (!asked) continue;
    // The automatic out-of-hours reply is not an answer from the advisor.
    const answer = ms.find((m) => m.sender === 'agent' && !m.auto && m.createdAt >= asked.createdAt);
    out.push({ threadId: t.id, agentId: t.agentId, minutes: answer ? (answer.createdAt.getTime() - asked.createdAt.getTime()) / 60_000 : null });
  }
  return out;
}
