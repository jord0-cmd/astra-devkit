---
name: ml-ops
description: Use this skill when working with PyTorch models, CUDA/GPU operations, Docker GPU containers, model inference, model serving, or any ML infrastructure. Contains environment verification, CUDA compatibility, Docker GPU patterns, model serving with FastAPI, and production optimization.
---

# ML-Ops

PyTorch + CUDA + GPU Containers. Verify first, measure everything, ship what works.

---

## Core Principles

1. **Verify CUDA before anything else** — GPU issues waste hours. Check first, code second.
2. **Pin everything** — PyTorch, CUDA, cuDNN versions must be explicit and compatible.
3. **Containers are reproducible** — same image in dev and prod. No "works on my machine".
4. **Fail on startup, not inference** — catch environment issues immediately, not mid-batch.
5. **Separate training from serving** — different requirements, different containers.

---

## CUDA Compatibility Matrix

These versions must match. Mismatches = runtime errors.

| PyTorch | CUDA | cuDNN | Python | Notes |
|---------|------|-------|--------|-------|
| 2.5.x | 12.4 | 9.1 | 3.10-3.12 | Latest stable |
| 2.4.x | 12.4 | 9.1 | 3.10-3.12 | Production recommended |
| 2.3.x | 12.1 | 8.9 | 3.10-3.12 | LTS candidate |

**Driver Requirements:**

| CUDA | Minimum Driver | Recommended |
|------|----------------|-------------|
| 12.4 | 550.54+ | 555.xx+ |
| 12.1 | 530.30+ | 535.xx+ |

---

## GPU Health Check

Run this before any ML work:

```python
#!/usr/bin/env python3
"""GPU health check — run before any ML work."""

import sys

def check_gpu():
    try:
        import torch
    except ImportError:
        print("FAIL: PyTorch not installed")
        sys.exit(1)

    print(f"PyTorch: {torch.__version__}")
    print(f"CUDA available: {torch.cuda.is_available()}")

    if not torch.cuda.is_available():
        print("FAIL: CUDA not available")
        sys.exit(1)

    print(f"CUDA version: {torch.version.cuda}")
    print(f"cuDNN version: {torch.backends.cudnn.version()}")
    print(f"GPU count: {torch.cuda.device_count()}")

    for i in range(torch.cuda.device_count()):
        props = torch.cuda.get_device_properties(i)
        mem_gb = props.total_mem / (1024 ** 3)
        print(f"  GPU {i}: {props.name} ({mem_gb:.1f} GB, compute {props.major}.{props.minor})")

    # Test basic CUDA operation
    try:
        x = torch.randn(100, 100, device="cuda")
        y = x @ x.T
        assert y.shape == (100, 100)
        print("CUDA test: PASSED")
    except Exception as e:
        print(f"CUDA test: FAILED — {e}")
        sys.exit(1)

if __name__ == "__main__":
    check_gpu()
```

---

## Docker GPU Patterns

### Prerequisites

```bash
# Install NVIDIA Container Toolkit (host machine)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# Verify
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi
```

### Base Image Selection

| Use Case | Image | When |
|----------|-------|------|
| Quick start | `pytorch/pytorch:2.5.0-cuda12.4-cudnn9-runtime` | Pre-built, compatible versions |
| Custom stack | `nvidia/cuda:12.4.1-devel-ubuntu22.04` | Fine-grained control |
| Serving only | `nvidia/cuda:12.4.1-runtime-ubuntu22.04` | Minimal runtime, no dev tools |

### Training Dockerfile

```dockerfile
FROM pytorch/pytorch:2.5.0-cuda12.4-cudnn9-runtime

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl && \
    rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Code
COPY src/ src/
COPY scripts/ scripts/

# Verify GPU on startup
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD python -c "import torch; assert torch.cuda.is_available()"

CMD ["python", "scripts/train.py"]
```

### Serving Dockerfile (Multi-Stage)

```dockerfile
# Stage 1: Build
FROM pytorch/pytorch:2.5.0-cuda12.4-cudnn9-runtime AS builder
WORKDIR /app
COPY requirements-serve.txt .
RUN pip install --no-cache-dir -r requirements-serve.txt
COPY src/ src/

# Stage 2: Runtime (smaller)
FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04
WORKDIR /app

# Copy Python and packages from builder
COPY --from=builder /opt/conda /opt/conda
ENV PATH="/opt/conda/bin:$PATH"
COPY --from=builder /app /app

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "src.serve:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Docker Compose with GPU

```yaml
services:
  training:
    build:
      context: .
      dockerfile: Dockerfile.train
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    volumes:
      - ./data:/app/data
      - ./checkpoints:/app/checkpoints
    shm_size: "8gb"  # Required for PyTorch DataLoader

  serving:
    build:
      context: .
      dockerfile: Dockerfile.serve
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    ports:
      - "8000:8000"
    environment:
      - MODEL_PATH=/app/models/latest.pt
    volumes:
      - ./models:/app/models:ro
```

**Note**: `shm_size: "8gb"` is required for PyTorch DataLoader with multiple workers. Without it, you'll get cryptic shared memory errors.

---

## PyTorch Patterns

### Device Management

```python
import torch

# Always detect device explicitly
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Move model to device
model = MyModel().to(device)

