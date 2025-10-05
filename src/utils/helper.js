// src/utils/helper.js

/**
 * Adds alpha channel to a hex color string.
 * @param {string} hex - e.g. '#ff0000'
 * @param {number} alpha - 0..1
 * @returns {string} rgba(...) string
 */
export default function addAlphaToColor(hex, alpha) {
    if (!hex.startsWith('#')) return hex;
    const v = hex.slice(1);
    const r = parseInt(v.slice(0,2),16);
    const g = parseInt(v.slice(2,4),16);
    const b = parseInt(v.slice(4,6),16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Pick a random cursor color pair.
 */
export function getRandomColorPair() {
    const colors = [
        { bg: '#3b82f6', text: '#ffffff' },
        { bg: '#ef4444', text: '#ffffff' },
        { bg: '#10b981', text: '#ffffff' },
        { bg: '#f59e0b', text: '#000000' }
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}
