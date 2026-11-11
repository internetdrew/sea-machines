/** Measure intrinsic sections, so the panel can grow while only its body scrolls. */
export function syncMissionDrawerSize(popup: HTMLElement) {
  const viewport = popup.parentElement;
  if (!viewport) return () => {};
  let frame = 0;
  const resize = () => {
    frame = 0;
    const content = popup.querySelector<HTMLElement>('.mission-drawer-content');
    const body = content?.querySelector<HTMLElement>('.mission-drawer-body');
    if (!content || !body) return;
    const header = content.querySelector<HTMLElement>(':scope > header');
    const footer = content.querySelector<HTMLElement>(':scope > footer');
    const height = Math.ceil((header?.getBoundingClientRect().height ?? 0) + body.getBoundingClientRect().height + (footer?.getBoundingClientRect().height ?? 0) + 2);
    const nextHeight = `${Math.min(height, viewport.clientHeight)}px`;
    if (popup.style.height !== nextHeight) popup.style.height = nextHeight;
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(resize);
  };
  const observer = new ResizeObserver(schedule);
  const observeSections = () => {
    observer.disconnect();
    observer.observe(viewport);
    popup.querySelectorAll<HTMLElement>('.mission-drawer-body, .mission-drawer-content > header, .mission-drawer-content > footer').forEach(section => observer.observe(section));
    schedule();
  };
  const mutations = new MutationObserver(observeSections);
  mutations.observe(popup, { childList: true, subtree: true, characterData: true });
  observeSections();
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    mutations.disconnect();
  };
}