# Move data to device
inputs = inputs.to(device)
labels = labels.to(device)
```

### Memory-Efficient Inference

```python
@torch.inference_mode()  # Faster than torch.no_grad()
def predict(model: torch.nn.Module, inputs: torch.Tensor) -> torch.Tensor:
    return model(inputs)

# For large models — load with reduced memory
model = torch.load("model.pt", map_location=device, weights_only=True)
```

### Memory Monitoring

```python
def log_gpu_memory(tag: str = ""):
    if torch.cuda.is_available():
        allocated = torch.cuda.memory_allocated() / 1024**3
        reserved = torch.cuda.memory_reserved() / 1024**3
        print(f"[{tag}] GPU Memory: {allocated:.2f}GB allocated, {reserved:.2f}GB reserved")

# Memory-aware batch sizing
def get_safe_batch_size(model_memory_gb: float, gpu_memory_gb: float) -> int:
    available = gpu_memory_gb - model_memory_gb - 1.0  # 1GB headroom
    per_sample_gb = 0.01  # Estimate — profile your model
    return max(1, int(available / per_sample_gb))
```

### Gradient Checkpointing (Save Memory)

```python
from torch.utils.checkpoint import checkpoint

class LargeModel(torch.nn.Module):
    def forward(self, x):
        # Trade compute for memory — recompute activations during backward
        x = checkpoint(self.layer1, x, use_reentrant=False)
        x = checkpoint(self.layer2, x, use_reentrant=False)
        return self.head(x)
```

---

## Model Serving with FastAPI

```python
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from contextlib import asynccontextmanager

model = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    # Startup — load model
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = torch.load("model.pt", map_location=device, weights_only=True)
    model.eval()
    yield
    # Shutdown
    del model
    torch.cuda.empty_cache()

app = FastAPI(lifespan=lifespan)


class PredictRequest(BaseModel):
    data: list[float]


class PredictResponse(BaseModel):
    prediction: list[float]
    device: str


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "gpu_available": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "model_loaded": model is not None,
    }


@app.post("/predict", response_model=PredictResponse)
@torch.inference_mode()
async def predict(request: PredictRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    device = next(model.parameters()).device
    inputs = torch.tensor(request.data, device=device).unsqueeze(0)
    output = model(inputs)

    return PredictResponse(
        prediction=output.squeeze().tolist(),
        device=str(device),
    )
```

---

## Production Optimization

### ONNX Runtime (Faster Inference)

For production serving, consider converting to ONNX:

```python
import torch.onnx

# Export
dummy_input = torch.randn(1, 3, 224, 224, device="cuda")
torch.onnx.export(model, dummy_input, "model.onnx", opset_version=17)

# Serve with ONNX Runtime
import onnxruntime as ort

session = ort.InferenceSession("model.onnx", providers=["CUDAExecutionProvider"])
result = session.run(None, {"input": input_array})
```

ONNX Runtime is typically 2-3x faster than raw PyTorch for inference.

### Quantization

```python
# Dynamic quantization (CPU) — simplest, no calibration needed
quantized_model = torch.quantization.quantize_dynamic(
    model, {torch.nn.Linear}, dtype=torch.qint8
)

# Half precision (GPU) — halves memory, minimal accuracy loss
model = model.half()  # FP16
```

### TorchScript (JIT)

```python
# Script the model for optimized execution
scripted = torch.jit.script(model)
scripted.save("model_scripted.pt")

# Load without Python dependency
model = torch.jit.load("model_scripted.pt")
```

---

## Debugging GPU Issues

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| `CUDA out of memory` | Batch too large | Reduce batch size, gradient checkpointing |
| `CUDA error: device-side assert` | Invalid tensor op | Check input shapes, add assertions |
| `NCCL timeout` | Multi-GPU sync | Check network, increase timeout |
| `cuDNN error` | Version mismatch | Verify compatibility matrix |
| Container exits silently | OOM killer | Check `dmesg`, increase memory limits |
| Slow inference | CPU fallback | Verify model and data are on GPU |

### Debug Commands

```bash
nvidia-smi                              # GPU status
watch -n 1 nvidia-smi                   # Live monitoring
nvidia-smi dmon -s pucvmet              # Detailed metrics
nvcc --version                          # CUDA version
python -c "import torch; print(torch.version.cuda)"  # PyTorch CUDA
docker run --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi  # Docker GPU test
docker logs -f container 2>&1 | grep -i "cuda\|gpu\|memory"  # Container logs
```

---

## Verification Checklist

### Environment
- [ ] GPU health check passes
- [ ] CUDA/cuDNN versions match PyTorch requirements
- [ ] Container runs with GPU access
- [ ] Health endpoint reports healthy

### Model
- [ ] Model loads without errors
- [ ] Inference produces expected output shape
- [ ] Memory usage is within limits
- [ ] Batch inference works correctly

### Performance
- [ ] Inference time is acceptable
- [ ] Memory doesn't leak over time
- [ ] GPU utilization is reasonable
- [ ] Concurrent requests handled properly

### Container
- [ ] Multi-stage build (training vs serving)
- [ ] Health check configured
- [ ] shm_size set for DataLoader
- [ ] Handles OOM gracefully
- [ ] Logs are informative

---

*GPU power is nothing without control. Verify first. Measure everything. Ship what works.*
