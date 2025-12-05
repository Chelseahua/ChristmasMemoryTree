import { useState, useEffect } from 'react';
import { THEME_LABELS } from './ColorThemes';
import type { ThemePreset, ColorTheme } from './ColorThemes';

interface SettingsPanelProps {
    selectedTheme: ThemePreset | 'custom';
    onThemeChange: (theme: ThemePreset | 'custom') => void;
    customColors: ColorTheme;
    onCustomColorsChange: (colors: ColorTheme) => void;
    isOpen: boolean;
    onClose: () => void;
    isMobile: boolean;
}

// Helper to convert Hex to HSL
const hexToHSL = (hex: string) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt("0x" + hex[1] + hex[1]);
        g = parseInt("0x" + hex[2] + hex[2]);
        b = parseInt("0x" + hex[3] + hex[3]);
    } else if (hex.length === 7) {
        r = parseInt("0x" + hex[1] + hex[2]);
        g = parseInt("0x" + hex[3] + hex[4]);
        b = parseInt("0x" + hex[5] + hex[6]);
    }
    r /= 255; g /= 255; b /= 255;
    const cmin = Math.min(r, g, b), cmax = Math.max(r, g, b), delta = cmax - cmin;
    let h = 0, s = 0, l = 0;

    if (delta === 0) h = 0;
    else if (cmax === r) h = ((g - b) / delta) % 6;
    else if (cmax === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;

    h = Math.round(h * 60);
    if (h < 0) h += 360;

    l = (cmax + cmin) / 2;
    s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);

    return { h, s, l };
};

