import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettings } from '../contexts/SettingsContext';

interface UseDiscordRPCProps {
    activityState: string;
    details: string;
    startTimestamp?: number | null;
    enabled?: boolean;
}

export function useDiscordRPC({
    activityState,
    details,
    startTimestamp,
    enabled = true
}: UseDiscordRPCProps) {
    const { settings } = useSettings();

    useEffect(() => {
        // Check both local prop and global setting
        if (!enabled || !settings.enableDiscordRichPresence) {
            invoke('clear_discord_activity').catch(() => { });
            return;
        }

        const updatePresence = async () => {
            try {
                await invoke('set_discord_activity', {
                    activityState,
                    details,
                    startTimestamp: startTimestamp ?? undefined
                });
            } catch (error) {
                console.error('Failed to update Discord presence:', error);
            }
        };

        updatePresence();
    }, [activityState, details, startTimestamp, enabled, settings.enableDiscordRichPresence]);

    useEffect(() => {
        // Clear presence when component using the hook unmounts
        return () => {
            invoke('clear_discord_activity').catch(() => { });
        };
    }, []);
}
