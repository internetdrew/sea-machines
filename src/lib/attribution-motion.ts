import { animate } from 'motion';

const DURATION = 0.16;
const EASE = [0.215, 0.61, 0.355, 1] as const;

/** Keep attribution transitions local: never synthesize clicks or move focus. */
export function animateAttributionCollapse(attribution: HTMLElement) {
  const button = attribution.querySelector<HTMLElement>('.maplibregl-ctrl-attrib-button');
  const inner = attribution.querySelector<HTMLElement>('.maplibregl-ctrl-attrib-inner');
  if (!button || !inner) return { collapse() {}, destroy() {} };

  let disposed = false;
  let generation = 0;
  let targetOpen: boolean | undefined;
  let automatic = false;
  let animations: ReturnType<typeof animate>[] = [];
  const originalClip = attribution.style.clipPath;
  const originalOpacity = inner.style.opacity;
  const expanded = () => attribution.classList.contains('maplibregl-compact-show');

  const cancel = () => {
    generation++;
    for (const animation of animations) animation.cancel();
    animations = [];
  };
  const clearStyles = () => {
    attribution.style.clipPath = originalClip;
    inner.style.opacity = originalOpacity;
  };
  const setOpen = (open: boolean) => {
    if (open) {
      attribution.classList.add('maplibregl-compact-show');
      attribution.setAttribute('open', '');
    } else {
      attribution.classList.remove('maplibregl-compact-show');
      attribution.removeAttribute('open');
    }
  };

  const transition = (open: boolean, immediate = false, isAutomatic = false) => {
    if (disposed) return;
    if (isAutomatic && attribution.matches(':hover, :focus-within')) return;
    if (targetOpen === open && animations.length) return;
    const wasOpen = expanded();
    const inFlight = animations.length > 0;
    // Read the current rendered frame before cancelling, so reversals do not snap.
    const currentClip = inFlight ? getComputedStyle(attribution).clipPath : undefined;
    const currentOpacity = inFlight ? getComputedStyle(inner).opacity : undefined;
    cancel();
    targetOpen = open;
    automatic = isAutomatic;
    if (immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOpen(open);
      clearStyles();
      targetOpen = undefined;
      return;
    }
    if (!inFlight && wasOpen === open) return;

    // Measure at expanded size; clip only the credit text, keeping the button still.
    setOpen(true);
    const border = getComputedStyle(attribution);
    const collapsedWidth = button.getBoundingClientRect().width +
      parseFloat(border.borderLeftWidth) + parseFloat(border.borderRightWidth);
    const full = 'inset(0 0 0 0 round 999px)';
    const compact = `inset(0 0 0 calc(100% - ${collapsedWidth}px) round 999px)`;
    const startClip = currentClip || (wasOpen ? full : compact);
    const startOpacity = Number.parseFloat(currentOpacity ?? (wasOpen ? '1' : '0'));
    const token = generation;
    animations = [
      animate(attribution, { clipPath: [startClip, open ? full : compact] }, { duration: DURATION, ease: EASE }),
      animate(inner, { opacity: [startOpacity, open ? 1 : 0] }, { duration: DURATION, ease: EASE }),
    ];
    void animations[0].then(() => {
      if (disposed || token !== generation) return;
      // Focus or pointer entry takes precedence over the startup timer.
      if (!open && automatic && attribution.matches(':hover, :focus-within')) {
        transition(true);
        return;
      }
      setOpen(open);
      cancel();
      clearStyles();
      targetOpen = undefined;
    });
  };

  const onClick = (event: MouseEvent) => {
    if (!attribution.classList.contains('maplibregl-compact')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    transition(!(targetOpen ?? expanded()), event.detail === 0);
  };
  const protectInteraction = () => {
    if (automatic && targetOpen === false) transition(true);
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onMotionPreference = () => {
    if (reducedMotion.matches && targetOpen !== undefined) transition(targetOpen, true);
  };
  button.addEventListener('click', onClick, true);
  attribution.addEventListener('mouseenter', protectInteraction);
  attribution.addEventListener('focusin', protectInteraction);
  reducedMotion.addEventListener('change', onMotionPreference);
  return {
    collapse() { transition(false, false, true); },
    destroy() {
      disposed = true;
      button.removeEventListener('click', onClick, true);
      attribution.removeEventListener('mouseenter', protectInteraction);
      attribution.removeEventListener('focusin', protectInteraction);
      reducedMotion.removeEventListener('change', onMotionPreference);
      cancel();
      clearStyles();
    },
  };
}
