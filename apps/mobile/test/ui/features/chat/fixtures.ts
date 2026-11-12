import type { ChatBody, ChatMessage, ChatThread } from '@maqar/shared';
import { makeCard } from '../../../utils/api';

export const agent = {
  id: 7,
  nameAr: 'عمر حسن',
  nameEn: 'Omar Hassan',
  roleTitleAr: 'مستشار',
  roleTitleEn: 'Advisor',
  rating: 4.9,
  dealsCount: 1,
  years: 1,
  languagesAr: 'العربية',
  languagesEn: 'Arabic',
  avgReplyMins: 4,
  phone: '+201000000001',
  colour: '#b38959',
};

let n = 100;
export const msg = (sender: 'client' | 'agent', body: ChatBody, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: ++n,
  threadId: 1,
  sender,
  body,
  readAt: null,
  createdAt: new Date().toISOString(),
  ...over,
});

export const thread = (over: Partial<ChatThread> = {}): ChatThread => ({
  id: 1,
  property: makeCard({ id: 4, titleAr: 'فيلا في التجمع', plan: { downPct: 10, years: 8 }, tour: true }),
  agent,
  client: null,
  leadId: null,
  last: null,
  unread: 0,
  blocked: null,
  ...over,
});
