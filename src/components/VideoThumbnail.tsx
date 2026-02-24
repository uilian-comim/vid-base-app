import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { convertFileSrc } from '@tauri-apps/api/core';
import { cn } from "@/lib/utils";

interface VideoThumbnailProps {
  filePath: string;
  time: number;
  className?: string;
  maxWidth?: number;
}

export default function VideoThumbnail({ filePath, time, className, maxWidth = 320 }: VideoThumbnailProps) {
  const { t } = useTranslation();
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    let video: HTMLVideoElement | null = document.createElement('video');
    const canvas = document.createElement('canvas');
    
    video.src = convertFileSrc(filePath);
    video.crossOrigin = 'anonymous';
    video.currentTime = time;
    video.muted = true;
    video.preload = 'metadata';

    const onSeeked = () => {
      if (!video) return;
      
      const scale = Math.min(1, maxWidth / video.videoWidth);
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setThumbnail(dataUrl);
        } catch (e) {
          console.error("Failed to generate thumbnail", e);
        }
      }
      
      // Cleanup
      video.remove();
      video = null;
    };

    const onLoadedMetadata = () => {
      if (video) {
        // Ensure we don't seek past duration
        const seekTime = Math.min(time, video.duration);
        video.currentTime = seekTime;
      }
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('seeked', onSeeked);
    
    return () => {
      if (video) {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('seeked', onSeeked);
        video.remove();
        video.pause();
        video.removeAttribute('src'); // Helper to stop loading
        video.load();
        video = null;
      }
    };
  }, [filePath, time, maxWidth]);

  if (thumbnail) {
    return <img src={thumbnail} alt={t('thumbnail.alt')} className={className} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  
  return (
    <div className={cn("flex items-center justify-center bg-card text-muted-foreground text-3xl", className)} style={{ width: '100%', height: '100%' }}>
      🎬
    </div>
  );
}
