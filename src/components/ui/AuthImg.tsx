/**
 * AuthImg — <img> що завантажує зображення напряму через URL /api/files.
 * Токен додається у query, тому браузер може ефективно кешувати через HTTP cache headers.
 */
import { useAuthImage } from '@/hooks/useAuthImage';
import { cn } from '@/lib/utils';

interface AuthImgProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  fileKey: string | null | undefined;
  fallback?: React.ReactNode;
}

export function AuthImg({ fileKey, fallback, className, alt, ...rest }: AuthImgProps) {
  const src = useAuthImage(fileKey);

  if (!src) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div
        className={cn(
          'bg-muted flex items-center justify-center text-muted-foreground text-xs',
          className,
        )}
      >
        {alt ?? '…'}
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} loading="lazy" {...rest} />;
}
