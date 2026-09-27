// Resizes to the PRD's largest media tier (2000px, see §9 Media) and
// re-encodes as WebP where the browser supports it — smaller payload means
// a faster upload, on top of the presigned direct-to-S3 path doing the file
// transfer in one hop instead of two.
const MAX_DIMENSION = 2000;
const QUALITY = 0.82;

export async function compressImage(file: File): Promise<{ blob: Blob; contentType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { blob: file, contentType: file.type };
  ctx.drawImage(bitmap, 0, 0, width, height);

  const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", QUALITY));
  if (webp) return { blob: webp, contentType: "image/webp" };

  // Browser doesn't support WebP encoding — fall back to JPEG, still resized.
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  return jpeg ? { blob: jpeg, contentType: "image/jpeg" } : { blob: file, contentType: file.type };
}

// fetch() has no upload-progress event — XHR is the only way to get one for
// a PUT request body, so the progress bar needs this instead of fetch.
export function uploadToS3(url: string, blob: Blob, contentType: string, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("S3 upload failed: network error"));
    xhr.send(blob);
  });
}
