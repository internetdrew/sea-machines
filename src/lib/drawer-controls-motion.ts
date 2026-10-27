import { cancelFrame, frame, motionValue } from 'motion';

/** Follow the drawer's rendered position, including native Base UI swipe/release motion. */
export function syncDrawerControls(container: HTMLElement, popup: HTMLElement) {
  const viewport = popup.parentElement;
  if (!viewport) return;
  const toolbar = container.querySelector<HTMLElement>('.map-toolbar');
  const attribution = container.querySelector<HTMLElement>('.maplibregl-ctrl-bottom-right');
  const toolbarX = motionValue(0);
  const attributionX = motionValue(0);
  const originalToolbarTransform = toolbar?.style.transform ?? '';
  const originalAttributionTransform = attribution?.style.transform ?? '';
  const render = () => {
    if (toolbar) toolbar.style.transform = `translateX(${toolbarX.get()}px)`;
    if (attribution) attribution.style.transform = `translateX(${attributionX.get()}px)`;
  };

  // Reads are batched before Motion writes transforms; no React state per frame.
  const measure = () => {
    const bounds = popup.getBoundingClientRect();
    const edge = viewport.getBoundingClientRect().right;
    const visibleWidth = Math.max(0, Math.min(bounds.width, edge - bounds.left));
    const progress = bounds.width ? visibleWidth / bounds.width : 0;
    toolbarX.set(-(visibleWidth + 8 * progress));
    attributionX.set(-(visibleWidth + 16 * progress));
    frame.render(render);
  };
  const onTransition = (event: TransitionEvent) => {
    if (event.target !== popup || event.propertyName !== 'transform') return;
    if (event.type === 'transitionrun') {
      frame.read(measure, true);
    } else {
      cancelFrame(measure);
      frame.read(measure);
    }
  };
  popup.addEventListener('transitionrun', onTransition);
  popup.addEventListener('transitionend', onTransition);
  popup.addEventListener('transitioncancel', onTransition);

  // Swipe positions are written directly by Base UI. Follow them without easing.
  const observer = new MutationObserver(() => frame.read(measure));
  observer.observe(popup, { attributes: true, attributeFilter: ['style', 'data-swiping'] });
  const resizeObserver = new ResizeObserver(() => frame.read(measure));
  resizeObserver.observe(popup);
  resizeObserver.observe(viewport);
  frame.read(measure);

  return () => {
    cancelFrame(measure);
    cancelFrame(render);
    observer.disconnect();
    resizeObserver.disconnect();
    popup.removeEventListener('transitionrun', onTransition);
    popup.removeEventListener('transitionend', onTransition);
    popup.removeEventListener('transitioncancel', onTransition);
    toolbarX.destroy();
    attributionX.destroy();
    if (toolbar) toolbar.style.transform = originalToolbarTransform;
    if (attribution) attribution.style.transform = originalAttributionTransform;
  };
}
