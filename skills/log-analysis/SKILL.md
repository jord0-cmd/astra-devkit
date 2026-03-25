---
name: log-analysis
description: Use this skill when debugging errors, analyzing logs, troubleshooting crashes, monitoring Docker containers, checking system health, investigating performance issues, or when logs/errors/warnings are mentioned. Contains log analysis methodology, Docker debugging, structured logging patterns, and root cause analysis workflows.
---

# Log Analysis

Systematic log analysis for debugging, troubleshooting, and root cause investigation.

---

## Methodology

When debugging from logs, follow this order:

1. **What happened?** — Find the error, crash, or anomaly
2. **When did it happen?** — Establish timeline
3. **What changed?** — Recent deployments, config changes, traffic spikes
4. **What's the blast radius?** — One user, all users, one service, cascade?
5. **What's the root cause?** — Follow the chain backward
6. **What's the fix?** — Address root cause, not symptoms

Don't jump to fixes before understanding the timeline.

---

## Docker Container Logs

### Essential Commands

```bash
# View logs (last 100 lines)
docker logs --tail 100 container_name

# Follow logs in real-time
docker logs -f container_name

# Logs with timestamps
docker logs -t container_name

# Logs since a specific time
docker logs --since "2024-01-15T10:00:00" container_name
docker logs --since "30m" container_name

# Logs between times
docker logs --since "1h" --until "30m" container_name

# Search for errors
docker logs container_name 2>&1 | grep -i "error\|exception\|fatal\|panic"

# Count error types
docker logs container_name 2>&1 | grep -i "error" | sort | uniq -c | sort -rn

# Docker Compose — all services
docker compose logs --tail 50
docker compose logs -f service_name

# Container exit info
docker inspect container_name --format='{{.State.ExitCode}} {{.State.Error}}'

# Last exit details
docker inspect container_name --format='{{json .State}}' | jq
```

### Container Crash Debugging

```bash
# 1. Check exit code
docker inspect container_name --format='{{.State.ExitCode}}'
# Exit 0 = clean shutdown, 1 = app error, 137 = OOM killed, 139 = segfault

# 2. Get logs from crashed container
docker logs container_name 2>&1 | tail -50

# 3. Check OOM kill
dmesg | grep -i "oom\|killed"
docker inspect container_name --format='{{.State.OOMKilled}}'

# 4. Check resource usage before crash
docker stats --no-stream

# 5. Check events timeline
docker events --since "1h" --filter container=container_name
```

### Log Rotation (prevent disk exhaustion)

```json
// /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  }
}
```

Never run production containers without log rotation configured.

---

## System Logs

```bash
# System journal (systemd)
journalctl -u service_name --since "1 hour ago"
journalctl -u service_name -f            # Follow
journalctl -p err --since "today"         # Errors only

# Kernel logs (OOM, hardware issues)
dmesg | tail -50
dmesg | grep -i "error\|oom\|gpu\|nvidia"

# Auth/security logs
journalctl -u sshd --since "today"

# Nginx/Apache
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log | awk '{print $9}' | sort | uniq -c | sort -rn
```

---

## Application Log Analysis

### Structured Logging (JSON)

Modern applications should log in JSON format for easy parsing:

```bash
# Parse JSON logs with jq
docker logs container 2>&1 | jq -r 'select(.level == "ERROR") | "\(.timestamp) \(.message)"'

# Count errors by type
docker logs container 2>&1 | jq -r 'select(.level == "ERROR") | .error_type' | sort | uniq -c | sort -rn

# Find slow requests
docker logs container 2>&1 | jq -r 'select(.duration_ms > 1000) | "\(.timestamp) \(.path) \(.duration_ms)ms"'

# Trace a request by ID
docker logs container 2>&1 | jq -r 'select(.request_id == "abc-123")'
```

### Common Log Patterns to Search

```bash
# HTTP errors
grep -E "HTTP/[12]\.[01]\" [45][0-9]{2}" access.log

# Stack traces (Python)
grep -A 20 "Traceback" app.log

# Stack traces (Node.js)
grep -A 10 "Error:" app.log

# Connection issues
grep -i "connection refused\|timeout\|ECONNRESET\|ECONNREFUSED" app.log

# Memory issues
grep -i "out of memory\|OOM\|MemoryError\|heap" app.log

# Slow queries
grep -i "slow query\|duration.*[0-9]\{4,\}ms" app.log
```

---

## Root Cause Analysis Workflow

### Step 1: Establish Timeline

```bash
# When did errors start?
grep -i "error" app.log | head -5    # First errors
grep -i "error" app.log | tail -5    # Most recent

# Error frequency over time
grep -i "error" app.log | awk '{print $1}' | cut -d'T' -f1,2 | uniq -c
```

### Step 2: Correlate Across Services

```bash
# Check multiple services around the same timeframe
for svc in api worker database redis; do
  echo "=== $svc ==="
  docker logs --since "30m" "$svc" 2>&1 | grep -i "error\|warn" | tail -5
done
```

