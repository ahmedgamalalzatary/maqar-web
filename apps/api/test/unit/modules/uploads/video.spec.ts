import { canCopy, convertArgs, ffTools, posterArgs, type VideoProbe } from '../../../../src/modules/uploads/video.js';

const probe = (over: Partial<VideoProbe> = {}): VideoProbe => ({
  codec: 'h264',
  pixFmt: 'yuv420p',
  width: 1920,
  height: 1080,
  shown: { width: 1920, height: 1080 },
  audio: 'aac',
  durationS: 42,
  container: 'mov,mp4,m4a,3gp,3g2,mj2',
  ...over,
});

describe('listing videos (phase 26)', () => {
  it('copies an H.264 video up to 1920 px; anything else is converted', () => {
    expect(canCopy(probe())).toBe(true);
    expect(canCopy(probe({ width: 1080, height: 1920 }))).toBe(true);
    expect(canCopy(probe({ codec: 'hevc' }))).toBe(false);
    expect(canCopy(probe({ width: 3840, height: 2160 }))).toBe(false);
    // 10-bit H.264 does not play on many phones.
    expect(canCopy(probe({ pixFmt: 'yuv420p10le' }))).toBe(false);
    expect(canCopy(probe({ container: 'matroska,webm' }))).toBe(false);
  });

  it('a copy keeps the streams; a conversion is H.264 at most 1280 px on one thread; metadata never stays', () => {
    const copy = convertArgs(probe(), 'in', 'out.mp4');
    expect(copy).toEqual(expect.arrayContaining(['-c:v', 'copy', '-c:a', 'copy', '-map_metadata', '-1', '-movflags', '+faststart']));
    expect(copy.at(-1)).toBe('out.mp4');
    const convert = convertArgs(probe({ codec: 'hevc', audio: 'opus' }), 'in', 'out.mp4');
    expect(convert).toEqual(expect.arrayContaining(['libx264', '-threads', '1', '-c:a', 'aac', '-map_metadata', '-1']));
    expect(convert.join(' ')).toContain('1280/max(iw,ih)');
    expect(convertArgs(probe({ audio: null }), 'in', 'out.mp4')).toContain('-an');
  });

  it('the poster comes from one second in, or the middle of a shorter video', () => {
    expect(posterArgs(42, 'v.mp4', 'p.jpg')).toEqual(expect.arrayContaining(['-ss', '1.00', '-frames:v', '1']));
    expect(posterArgs(0.5, 'v.mp4', 'p.jpg')).toEqual(expect.arrayContaining(['-ss', '0.25']));
  });

  it('finds the tools: the env vars first, never the dev packages in production', () => {
    expect(ffTools({ FFMPEG_PATH: '/x/ffmpeg', FFPROBE_PATH: '/x/ffprobe' })).toEqual({ ffmpeg: '/x/ffmpeg', ffprobe: '/x/ffprobe' });
    expect(ffTools({ NODE_ENV: 'production' })).toEqual({ ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' });
  });
});
