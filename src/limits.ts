// Transport capacity only, not a qualified uninterrupted dictation duration.
// Python mirrors these formulas; cross-language boundary tests guard drift.
export const AUDIO_BYTES_PER_SECOND = 8000;
export const MAX_AUDIO_SECONDS = 120;
export const MAX_AUDIO_BYTES = MAX_AUDIO_SECONDS * AUDIO_BYTES_PER_SECOND;
export const MAX_REQUEST_BYTES = 4 * Math.ceil(MAX_AUDIO_BYTES / 3) + 4096;
