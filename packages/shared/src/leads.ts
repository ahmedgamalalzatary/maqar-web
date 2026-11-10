// Sales agent rules both sides need (contract §10.1, §10.2).

/**
 * A phone number for lists, where only part of it shows (contract §10.2): "+20 101 *** 4412".
 * The lead page shows it in full, for calling.
 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, '');
  const international = digits.startsWith('+');
  const body = international ? digits.slice(3) : digits;
  if (body.length < 8) return '***';
  const parts = [body.slice(0, 3), '***', body.slice(-4)];
  return (international ? [digits.slice(0, 3), ...parts] : parts).join(' ');
}

/**
 * The monthly target card: `share` of the target won (0 to 1; null without a target), and
 * `vsTeam`, how far above (+) or below (-) the team's average the agent is, in whole percent
 * (null while the team has won nothing this month).
 */
export function targetProgress(t: { won: number; target: number; teamAvg: number }): { share: number | null; vsTeam: number | null } {
  const share = t.target > 0 ? Math.min(1, t.won / t.target) : null;
  const vsTeam = t.teamAvg > 0 ? Math.round(((t.won - t.teamAvg) / t.teamAvg) * 100) : null;
  return { share, vsTeam: vsTeam === 0 ? 0 : vsTeam };
}
