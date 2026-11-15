import { canChangeOwnPassword, passwordOk, RESET_CODE_LENGTH, readResetCode } from '../../src/api.js';

// Phase 31 (2026-11-15): changing and recovering a password.
describe('passwords', () => {
  it('need 8 characters with a letter and a digit', () => {
    expect(passwordOk('Secret123')).toBe(true);
    expect(passwordOk('Sec12')).toBe(false);
    expect(passwordOk('12345678')).toBe(false);
    expect(passwordOk('abcdefgh')).toBe(false);
    expect(passwordOk(`a1${'x'.repeat(127)}`)).toBe(false);
  });

  it('are changed by clients and admins themselves; an advisor asks the admin', () => {
    expect(canChangeOwnPassword('client')).toBe(true);
    expect(canChangeOwnPassword('admin')).toBe(true);
    expect(canChangeOwnPassword('agent')).toBe(false);
  });

  it('a reset code is read from Arabic or Latin digits, with spaces ignored', () => {
    expect(RESET_CODE_LENGTH).toBe(6);
    expect(readResetCode(' 123 456 ')).toBe('123456');
    expect(readResetCode('١٢٣٤٥٦')).toBe('123456');
    expect(readResetCode('12345')).toBeNull();
    expect(readResetCode('12345a')).toBeNull();
  });
});
