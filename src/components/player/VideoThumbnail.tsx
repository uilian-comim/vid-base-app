import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from "@/lib/utils";
import { thumbnailUrl } from '../../lib/mediaServer';

interface VideoThumbnailProps {
  filePath: string;
  time: number;
  className?: string;
  maxWidth?: number;
}

// One observer for every thumbnail on screen. The margin starts loading slightly before a
// thumbnail scrolls into view.
const onVisible = new WeakMap<Element, () => void>();
let observer: IntersectionObserver | null = null;

function observeOnce(element: Element, callback: () => void): () => void {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        onVisible.get(entry.target)?.();
        onVisible.delete(entry.target);
        observer?.unobserve(entry.target);
      }
    },
    { rootMargin: '300px' },
  );
  onVisible.set(element, callback);
  observer.observe(element);
  return () => {
    onVisible.delete(element);
    observer?.unobserve(element);
  };
}

/**
 * A frame of the video, rendered by the media server (which caches it on disk). Nothing is
 * requested until the thumbnail is near the viewport, so long episode lists stay cheap.
 */
export default function VideoThumbnail({ filePath, time, className, maxWidth = 320 }: VideoThumbnailProps) {
  const { t } = useTranslation();
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  // Remembered per URL, so a different file or frame gets its own attempt.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = thumbnailUrl(filePath, time, maxWidth);

  useEffect(() => {
    if (visible || !placeholderRef.current) return;
    return observeOnce(placeholderRef.current, () => setVisible(true));
  }, [visible]);

  if (visible && failedSrc !== src) {
    return (
      <img
        src={src}
        alt={t('thumbnail.alt')}
        decoding="async"
        className={className}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={() => setFailedSrc(src)}
      />
    );
  }

  return (
    <div
      ref={placeholderRef}
      className={cn("flex items-center justify-center bg-card text-muted-foreground text-3xl", className)}
      style={{ width: '100%', height: '100%' }}
    >
      🎬
    </div>
  );
}
