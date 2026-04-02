function replaceExtensionWithAvif(filename: string): string {
  return filename.replace(/\.[^.]+$/, '') + '.avif';
}

export async function convertImageToAvif(file: File, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/avif') return file;

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/avif', quality),
  );
  if (!blob) return file;

  return new File([blob], replaceExtensionWithAvif(file.name), {
    type: 'image/avif',
    lastModified: Date.now(),
  });
}
