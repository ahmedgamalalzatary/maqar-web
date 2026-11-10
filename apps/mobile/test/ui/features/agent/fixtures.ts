import type { AgentToday, AgentViewing, LeadCard, LeadDetail } from '@maqar/shared';
import { makeCard } from '../../../utils/api';

export const lead = (over: Partial<LeadCard> = {}): LeadCard => ({
  id: 1,
  name: 'كريم محمود',
  phone: '+20 101 *** 4412',
  stage: 'viewing',
  source: 'booking',
  hot: false,
  fromApp: true,
  isNew: false,
  budget: 25_000_000,
  property: { id: 4, titleAr: 'فيلا في التجمع', titleEn: 'Villa in New Cairo' },
  lastActivityAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  ...over,
});

export const agentViewing = (over: Partial<AgentViewing> = {}): AgentViewing => ({
  id: 10,
  leadId: 1,
  date: '2026-11-12',
  time: '16:00',
  startsAt: '2026-11-12T14:00:00.000Z',
  mode: 'visit',
  clientName: 'كريم محمود',
  newFromApp: false,
  property: makeCard({ id: 4, titleAr: 'فيلا في التجمع' }),
  ...over,
});

export const todayOf = (over: Partial<AgentToday> = {}): AgentToday => ({
  firstNameAr: 'عمر',
  firstNameEn: 'Omar',
  stats: { today: 1, fresh: 2, active: 5 },
  target: { won: 6, target: 8, teamAvg: 5 },
  today: [agentViewing({ newFromApp: true })],
  upcoming: [agentViewing({ id: 11, leadId: 2, date: '2026-11-14', clientName: 'دينا رأفت' })],
  pipeline: { new: 2, contacted: 1, viewing: 2, negotiation: 0, won: 1, lost: 1 },
  firstCall: [lead({ id: 3, name: 'نهى السيد', stage: 'new', source: 'tour', hot: true, fromApp: false })],
  ...over,
});

export const detailOf = (over: Partial<LeadDetail> = {}): LeadDetail => ({
  ...lead({ isNew: true, hot: true }),
  phone: '+201014124412',
  property: makeCard({ id: 4, titleAr: 'فيلا في التجمع' }),
  viewing: agentViewing({ newFromApp: true }),
  chatId: null,
  notes: [{ id: 1, text: 'عايز دور أرضي', createdAt: new Date(Date.now() - 3_600_000).toISOString() }],
  createdAt: new Date(Date.now() - 86_400_000).toISOString(),
  ...over,
});
