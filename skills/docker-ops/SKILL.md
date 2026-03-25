---
name: docker-ops
description: Use this skill when working with Docker, writing Dockerfiles, configuring Docker Compose, optimizing container images, debugging container issues, or deploying containerized applications. Contains Dockerfile best practices, multi-stage builds, Compose patterns, security hardening, and debugging workflows.
---

# Docker Ops

Containers done right. Build small, run secure, debug fast.

---

## Dockerfile Best Practices

### Multi-Stage Builds

Separate build dependencies from runtime. Final image contains only what's needed.

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY . .
RUN npm run build

# Stage 2: Runtime (10-50x smaller)
FROM node:22-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
USER app
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Python Multi-Stage

```dockerfile
# Build
FROM python:3.12-slim AS builder
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY src/ src/

# Runtime
FROM python:3.12-slim
WORKDIR /app
RUN useradd -r -s /bin/false app
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src src/
ENV PATH="/app/.venv/bin:$PATH"
USER app
EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Layer Optimization

```dockerfile
# BAD — each RUN creates a layer, cache busted by apt-get update
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get install -y git
RUN apt-get clean

# GOOD — single layer, clean in same step
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl git && \
    rm -rf /var/lib/apt/lists/*
```

### Copy Order Matters (Cache)

```dockerfile
# Dependencies first (changes less often — cached)
COPY package*.json ./
RUN npm ci

# Source code last (changes often — rebuilds from here)
COPY . .
RUN npm run build
```

### .dockerignore

Always include. Reduces build context, prevents leaking secrets.

```
node_modules
.git
.env
*.log
dist
__pycache__
.venv
.pytest_cache
coverage
```

---

## Base Image Selection

| Need | Image | Size |
|------|-------|------|
| Node.js | `node:22-alpine` | ~50MB |
| Python | `python:3.12-slim` | ~120MB |
| Go | `golang:1.22-alpine` (build) → `gcr.io/distroless/static` (run) | ~2MB runtime |
| Rust | `rust:1.77-slim` (build) → `debian:bookworm-slim` (run) | ~80MB runtime |
| Minimal | `alpine:3.20` | ~7MB |
| Ultra-minimal | `gcr.io/distroless/static` | ~2MB |

**Rules:**
- Never use `latest` tag — pin versions (`node:22.2-alpine`, not `node:latest`)
- Prefer `-slim` or `-alpine` variants
- For production, consider distroless (no shell, no package manager — smallest attack surface)

---

## Docker Compose

### Development

```yaml
services:
  app:
    build:
      context: .
      target: builder  # Use build stage for dev
    volumes:
      - .:/app          # Hot reload
      - /app/node_modules  # Don't override node_modules
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=dev
      - POSTGRES_PASSWORD=dev
      - POSTGRES_DB=myapp_dev
    volumes:
      - db_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  db_data:
```

### Production Override

```yaml
# docker-compose.prod.yml
services:
  app:
    build:
      target: runtime  # Use runtime stage
    volumes: []  # No bind mounts in prod
    environment:
      - NODE_ENV=production
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "3"
```

```bash
# Run production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Health Checks

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

For containers without curl:

```yaml
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://localhost:3000/health || exit 1"]
```

---

## Security

### Run as Non-Root

```dockerfile
# Create user
RUN addgroup -S app && adduser -S app -G app

# Own the files
COPY --chown=app:app . .

# Switch to non-root
USER app
```

### No Secrets in Images

```dockerfile
# NEVER
ENV API_KEY=sk-1234567890
COPY .env .

# YES — pass at runtime
# docker run -e API_KEY=$API_KEY myapp
# Or use Docker secrets / env_file
```

### Read-Only Filesystem

```yaml
services:
  app:
    read_only: true
    tmpfs:
      - /tmp
      - /app/tmp
```

### Drop Capabilities

```yaml
services:
  app:
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE  # Only if binding port < 1024
```

### Scan for Vulnerabilities

```bash
# Docker Scout (built-in)
docker scout cves myimage:latest

# Trivy (comprehensive)
trivy image myimage:latest
```

---

## Debugging Containers

### Container Won't Start

```bash
# Check logs
docker logs container_name

# Check exit code (0=clean, 1=error, 137=OOM, 139=segfault)
docker inspect container_name --format='{{.State.ExitCode}}'

# Check OOM kill
docker inspect container_name --format='{{.State.OOMKilled}}'

# Run interactively to debug
docker run -it --entrypoint /bin/sh myimage
```

### Container Running but Broken

```bash
# Exec into running container
docker exec -it container_name /bin/sh

# Check processes
docker top container_name

# Resource usage
docker stats container_name

# Network
docker network inspect bridge
docker exec container_name ping other_service
```

### Compose Issues

```bash
# Service dependencies and status
docker compose ps

# Rebuild without cache
docker compose build --no-cache

# Check config is valid
docker compose config

# Follow all logs
docker compose logs -f

# Check specific service
docker compose logs -f service_name --tail 50
```

### Networking Debug

```bash
# List networks
docker network ls

# Inspect network
docker network inspect myapp_default

# DNS resolution inside container
docker exec container_name nslookup other_service

# Container can't reach host
# Use host.docker.internal (Docker Desktop) or 172.17.0.1 (Linux)
```

---

## Image Optimization

### Reduce Image Size

```bash
# Check image size
docker images myapp

# Layer history (which layers are biggest)
docker history myapp:latest

# Dive tool (interactive layer explorer)
dive myapp:latest
```

### Common Size Wins

| Action | Typical Savings |
|--------|----------------|
| Alpine base instead of Ubuntu | 100-200MB |
| Multi-stage build | 200-500MB |
| `--no-install-recommends` on apt | 50-100MB |
| Clean apt cache in same RUN | 30-50MB |
| `.dockerignore` node_modules/git | Build context 80%+ |
| `npm ci --only=production` | 50%+ of node_modules |

---

## Useful Commands

```bash
# Build
docker build -t myapp:latest .
docker compose build

# Run
docker compose up -d
docker compose down
docker compose restart service_name

# Clean up
docker system prune -f           # Remove unused containers/images/networks
docker volume prune -f            # Remove unused volumes
docker builder prune -f           # Remove build cache

# Registry
docker tag myapp:latest registry.example.com/myapp:v1.2.3
docker push registry.example.com/myapp:v1.2.3

# Save/Load (offline transfer)
docker save myapp:latest | gzip > myapp.tar.gz
docker load < myapp.tar.gz
```

---

## Anti-Patterns

- **`latest` tag** — unpredictable, breaks reproducibility. Pin versions.
- **Root user** — security risk. Always `USER non-root`.
- **Secrets in image** — use runtime env vars or Docker secrets. Never bake in.
- **No `.dockerignore`** — sends entire context (including .git, node_modules).
- **One giant layer** — order commands for cache efficiency.
- **No health checks** — orchestrators can't restart unhealthy containers.
- **No resource limits** — one container can consume all host resources.
- **`apt-get upgrade` in Dockerfile** — rebuilds change over time. Pin base image instead.
- **Multiple processes per container** — one process per container. Use Compose for multi-service.

---

## Dockerfile Checklist

Before shipping a Dockerfile:

- [ ] Multi-stage build (build vs runtime)
- [ ] Pinned base image version
- [ ] Non-root user
- [ ] `.dockerignore` present
- [ ] No secrets in image
- [ ] Layer order optimized for cache
- [ ] Cleanup in same RUN as install
- [ ] Health check defined
- [ ] Resource limits in Compose
- [ ] Log rotation configured

---

*Small images. Non-root. Pinned versions. Health checks. These aren't nice-to-haves — they're the baseline.*
