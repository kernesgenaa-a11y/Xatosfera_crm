import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { ChevronLeft, ChevronRight, FileText, X } from 'lucide-react';
import { getImageSources } from '@/lib/image-sources';

interface PropertyPhotoViewerProps {
  photos: string[];
  photoIdx: number;
  isOpen: boolean;
  title: string;
  isUk: boolean;
  onClose: () => void;
  setPhotoIdx: Dispatch<SetStateAction<number>>;
}

export function PropertyPhotoViewer({
  photos,
  photoIdx,
  isOpen,
  title,
  isUk,
  onClose,
  setPhotoIdx,
}: PropertyPhotoViewerProps) {
  const [loadFull, setLoadFull] = useState(false);
  const imageSources = getImageSources(photos[photoIdx]);

  useEffect(() => {
    if (!isOpen) {
      setLoadFull(false);
      return;
    }

    setLoadFull(false);
    const timer = window.setTimeout(() => setLoadFull(true), 0);
    return () => window.clearTimeout(timer);
  }, [isOpen, photoIdx]);

  if (!isOpen || photos.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-2 backdrop-blur-sm sm:p-4">
      <button
        type="button"
        className="fixed right-3 top-3 z-[90] inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 py-2 text-white shadow-lg hover:bg-black/85 sm:right-4 sm:top-4"
        onClick={onClose}
        aria-label={isUk ? 'Закрити перегляд фото' : 'Close photo viewer'}
      >
        <X className="h-5 w-5" />
        <span className="hidden text-sm font-medium sm:inline">{isUk ? 'Закрити' : 'Close'}</span>
      </button>
      <div className="relative w-full max-w-5xl">
        {imageSources.detail ? (
          <img
            src={loadFull ? imageSources.full : imageSources.detail}
            srcSet={`${imageSources.detail} 1200w, ${imageSources.full} 2400w`}
            sizes="100vw"
            alt={`${title} фото ${photoIdx + 1}`}
            className="max-h-[86dvh] w-full rounded-lg object-contain"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-[70dvh] w-full items-center justify-center rounded-lg bg-muted">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setPhotoIdx((idx) => (idx - 1 + photos.length) % photos.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white hover:bg-black/75 sm:left-3"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => setPhotoIdx((idx) => (idx + 1) % photos.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white hover:bg-black/75 sm:right-3"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
              {photoIdx + 1} / {photos.length}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
