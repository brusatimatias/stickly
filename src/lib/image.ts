/**
 * Downscales/crops an image file to a square JPEG data URL, centered and
 * cropped to fill the target size (cover behavior, like CSS `object-fit: cover`).
 */
export function resizeImageToDataUrl(
  file: File,
  targetSize: number,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }

      const scale = Math.max(targetSize / image.width, targetSize / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      ctx.drawImage(
        image,
        (targetSize - drawWidth) / 2,
        (targetSize - drawHeight) / 2,
        drawWidth,
        drawHeight
      );
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => reject(new Error("Could not read image"));
    image.src = URL.createObjectURL(file);
  });
}
