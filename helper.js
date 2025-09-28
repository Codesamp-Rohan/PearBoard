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