// Helper to convert HSL to Hex
const hslToHex = (h: number, s: number, l: number) => {
    s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    const toHex = (n: number) => {
        const hex = n.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    return "#" + toHex(r) + toHex(g) + toHex(b);
};

export default function SettingsPanel({
    selectedTheme,
    onThemeChange,
    customColors,
    onCustomColorsChange,
    isOpen,
    onClose,
    isMobile,
}: SettingsPanelProps) {
    const [showColorPickers, setShowColorPickers] = useState(false);
    // Local state for sliders to avoid jitter, synced with customColors
    const [activeColorKey, setActiveColorKey] = useState<keyof ColorTheme | null>(null);
    const [hslValues, setHslValues] = useState({ h: 0, s: 100, l: 50 });

    useEffect(() => {
        if (activeColorKey) {
            const hex = customColors[activeColorKey];
            setHslValues(hexToHSL(hex));
        }
    }, [activeColorKey, customColors]);

    const handleSliderChange = (type: 'h' | 's' | 'l', value: number) => {
        if (!activeColorKey) return;
        const newHsl = { ...hslValues, [type]: value };
        setHslValues(newHsl);
        const newHex = hslToHex(newHsl.h, newHsl.s, newHsl.l);
        onCustomColorsChange({ ...customColors, [activeColorKey]: newHex });
    };

    return (
        <>
            {/* Toggle Button Removed - Moved to App.tsx */}

            {/* Settings Panel */}
            <div
                style={{
                    position: 'fixed',
                    top: isMobile ? 'auto' : 0,
                    bottom: isMobile ? 0 : 'auto',
                    left: 0,
                    width: isMobile ? '100%' : '340px',
                    height: isMobile ? '60vh' : '100vh',
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    backdropFilter: 'blur(20px)',
                    borderRight: isMobile ? 'none' : '1px solid rgba(255, 215, 0, 0.2)',
                    borderTop: isMobile ? '1px solid rgba(255, 215, 0, 0.2)' : 'none',
                    padding: '20px',
                    paddingTop: isMobile ? '20px' : '80px',
                    zIndex: 250,
                    transform: isOpen
                        ? (isMobile ? 'translateY(0)' : 'translateX(0)')
                        : (isMobile ? 'translateY(100%)' : 'translateX(-100%)'),
                    transition: 'transform 0.3s ease',
                    overflowY: 'auto',
                    color: '#DDD',
                    fontFamily: 'Avenir, sans-serif',
                    borderTopLeftRadius: isMobile ? '20px' : '0',
                    borderTopRightRadius: isMobile ? '20px' : '0',
                    boxSizing: 'border-box',
                }}
            >
                {/* Close Button for Mobile */}
                {isMobile && (
                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute',
                            top: '15px',
                            right: '15px',
                            background: 'transparent',
                            border: 'none',
                            color: '#666',
                            fontSize: '24px',
                            cursor: 'pointer',
                            padding: '5px',
                            lineHeight: 1,
                            zIndex: 260
                        }}
                    >
                        ✕
                    </button>
                )}
                {/* Color Themes Section */}
                <div>
                    <h3 style={{ color: '#FFD700', fontSize: '20px', letterSpacing: '2px', marginBottom: '20px' }}>
                        TREE THEMES
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                        {(['traditional', 'nordic', 'roseGold', 'darkNight'] as ThemePreset[]).map((theme) => (
                            <button
                                key={theme}
                                onClick={() => {
                                    onThemeChange(theme);
                                    setShowColorPickers(false);
                                    setActiveColorKey(null);
                                }}
                                style={{
                                    padding: '12px',
                                    backgroundColor: selectedTheme === theme ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                    border: `1px solid ${selectedTheme === theme ? '#FFD700' : '#444'}`,
                                    color: selectedTheme === theme ? '#FFD700' : '#AAA',
                                    fontSize: '16px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    textAlign: 'left',
                                    borderRadius: '4px',
                                }}
                            >
                                {THEME_LABELS[theme]}
                            </button>
                        ))}

                        <button
                            onClick={() => {
                                onThemeChange('custom');
                                setShowColorPickers(true);
                            }}
                            style={{
                                padding: '12px',
                                backgroundColor: selectedTheme === 'custom' ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                border: `1px solid ${selectedTheme === 'custom' ? '#FFD700' : '#444'}`,
                                color: selectedTheme === 'custom' ? '#FFD700' : '#AAA',
                                fontSize: '16px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                textAlign: 'left',
                                borderRadius: '4px',
                            }}
                        >
                            🎨 Custom Colors
                        </button>
                    </div>

                    {/* Custom Color Sliders */}
                    {showColorPickers && selectedTheme === 'custom' && (
                        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px' }}>
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                {Object.keys(customColors).map((key) => {
                                    const isActive = activeColorKey === key;
                                    const color = customColors[key as keyof ColorTheme];

                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setActiveColorKey(key as keyof ColorTheme)}
                                            style={{
                                                padding: 0,
                                                margin: 0,
                                                border: 'none',
                                                background: 'transparent',
                                                cursor: 'pointer',
                                                flex: '0 0 auto',
                                                outline: 'none',
                                            }}
                                            title={key}
                                        >
                                            <span
                                                style={{
                                                    position: 'relative',
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 999,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transform: isActive ? 'scale(1.1)' : 'scale(1.0)',
                                                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                                    boxShadow: isActive
                                                        ? '0 0 0 1px #111, 0 0 0 3px #F9E27D, 0 0 10px rgba(249,226,125,0.6)'
                                                        : '0 0 0 1px rgba(255,255,255,0.25)',
                                                    background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.6), transparent 55%)',
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        width: 24,
                                                        height: 24,
                                                        borderRadius: 999,
                                                        backgroundColor: color,
                                                    }}
                                                />
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {activeColorKey && (
                                <div>
                                    <label style={{ fontSize: '16px', color: '#DDD', display: 'block', marginBottom: '10px', textTransform: 'capitalize' }}>
                                        Editing: {activeColorKey}
                                    </label>

                                    {/* Hue Slider */}
                                    <div style={{ marginBottom: '10px' }}>
                                        <label style={{ fontSize: '16px', color: '#999' }}>Hue</label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="360"
                                            value={hslValues.h}
                                            onChange={(e) => handleSliderChange('h', parseInt(e.target.value))}
                                            style={{
                                                width: '100%',
                                                height: '10px',
                                                borderRadius: '5px',
                                                appearance: 'none',
                                                background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                                                outline: 'none',
                                                cursor: 'pointer'
                                            }}
                                        />
                                    </div>

                                    {/* Saturation Slider */}
                                    <div style={{ marginBottom: '10px' }}>
                                        <label style={{ fontSize: '16px', color: '#999' }}>Saturation</label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={hslValues.s}
                                            onChange={(e) => handleSliderChange('s', parseInt(e.target.value))}
                                            style={{
                                                width: '100%',
                                                height: '10px',
                                                borderRadius: '5px',
                                                appearance: 'none',
                                                background: `linear-gradient(to right, #888, hsl(${hslValues.h}, 100%, 50%))`,
                                                outline: 'none',
                                                cursor: 'pointer'
                                            }}
                                        />
                                    </div>

                                    {/* Lightness Slider */}
                                    <div style={{ marginBottom: '10px' }}>
                                        <label style={{ fontSize: '16px', color: '#999' }}>Lightness</label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={hslValues.l}
                                            onChange={(e) => handleSliderChange('l', parseInt(e.target.value))}
                                            style={{
                                                width: '100%',
                                                height: '10px',
                                                borderRadius: '5px',
                                                appearance: 'none',
                                                background: `linear-gradient(to right, #000, hsl(${hslValues.h}, ${hslValues.s}%, 50%), #fff)`,
                                                outline: 'none',
                                                cursor: 'pointer'
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                            {!activeColorKey && <p style={{ fontSize: '16px', color: '#888' }}>Select a color circle above to edit</p>}
                        </div>
                    )}
                </div>
            </div>

            {/* Overlay when open */}
            {isOpen && (
                <div
                    onClick={onClose}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        zIndex: 200,
                    }}
                />
            )}
        </>
    );
}
