import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { setPriority } from 'node:os';

// Listing videos (phase 26) go through ffmpeg: every stored video is an H.264 MP4 that phones and
// browsers play, with the moov atom first so playback starts before the whole file arrives.

/** Where ffmpeg and ffprobe are: the env vars, else the dev packages outside production, else the PATH. */
export function ffTools(env: { NODE_ENV?: string; FFMPEG_PATH?: string; FFPROBE_PATH?: string } = process.env): { ffmpeg: string; ffprobe: string } {
  const dev = (pkg: string): string | undefined => {
    if (env.NODE_ENV === 'production') return undefined;
    try {
      return (createRequire(import.meta.url)(pkg) as { path: string }).path;
    } catch {
      return undefined;
    }
  };
  return {
    ffmpeg: env.FFMPEG_PATH || dev('@ffmpeg-installer/ffmpeg') || 'ffmpeg',
    ffprobe: env.FFPROBE_PATH || dev('@ffprobe-installer/ffprobe') || 'ffprobe',
  };
}

/** What ffprobe says about a file: its first video stream, its first audio stream's codec, its length. */
export type VideoProbe = {
  codec: string;
  pixFmt: string;
  /** As stored; a phone video filmed upright is often stored sideways with a 90° rotation. */
  width: number;
  height: number;
  /** As shown: width and height swapped when the rotation is a quarter turn. */
  shown: { width: number; height: number };
  audio: string | null;
  durationS: number;
  container: string;
};

type ProbeJson = {
  streams?: {
    codec_type?: string;
    codec_name?: string;
    pix_fmt?: string;
    width?: number;
    height?: number;
    tags?: { rotate?: string };
    side_data_list?: { rotation?: number }[];
  }[];
  format?: { duration?: string; format_name?: string };
};

/** Runs a tool at the lowest CPU priority: the server is shared, and a conversion must never slow the neighbour. */
export function run(file: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(file, args, { timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (err, stdout) =>
      err ? reject(err) : resolve(stdout),
    );
    if (child.pid) {
      try {
        setPriority(child.pid, 19);
      } catch {
        // Not allowed here (some containers): it still runs, at normal priority.
      }
    }
  });
}

/** Reads a file's streams; undefined when it is not a video ffprobe can read. */
export async function probe(ffprobe: string, file: string): Promise<VideoProbe | undefined> {
  let json: ProbeJson;
  try {
    json = JSON.parse(await run(ffprobe, ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], 30_000)) as ProbeJson;
  } catch {
    return undefined;
  }
  const v = json.streams?.find((s) => s.codec_type === 'video' && s.width && s.height);
  const durationS = Number(json.format?.duration);
  if (!v || !Number.isFinite(durationS) || durationS <= 0) return undefined;
  const rotation = Math.abs(Number(v.tags?.rotate ?? v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0)) % 180;
  const [width, height] = [v.width!, v.height!];
  return {
    codec: v.codec_name ?? '',
    pixFmt: v.pix_fmt ?? '',
    width,
    height,
    shown: rotation === 90 ? { width: height, height: width } : { width, height },
    audio: json.streams?.find((s) => s.codec_type === 'audio')?.codec_name ?? null,
    durationS,
    container: json.format?.format_name ?? '',
  };
}

/** Videos up to this many pixels on the longest side are kept as they are when already H.264. */
export const VIDEO_KEEP_PX = 1920;

/** Converted videos get at most this many pixels on the longest side. */
export const VIDEO_CONVERT_PX = 1280;

/**
 * An H.264 (8-bit 4:2:0) MP4 or MOV up to 1920 px plays everywhere: it is copied, not re-encoded,
 * which takes seconds. Anything else (HEVC from newer iPhones, 4K, other codecs) is converted.
 */
export const canCopy = (p: VideoProbe): boolean =>
  p.codec === 'h264' && p.pixFmt === 'yuv420p' && Math.max(p.width, p.height) <= VIDEO_KEEP_PX && /mov|mp4/.test(p.container);

/**
 * The ffmpeg arguments that write `output`: the first video stream and the first audio stream if
 * there is one, no metadata (a phone video carries where it was filmed), and the index first.
 */
export function convertArgs(p: VideoProbe, input: string, output: string): string[] {
  const audio = p.audio === null ? ['-an'] : p.audio === 'aac' ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '128k', '-ac', '2'];
  const px = VIDEO_CONVERT_PX;
  const video = canCopy(p)
    ? ['-c:v', 'copy']
    : [
        '-vf',
        `scale='trunc(min(1,${px}/max(iw,ih))*iw/2)*2':'trunc(min(1,${px}/max(iw,ih))*ih/2)*2'`,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '26',
        '-pix_fmt',
        'yuv420p',
        '-threads',
        '1',
      ];
  return ['-v', 'error', '-y', '-i', input, '-map', '0:v:0', '-map', '0:a:0?', ...video, ...audio, '-map_metadata', '-1', '-movflags', '+faststart', '-f', 'mp4', output];
}

/** One frame, early on but not the black first one, as a JPEG at `output`. */
export function posterArgs(durationS: number, input: string, output: string): string[] {
  const at = Math.min(1, durationS / 2).toFixed(2);
  return ['-v', 'error', '-y', '-ss', at, '-i', input, '-frames:v', '1', '-q:v', '3', '-f', 'image2', output];
}
