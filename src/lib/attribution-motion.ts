import { animate } from 'motion';

/** Animate before MapLibre hides the credits, leaving its native toggle intact. */
export function animateAttributionCollapse(attribution: HTMLElement) {
  const button = attribution.querySelector<HTMLElement>('.maplibregl-ctrl-attrib-button');
  const inner = attribution.querySelector<HTMLElement>('.maplibregl-ctrl-attrib-inner');
  if (!button || !inner) return () => {};

  let bypass = false;
  let disposed = false;
  let animations: ReturnType<typeof animate>[] = [];
  const originalClip = attribution.style.clipPath;
  const originalOpacity = inner.style.opacity;

  const reset = () => {
    for (const animation of animations) animation.cancel();
    animations = [];
    attribution.style.clipPath = originalClip;
    inner.style.opacity = originalOpacity;
  };

  const onClick = (event: MouseEvent) => {
    if (bypass || !attribution.classList.contains('maplibregl-compact-show') ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    // A second press catches the collapse and leaves the credits open.
    if (animations.length) {
      reset();
      return;
    }
    const border = getComputedStyle(attribution);
    const collapsedWidth = button.getBoundingClientRect().width +
      parseFloat(border.borderLeftWidth) + parseFloat(border.borderRightWidth);
    animations = [
      animate(attribution, {
        clipPath: ['inset(0 0 0 0 round 999px)', `inset(0 0 0 calc(100% - ${collapsedWidth}px) round 999px)`],
      }, { duration: 0.2, ease: [0.2, 0, 0, 1] }),
      animate(inner, { opacity: [1, 0] }, { duration: 0.12, ease: 'easeOut' }),
    ];
    void animations[0].then(() => {
      if (disposed || !animations.length) return;
      // Finish with MapLibre's own click handler and native details behavior.
      if (attribution.classList.contains('maplibregl-compact-show')) {
        bypass = true;
        button.click();
        bypass = false;
      }
      reset();
    });
  };

  button.addEventListener('click', onClick, true);
  return () => {
    disposed = true;
    button.removeEventListener('click', onClick, true);
    reset();
  };
}
