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

document.querySelector('.slide-state-btn').addEventListener('click', () => {
    document.querySelector('#slide-state-container').classList.toggle('hidden');
})

document.querySelector('#slide-state-close-btn').addEventListener('click', () => {
    document.querySelector('#state-details-container').classList.toggle('hidden');
})

class DrawingControls {
    constructor() {
        this.toggleBtn = document.getElementById('toggleControls');
        this.container = document.getElementById('controlsContainer');
        this.isExpanded = true;

        this.toggleBtn.addEventListener('click', () => this.toggle());

        // Restore previous state
        const savedState = localStorage.getItem('drawingControlsState');
        if (savedState === 'false') {
            this.toggle(false);
        }
    }

    toggle(force) {
        this.isExpanded = force !== undefined ? force : !this.isExpanded;
        this.container.classList.toggle('hidden', !this.isExpanded);
        this.toggleBtn.setAttribute('aria-expanded', this.isExpanded);
        localStorage.setItem('drawingControlsState', this.isExpanded);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.drawingControls = new DrawingControls();
});

export function updateStrokeColor() {
    const strokeColor = document.querySelector('#color')
    const strokeColorValue = document.getAttribute('data-value')
    const strokeColorText = document.querySelector('#color-text')

    strokeColorText.textContent = strokeColorValue
}