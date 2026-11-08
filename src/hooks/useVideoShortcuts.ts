import { useEffect, useRef } from 'react';

export interface VideoShortcutHandlers {
    togglePlay: () => void;
    skip: (seconds: number) => void;
    /** Jumps to a fraction (0–1) of the video. */
    seekToFraction: (fraction: number) => void;
    changeVolume: (delta: number) => void;
    toggleMute: () => void;
    toggleFullscreen: () => void;
    changeSpeed: (direction: 1 | -1) => void;
    toggleSubtitles: () => void;
    playAdjacent: (direction: 1 | -1) => void;
}

interface UseVideoShortcutsProps extends VideoShortcutHandlers {
    videoSkipBackward: number;
    videoSkipForward: number;
    isFullscreen: boolean;
}

const VOLUME_STEP = 0.05;
const JUMP_SECONDS = 10;

/** Text fields keep their keys; sliders (seek/volume) are taken over so arrows don't move them twice. */
function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
    return target instanceof HTMLInputElement && target.type !== 'range' && target.type !== 'checkbox';
}

/**
 * Player shortcuts, following the conventions of YouTube/VLC:
 * Space/K play-pause · ←/→ skip (settings) · J/L ±10s · ↑/↓ volume · M mute · F fullscreen ·
 * Esc leave fullscreen · 0–9 jump to 0–90% · Home/End start/end · Shift+</> speed ·
 * C subtitles · Shift+N/Shift+P next/previous episode.
 */
export function useVideoShortcuts(props: UseVideoShortcutsProps) {
    // Read the latest handlers from a ref so the listener is attached only once.
    const propsRef = useRef(props);
    propsRef.current = props;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
            const p = propsRef.current;

            const handled = (() => {
                if (/^[0-9]$/.test(e.key)) {
                    p.seekToFraction(Number(e.key) / 10);
                    return true;
                }
                switch (e.key) {
                    case ' ':
                    case 'k':
                    case 'K':
                        p.togglePlay();
                        return true;
                    case 'ArrowLeft':
                        p.skip(-p.videoSkipBackward);
                        return true;
                    case 'ArrowRight':
                        p.skip(p.videoSkipForward);
                        return true;
                    case 'j':
                    case 'J':
                        p.skip(-JUMP_SECONDS);
                        return true;
                    case 'l':
                    case 'L':
                        p.skip(JUMP_SECONDS);
                        return true;
                    case 'ArrowUp':
                        p.changeVolume(VOLUME_STEP);
                        return true;
                    case 'ArrowDown':
                        p.changeVolume(-VOLUME_STEP);
                        return true;
                    case 'm':
                    case 'M':
                        p.toggleMute();
                        return true;
                    case 'f':
                    case 'F':
                        p.toggleFullscreen();
                        return true;
                    case 'Escape':
                        if (!p.isFullscreen) return false;
                        p.toggleFullscreen();
                        return true;
                    case 'Home':
                        p.seekToFraction(0);
                        return true;
                    case 'End':
                        p.seekToFraction(1);
                        return true;
                    case '>':
                        p.changeSpeed(1);
                        return true;
                    case '<':
                        p.changeSpeed(-1);
                        return true;
                    case 'c':
                    case 'C':
                        p.toggleSubtitles();
                        return true;
                    case 'N':
                        if (!e.shiftKey) return false;
                        p.playAdjacent(1);
                        return true;
                    case 'P':
                        if (!e.shiftKey) return false;
                        p.playAdjacent(-1);
                        return true;
                    default:
                        return false;
                }
            })();

            // Also stops page scrolling and a focused button/slider from reacting to the same key.
            if (handled) e.preventDefault();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
}
