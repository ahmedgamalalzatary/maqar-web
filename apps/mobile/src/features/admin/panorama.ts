import { PANO_SIZE } from '@maqar/shared';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import type { PhotoPart } from '@/features/chat/photos';

/**
 * A picked 360° panorama as a form part (phase 21): scaled on the phone to the size the server
 * keeps (4096×2048) and saved as JPEG, so a sharper camera file uploads in seconds, not minutes.
 * The caller has already checked it is 2:1 and big enough (`panoramaProblem`).
 */
export async function preparePanorama(asset: ImagePickerAsset): Promise<PhotoPart> {
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (asset.width !== PANO_SIZE.width || asset.height !== PANO_SIZE.height) ctx.resize({ width: PANO_SIZE.width, height: PANO_SIZE.height });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.88, format: SaveFormat.JPEG });
  return { name: 'pano.jpg', type: 'image/jpeg', bytes: () => new File(saved.uri).bytes() };
}
