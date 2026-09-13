#!/usr/bin/env bash
# Hardware/runtime report for choosing a local model (spec Step 1/8).
# Every check degrades gracefully — a missing tool prints "not available"
# instead of aborting the script, since this is meant to run as-is on
# whatever Linux box Light One ends up deployed on.
set -uo pipefail

echo "=== CPU ==="
if command -v nproc >/dev/null 2>&1; then
  echo "Cores: $(nproc)"
elif [ -f /proc/cpuinfo ]; then
  echo "Cores: $(grep -c ^processor /proc/cpuinfo)"
else
  echo "Cores: unknown (nproc not available, /proc/cpuinfo missing)"
fi
if [ -f /proc/cpuinfo ]; then
  model=$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2- | sed 's/^ //')
  [ -n "${model:-}" ] && echo "Model: $model"
fi

echo ""
echo "=== RAM ==="
if command -v free >/dev/null 2>&1; then
  free -h
else
  echo "free not available"
  [ -f /proc/meminfo ] && grep -E '^(MemTotal|MemAvailable):' /proc/meminfo
fi

echo ""
echo "=== GPU / VRAM / CUDA ==="
if command -v nvidia-smi >/dev/null 2>&1; then
  nvidia-smi --query-gpu=name,memory.total,memory.used,driver_version --format=csv
  if command -v nvcc >/dev/null 2>&1; then
    nvcc --version | grep -i release
  else
    echo "CUDA toolkit (nvcc): not found (driver may still support CUDA-enabled Ollama)"
  fi
else
  echo "No NVIDIA GPU detected (nvidia-smi not found) -> Ollama will run on CPU"
fi

echo ""
echo "=== Disk ==="
df -h / 2>/dev/null || echo "df not available"

echo ""
echo "=== Ollama ==="
if command -v ollama >/dev/null 2>&1; then
  ollama --version
  echo "--- installed models (ollama list) ---"
  ollama list 2>&1 || echo "ollama list failed (is 'ollama serve' running?)"
else
  echo "ollama not found on PATH. Install from https://ollama.com, then:"
  echo "  ollama pull <model>"
  echo "  ollama serve"
fi
