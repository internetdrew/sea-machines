export function getFuelAppearance(percent: number) {
  if (percent <= 15) {
    return { indicator: 'bg-red-600', text: 'text-red-600', label: 'Critical' };
  }
  if (percent <= 30) {
    return { indicator: 'bg-amber-500', text: 'text-amber-500', label: 'Low' };
  }
  return { indicator: 'bg-emerald-600', text: 'text-emerald-600', label: 'Normal' };
}
