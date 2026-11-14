import { BadRequestException, Injectable } from '@nestjs/common';
import { type AppSettings, calculatorProblem, DEFAULT_APP_SETTINGS, homeSectionOrder, SPLASH_VIDEO_MAX_SECONDS, type SplashSettings, splashProblem } from '@maqar/shared';
import { eq, sql } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { propertyVideos } from '../properties/properties.schema.js';
import { UploadsService } from '../uploads/uploads.service.js';
import type { SettingsDto, SplashDto } from './dto/settings.dto.js';
import { appSettings } from './settings.schema.js';

const isVideo = (path: string | null): path is string => !!path && path.startsWith('/uploads/videos/');

/** The app's settings (phase 29): read by everyone, changed by an admin. */
@Injectable()
export class SettingsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly uploads: UploadsService,
  ) {}

  /** The saved settings over the defaults, so a part added later always has a value. */
  async get(): Promise<AppSettings> {
    const [row] = await this.db.select().from(appSettings).where(eq(appSettings.id, 1));
    return this.merged(row?.value);
  }

  private merged(v: Partial<AppSettings> | undefined): AppSettings {
    return {
      splash: { ...DEFAULT_APP_SETTINGS.splash, ...v?.splash },
      calculator: { ...DEFAULT_APP_SETTINGS.calculator, ...v?.calculator },
      home: { sections: homeSectionOrder(v?.home?.sections ?? []) },
    };
  }

  /**
   * Changes only the parts sent. The parts are checked first; then the row is read, merged and
   * written under a lock, so two admins saving different parts at once both keep theirs.
   */
  async update(body: SettingsDto): Promise<AppSettings> {
    const parts: Partial<AppSettings> = {};
    if (body.calculator) {
      const problem = calculatorProblem(body.calculator);
      if (problem === 'down') throw new BadRequestException('The least down payment is 0 to 50 percent, in steps of 5');
      if (problem === 'years') throw new BadRequestException('The years go from 1 to 30, and the least cannot be more than the most');
      parts.calculator = { minDownPct: body.calculator.minDownPct, minYears: body.calculator.minYears, maxYears: body.calculator.maxYears };
    }
    if (body.home) parts.home = { sections: homeSectionOrder(body.home.sections) };
    if (body.splash) parts.splash = await this.splash(body.splash);

    const { cur, next } = await this.db.transaction(async (tx) => {
      // The row exists before it is locked, so even the first two saves queue on it.
      await tx.insert(appSettings).values({ id: 1, value: DEFAULT_APP_SETTINGS }).onDuplicateKeyUpdate({ set: { id: sql`id` } });
      const [row] = await tx.select().from(appSettings).where(eq(appSettings.id, 1)).for('update');
      const cur = this.merged(row?.value);
      const next: AppSettings = { ...cur, ...parts };
      await tx.update(appSettings).set({ value: next }).where(eq(appSettings.id, 1));
      return { cur, next };
    });
    // A video the opening screen no longer plays is deleted, unless a listing plays it too.
    const old = cur.splash.media;
    if (isVideo(old) && old !== next.splash.media) {
      const [used] = await this.db.select({ id: propertyVideos.id }).from(propertyVideos).where(eq(propertyVideos.url, old)).limit(1);
      if (!used) await this.uploads.removeVideoFiles([old]);
    }
    return next;
  }

  /** The opening screen as saved: a picture for `image`, a video of at most 3 seconds (with its poster) for `video`. */
  private async splash(s: SplashDto): Promise<SplashSettings> {
    const text = { textAr: s.textAr, textEn: s.textEn };
    if (s.kind === 'none') return { kind: 'none', media: null, poster: null, ...text };
    if (splashProblem(s) === 'media') throw new BadRequestException('Add the picture or the video');
    const media = s.media!;
    if (s.kind === 'image') {
      if (isVideo(media)) throw new BadRequestException('That is a video: pick the video kind');
      return { kind: 'image', media, poster: null, ...text };
    }
    if (!isVideo(media)) throw new BadRequestException('That is a picture: pick the picture kind');
    const [video] = await this.uploads.videoDetails([media], SPLASH_VIDEO_MAX_SECONDS + 0.5);
    return { kind: 'video', media, poster: video!.poster, ...text };
  }
}
