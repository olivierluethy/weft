import type { CSSProperties } from 'react';

/** Consistent cover rendering from a persisted focal point + zoom, used
 * everywhere a cover appears (page header, public view). Zooming focuses on the
 * focal point so drag-to-focus and scale compose intuitively. */
export function coverImageStyle(
  offsetX = 50,
  offsetY = 50,
  scale = 1,
): CSSProperties {
  return {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: `${offsetX}% ${offsetY}%`,
    transform: `scale(${scale})`,
    transformOrigin: `${offsetX}% ${offsetY}%`,
  };
}
