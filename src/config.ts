import { isAbsolute } from "node:path";

export const ID = "faster-whisper-transcription";
export const PROVIDER = "faster-whisper";
export type Config = {
  python: string;
  modelPath: string;
  model: string;
  device: "cuda" | "cpu";
  computeType: "float16" | "int8_float16" | "int8" | "float32";
  beamSize: number;
  maxAudioSeconds: number;
  snapshotIntervalSeconds: number;
  idleSeconds: number;
  loadTimeoutMs: number;
  decodeTimeoutMs: number;
  finalTimeoutMs: number;
};
export const defaults = {
  model: "medium",
  device: "cuda",
  computeType: "float16",
  beamSize: 5,
  maxAudioSeconds: 30,
  snapshotIntervalSeconds: 0,
  idleSeconds: 120,
  loadTimeoutMs: 90000,
  decodeTimeoutMs: 15000,
  finalTimeoutMs: 4500,
} as const;
const bounds: Record<string, [number, number]> = {
  beamSize: [1, 5],
  maxAudioSeconds: [1, 120],
  snapshotIntervalSeconds: [0, 10],
  idleSeconds: [1, 3600],
  loadTimeoutMs: [1000, 120000],
  decodeTimeoutMs: [100, 30000],
  finalTimeoutMs: [100, 4500],
};
export function parseConfig(raw: Record<string, unknown>): Config {
  const c = { ...defaults, ...raw } as Record<string, unknown>;
  for (const key of Object.keys(c)) {
    if (!(key in defaults) && key !== "python" && key !== "modelPath") {
      throw new Error(`Unknown Faster-Whisper setting: ${key}`);
    }
  }
  for (const key of ["python", "modelPath"]) {
    if (typeof c[key] !== "string" || !isAbsolute(c[key] as string)) {
      throw new Error(
        `Faster-Whisper ${key} must be an absolute provisioned path`,
      );
    }
  }
  if (
    typeof c.model !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(c.model)
  )
    throw new Error("Invalid model label");
  if (!["cuda", "cpu"].includes(String(c.device)))
    throw new Error("Invalid device");
  if (
    !["float16", "int8_float16", "int8", "float32"].includes(
      String(c.computeType),
    )
  )
    throw new Error("Invalid computeType");
  for (const [key, [min, max]] of Object.entries(bounds)) {
    const n = c[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max)
      throw new Error(`Invalid ${key}`);
  }
  if (!Number.isInteger(c.beamSize))
    throw new Error("beamSize must be an integer");
  return c as Config;
}
