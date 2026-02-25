import { useEffect } from 'react';

interface UseVideoShortcutsProps {
    skip: (seconds: number) => void;
    togglePlay: () => void;
    videoSkipBackward: number;
    videoSkipForward: number;
}

export function useVideoShortcuts({
    skip,
    togglePlay,
    videoSkipBackward,
    videoSkipForward
}: UseVideoShortcutsProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            switch (e.key) {
                case 'ArrowLeft':
                    skip(-videoSkipBackward);
                    break;
                case 'ArrowRight':
                    skip(videoSkipForward);
                    break;
                case ' ':
                    e.preventDefault(); // Prevent scrolling
                    togglePlay();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [skip, videoSkipBackward, videoSkipForward, togglePlay]);
}
