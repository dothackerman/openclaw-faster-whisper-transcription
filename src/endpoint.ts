import {
  AUDIO_BYTES_PER_SECOND,
  WINDOW_SECONDS,
  OVERLAP_SECONDS,
} from "./limits.js";
const frame = 160; // 20 ms
const quietFrames = 30; // 600 ms; endpoint selection only, never audio removal
const power = Float64Array.from({ length: 256 }, (_, i) => {
  const u = i ^ 255,
    magnitude = (((u & 15) << 3) + 132) << ((u >> 4) & 7);
  return ((u & 128 ? 132 - magnitude : magnitude - 132) / 32768) ** 2;
});
export function endpoint(
  audio: Buffer,
  length: number,
): { size: number; advance: number } | undefined {
  const maximum = WINDOW_SECONDS * AUDIO_BYTES_PER_SECOND;
  let active = false,
    quiet = 0;
  for (let end = frame; end <= Math.min(length, maximum); end += frame) {
    let energy = 0;
    for (let i = end - frame; i < end; i++) energy += power[audio[i]!]!;
    if (energy / frame > 0.005 ** 2) {
      active = true;
      quiet = 0;
    } else quiet++;
    if (active && end >= 4 * AUDIO_BYTES_PER_SECOND && quiet >= quietFrames) {
      // Both windows include 250 ms around the middle of the detected pause.
      return { size: end, advance: end - 4000 };
    }
  }
  return length >= maximum
    ? {
        size: maximum,
        advance: (WINDOW_SECONDS - OVERLAP_SECONDS) * AUDIO_BYTES_PER_SECOND,
      }
    : undefined;
}
