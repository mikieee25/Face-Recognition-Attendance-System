#!/bin/sh
set -eu

log() {
  printf '[entrypoint] %s\n' "$*"
}

ANTISPOOF_ENABLED="${ANTISPOOF_ENABLED:-true}"
MODEL_PATH="${ANTISPOOF_MODEL_PATH:-models/minifasnet_v2.onnx}"
MODEL_URL="${ANTISPOOF_MODEL_URL:-}"

if [ "$ANTISPOOF_ENABLED" = "true" ]; then
  mkdir -p "$(dirname "$MODEL_PATH")"

  if [ ! -s "$MODEL_PATH" ]; then
    if [ -n "$MODEL_URL" ]; then
      log "Anti-spoof model missing. Downloading from ANTISPOOF_MODEL_URL to $MODEL_PATH"
      curl -fL --retry 3 --retry-delay 2 "$MODEL_URL" -o "$MODEL_PATH"
      log "Anti-spoof model downloaded"
    else
      log "WARNING: ANTISPOOF_ENABLED=true but model missing at $MODEL_PATH and ANTISPOOF_MODEL_URL is empty"
    fi
  else
    log "Anti-spoof model found at $MODEL_PATH"
  fi
fi

exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-5002}"
