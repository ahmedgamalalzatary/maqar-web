import { vi } from 'vitest';
import { alreadyDue, dueBatches, reminderAt } from '../../../../src/modules/viewings/reminders.js';
import { ViewingsService, conflictOf } from '../../../../src/modules/viewings/viewings.service.js';

const MIN = 60_000;
const startsAt = new Date('2026-11-13T15:00:00.000Z');
const before = (ms: number) => new Date(startsAt.getTime() - ms);

describe('conflictOf', () => {
  it('says "already have a viewing" when the one-active-viewing key refused the second booking', () => {
    const dup = Object.assign(new Error("Duplicate entry '21-7-1' for key 'viewings_client_property_active_unique'"), { code: 'ER_DUP_ENTRY' });
    expect(conflictOf(dup)?.message).toContain('already have a viewing');
  });

  it('still says the hour was taken when the agent-hour key refused it', () => {
    const dup = Object.assign(new Error("Duplicate entry '3-2026-1' for key 'viewings_agent_hour_unique'"), { code: 'ER_DUP_ENTRY' });
    expect(conflictOf(dup)?.message).toContain('just booked');
    expect(conflictOf(new Error('other'))).toBeUndefined();
  });
});

describe('completing past viewings', () => {
  it("runs on the reminder job's pass, so past appointments stop blocking new bookings", async () => {
    const completePastViewings = vi.fn(async () => 2);
    const pendingReminders = vi.fn(async () => []);
    const service = new ViewingsService(
      { pendingReminders, completePastViewings } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await service.completePastViewings();
    expect(completePastViewings).toHaveBeenCalledTimes(1);
    void pendingReminders;
  });
});

describe('reminder claiming', () => {
  const card = { id: 7, titleAr: 'شقة', titleEn: 'Flat', price: 1, category: 'sale', type: 'apartment', area: { nameAr: 'ت', nameEn: 't' }, publishedAt: new Date().toISOString() };
  const agent = { id: 3, nameAr: 'عمر', nameEn: 'Omar' };
  const deps = (repo: Record<string, unknown>) => {
    const properties = { cardsById: vi.fn(async () => new Map([[7, card]])), agentsById: vi.fn(async () => new Map([[3, agent]])) };
    const notifications = { notify: vi.fn(async () => ({})) };
    const service = new ViewingsService(repo as never, properties as never, {} as never, notifications as never, {} as never);
    return { service, notifications };
  };
  const row = {
    id: 1, propertyId: 7, clientId: 21, agentId: 3,
    startsAt: new Date(Date.now() + 3_600_000), status: 'confirmed', mode: 'visit', createdAt: new Date(), updatedAt: new Date(),
  };

  it("stamps a reminder sent only after it went out, so a crash can't lose it", async () => {
    const markRemindersSent = vi.fn(async () => undefined);
    const { service, notifications } = deps({
      pendingReminders: vi.fn(async () => [{ viewingId: 1, offset: '1d', startsAt: new Date(Date.now() + 3_600_000) }]),
      claimReminders: vi.fn(async () => true),
      findById: vi.fn(async () => row),
      remindersOf: vi.fn(async () => new Map()),
      markRemindersSent,
    });
    await service.sendDueReminders(new Date());
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(markRemindersSent).toHaveBeenCalledWith(1, ['1d']);
  });

  it('leaves the reminder claimable when its delivery fails', async () => {
    const markRemindersSent = vi.fn(async () => undefined);
    const { service, notifications } = deps({
      pendingReminders: vi.fn(async () => [{ viewingId: 1, offset: '1d', startsAt: new Date(Date.now() + 3_600_000) }]),
      claimReminders: vi.fn(async () => true),
      findById: vi.fn(async () => row),
      remindersOf: vi.fn(async () => new Map()),
      markRemindersSent,
    });
    (notifications.notify as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('push down'));
    await service.sendDueReminders(new Date());
    expect(markRemindersSent).not.toHaveBeenCalled();
  });
});

describe('reminderAt', () => {
  it('is 1 day, 2 hours or 30 minutes before the viewing', () => {
    expect(reminderAt(startsAt, '1d').toISOString()).toBe('2026-11-12T15:00:00.000Z');
    expect(reminderAt(startsAt, '2h').toISOString()).toBe('2026-11-13T13:00:00.000Z');
    expect(reminderAt(startsAt, '30m').toISOString()).toBe('2026-11-13T14:30:00.000Z');
  });
});

describe('alreadyDue', () => {
  it('lists the choices whose time has passed when booking, so they are never sent', () => {
    // Booked 35 minutes ahead: only the 30-minute reminder is still to come.
    expect(alreadyDue(startsAt, ['1d', '2h', '30m'], before(35 * MIN))).toEqual(['1d', '2h']);
    expect(alreadyDue(startsAt, ['1d', '2h', '30m'], before(3 * 86_400_000))).toEqual([]);
    // Exactly at its time counts as due.
    expect(alreadyDue(startsAt, ['30m'], before(30 * MIN))).toEqual(['30m']);
  });
});

describe('dueBatches', () => {
  const row = (viewingId: number, offset: '1d' | '2h' | '30m', at = startsAt) => ({ viewingId, offset, startsAt: at });

  it('picks the reminders whose time has come, one batch per viewing', () => {
    const one = [row(1, '1d'), row(1, '2h'), row(1, '30m')];
    expect(dueBatches(one, before(2 * 60 * MIN))).toEqual([{ viewingId: 1, offsets: ['1d', '2h'] }]);
    expect(dueBatches(one, before(2 * 60 * MIN + 1))).toEqual([{ viewingId: 1, offsets: ['1d'] }]);
    expect(dueBatches(one, before(2 * 86_400_000))).toEqual([]);
    const rows = [...one, row(2, '1d', new Date(startsAt.getTime() + 60 * MIN))];
    expect(dueBatches(rows, before(29 * MIN))).toEqual([
      { viewingId: 1, offsets: ['1d', '2h', '30m'] },
      { viewingId: 2, offsets: ['1d'] },
    ]);
  });

  it('sends nothing once the viewing has started', () => {
    expect(dueBatches([row(1, '30m')], startsAt)).toEqual([]);
    expect(dueBatches([row(1, '30m')], new Date(startsAt.getTime() + MIN))).toEqual([]);
  });
});