### Step 3: Check What Changed

```bash
# Recent deployments
docker images --format "{{.Repository}}:{{.Tag}} {{.CreatedAt}}" | head -10

# Recent config changes
git log --oneline -10

# Environment changes
docker inspect container_name --format='{{json .Config.Env}}' | jq
```

### Step 4: Classify the Issue

| Pattern | Likely Category | Next Steps |
|---------|----------------|------------|
| Sudden spike in 500s | Code bug or dependency failure | Check recent deploy, rollback |
| Gradual memory increase | Memory leak | Profile, check for unbounded caches |
| Periodic timeouts | Resource exhaustion | Check connection pools, file handles |
| Single-user errors | Data issue | Check specific request, input validation |
| All services affected | Infrastructure | Check network, DNS, disk space |
| After deploy | Regression | Diff previous version, rollback |

---

## GPU/CUDA Log Analysis

```bash
# GPU status
nvidia-smi

# GPU errors in system log
dmesg | grep -i "nvidia\|gpu\|cuda"

# CUDA errors in application
docker logs gpu_container 2>&1 | grep -i "cuda\|gpu\|memory\|nccl"

# Common CUDA issues
# "CUDA out of memory" → reduce batch size, check for memory leaks
# "CUDA error: device-side assert" → bad tensor shapes or values
# "NCCL timeout" → multi-GPU sync issue, check network
# "cuDNN error" → version mismatch, check compatibility matrix
```

---

## Performance Debugging from Logs

### API Latency

```bash
# Find slowest requests
grep "duration" app.log | jq -r '"\(.duration_ms)ms \(.method) \(.path)"' | sort -rn | head -20

# Average response time by endpoint
grep "duration" app.log | jq -r '"\(.path) \(.duration_ms)"' | \
  awk '{sum[$1]+=$2; count[$1]++} END {for(k in sum) print k, sum[k]/count[k] "ms"}' | sort -k2 -rn
```

### Database Slow Queries

```bash
# PostgreSQL slow query log
grep "duration:" /var/log/postgresql/postgresql.log | awk -F'duration: ' '{print $2}' | sort -rn | head -10

# SQLAlchemy query logging
grep "SELECT\|INSERT\|UPDATE\|DELETE" app.log | grep -oP 'duration=\K[0-9.]+' | sort -rn | head -10
```

### Memory Leaks

```bash
# Track container memory over time
while true; do
  docker stats --no-stream --format "{{.Name}}: {{.MemUsage}}" | grep target_container
  sleep 60
done >> memory_tracking.log
```

---

## Proactive Health Checks

Run after deployments or when things "seem fine":

```bash
#!/bin/bash
echo "=== Post-Deploy Health Check ==="

# 1. All containers running?
echo "--- Container Status ---"
docker compose ps

# 2. Any recent errors?
echo "--- Recent Errors (last 5 min) ---"
docker compose logs --since "5m" 2>&1 | grep -i "error\|fatal\|panic" | tail -20

# 3. Any OOM kills?
echo "--- OOM Events ---"
dmesg | grep -i "oom" | tail -5

# 4. Resource usage
echo "--- Resource Usage ---"
docker stats --no-stream

# 5. Health endpoints
echo "--- Health Checks ---"
curl -s http://localhost:8000/health | jq
curl -s http://localhost:3000 > /dev/null && echo "Frontend: OK" || echo "Frontend: DOWN"
```

---

## Log Formatting Cheat Sheet

When setting up logging in applications:

```python
# Python — structlog (recommended)
import structlog
logger = structlog.get_logger()
logger.info("request_processed", path="/api/users", duration_ms=42, status=200)
# Output: {"event": "request_processed", "path": "/api/users", "duration_ms": 42, "status": 200, "timestamp": "..."}

# Python — stdlib
import logging
logging.basicConfig(format='%(asctime)s %(levelname)s %(name)s %(message)s')
```

```typescript
// Node.js — pino (recommended)
import pino from "pino";
const logger = pino();
logger.info({ path: "/api/users", duration: 42 }, "request processed");
```

### Log Levels

| Level | When to Use |
|-------|-------------|
| **DEBUG** | Detailed diagnostic info (dev only) |
| **INFO** | Normal operations, key events, request completion |
| **WARN** | Degraded but functional (approaching limits, retries) |
| **ERROR** | Failed operations that need attention |
| **FATAL** | Application cannot continue, about to crash |

---

## Anti-Patterns

- **Logging sensitive data** — never log passwords, tokens, PII, credit cards
- **No log rotation** — fills disk, crashes containers
- **print() instead of logger** — no levels, no structure, no timestamp
- **Logging everything** — noise drowns signal, increases costs
- **No request ID** — impossible to trace a request across services
- **Catching and swallowing** — `except: pass` hides the problem

---

*Logs tell you what happened. Good logs tell you why. Follow the trail.*
