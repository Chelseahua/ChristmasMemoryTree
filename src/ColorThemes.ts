export interface ColorTheme {
    gold: string;
    red: string;
    green: string;
    white: string;
    warmLight: string;
    polaroidBorder: string;
}

export type ThemePreset = 'traditional' | 'nordic' | 'roseGold' | 'darkNight';

export const COLOR_THEMES: Record<ThemePreset, ColorTheme> = {
    traditional: {
        gold: '#FFD700',
        red: '#8B0000',
        green: '#004225',
        white: '#F8F8FF',
        warmLight: '#FFD54F',
        polaroidBorder: '#FDFBF7',
    },

    nordic: {
        gold: '#E8E8E8',      // Silver-white
        red: '#A0A0A0',       // Cool gray
        green: '#B8B8B8',     // Light gray
        white: '#FFFFFF',
        warmLight: '#D4D4D4', // Cool white light
        polaroidBorder: '#F0F0F0',
    },

    roseGold: {
        gold: '#E0BFB8',      // Rose gold
        red: '#C97064',       // Muted coral
        green: '#9B8B7E',     // Warm taupe
        white: '#FFF5F0',     // Warm white
        warmLight: '#FFCBA4', // Peachy glow
        polaroidBorder: '#FFF0E6',
    },

    darkNight: {
        gold: '#FFD700',      // Bright gold (contrast)
        red: '#1A0F0F',       // Almost black red
        green: '#0D1B0D',     // Almost black green
        white: '#2A2A2A',     // Dark gray
        warmLight: '#4A4A00', // Dim yellow
        polaroidBorder: '#1F1F1F',
    },
};

export const THEME_LABELS: Record<ThemePreset, string> = {
    traditional: 'Traditional 🎄',
    nordic: 'Nordic ❄️',
    roseGold: 'Rose Gold 🌸',
    darkNight: 'Dark Night 🌙',
};
