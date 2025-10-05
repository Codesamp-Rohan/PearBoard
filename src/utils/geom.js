/**
 * Utility functions for geometry and bounds.
 */

/**
 * Get bounding box of an object.
 * Supports pen (path), rect, ellipse, and line.
 */
export function getBounds(obj) {
    if (obj.points) {
        // Path: pen or eraser
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        obj.points.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    if (obj.type === 'rect' || obj.type === 'ellipse') {
        return {
            x: Math.min(obj.x, obj.x + obj.w),
            y: Math.min(obj.y, obj.y + obj.h),
            w: Math.abs(obj.w),
            h: Math.abs(obj.h)
        };
    }
    if (obj.type === 'line') {
        return {
            x: Math.min(obj.x, obj.x + obj.w),
            y: Math.min(obj.y, obj.y + obj.h),
            w: Math.abs(obj.w),
            h: Math.abs(obj.h)
        };
    }
    // Text or other shapes: fallback
    return { x: obj.x, y: obj.y, w: obj.w || 0, h: obj.h || 0 };
}

/**
 * Check if a point is within an object's bounds.
 */
export function pointInBounds(obj, x, y) {
    const b = getBounds(obj);
    return x >= b.x && y >= b.y && x <= b.x + b.w && y <= b.y + b.h;
}
