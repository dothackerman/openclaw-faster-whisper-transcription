// Independent bounds: per-request transport, rolling queue, session, final text.
export const AUDIO_BYTES_PER_SECOND = 8000;
export const MAX_AUDIO_SECONDS = 30; // offline comparator and protocol ceiling
export const MAX_AUDIO_BYTES = MAX_AUDIO_SECONDS * AUDIO_BYTES_PER_SECOND;
export const MAX_REQUEST_BYTES = 4 * Math.ceil(MAX_AUDIO_BYTES / 3) + 4096;
export const WINDOW_SECONDS = 16;
export const OVERLAP_SECONDS = 4;
export const QUEUE_SECONDS = 32;
export const SESSION_SECONDS = 60 * 60;
export const MAX_TRANSCRIPT_CHARS = 160000;
export const MAX_TRANSCRIPT_WORDS = 24000;
