# Ollama Ops

Manage local Ollama models and OpenWebUI integration.

## Activation

Use when: user asks about "ollama", "local models", "pull a model", "list models",
"model info", "remove a model", "VRAM", "quantisation", or OpenWebUI model management.

## Ollama CLI Commands

### List models
```bash
ollama list                    # All downloaded models
ollama list --json             # JSON output for parsing
```

### Pull models
```bash
ollama pull gemma3:27b         # Pull specific model + tag
ollama pull llama3.3:70b-instruct-q4_K_M  # Pull specific quantisation
```

### Model info
```bash
ollama show gemma3:27b         # Model details (params, template, licence)
ollama show gemma3:27b --modelfile  # Full modelfile
```

### Remove models
```bash
ollama rm gemma3:27b           # Remove a model
```

### Running models
```bash
ollama ps                      # Show loaded models and VRAM usage
ollama stop gemma3:27b         # Unload from VRAM
```

### Server management
```bash
ollama serve                   # Start server (default :11434)
OLLAMA_HOST=0.0.0.0 ollama serve  # Listen on all interfaces
```

## OpenWebUI API Integration

Base URL: `http://localhost:3000` (or `OPEN_WEBUI_URL` env var)

### List models via API
```bash
curl -s http://localhost:3000/api/models | python3 -m json.tool
```

### Create/update model config
```bash
curl -X POST http://localhost:3000/api/models/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPEN_WEBUI_TOKEN" \
  -d @model.json
```

### Import model config from JSON
Use the card-builder skill to generate `model.json`, then:
```bash
curl -X POST http://localhost:3000/api/models/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPEN_WEBUI_TOKEN" \
  -d @model.json
```

## VRAM Budget Guide

| Model Size | Quantisation | VRAM Required | RTX 4090 (24GB) |
|-----------|-------------|--------------|-----------------|
| 7-9B      | Q4_K_M      | ~5 GB        | Fits easily     |
| 14B       | Q4_K_M      | ~9 GB        | Fits            |
| 27B       | Q4_K_M      | ~16 GB       | Fits (tight)    |
| 32B       | Q4_K_M      | ~20 GB       | Fits (max ctx ~8K) |
| 70B       | Q4_K_M      | ~40 GB       | Does NOT fit    |
| 70B       | Q2_K        | ~26 GB       | Marginal        |

## Rules

1. Always check `ollama ps` before pulling large models — warn about VRAM conflicts
2. Prefer Q4_K_M quantisation for balance of quality and VRAM
3. When removing models, confirm with user first — downloads can be slow
4. For OpenWebUI API calls, always check if `OPEN_WEBUI_TOKEN` is set
5. Never expose API tokens in command output — use env vars
6. Default model recommendation: `gemma3:27b` (best quality/VRAM for 24GB cards)

## Common Workflows

### "Set up a new model for OpenWebUI"
1. `ollama pull <model>` — download the base model
2. Use card-builder skill — generate model.json with system prompt and params
3. Import to OpenWebUI via API or manual upload

### "What models do I have and how much space?"
1. `ollama list` — show all models with sizes
2. `ollama ps` — show loaded models and VRAM
3. `df -h ~/.ollama` — disk space used by models

### "My model is slow"
1. Check `ollama ps` — is another model loaded eating VRAM?
2. Check num_ctx — lower context = faster inference
3. Check quantisation — Q4_K_M is the sweet spot
4. Check if model fits in VRAM — partial offload to CPU kills speed
