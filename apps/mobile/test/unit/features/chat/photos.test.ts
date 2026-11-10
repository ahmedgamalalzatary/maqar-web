import type { ImagePickerAsset } from 'expo-image-picker';
import { preparePhotos } from '@/features/chat/photos';

const asset = (width: number, height: number) => ({ uri: 'file:///picked.jpg', width, height }) as ImagePickerAsset;

describe('Photos to send', () => {
  // Expo's fetch (the app's global fetch since SDK 52) cannot send React Native's { uri } parts:
  // each part must carry its bytes, as a Blob does.
  it('are JPEG parts that carry their bytes, not a bare uri', async () => {
    const [part, second] = await preparePhotos([asset(3000, 2000), asset(800, 600)]);
    expect(part).toMatchObject({ name: 'photo-1.jpg', type: 'image/jpeg' });
    expect(typeof part!.bytes).toBe('function');
    expect(part).not.toHaveProperty('uri');
    expect(second!.name).toBe('photo-2.jpg');
  });
});
