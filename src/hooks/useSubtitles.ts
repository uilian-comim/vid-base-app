import { useEffect, useState } from 'react';
import { MediaInfo, subtitleUrl } from '../lib/mediaServer';

/** Picks forced subtitles first, then the track the file marks as default; otherwise off. */
function initialTrack(info: MediaInfo | null): string | null {
  if (!info) return null;
  return (info.subtitles.find((s) => s.forced) ?? info.subtitles.find((s) => s.default))?.id ?? null;
}

/**
 * Loads the selected subtitle track (converted to WebVTT by the media server) into a hidden
 * text track and exposes the active cues as HTML, so the player can render them itself above
 * the custom controls instead of relying on the webview's native cue styling.
 */
export function useSubtitles(videoRef: React.RefObject<HTMLVideoElement | null>, info: MediaInfo | null) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cues, setCues] = useState<string[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    setSelectedId(initialTrack(info));
  }, [info]);

  useEffect(() => {
    const video = videoRef.current;
    setCues([]);
    setError(false);
    if (!video || !info || !selectedId) return;

    const controller = new AbortController();
    let trackEl: HTMLTrackElement | null = null;
    let blobUrl: string | null = null;

    const onCueChange = () => {
      const active = trackEl?.track.activeCues;
      if (!active) return;
      const html = Array.from(active).map((cue) => {
        // getCueAsHTML() yields only the safe WebVTT node types (i, b, u, span, ruby...).
        const container = document.createElement('div');
        container.appendChild((cue as VTTCue).getCueAsHTML());
        return container.innerHTML;
      });
      setCues(html);
    };

    fetch(subtitleUrl(info.id, selectedId), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Subtitle request failed (${res.status})`);
        return res.text();
      })
      .then((vtt) => {
        // A blob URL keeps the track same-origin, so no CORS attributes are needed on <video>.
        blobUrl = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
        trackEl = document.createElement('track');
        trackEl.kind = 'subtitles';
        trackEl.src = blobUrl;
        video.appendChild(trackEl);
        trackEl.track.mode = 'hidden';
        trackEl.track.addEventListener('cuechange', onCueChange);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error('Failed to load subtitles:', err);
        setError(true);
      });

    return () => {
      controller.abort();
      if (trackEl) {
        trackEl.track.removeEventListener('cuechange', onCueChange);
        trackEl.track.mode = 'disabled';
        trackEl.remove();
      }
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [videoRef, info, selectedId]);

  return { selectedId, setSelectedId, cues, error };
}
