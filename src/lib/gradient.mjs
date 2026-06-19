// Deterministic, minimal 2-stop gradient derived from a key, used for coverless content placeholders.
export function gradientFor(key = '') {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (key.charCodeAt(i) + ((h << 5) - h)) | 0;
  const hue = ((h % 360) + 360) % 360;
  return `linear-gradient(135deg, hsl(${hue} 62% 58%), hsl(${(hue + 38) % 360} 64% 46%))`;
}
