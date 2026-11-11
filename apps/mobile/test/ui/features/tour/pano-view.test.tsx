import { render, waitFor } from '@testing-library/react-native';
import { PanoView } from '@/features/tour/components/pano-view';

// A stand-in WebGL context: every method is a mock, every constant is its own name.
const mockGl = new Proxy({} as Record<string, unknown>, {
  get(target, key: string) {
    if (!(key in target)) {
      target[key] =
        key === 'getShaderParameter'
          ? jest.fn(() => true)
          : /^[A-Z_0-9]+$/.test(key)
            ? key
            : key === 'drawingBufferWidth' || key === 'drawingBufferHeight'
              ? 1
              : jest.fn(() => ({}));
    }
    return target[key];
  },
});

jest.mock('expo-gl', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GLView: ({ onContextCreate, ...props }: { onContextCreate: (gl: unknown) => void }) => {
      React.useEffect(() => {
        onContextCreate(mockGl);
      }, []);
      return React.createElement(View, props);
    },
  };
});
jest.mock('expo-asset', () => ({ Asset: { fromURI: () => ({ downloadAsync: async () => ({ localUri: 'file:///pano.jpg' }) }) } }));
jest.mock('expo-sensors', () => ({ DeviceMotion: { setUpdateInterval: jest.fn(), addListener: jest.fn(() => ({ remove: jest.fn() })) } }));

// On phones expo-gl always decodes a photo to 4 bytes a pixel. Uploaded as RGB (3 bytes), every
// row was read out of step and the tour showed a grey grid instead of the room (seen on a phone).
it('uploads the panorama as RGBA, the layout expo-gl decodes photos into', async () => {
  render(<PanoView uri="https://maqar.test/pano.jpg" hotspots={[]} onHotspot={jest.fn()} gyro={false} />);
  await waitFor(() => expect(mockGl.texImage2D).toHaveBeenCalled());
  expect(mockGl.texImage2D).toHaveBeenCalledWith('TEXTURE_2D', 0, 'RGBA', 'RGBA', 'UNSIGNED_BYTE', expect.anything());
});
