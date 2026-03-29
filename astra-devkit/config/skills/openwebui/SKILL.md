---
name: openwebui
description: Use this skill when working with OpenWebUI, Ollama, building RAG systems, creating pipelines, managing knowledge bases, or doing any local LLM infrastructure work. Contains complete API references, cURL examples, RAG workflows, and deployment patterns.
---

# OpenWebUI & Ollama

Complete API reference for programmatic control of OpenWebUI and Ollama.

---

## Architecture

```
Your Scripts --> OpenWebUI API (port 3000/8080) --> Ollama API (port 11434)
                     |                                    |
                     +-- /api/* (management)              +-- /api/generate
                     +-- /api/v1/* (files, RAG)           +-- /api/chat
                     +-- /v1/* (OpenAI compat)            +-- /api/embed
                     +-- /ollama/* (passthrough)          +-- /api/tags
```

---

## Authentication

```bash
# Header format (both systems)
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

# Get JWT from credentials
curl -X POST https://openwebui/auths/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"xxx"}'
# Returns: {"token": "eyJ...", "token_type": "Bearer"}
```

---

## Essential Endpoints

| Action | Endpoint | Method |
|--------|----------|--------|
| Health check | `/health` | GET |
| List models | `/api/models` | GET |
| Chat completion | `/api/chat/completions` | POST |
| Upload file | `/api/v1/files/` | POST |
| File status | `/api/v1/files/{id}/process/status` | GET |
| Create KB | `/api/v1/knowledge/create` | POST |
| List KBs | `/api/v1/knowledge/` | GET |
| Add file to KB | `/api/v1/knowledge/{kb}/file/add` | POST |
| Ollama generate | `/ollama/api/generate` | POST |
| Ollama embed | `/ollama/api/embed` | POST |

---

## Chat Completions

**Non-streaming:**
```bash
curl -X POST https://openwebui/api/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Explain containerisation."}
    ],
    "temperature": 0.3
  }'
```

**Streaming:**
```bash
curl -X POST https://openwebui/api/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1",
    "messages": [{"role": "user", "content": "Explain..."}],
    "stream": true
  }'
# Returns: data: {"choices":[{"delta":{"content":"token"}}]}
# Final:   data: [DONE]
```

**With RAG (Knowledge Base):**
```bash
curl -X POST https://openwebui/api/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1",
    "messages": [{"role": "user", "content": "What does the policy say about X?"}],
    "files": [{"type": "collection", "id": "KB_ID_HERE"}],
    "temperature": 0.1
  }'
```

---

## RAG Workflow

### Step 1: Upload Document

```bash
curl -X POST https://openwebui/api/v1/files/ \
  -H "Authorization: Bearer $API_KEY" \
  -F "file=@/path/to/document.pdf"
# Returns: {"id": "file-abc123", ...}
```

### Step 2: Wait for Processing

```bash
# Poll until status == "completed"
curl -X GET https://openwebui/api/v1/files/file-abc123/process/status \
  -H "Authorization: Bearer $API_KEY"
# Returns: {"status": "completed"} or {"status": "pending"}
```

Large PDFs can take several minutes. Poll, don't guess.

### Step 3: Create Knowledge Base

```bash
curl -X POST https://openwebui/api/v1/knowledge/create \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Project Documentation",
    "description": "Internal project docs and specs",
    "data": {},
    "access_control": {}
  }'
# Returns: {"id": "kb-xyz789", ...}
```

### Step 4: Add File to Knowledge Base

```bash
curl -X POST https://openwebui/api/v1/knowledge/kb-xyz789/file/add \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"file_id": "file-abc123"}'
```

### Step 5: Query with RAG

```bash
curl -X POST https://openwebui/api/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1",
    "messages": [{"role": "user", "content": "Summarise the architecture"}],
    "files": [{"type": "collection", "id": "kb-xyz789"}]
  }'
```

### Knowledge Base Management

