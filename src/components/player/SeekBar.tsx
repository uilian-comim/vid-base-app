import { memo, useEffect, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { cn } from "@/lib/utils";
import { formatTime } from '../../utils/utils';
import { seekPreviewUrl } from '../../lib/mediaServer';

type VideoRef = React.RefObject<HTMLVideoElement | null>;

const PREVIEW_HALF_WIDTH = 92;
// How long the pointer has to rest on a spot before the server is asked for that frame.
const PREVIEW_SETTLE_MS = 120;

/**
 * The video's current position, as state local to the caller. Subscribing here instead of
 * in the player view keeps `timeupdate` (several per second) from re-rendering the whole
 * player.
 */
function useVideoTime(videoRef: VideoRef): [number, (time: number) => void] {
  const [time, setTime] = useState(() => videoRef.current?.currentTime ?? 0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () => setTime(video.currentTime);
    update();
    video.addEventListener('timeupdate', update);
    video.addEventListener('seeking', update);
    return () => {
      video.removeEventListener('timeupdate', update);
      video.removeEventListener('seeking', update);
    };
  }, [videoRef]);

  return [time, setTime];
}

/** "12:34 / 45:00" label. */
export const PlaybackTime = memo(function PlaybackTime({ videoRef, duration }: { videoRef: VideoRef; duration: number }) {
  const [currentTime] = useVideoTime(videoRef);
  return <>{formatTime(currentTime)} / {formatTime(duration)}</>;
});

function useSettledValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

/** Preview frame from ffmpeg, for files the webview can't decode itself. */
function ServerPreview({ filePath, time, duration }: { filePath: string; time: number; duration: number }) {
  // Every distinct frame costs an ffmpeg process, so snap to a coarse grid (finer on short
  // videos) and wait for the pointer to settle instead of chasing every pixel of movement.
  const step = duration > 1800 ? 10 : duration > 300 ? 5 : 2;
  const frameTime = useSettledValue(Math.floor(time / step) * step, PREVIEW_SETTLE_MS);
  return <img src={seekPreviewUrl(filePath, frameTime, 360)} className="w-full h-full object-cover" alt="Preview" />;
}

/** Preview frame from a second, muted `<video>` of the same file. */
function NativePreview({ filePath, time }: { filePath: string; time: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const wantedRef = useRef(time);
  wantedRef.current = time;

  // One seek at a time: positions hovered while a seek is in flight are skipped, and the
  // latest one is applied when it lands.
  useEffect(() => {
    const video = ref.current;
    if (video && !video.seeking) video.currentTime = time;
  }, [time]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const catchUp = () => {
      if (Math.abs(video.currentTime - wantedRef.current) > 0.25) video.currentTime = wantedRef.current;
    };
    video.addEventListener('seeked', catchUp);
    video.addEventListener('loadedmetadata', catchUp);
    return () => {
      video.removeEventListener('seeked', catchUp);
      video.removeEventListener('loadedmetadata', catchUp);
      // Release the decoder and file handle right away instead of waiting for GC.
      video.removeAttribute('src');
      video.load();
    };
  }, []);

  return (
    <video
      ref={ref}
      src={convertFileSrc(filePath)}
      className="w-full h-full object-cover"
      muted
      preload="metadata"
      disablePictureInPicture
    />
  );
}

interface SeekBarProps {
  videoRef: VideoRef;
  duration: number;
  filePath: string;
  /** Seek previews come from ffmpeg when the webview can't decode the file itself. */
  useServerPreview: boolean;
}

/** Progress bar with scrubbing and a hover preview of the frame under the pointer. */
export const SeekBar = memo(function SeekBar({ videoRef, duration, filePath, useServerPreview }: SeekBarProps) {
  const [currentTime, setCurrentTime] = useVideoTime(videoRef);
  // The last hovered spot is kept after the pointer leaves, so the preview (and its video
  // element) stays mounted and isn't reloaded on every hover.
  const [preview, setPreview] = useState<{ time: number; left: number } | null>(null);
  const [hovering, setHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, x / rect.width));
    setPreview({
      time: fraction * (duration || 0),
      left: Math.max(PREVIEW_HALF_WIDTH, Math.min(x, rect.width - PREVIEW_HALF_WIDTH)),
    });
    setHovering(true);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  return (
    <div
      className="relative w-full h-1 bg-white/25 rounded-full cursor-pointer group mb-3 hover:h-1.5 transition-all"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHovering(false)}
    >
      {preview && (
        <div
          className={cn(
            "absolute bottom-8 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-xl p-1 flex-col items-center pointer-events-none z-20 shadow-2xl overflow-hidden min-w-[160px]",
            hovering ? "flex" : "hidden"
          )}
          style={{ left: preview.left }}
        >
          <div className="w-[180px] aspect-video bg-black flex items-center justify-center overflow-hidden rounded-lg relative">
            {useServerPreview ? (
              <ServerPreview filePath={filePath} time={preview.time} duration={duration} />
            ) : (
              <NativePreview filePath={filePath} time={preview.time} />
            )}
          </div>
          <span className="w-full text-center py-2 text-sm font-semibold text-white tabular-nums">{formatTime(preview.time)}</span>
        </div>
      )}
      <div
        className="brand-bg h-full rounded-full relative"
        style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity scale-0 group-hover:scale-125 shadow-lg ring-2 ring-white/20" />
      </div>

      <input
        type="range"
        min="0"
        max={duration || 100}
        value={currentTime}
        onChange={handleSeek}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
      />
    </div>
  );
});
