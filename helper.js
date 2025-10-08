export function addAlphaToColor(hex, alpha) {
    if (!hex.startsWith('#')) return hex;
    const v = hex.slice(1);
    const r = parseInt(v.slice(0,2),16);
    const g = parseInt(v.slice(2,4),16);
    const b = parseInt(v.slice(4,6),16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getRandomColorPair() {
    const colors = [
        { bg: '#3b82f6', text: '#ffffff' },
        { bg: '#ef4444', text: '#ffffff' },
        { bg: '#10b981', text: '#ffffff' },
        { bg: '#f59e0b', text: '#000000' }
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

var isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
console.log(isMac)
if (!isMac) {
    document.querySelector('#titlebar').style.backgroundColor = 'black';
    document.querySelector('#state-details').style.left = '48px';
    document.querySelector('#version').style.left = '12px';
    document.querySelector('#state-details').style.backgroundColor = 'white';
    document.querySelector('#version').style.color = 'white';
}

document.querySelector('#logout-btn').addEventListener('click', () => {
    window.location.reload(true)
})
