"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Room } from "@/lib/data";

export type Hotspot = { roomId: string; label: string; lon: number; lat: number };

type Props = {
  room: Room;
  hotspots: Hotspot[];
  onHotspot: (roomId: string) => void;
  gyro: boolean;
  onProgress?: (loading: boolean) => void;
  onHeading?: (deg: number) => void;
};

/**
 * Lightweight equirectangular 360° viewer.
 * Drag to look (with inertia), pinch or wheel to zoom, optional gyroscope.
 */
export function PanoViewer({ room, hotspots, onHotspot, gyro, onProgress, onHeading }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const hotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const api = useRef<{ load: (url: string) => void; setGyro: (on: boolean) => void } | null>(null);
  const hotspotsRef = useRef(hotspots);
  const headingCb = useRef(onHeading);
  const progressCb = useRef(onProgress);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hotspotsRef.current = hotspots;
    headingCb.current = onHeading;
    progressCb.current = onProgress;
  });

  useEffect(() => {
    const el = mount.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, el.clientWidth / el.clientHeight, 1, 1100);
    const geo = new THREE.SphereGeometry(500, 64, 40);
    geo.scale(-1, 1, 1);

    const makeMesh = () => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      scene.add(m);
      return m;
    };
    let front = makeMesh();
    let back = makeMesh();
    let fade = 1;

    const loader = new THREE.TextureLoader();
    const load = (url: string) => {
      progressCb.current?.(true);
      loader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        [front, back] = [back, front];
        const mat = front.material as THREE.MeshBasicMaterial;
        mat.map?.dispose();
        mat.map = tex;
        mat.needsUpdate = true;
        mat.opacity = 0;
        front.renderOrder = 2;
        back.renderOrder = 1;
        fade = 0;
        lat = 0;
        setReady(true);
        progressCb.current?.(false);
      });
    };

    let lon = 90,
      lat = 0,
      vLon = 0,
      vLat = 0,
      fov = 75,
      dragging = false,
      touched = false,
      gyroOn = false,
      gyroLon0: number | null = null,
      lastX = 0,
      lastY = 0,
      pinch0 = 0,
      fov0 = 75;
    const pointers = new Map<number, { x: number; y: number }>();

    const down = (e: PointerEvent) => {
      renderer.domElement.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      touched = true;
      if (pointers.size === 1) {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        vLon = vLat = 0;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
        fov0 = fov;
      }
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        fov = THREE.MathUtils.clamp(fov0 * (pinch0 / d), 35, 95);
        return;
      }
      if (!dragging || gyroOn) return;
      const k = (fov / 75) * 0.18;
      const dx = (lastX - e.clientX) * k;
      const dy = (e.clientY - lastY) * k;
      lon += dx;
      lat += dy;
      vLon = dx;
      vLat = dy;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) dragging = false;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      fov = THREE.MathUtils.clamp(fov + e.deltaY * 0.04, 35, 95);
    };
    const orient = (e: DeviceOrientationEvent) => {
      if (!gyroOn || e.alpha == null || e.beta == null) return;
      if (gyroLon0 === null) gyroLon0 = lon + e.alpha;
      lon = gyroLon0 - e.alpha;
      lat = THREE.MathUtils.clamp(e.beta - 90, -80, 80);
    };

    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", up);
    renderer.domElement.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("deviceorientation", orient);

    const resize = () => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const target = new THREE.Vector3();
    const v = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    const toVec = (lo: number, la: number, out: THREE.Vector3) => {
      const phi = THREE.MathUtils.degToRad(90 - la);
      const theta = THREE.MathUtils.degToRad(lo);
      return out.set(500 * Math.sin(phi) * Math.cos(theta), 500 * Math.cos(phi), 500 * Math.sin(phi) * Math.sin(theta));
    };

    let raf = 0;
    let lastHeading = -1;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!dragging && !gyroOn) {
        lon += vLon;
        lat += vLat;
        vLon *= 0.93;
        vLat *= 0.93;
        if (!touched) lon += 0.035;
      }
      lat = THREE.MathUtils.clamp(lat, -82, 82);
      camera.fov += (fov - camera.fov) * 0.18;
      camera.updateProjectionMatrix();
      camera.lookAt(toVec(lon, lat, target));

      if (fade < 1) {
        fade = Math.min(1, fade + 0.045);
        (front.material as THREE.MeshBasicMaterial).opacity = fade;
        const bm = back.material as THREE.MeshBasicMaterial;
        bm.opacity = bm.map ? 1 - fade * 0.999 : 0;
      } else {
        (front.material as THREE.MeshBasicMaterial).opacity = 1;
        (back.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      renderer.render(scene, camera);

      // place HTML hotspots
      camera.getWorldDirection(camDir);
      const w = el.clientWidth,
        h = el.clientHeight;
      hotspotsRef.current.forEach((hs, i) => {
        const node = hotRefs.current[i];
        if (!node) return;
        toVec(hs.lon, hs.lat, v);
        const facing = v.clone().normalize().dot(camDir);
        v.project(camera);
        if (facing < 0.15) {
          node.style.opacity = "0";
          node.style.pointerEvents = "none";
          return;
        }
        node.style.opacity = String(Math.min(1, (facing - 0.15) * 3) * fade);
        node.style.pointerEvents = "auto";
        node.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -50%)`;
      });
      const heading = Math.round((((lon % 360) + 360) % 360));
      if (heading !== lastHeading) {
        lastHeading = heading;
        headingCb.current?.(heading);
      }
    };
    tick();

    api.current = {
      load,
      setGyro: (on) => {
        gyroOn = on;
        gyroLon0 = null;
        touched = true;
      },
    };
    load(room.pano);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("deviceorientation", orient);
      renderer.dispose();
      geo.dispose();
      [front, back].forEach((m) => {
        const mat = m.material as THREE.MeshBasicMaterial;
        mat.map?.dispose();
        mat.dispose();
      });
      el.removeChild(renderer.domElement);
      api.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    api.current?.load(room.pano);
  }, [room.pano]);

  useEffect(() => {
    api.current?.setGyro(gyro);
  }, [gyro]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-navy">
      <div ref={mount} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0">
        {hotspots.map((h, i) => (
          <button
            key={room.id + h.roomId}
            ref={(n) => {
              hotRefs.current[i] = n;
            }}
            onClick={() => onHotspot(h.roomId)}
            className="group absolute left-0 top-0 flex flex-col items-center gap-1.5 opacity-0"
            style={{ transition: "opacity .2s" }}
          >
            <span className="relative grid size-12 place-items-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-white/30" />
              <span className="relative grid size-10 place-items-center rounded-full border-2 border-white bg-white/25 backdrop-blur-md">
                <span className="size-3 rounded-full bg-white" />
              </span>
            </span>
            <span className="whitespace-nowrap rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-medium text-white backdrop-blur-md">{h.label}</span>
          </button>
        ))}
      </div>
      {!ready && <div className="shimmer absolute inset-0 opacity-20" />}
    </div>
  );
}
