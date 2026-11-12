export const MISSION_COMPACT_SNAP = 'compact';
export const MISSION_EXPANDED_SNAP = 'expanded';

const query = '(max-width: 639px)';
export const subscribeMissionMobile = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
export const getMissionMobile = () => window.matchMedia(query).matches;

