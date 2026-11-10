import type { LeadSource, LeadStage } from '@maqar/shared';
import { and, eq, isNull, ne } from 'drizzle-orm';
import type { Db } from '../../core/db/db.module.js';
import { agents } from '../agents/agents.schema.js';
import { properties } from '../properties/properties.schema.js';
import { leadNotes, leads } from './leads.schema.js';

const HOUR = 3_600_000;

/** Sample leads from outside the app (calls, walk-ins), as in the demo, so the agent screens are not empty. */
const SAMPLES: { name: string; phone: string; budget: number; source: LeadSource; stage: LeadStage; hoursAgo: number; hot?: boolean; note?: string }[] = [
  { name: 'نهى السيد', phone: '+201124129087', budget: 8_000_000, source: 'tour', stage: 'new', hoursAgo: 0.4, hot: true },
  { name: 'أحمد سمير', phone: '+201064125521', budget: 10_000_000, source: 'call', stage: 'new', hoursAgo: 1.2 },
  { name: 'دينا رأفت', phone: '+201224126540', budget: 13_000_000, source: 'smart_pick', stage: 'contacted', hoursAgo: 5, note: 'عايزة دور أرضي بجنينة، هتكلمنا الأحد.' },
  { name: 'طارق عبد الله', phone: '+201004122231', budget: 17_000_000, source: 'price_alert', stage: 'negotiation', hoursAgo: 26, note: 'عرض ١٦٫٥ مليون كاش، مستني رد المالك.' },
  { name: 'ياسمين حسني', phone: '+201114123390', budget: 7_500_000, source: 'calculator', stage: 'won', hoursAgo: 72 },
  { name: 'هالة منصور', phone: '+201274128804', budget: 12_000_000, source: 'walk_in', stage: 'lost', hoursAgo: 120 },
];

/**
 * Adds the sample leads to every agent that has none from outside the app yet, so running the seed
 * again adds nothing. Each lead asks about one of the agent's own homes (not a stay).
 */
export async function seedSampleLeads(db: Db): Promise<void> {
  const all = await db.select({ id: agents.userId }).from(agents);
  for (const { id: agentId } of all) {
    const [has] = await db.select({ id: leads.id }).from(leads).where(and(eq(leads.agentId, agentId), isNull(leads.clientId))).limit(1);
    if (has) continue;
    const homes = await db
      .select({ id: properties.id })
      .from(properties)
      .where(and(eq(properties.agentId, agentId), ne(properties.category, 'stay')));
    const now = Date.now();
    for (const [i, s] of SAMPLES.entries()) {
      const at = new Date(now - s.hoursAgo * HOUR);
      const [{ id }] = await db
        .insert(leads)
        .values({
          agentId,
          name: s.name,
          phone: s.phone,
          propertyId: homes.length ? homes[i % homes.length]!.id : null,
          budget: s.budget,
          source: s.source,
          stage: s.stage,
          hot: s.hot ?? false,
          fromApp: false,
          lastActivityAt: at,
          createdAt: at,
          wonAt: s.stage === 'won' ? at : null,
        })
        .$returningId();
      if (s.note) await db.insert(leadNotes).values({ leadId: id!, agentId, text: s.note, createdAt: at });
    }
  }
}
