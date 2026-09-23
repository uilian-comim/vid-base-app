import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
  MediaInfo,
  VideoMode,
  canCopyVideo,
  defaultAudioIndex,
  needsServerPlayback,
  openMedia,
  playlistUrl,
} from '../lib/mediaServer';

export type PlaybackMode = 'native' | 'hls';
export type PlaybackStatus = 'loading' | 'ready' | 'error';

interface UseMediaPlaybackOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  filePath: string;
  /** Where to resume (seconds), e.g. from the watch history. */
  startTime: number;
}

// hls.js retries fatal media errors this many times before we give up on stream copy.
const MAX_MEDIA_RECOVERIES = 2;

/**
 * Plays a file natively when the webview supports it and otherwise through the local HLS
 * server, falling back automatically when native playback or stream copy fails.
 */
export function useMediaPlayback({ videoRef, filePath, startTime }: UseMediaPlaybackOptions) {
  const [mode, setMode] = useState<PlaybackMode>(() => (needsServerPlayback(filePath) ? 'hls' : 'native'));
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [videoMode, setVideoMode] = useState<VideoMode | null>(null);
  const [audioIndex, setAudioIndexState] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<PlaybackStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  // Position/play state to restore whenever the source is (re)loaded.
  const resumeRef = useRef({ time: startTime, play: true });

  // Probe the file: needed for HLS, and for native files it still lists subtitles/audio tracks.
  useEffect(() => {
    const controller = new AbortController();
    openMedia(filePath, controller.signal)
      .then((media) => {
        setInfo(media);
        setAudioIndexState((current) => current ?? defaultAudioIndex(media));
        setVideoMode((current) => current ?? (canCopyVideo(media) ? 'copy' : 'transcode'));
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error('Failed to probe media:', err);
        setProbeError(String(err?.message ?? err));
      });
    return () => controller.abort();
  }, [filePath]);

  const captureResumePoint = useCallback(() => {
    const video = videoRef.current;
    if (video && video.readyState > 0) {
      resumeRef.current = { time: video.currentTime, play: !video.paused };
    }
  }, [videoRef]);

  const play = useCallback(() => {
    const p = videoRef.current?.play();
    if (p !== undefined) p.catch((e) => console.warn('Auto-play failed:', e));
  }, [videoRef]);

  // Native playback through the asset protocol.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || mode !== 'native') return;

    const onLoaded = () => {
      const { time, play: shouldPlay } = resumeRef.current;
      if (time > 0 && Number.isFinite(video.duration)) video.currentTime = Math.min(time, video.duration);
      setStatus('ready');
      if (shouldPlay) play();
    };
    const onError = () => {
      // Unsupported codec/container: let ffmpeg remux or transcode it instead.
      console.warn('Native playback failed, switching to HLS:', video.error?.message);
      captureResumePoint();
      setStatus('loading');
      setMode('hls');
    };

    video.addEventListener('loadedmetadata', onLoaded, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.src = convertFileSrc(filePath);

    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
    };
  }, [mode, filePath, videoRef, play, captureResumePoint]);

  // HLS playback; recreated whenever the audio track or video mode changes.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || mode !== 'hls' || !info || !videoMode) return;

    const src = playlistUrl(info.id, videoMode, audioIndex);
    const { time, play: shouldPlay } = resumeRef.current;
    setStatus('loading');

    if (!Hls.isSupported()) {
      // Safari-style native HLS (no MediaSource available).
      const onLoaded = () => {
        if (time > 0) video.currentTime = time;
        setStatus('ready');
        if (shouldPlay) play();
      };
      video.addEventListener('loadedmetadata', onLoaded, { once: true });
      video.src = src;
      return () => {
        video.removeEventListener('loadedmetadata', onLoaded);
        captureResumePoint();
      };
    }

    const hls = new Hls({
      startPosition: time > 0 ? time : -1,
      maxBufferLength: 30,
      enableCEA708Captions: false,
      // Segments are generated on demand; transcoding a segment can take a few seconds.
      fragLoadPolicy: {
        default: {
          maxTimeToFirstByteMs: 30_000,
          maxLoadTimeMs: 60_000,
          timeoutRetry: { maxNumRetry: 2, retryDelayMs: 0, maxRetryDelayMs: 0 },
          errorRetry: { maxNumRetry: 3, retryDelayMs: 1000, maxRetryDelayMs: 4000 },
        },
      },
    });
    let mediaRecoveries = 0;

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (shouldPlay) play();
    });
    hls.on(Hls.Events.FRAG_BUFFERED, () => setStatus('ready'));
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < MAX_MEDIA_RECOVERIES) {
        mediaRecoveries++;
        hls.recoverMediaError();
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && videoMode === 'copy') {
        // The webview claimed support but can't actually decode it: transcode instead.
        console.warn('Stream copy failed to decode, switching to transcoding');
        captureResumePoint();
        setVideoMode('transcode');
      } else {
        console.error('Fatal HLS error:', data);
        setError(data.error?.message ?? data.details);
        setStatus('error');
      }
    });

    hls.loadSource(src);
    hls.attachMedia(video);

    return () => {
      captureResumePoint();
      hls.destroy();
    };
  }, [mode, info, videoMode, audioIndex, videoRef, play, captureResumePoint]);

  const setAudioIndex = useCallback(
    (index: number) => {
      if (index === audioIndex && mode === 'hls') return;
      captureResumePoint();
      setAudioIndexState(index);
      // The webview can't switch audio tracks itself; the server can.
      if (mode === 'native') {
        setStatus('loading');
        setMode('hls');
      }
    },
    [audioIndex, mode, captureResumePoint],
  );

  // Without probe data only native playback can work.
  const failed = mode === 'hls' && probeError !== null;

  return {
    mode,
    info,
    status: failed ? 'error' : status,
    error: failed ? probeError : error,
    audioIndex: mode === 'hls' ? audioIndex : defaultAudioIndexOrUndefined(info),
    setAudioIndex,
    isTranscoding: mode === 'hls' && videoMode === 'transcode',
  };
}

function defaultAudioIndexOrUndefined(info: MediaInfo | null) {
  return info ? defaultAudioIndex(info) : undefined;
}
