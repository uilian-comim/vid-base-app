// Client for the local Rust media server (src-tauri/src/streamer.rs).

export const MEDIA_SERVER = 'http://127.0.0.1:8765';

export interface VideoStreamInfo {
  index: number;
  codec: string;
  profile: string | null;
  pixFmt: string | null;
  width: number;
  height: number;
}

export interface AudioStreamInfo {
  index: number;
  codec: string;
  channels: number;
  language: string | null;
  title: string | null;
  default: boolean;
}

export interface SubtitleTrackInfo {
  id: string;
  codec: string;
  language: string | null;
  title: string | null;
  default: boolean;
  forced: boolean;
  external: boolean;
}

export interface MediaInfo {
  id: string;
  duration: number;
  video: VideoStreamInfo | null;
  audio: AudioStreamInfo[];
  subtitles: SubtitleTrackInfo[];
  canCopyVideo: boolean;
}

export type VideoMode = 'copy' | 'transcode';

// Containers the webview can't open natively; they always go through the HLS server.
const SERVER_ONLY_EXTENSIONS = ['mkv', 'ts', 'm2ts', 'mts', 'avi', 'wmv', 'flv', 'mpg', 'mpeg', 'vob', '3gp'];

export function needsServerPlayback(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return SERVER_ONLY_EXTENSIONS.includes(ext);
}

export async function openMedia(path: string, signal?: AbortSignal): Promise<MediaInfo> {
  const res = await fetch(`${MEDIA_SERVER}/media/open?path=${encodeURIComponent(path)}`, { signal });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function playlistUrl(id: string, video: VideoMode, audio?: number): string {
  const params = new URLSearchParams({ video });
  if (audio !== undefined) params.set('audio', String(audio));
  return `${MEDIA_SERVER}/media/${id}/index.m3u8?${params}`;
}

export function subtitleUrl(id: string, trackId: string): string {
  return `${MEDIA_SERVER}/media/${id}/subtitles/${trackId}.vtt`;
}

export function thumbnailUrl(path: string, time: number, width?: number): string {
  const params = new URLSearchParams({ path, time: String(Math.max(0, Math.floor(time))) });
  if (width) params.set('width', String(Math.round(width)));
  return `${MEDIA_SERVER}/thumbnail?${params}`;
}

// Representative codec strings: level/profile details don't matter for the yes/no answer,
// only whether the decoder exists (10-bit needs its own check: most H.264 decoders lack it).
function videoCodecString(video: VideoStreamInfo): string | null {
  const tenBit = video.pixFmt?.includes('10') ?? false;
  switch (video.codec) {
    case 'h264':
      return tenBit ? 'avc1.6e0028' : 'avc1.640028';
    case 'hevc':
      return tenBit ? 'hvc1.2.4.L120.90' : 'hvc1.1.6.L120.90';
    default:
      return null;
  }
}

/** Whether the webview can decode the file's video as-is, so the server only has to remux it. */
export function canCopyVideo(info: MediaInfo): boolean {
  if (!info.canCopyVideo || !info.video) return false;
  const codec = videoCodecString(info.video);
  if (!codec || typeof MediaSource === 'undefined') return false;
  const is420 = !info.video.pixFmt || info.video.pixFmt.startsWith('yuv420') || info.video.pixFmt.startsWith('yuvj420');
  return is420 && MediaSource.isTypeSupported(`video/mp4; codecs="${codec}"`);
}

export function defaultAudioIndex(info: MediaInfo): number | undefined {
  return (info.audio.find((a) => a.default) ?? info.audio[0])?.index;
}

const displayNamesCache = new Map<string, Intl.DisplayNames | null>();

/** Localized language name for an ISO 639 code from the container ("por" → "Português"). */
export function languageName(code: string | null, locale: string): string | null {
  if (!code) return null;
  if (!displayNamesCache.has(locale)) {
    try {
      displayNamesCache.set(locale, new Intl.DisplayNames([locale], { type: 'language' }));
    } catch {
      displayNamesCache.set(locale, null);
    }
  }
  try {
    const name = displayNamesCache.get(locale)?.of(code);
    return name && name !== code ? name.charAt(0).toUpperCase() + name.slice(1) : code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

export function channelLabel(channels: number): string {
  if (channels === 1) return 'Mono';
  if (channels === 2) return 'Stereo';
  return `${channels - 1}.1`;
}
