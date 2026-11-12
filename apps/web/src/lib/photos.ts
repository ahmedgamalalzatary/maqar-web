import { PANO_SIZE, panoramaProblem } from "@maqar/shared";

/** The longest side photos are sent at (the server keeps at most 2000). */
const MAX_PX = 2000;

/**
 * A picked photo made smaller in the browser before upload (contract §9.2): at most 2000 px on
 * the longest side, as JPEG. A file the browser cannot draw (HEIC on most browsers) is sent as it is.
 */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", 0.85));
  return blob ?? file;
}

/**
 * A picked 360° panorama checked and scaled in the browser (phase 21): it must be 2:1 and at least
 * 4096×2048, and is sent at exactly 4096×2048 as JPEG, the size the server keeps. Returns the
 * problem instead when it is not a panorama, or `unreadable` when the browser cannot draw it.
 */
export async function preparePanorama(file: File): Promise<Blob | "ratio" | "small" | "unreadable"> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return "unreadable";
  const problem = panoramaProblem(bitmap.width, bitmap.height);
  if (problem) {
    bitmap.close();
    return problem;
  }
  const canvas = document.createElement("canvas");
  canvas.width = PANO_SIZE.width;
  canvas.height = PANO_SIZE.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", 0.88));
  return blob ?? "unreadable";
}
