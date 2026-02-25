#!/bin/sh
set -eu

log() {
  printf '[entrypoint] %s\n' "$*"
}

ANTISPOOF_ENABLED="${ANTISPOOF_ENABLED:-true}"
MODEL_PATH="${ANTISPOOF_MODEL_PATH:-models/minifasnet_v2.onnx}"
MODEL_URL_RAW="${ANTISPOOF_MODEL_URL:-}"
DEFAULT_MODEL_URL="https://raw.githubusercontent.com/feni-katharotiya/Silent-Face-Anti-Spoofing-TFLite/master/converted_models/onnx/2.7_80x80_MiniFASNetV2.onnx"

# Normalize accidental CRLF/whitespace/quoted env values.
MODEL_URL="$(printf '%s' "$MODEL_URL_RAW" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
case "$MODEL_URL" in
  \"*\")
    MODEL_URL="${MODEL_URL#\"}"
    MODEL_URL="${MODEL_URL%\"}"
    ;;
  \'*\')
    MODEL_URL="${MODEL_URL#\'}"
    MODEL_URL="${MODEL_URL%\'}"
    ;;
esac

if [ -z "$MODEL_URL" ]; then
  MODEL_URL="$DEFAULT_MODEL_URL"
fi

case "$MODEL_URL" in
  http://*|https://*) ;;
  *)
    log "WARNING: Invalid ANTISPOOF_MODEL_URL ('$MODEL_URL'). Falling back to default URL."
    MODEL_URL="$DEFAULT_MODEL_URL"
    ;;
esac

if [ "$ANTISPOOF_ENABLED" = "true" ]; then
  mkdir -p "$(dirname "$MODEL_PATH")"

  if [ ! -s "$MODEL_PATH" ]; then
    log "Anti-spoof model missing. Downloading model to $MODEL_PATH"
    curl -fL --retry 3 --retry-delay 2 "$MODEL_URL" -o "$MODEL_PATH"
    log "Anti-spoof model downloaded"
  else
    log "Anti-spoof model found at $MODEL_PATH"
  fi
fi

exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-5002}"
