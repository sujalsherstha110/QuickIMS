import React from 'react';

/**
 * Spawns an animated touch ripple starting at the exact tap/click coordinates.
 * Works seamlessly on mobile touchscreens, tablets, and desktop mouse clicks.
 */
export function spawnTouchRipple(
  event: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
  colorClass: string = 'bg-white/40'
) {
  const target = event.currentTarget as HTMLElement | null;
  if (!target) return;

  const rect = target.getBoundingClientRect();
  let clientX = 0;
  let clientY = 0;

  if ('touches' in event && event.touches.length > 0) {
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  } else if ('changedTouches' in event && event.changedTouches.length > 0) {
    clientX = event.changedTouches[0].clientX;
    clientY = event.changedTouches[0].clientY;
  } else if ('clientX' in event) {
    clientX = (event as React.MouseEvent).clientX;
    clientY = (event as React.MouseEvent).clientY;
  }

  // Fallback if coords were zero
  if (clientX === 0 && clientY === 0) {
    clientX = rect.left + rect.width / 2;
    clientY = rect.top + rect.height / 2;
  }

  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const radius = Math.max(rect.width, rect.height) * 1.4;

  const ripple = document.createElement('span');
  ripple.className = `absolute rounded-full pointer-events-none animate-touch-ripple ${colorClass}`;
  ripple.style.width = `${radius * 2}px`;
  ripple.style.height = `${radius * 2}px`;
  ripple.style.left = `${x - radius}px`;
  ripple.style.top = `${y - radius}px`;

  // Ensure target has relative positioning and hidden overflow for clean containment
  const computed = window.getComputedStyle(target);
  if (computed.position === 'static') {
    target.style.position = 'relative';
  }
  if (computed.overflow !== 'hidden') {
    target.style.overflow = 'hidden';
  }

  target.appendChild(ripple);

  // Clean up ripple element after animation finishes
  setTimeout(() => {
    if (ripple.parentNode) {
      ripple.parentNode.removeChild(ripple);
    }
  }, 600);
}
