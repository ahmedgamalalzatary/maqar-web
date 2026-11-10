import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';

/** The longest side photos are sent at; the server keeps the same. */
const MAX_PX = 1600;

/**
 * Picked photos, made small enough to send (contract §8.12): at most 1600 px on the longest side,
 * as JPEG. Four phone photos then stay well under the upload limit.
 */
export async function preparePhotos(assets: ImagePickerAsset[]): Promise<{ uri: string; name: string; type: string }[]> {
  return Promise.all(
    assets.map(async (a, i) => {
      const ctx = ImageManipulator.manipulate(a.uri);
      if (Math.max(a.width, a.height) > MAX_PX) ctx.resize(a.width >= a.height ? { width: MAX_PX } : { height: MAX_PX });
      const image = await ctx.renderAsync();
      const saved = await image.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
      return { uri: saved.uri, name: `photo-${i + 1}.jpg`, type: 'image/jpeg' };
    }),
  );
}
