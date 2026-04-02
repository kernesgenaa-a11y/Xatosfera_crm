function replaceExtensionWithAvif(filename: string): string {
  return filename.replace(/\.[^.]+$/, '') + '.avif';
}

let watermarkBitmap: ImageBitmap | null = null;
let watermarkBitmapPromise: Promise<ImageBitmap> | null = null;

type CanvasLike = OffscreenCanvas | HTMLCanvasElement;
type CanvasContextLike = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function createCanvas(width: number, height: number): CanvasLike {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getCanvasContext(canvas: CanvasLike): CanvasContextLike | null {
  return canvas.getContext('2d');
}

async function canvasToBlob(canvas: CanvasLike): Promise<Blob | null> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: 'image/avif', quality: 0.82 });
  }

  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/avif', 0.82));
}

async function getWatermarkBitmap(url: string): Promise<ImageBitmap> {
  if (watermarkBitmap) return watermarkBitmap;
  if (!watermarkBitmapPromise) {
    watermarkBitmapPromise = fetch(url)
      .then((res) => res.blob())
      .then((blob) => createImageBitmap(blob))
      .then((bitmap) => {
        watermarkBitmap = bitmap;
        return bitmap;
      })
      .catch((error) => {
        watermarkBitmapPromise = null;
        throw error;
      });
  }

  return watermarkBitmapPromise;
}

export async function addWatermarkToImage(file: File, watermarkUrl: string): Promise<File> {
  const [imageBitmap, loadedWatermarkBitmap] = await Promise.all([
    createImageBitmap(file),
    getWatermarkBitmap(watermarkUrl),
  ]);

  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(imageBitmap.width, imageBitmap.height));
  const targetWidth = Math.max(1, Math.round(imageBitmap.width * scale));
  const targetHeight = Math.max(1, Math.round(imageBitmap.height * scale));
  const canvas = createCanvas(targetWidth, targetHeight);
  const ctx = getCanvasContext(canvas);
  if (!ctx) {
    imageBitmap.close();
    return file;
  }

  try {
    ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);

    const watermarkTargetWidth = targetWidth / 3;
    const wmRatio = loadedWatermarkBitmap.width / loadedWatermarkBitmap.height;
    const wmWidth = Math.min(watermarkTargetWidth, targetWidth);
    const wmHeight = wmWidth / wmRatio;
    const pad = Math.max(12, targetWidth * 0.015);

    ctx.globalAlpha = 0.8;
    ctx.drawImage(
      loadedWatermarkBitmap,
      targetWidth - wmWidth - pad,
      targetHeight - wmHeight - pad,
      wmWidth,
      wmHeight,
    );
    ctx.globalAlpha = 1;

    const blob = await canvasToBlob(canvas);
    if (!blob) return file;

    return new File([blob], replaceExtensionWithAvif(file.name), {
      type: 'image/avif',
      lastModified: Date.now(),
    });
  } finally {
    imageBitmap.close();
  }
}