```bash
# List all knowledge bases
curl -X GET https://openwebui/api/v1/knowledge/ \
  -H "Authorization: Bearer $API_KEY"

# Delete a knowledge base
curl -X DELETE https://openwebui/api/v1/knowledge/kb-xyz789/delete \
  -H "Authorization: Bearer $API_KEY"

# Delete a file
curl -X DELETE https://openwebui/api/v1/files/file-abc123 \
  -H "Authorization: Bearer $API_KEY"
```

---

## Ollama API

### Direct Generation

```bash
curl http://ollama:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "Explain quantum computing",
  "stream": false,
  "options": {
    "temperature": 0.7,
    "num_ctx": 8192
  }
}'
```

### Chat Format

```bash
curl http://ollama:11434/api/chat -d '{
  "model": "llama3.2",
  "messages": [
    {"role": "system", "content": "You are helpful."},
    {"role": "user", "content": "Hello!"}
  ],
  "stream": false
}'
```

### Embeddings (Batch)

```bash
curl http://ollama:11434/api/embed -d '{
  "model": "nomic-embed-text",
  "input": [
    "First document text",
    "Second document text"
  ]
}'
# Returns: {"embeddings": [[0.1, -0.2, ...], [...]]}
```

### Model Management

```bash
curl http://ollama:11434/api/tags                    # List models
curl http://ollama:11434/api/show -d '{"model": "llama3.2"}'  # Model info
curl http://ollama:11434/api/pull -d '{"model": "llama3.2", "stream": true}'  # Pull
curl -X DELETE http://ollama:11434/api/delete -d '{"model": "old-model"}'  # Delete
curl http://ollama:11434/api/ps                      # Running models
```

---

## RAG Best Practices

### Chunking Configuration

```yaml
CHUNK_SIZE: 1500          # Larger for document coherence
CHUNK_OVERLAP: 200        # Preserve cross-references
ENABLE_RAG_HYBRID_SEARCH: true  # Combines semantic + keyword search
RAG_RERANKING_MODEL: BAAI/bge-reranker-v2-m3  # Improves relevance
```

### Context Length

Ollama defaults to 2048 tokens — too short for RAG. Increase to 8192+:
- Admin Panel > Models > Settings > Advanced Parameters > Context Length
- Or set `num_ctx` in API calls

### Temperature by Use Case

| Use Case | Temperature |
|----------|-------------|
| Factual/citation-heavy | 0.1 |
| Q&A | 0.3 |
| Creative | 0.7-1.0 |

### Performance Tips

- Preload frequently-used models: `ollama run model --keep-alive`
- Use `nomic-embed-text` for embeddings (fast, good quality)
- Enable hybrid search for mixed content (text + numbers/codes)
- Batch embeddings — single API call for multiple documents

---

## Docker Deployment

```yaml
services:
  openwebui:
    image: ghcr.io/open-webui/open-webui:main
    ports:
      - "3000:8080"
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434
      - ENABLE_API_KEYS=true
      - WEBUI_AUTH=true
    volumes:
      - openwebui_data:/app/backend/data
    depends_on:
      - ollama

  ollama:
    image: ollama/ollama:latest
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    environment:
      - OLLAMA_HOST=0.0.0.0
    volumes:
      - ollama_data:/root/.ollama
    ports:
      - "11434:11434"

volumes:
  openwebui_data:
  ollama_data:
```

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized | Invalid/expired API key | Check key, verify `ENABLE_API_KEYS=True` |
| 403 Forbidden | Permission denied (v0.7.0+) | Check user permissions in admin |
| File processing stuck | Large file / extraction error | Poll status endpoint, check logs |
| Connection refused to Ollama | Network/port issue | Verify `OLLAMA_HOST=0.0.0.0`, check Docker network |
| RAG empty results | File not processed or not in KB | Verify processing completed, check KB membership |
| Slow first response | Model not loaded | Preload with `ollama run model --keep-alive` |

### v0.7.0+ Breaking Change

Permission enforcement moved to backend. API calls to disabled features now return **403** instead of silently failing. Update scripts accordingly.

---

*Local LLMs, your rules, your data. API by API, endpoint by endpoint.*
