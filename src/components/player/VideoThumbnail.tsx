import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { convertFileSrc } from '@tauri-apps/api/core';
import { cn } from "@/lib/utils";
import { needsServerPlayback, thumbnailUrl } from '../../lib/mediaServer';

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
    // Containers the webview can't decode get their frame from ffmpeg instead.
    if (needsServerPlayback(filePath)) {
      setThumbnail(thumbnailUrl(filePath, time, maxWidth));
      return;
    }
    setThumbnail(null);

    let video: HTMLVideoElement | null = document.createElement('video');
    const canvas = document.createElement('canvas');
    
    video.src = convertFileSrc(filePath);
    video.crossOrigin = 'anonymous';
    video.currentTime = time;
    video.muted = true;
    // Extra safety locks
    video.volume = 0;
    video.autoplay = false;
    video.playsInline = true;
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
      
      // Cleanup aggressively to prevent ghost playback leaks
      try {
        video.pause();
        video.volume = 0;
        video.muted = true;
        video.removeAttribute('src');
        video.src = '';
        video.load();
      } catch (e) {}
      
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

    // e.g. an MP4 with HEVC on a webview without an HEVC decoder.
    const onError = () => setThumbnail(thumbnailUrl(filePath, time, maxWidth));

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    
    return () => {
      if (video) {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        video.remove();
        
        try {
          video.pause();
          video.volume = 0;
          video.muted = true;
          video.removeAttribute('src');
          video.src = '';
          video.load();
        } catch (e) {}
        
        video = null;
      }
    };
  }, [filePath, time, maxWidth]);

  if (thumbnail) {
    return <img src={thumbnail} alt={t('thumbnail.alt')} className={className} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setThumbnail(null)} />;
  }
  
  return (
    <div className={cn("flex items-center justify-center bg-card text-muted-foreground text-3xl", className)} style={{ width: '100%', height: '100%' }}>
      🎬
    </div>
  );
}
