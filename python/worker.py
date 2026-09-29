"""Private bounded stdio protocol. Never log audio, transcripts, or exception text."""
import base64
import ctypes
import signal
import json
import logging
import os
import sys
import sysconfig
from pathlib import Path

logging.disable(logging.CRITICAL)
MAX_LINE = 1300000
MAX_AUDIO = 960000


def decode_mulaw(data):
    import numpy as np
    from scipy.signal import resample_poly
    u = np.frombuffer(data, dtype=np.uint8).astype(np.int32) ^ 0xFF
    magnitude = (((u & 15) << 3) + 132) << ((u >> 4) & 7)
    pcm = np.where(u & 128, 132 - magnitude, magnitude - 132)
    return resample_poly(pcm.astype(np.float32) / 32768, 2, 1).astype(np.float32)


def reply(text="", error=None):
    result = {"ok": error is None, "text": text} if error is None else {"ok": False, "error": error}
    sys.stdout.write(json.dumps(result, ensure_ascii=True) + "\n")
    sys.stdout.flush()


def main():
    model = None
    config = None
    while True:
        line = sys.stdin.buffer.readline(MAX_LINE + 1)
        if not line:
            return
        try:
            if len(line) > MAX_LINE or not line.endswith(b"\n"):
                raise ValueError()
            request = json.loads(line)
            if request["op"] == "load" and model is None:
                from faster_whisper import WhisperModel
                import ctranslate2
                config = request["config"]
                if not os.path.isdir(config["modelPath"]):
                    raise ValueError()
                if config["computeType"] not in ctranslate2.get_supported_compute_types(config["device"]):
                    raise ValueError()
                model = WhisperModel(config["modelPath"], device=config["device"],
                                     compute_type=config["computeType"], cpu_threads=2,
                                     num_workers=1, local_files_only=True)
                reply()
            elif request["op"] == "decode" and model is not None:
                data = base64.b64decode(request["audio"], validate=True)
                if not data or len(data) > MAX_AUDIO:
                    raise ValueError()
                audio = decode_mulaw(data)
                # Exact digital silence needs no model and must not hallucinate.
                if not audio.any():
                    reply()
                    continue
                segments, _ = model.transcribe(audio, language=None, task="transcribe",
                    beam_size=config["beamSize"], vad_filter=False,
                    condition_on_previous_text=True, word_timestamps=False)
                parts = []
                size = 0
                for segment in segments:
                    size += len(segment.text)
                    if size > 16000:
                        raise ValueError()
                    parts.append(segment.text)
                reply("".join(parts).strip())
            else:
                raise ValueError()
        except Exception as exc:
            # Only inspect locally to classify; never emit the native error text.
            oom = "out of memory" in str(exc).lower()
            reply(error="gpu_oom" if oom else "worker_failed")
            return


if __name__ == "__main__":
    if sys.platform == "linux":
        parent = os.getppid()
        if ctypes.CDLL(None).prctl(1, signal.SIGTERM, 0, 0, 0) != 0:
            raise SystemExit(1)
        if os.getppid() != parent or parent == 1:
            raise SystemExit(1)
    # The environment owns CUDA userspace libraries. Re-exec before loading native
    # code so dlopen resolves split cuDNN libraries without any shared Python env.
    if os.environ.get("FW_CUDA_PATH_READY") != "1":
        site = Path(sysconfig.get_paths()["purelib"])
        libs = [site / "nvidia" / name / "lib" for name in ("cublas", "cudnn")]
        env = dict(os.environ, FW_CUDA_PATH_READY="1")
        env["LD_LIBRARY_PATH"] = ":".join(str(p) for p in libs if p.is_dir())
        os.execve(sys.executable, [sys.executable, "-I", str(Path(__file__).resolve())], env)
    main()
