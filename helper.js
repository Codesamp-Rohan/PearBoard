export const colorPairs = [
    { bg: '#334443', text: '#FAF8F1' },
    { bg: '#3338A0', text: '#F7F7F7' },
    { bg: '#344F1F', text: '#F9F5F0' },
    { bg: '#f57c00', text: '#000000' },
    { bg: '#3f51b5', text: '#ffffff' },
    { bg: '#000000', text: '#FE7743' },
    { bg: '#C5BAFF', text: '#5238ff' }
];

export function getRandomColorPair() {
    return colorPairs[Math.floor(Math.random() * colorPairs.length)];
}

export function addAlphaToColor(color, alpha) {
    if (!color) return `rgba(0,0,0,${alpha})`;

    if (color.startsWith('rgba')) {
        return color.replace(/rgba\\(([^,]+),([^,]+),([^,]+),[^)]+\\)/, `rgba($1,$2,$3,${alpha})`);
    }

    if (color.startsWith('#')) {
        let r, g, b;
        if (color.length === 7) {
            r = parseInt(color.slice(1, 3), 16);
            g = parseInt(color.slice(3, 5), 16);
            b = parseInt(color.slice(5, 7), 16);
        } else if (color.length === 4) {
            r = parseInt(color[1] + color[1], 16);
            g = parseInt(color[2] + color[2], 16);
            b = parseInt(color[3] + color[3], 16);
        } else {
            return color; // Unknown format fallback
        }
        return `rgba(${r},${g},${b},${alpha})`;
    }

    if (color.startsWith('rgb(')) {
        let parts = color.slice(4, -1).split(',');
        return `rgba(${parts[0].trim()}, ${parts[1].trim()}, ${parts[2].trim()}, ${alpha})`;
    }

    return color;
}
