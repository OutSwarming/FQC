const modes = ['low', 'medium', 'high'];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function chooseSheetDestination({ metrics, startHeight, height, velocity }) {
  const nearest = position => modes.reduce((best, mode) =>
    Math.abs(metrics[mode] - position) < Math.abs(metrics[best] - position) ? mode : best, 'medium');
  const travel = Math.abs(height - startHeight);
  const speed = Math.abs(velocity);
  const range = metrics.high - metrics.low;
  if (travel < 22 || speed < .18) return nearest(height);

  const direction = Math.sign(velocity);
  const startIndex = modes.indexOf(nearest(startHeight));
  const adjacent = clamp(startIndex + direction, 0, 2);
  const shortDistance = Math.min(96, Math.max(56, range * .25));
  // Short flicks express one step. Momentum is bounded by the distance travelled,
  // so a single noisy velocity sample cannot throw a small gesture across the sheet.
  if (travel < shortDistance) return modes[adjacent];
  if (speed >= 2.6 && travel >= shortDistance) return direction > 0 ? 'high' : 'low';

  const projected = height + direction * Math.min(speed * 180, travel * .75);
  const projectedIndex = modes.indexOf(nearest(projected));
  return modes[direction > 0 ? Math.max(adjacent, projectedIndex) : Math.min(adjacent, projectedIndex)];
}
