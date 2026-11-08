import type { Role } from '@maqar/shared';
import { eq } from 'drizzle-orm';
import type { Db } from '../../core/db/db.module.js';
import { agents } from '../agents/agents.schema.js';
import { hashPassword } from '../auth/password.js';
import { users } from './users.schema.js';

// The demo's agents (apps/demo/src/lib/data.ts). Names are fictional.
const AGENTS = [
  { email: 'omar@maqar.app', nameAr: 'عمر حسن', nameEn: 'Omar Hassan', roleTitleAr: 'مستشار مبيعات أول', roleTitleEn: 'Senior sales advisor', rating: 4.9, dealsCount: 184, years: 7, languagesAr: 'العربية، الإنجليزية', languagesEn: 'Arabic, English', avgReplyMins: 4, phone: '+201000000001', colour: '#b38959' },
  { email: 'mariam@maqar.app', nameAr: 'مريم عادل', nameEn: 'Mariam Adel', roleTitleAr: 'مستشارة مشروعات جديدة', roleTitleEn: 'New projects advisor', rating: 4.8, dealsCount: 132, years: 5, languagesAr: 'العربية، الإنجليزية، الفرنسية', languagesEn: 'Arabic, English, French', avgReplyMins: 6, phone: '+201000000002', colour: '#61766d' },
  { email: 'youssef@maqar.app', nameAr: 'يوسف كمال', nameEn: 'Youssef Kamal', roleTitleAr: 'مستشار الساحل والسخنة', roleTitleEn: 'Coastal homes advisor', rating: 4.9, dealsCount: 97, years: 4, languagesAr: 'العربية، الإنجليزية', languagesEn: 'Arabic, English', avgReplyMins: 3, phone: '+201000000003', colour: '#3d5a80' },
  { email: 'salma@maqar.app', nameAr: 'سلمى فاروق', nameEn: 'Salma Farouk', roleTitleAr: 'مستشارة إيجارات', roleTitleEn: 'Rentals advisor', rating: 4.7, dealsCount: 210, years: 6, languagesAr: 'العربية، الإنجليزية', languagesEn: 'Arabic, English', avgReplyMins: 5, phone: '+201000000004', colour: '#8c5e58' },
];

const OTHERS: { email: string; name: string; role: Role }[] = [
  { email: 'admin@maqar.app', name: 'فريق مقر', role: 'admin' },
  { email: 'client@maqar.app', name: 'عميل تجريبي', role: 'client' },
  { email: 'owner@maqar.app', name: 'مالك تجريبي', role: 'owner' },
];

/** Creates the demo accounts that do not exist yet. Safe to run more than once. */
export async function seedDemoAccounts(db: Db, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);

  const ensureUser = async (email: string, name: string, role: Role): Promise<number | null> => {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) return null;
    const [{ id }] = await db.insert(users).values({ email, name, role, passwordHash }).$returningId();
    return id;
  };

  for (const { email, ...profile } of AGENTS) {
    const id = await ensureUser(email, profile.nameAr, 'agent');
    if (id) await db.insert(agents).values({ userId: id, ...profile, monthlyTarget: 6 });
  }
  for (const { email, name, role } of OTHERS) await ensureUser(email, name, role);
}
