import i18n from './i18n';

export function formatTime(seconds: number): string {
    if (!seconds || seconds < 0) return "0:00";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return i18n.t('time.just_now');
    if (minutes < 60) return i18n.t('time.minutes_ago', { count: minutes });
    if (hours < 24) return i18n.t('time.hours_ago', { count: hours });
    if (days === 1) return i18n.t('time.yesterday');
    if (days < 7) return i18n.t('time.days_ago', { count: days });

    const date = new Date(timestamp);
    return date.toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit' });
}


