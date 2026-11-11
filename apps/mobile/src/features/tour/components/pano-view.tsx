import { Asset } from 'expo-asset';
import { type ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { DeviceMotion } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import { Txt } from '@/components/text';
import { basis, clampView, dragBy, LAT_MAX, project, START_VIEW, type View as Look, zoomBy } from '../pano-math';

/** A dot leading to another room. `label` is shown; `a11yLabel` is what screen readers say. */
export type Hotspot = { key: string; label: string; a11yLabel: string; lon: number; lat: number };

type Props = {
  /** The room's panorama (an absolute URL). Changing it cross-fades to the new room. */
  uri: string;
  hotspots: Hotspot[];
  onHotspot: (key: string) => void;
  /** Look around by moving the phone. */
  gyro: boolean;
  onLoading?: (loading: boolean) => void;
  /** The room failed to load, or the viewer itself failed to start. */
  onError?: () => void;
  /** The heading in whole degrees, for the compass. */
  onHeading?: (deg: number) => void;
  /** The first touch: the screen hides its hint. */
  onTouch?: () => void;
};

// One full-screen triangle pair. Each pixel finds its direction from the camera and reads the
// equirectangular photo there, so the panorama needs no sphere mesh (contract §8.6).
const VERTEX = `
attribute vec2 aPos;
varying vec2 vPos;
void main() { vPos = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }`;

// Must match pano-math.ts: lon around the horizon from +x towards +z, lat up, v = 0 at the top.
const FRAGMENT = `
precision highp float;
varying vec2 vPos;
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uMix;
uniform vec3 uF;
uniform vec3 uR;
uniform vec3 uU;
uniform vec2 uTan;
const float PI = 3.14159265359;
void main() {
  vec3 d = normalize(uF + vPos.x * uTan.x * uR + vPos.y * uTan.y * uU);
  vec2 uv = vec2(fract(atan(d.z, d.x) / (2.0 * PI)), 0.5 - asin(clamp(d.y, -1.0, 1.0)) / PI);
  gl_FragColor = mix(texture2D(uB, uv), texture2D(uA, uv), uMix);
}`;

/** Fades between rooms over about 22 frames, like the demo. */
const FADE_STEP = 0.045;
/** Inertia after a drag, per frame. */
const FRICTION = 0.93;
/** Below this many degrees per frame the drift stops. */
const MIN_SPEED = 0.002;
/** The slow turn before the first touch, in degrees per frame. */
const IDLE_TURN = 0.035;

type Gl = ExpoWebGLRenderingContext;

/** Loads a photo into a texture: an <img> on the web, a downloaded file on phones. */
async function loadTexture(gl: Gl, uri: string): Promise<WebGLTexture> {
  const source: unknown =
    Platform.OS === 'web'
      ? await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new (globalThis as unknown as { Image: typeof HTMLImageElement }).Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = uri;
        })
      : await Asset.fromURI(uri).downloadAsync();
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // Panoramas are 2:1 powers of two, so they can wrap around the seam where lon meets 360.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  // RGBA: on phones expo-gl always decodes the photo to 4 bytes a pixel, so as RGB every row was
  // read out of step and the room showed as a grey grid.
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);
  return tex;
}

function compile(gl: Gl, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
  return s;
}

/** The live state the render loop reads. Kept outside React so dragging never re-renders. */
type Live = {
  view: Look;
  vLon: number;
  vLat: number;
  dragging: boolean;
  touched: boolean;
  gyro: boolean;
  gyroLon0: number | null;
  size: { width: number; height: number };
};

/**
 * The 360° panorama (contract §8.6): drag with inertia, pinch zoom, the gyroscope, dots that lead to
 * other rooms, and a cross-fade between rooms. Drawn with expo-gl, so it runs on the phone's GPU.
 */
