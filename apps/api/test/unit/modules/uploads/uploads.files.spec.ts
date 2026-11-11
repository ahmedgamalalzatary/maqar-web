import { BadRequestException } from '@nestjs/common';
import { vi } from 'vitest';
import { UploadsService } from '../../../../src/modules/uploads/uploads.service.js';

const config = { get: vi.fn(() => 'uploads-root') };
const service = new UploadsService(config as never);

vi.mock('node:fs/promises', () => ({
  access: vi.fn(async (p: string) => {
    if (String(p).includes('missing')) throw new Error('nope');
  }),
  unlink: vi.fn(async () => undefined),
}));

describe('listing files on disk', () => {
  it('accepts photos that exist and seed photos without touching the disk', async () => {
    await expect(service.assertListingFiles(['/uploads/listings/a.jpg', '/uploads/seed/demo.jpg'])).resolves.toBeUndefined();
  });

  it('refuses a listing photo that was never uploaded', async () => {
    await expect(service.assertListingFiles(['/uploads/listings/missing.jpg'])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a path that is not a bare file name under listings', async () => {
    await expect(service.assertListingFiles(['/uploads/listings/sub/dir.jpg'])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('removes only listing files, and ignores one that will not go', async () => {
    const fs = await import('node:fs/promises');
    await service.removeListingFiles(['/uploads/listings/gone.jpg', '/uploads/seed/keep.jpg', '/uploads/listings/../secret.jpg']);
    const calls = (fs.unlink as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('uploads-root');
    expect(calls[0]).toContain('gone.jpg');
  });
});