export function PanoView({ uri, hotspots, onHotspot, gyro, onLoading, onError, onHeading, onTouch }: Props) {
  const liveRef = useRef<Live>({
    view: START_VIEW,
    vLon: 0,
    vLat: 0,
    dragging: false,
    touched: false,
    gyro: false,
    gyroLon0: null,
    size: { width: 1, height: 1 },
  });
  const loadRoom = useRef<((uri: string) => void) | null>(null);
  // The latest props, for the render loop and the touch handlers (refs are read outside render only).
  const callbacks = useRef({ onLoading, onHeading, onTouch, onError, hotspots });
  useEffect(() => {
    callbacks.current = { onLoading, onHeading, onTouch, onError, hotspots };
  });
  // New rooms bring new dots, which must be placed even while the view is still.
  const hotspotsChanged = useRef(true);
  const hotspotKeys = hotspots.map((h) => h.key).join();
  useEffect(() => {
    hotspotsChanged.current = true;
  }, [hotspotKeys]);
  const [spots] = useState(() => new Map<string, { x: Animated.Value; y: Animated.Value; o: Animated.Value }>());
  const spot = (key: string) => {
    let s = spots.get(key);
    if (!s) spots.set(key, (s = { x: new Animated.Value(-1000), y: new Animated.Value(-1000), o: new Animated.Value(0) }));
    return s;
  };

  // A new room: fade to it from the one showing.
  useEffect(() => {
    loadRoom.current?.(uri);
  }, [uri]);

  // The gyroscope: the phone's heading turns the view, its tilt looks up and down.
  useEffect(() => {
    const live = liveRef.current;
    live.gyro = gyro;
    live.gyroLon0 = null;
    if (!gyro) return;
    live.touched = true;
    DeviceMotion.setUpdateInterval(16);
    const sub = DeviceMotion.addListener(({ rotation }) => {
      if (!rotation) return;
      const alpha = (rotation.alpha * 180) / Math.PI;
      const beta = (rotation.beta * 180) / Math.PI;
      live.gyroLon0 ??= live.view.lon + alpha;
      live.view = clampView({ ...live.view, lon: live.gyroLon0 - alpha, lat: Math.max(-LAT_MAX, Math.min(LAT_MAX, beta - 90)) });
    });
    return () => sub.remove();
  }, [gyro]);

  const pinch = useRef<{ dist: number; view: Look } | null>(null);
  const last = useRef({ x: 0, y: 0 });
  // Touch handlers for the scene: they only read refs when a finger moves, never while rendering.
  const touch: Pick<
    ViewProps,
    | 'onStartShouldSetResponder'
    | 'onMoveShouldSetResponder'
    | 'onResponderTerminationRequest'
    | 'onResponderGrant'
    | 'onResponderMove'
    | 'onResponderRelease'
    | 'onResponderTerminate'
  > = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e) => {
      const live = liveRef.current;
      live.dragging = true;
      live.vLon = live.vLat = 0;
      if (!live.touched) callbacks.current.onTouch?.();
      live.touched = true;
      last.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      pinch.current = null;
    },
    onResponderMove: (e) => {
      const live = liveRef.current;
      const touches = e.nativeEvent.touches;
      if (touches.length >= 2) {
        const [a, b] = touches;
        const dist = Math.hypot(a!.pageX - b!.pageX, a!.pageY - b!.pageY);
        pinch.current ??= { dist, view: live.view };
        live.view = zoomBy({ ...live.view, fov: pinch.current.view.fov }, dist / pinch.current.dist);
        return;
      }
      const { pageX, pageY } = e.nativeEvent;
      const dx = pageX - last.current.x;
      const dy = pageY - last.current.y;
      last.current = { x: pageX, y: pageY };
      if (pinch.current || live.gyro) return; // a finger lifted mid-pinch, or the phone steers
      const next = dragBy(live.view, dx, dy);
      live.vLon = next.lon - live.view.lon;
      live.vLat = next.lat - live.view.lat;
      if (Math.abs(live.vLon) > 180) live.vLon -= Math.sign(live.vLon) * 360; // across 0°/360°
      live.view = next;
    },
    onResponderRelease: () => {
      const live = liveRef.current;
      live.dragging = false;
      pinch.current = null;
    },
    onResponderTerminate: () => {
      const live = liveRef.current;
      live.dragging = false;
      pinch.current = null;
    },
  };

  const onContextCreate = async (gl: Gl) => {
    try {
      await startViewer(gl);
    } catch {
      callbacks.current.onLoading?.(false);
      callbacks.current.onError?.();
    }
  };

  const startViewer = async (gl: Gl) => {
    const live = liveRef.current;
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    gl.useProgram(program);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const at = (name: string) => gl.getUniformLocation(program, name);
    const u = { a: at('uA'), b: at('uB'), mix: at('uMix'), f: at('uF'), r: at('uR'), up: at('uU'), tan: at('uTan') };
    gl.uniform1i(u.a, 0);
    gl.uniform1i(u.b, 1);

    let front: WebGLTexture | null = null;
    let back: WebGLTexture | null = null;
    let fade = 1;
    let wanted = '';
    let stopped = false;
    loadRoom.current = (next: string) => {
      wanted = next;
      callbacks.current.onLoading?.(true);
      loadTexture(gl, next)
        .then((tex) => {
          if (stopped || next !== wanted) return void gl.deleteTexture(tex); // a newer room was picked
          if (back) gl.deleteTexture(back);
          back = front;
          front = tex;
          fade = back ? 0 : 1;
          live.view = { ...live.view, lat: 0 };
          callbacks.current.onLoading?.(false);
        })
        .catch(() => {
          callbacks.current.onLoading?.(false);
          // The old room's picture must not pass for the one that failed.
          if (!stopped && next === wanted) callbacks.current.onError?.();
        });
    };
    loadRoom.current(uri);

    let lastHeading = -1;
    let drawn = '';
    const frame = () => {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      if (!live.dragging && !live.gyro) {
        live.view = clampView({ ...live.view, lon: live.view.lon + live.vLon + (live.touched ? 0 : IDLE_TURN), lat: live.view.lat + live.vLat });
        // Slow down, then stop once the drift is too small to see.
        live.vLon = Math.abs(live.vLon) < MIN_SPEED ? 0 : live.vLon * FRICTION;
        live.vLat = Math.abs(live.vLat) < MIN_SPEED ? 0 : live.vLat * FRICTION;
      }
      if (fade < 1) fade = Math.min(1, fade + FADE_STEP);
      // Nothing moved since the last frame: keep it, and spare the battery.
      const state = `${live.view.lon},${live.view.lat},${live.view.fov},${fade},${live.size.width}x${live.size.height},${front ? 1 : 0}`;
      if (state === drawn && !hotspotsChanged.current) return;
      drawn = state;
      hotspotsChanged.current = false;

      const { width, height } = live.size;
      const tanV = Math.tan(((live.view.fov / 2) * Math.PI) / 180);
      const { f, r, u: up } = basis(live.view);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(0.016, 0.082, 0.145, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (front) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, front);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, back ?? front);
        gl.uniform1f(u.mix, fade);
        gl.uniform3f(u.f, ...f);
        gl.uniform3f(u.r, ...r);
        gl.uniform3f(u.up, ...up);
        gl.uniform2f(u.tan, tanV * (width / height), tanV);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      gl.flush();
      gl.endFrameEXP();

      // The dots that lead to other rooms follow the view; hidden when out of sight.
      for (const h of callbacks.current.hotspots) {
        const s = spot(h.key);
        const p = front ? project(h, live.view, live.size) : null;
        s.x.setValue(p ? p.x : -1000);
        s.y.setValue(p ? p.y : -1000);
        s.o.setValue(p ? Math.min(1, (p.facing - 0.15) * 3) * fade : 0);
      }
      const heading = Math.round(live.view.lon) % 360;
      if (heading !== lastHeading) {
        lastHeading = heading;
        callbacks.current.onHeading?.(heading);
      }
    };
    let raf = requestAnimationFrame(frame);
    cleanup.current = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      loadRoom.current = null;
      if (front) gl.deleteTexture(front);
      if (back) gl.deleteTexture(back);
    };
  };
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        liveRef.current.size = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height };
      }}
    >
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} testID="pano" />
      {/* On the web, the browser must not scroll or zoom the page while a finger turns the room. */}
      <View style={[StyleSheet.absoluteFill, Platform.OS === 'web' && ({ touchAction: 'none' } as object)]} {...touch} testID="pano-touch" />
      {hotspots.map((h) => {
        const s = spot(h.key);
        return (
          <Animated.View
            key={h.key}
            pointerEvents="box-none"
            style={[styles.spot, { opacity: s.o, transform: [{ translateX: s.x }, { translateY: s.y }] }]}
          >
            <Pressable accessibilityRole="button" accessibilityLabel={h.a11yLabel} onPress={() => onHotspot(h.key)} style={styles.spotInner} hitSlop={8}>
              <View style={styles.ring}>
                <View style={styles.dot} />
              </View>
              <View style={styles.label}>
                <Txt size={12} weight="medium" style={styles.white} numberOfLines={1}>
                  {h.label}
                </Txt>
              </View>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const SPOT_W = 160;
const SPOT_H = 76;
const RING = 40;

const styles = StyleSheet.create({
  // The ring's centre sits on the point: half the box's width across, half the ring's height down.
  spot: { position: 'absolute', left: -SPOT_W / 2, top: -RING / 2, width: SPOT_W, height: SPOT_H, alignItems: 'center' },
  spotInner: { alignItems: 'center', gap: 6 },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  label: { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  white: { color: '#fff' },
});
