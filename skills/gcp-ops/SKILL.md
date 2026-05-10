---
name: gcp-ops
description: Use this skill when building on Google Cloud Platform — BigQuery, Vertex AI Gemini, Cloud Run, Cloud Storage, IAM service accounts, or anything region-pinned for Canadian data residency. Covers `gemini-2.5-pro` on regional endpoints (NOT `gemini-3.1-pro-preview` which is global-only and breaks residency), the still-required `_clean_schema` shim for `google-genai` structured output, BigQuery recursive CTEs + procedural LOOP scripts (with the `COUNT(DISTINCT) OVER` workaround), Cloud Run gen2 deployment patterns, and the verbatim provisioning script. Activate for any GCP / BigQuery / Vertex AI / Cloud Run work, especially under FINTRAC / Canadian compliance constraints.
---

# GCP Ops — BigQuery, Vertex AI Gemini, Cloud Run

Production GCP patterns under **Canadian data residency** (`northamerica-northeast1` / Montréal). Hackathon-budget conscious — no Spanner Enterprise, no slot reservations, no Provisioned Throughput.

---

## Hard rules — non-negotiable

1. **For data residency, use `gemini-2.5-pro` on a regional endpoint.** `gemini-3.1-pro-preview` is **global-endpoint only** — no regional ML processing guarantee. Breaks FINTRAC / Crown residency.
2. **Use the `google-genai` SDK** (`pip install google-genai`). `vertexai` submodules of `google-cloud-aiplatform` are deprecated as of 2025-06-24, removal 2026-06-24.
3. **The `_clean_schema` shim is still required** as of May 2026. The Gemini API accepts `additionalProperties` but the `google-genai` SDK rejects it client-side (issue #1815, closed-not-planned).
4. **Pin every service to `northamerica-northeast1`** at creation. Most services (BigQuery dataset, Cloud Storage bucket, Cloud Run service) have immutable region after creation.
5. **Stay on Montréal (NE1), not Toronto (NE2).** NE2 lacks BigQuery partition/cluster recommender, SQL translator, continuous queries, several BQML models. Use NE2 only for DR.
6. **BigQuery Graph (GQL preview) requires Enterprise reservation** (~$4k/month). Skip. Use recursive CTEs + procedural LOOP instead.
7. **Use ADC + service accounts on Cloud Run.** Never mount JSON keys.

---

## Service decision matrix

| Service | Role | Cost (hackathon scale) | Decision |
|---|---|---|---|
| **BigQuery** (on-demand) | Layer 1, 2, 3 SQL | First 1 TiB/month free; then $6.25/TiB | **Use** |
| BigQuery Graph (GQL preview) | Could replace recursive CTE | Enterprise reservation ~$4k/mo | **Skip** |
| **Vertex AI Gemini 2.5 Pro** | Layer 4 reasoning | $1.25/M input, $10/M output | **Use** for residency |
| Vertex AI Gemini 2.5 Flash | Cost-cutter / triage | Cheaper; faster | Backup |
| Vertex AI Gemini 3.1 Pro Preview | Smarter reasoning | $2/$12 — but **global only** | **Skip** for residency |
| **Cloud Run gen2** | Orchestrator + frontend | 2M req/mo + 180k vCPU-s + 360k GiB-s free | **Use** |
| **Cloud Storage** (regional bucket) | Data landing + audit freeze | First 5 GB free, then ~$0.020/GB-mo | **Use** |
| **Artifact Registry** | Container images | $0.10/GB-mo, 0.5 GB free | **Use** |
| Spanner Enterprise | Future-state graph store | $800+/node-mo | **Skip** for hackathon |

---

## BigQuery

### Provisioning

```bash
bq --location=northamerica-northeast1 mk \
  --dataset \
  --description="..." \
  --label=residency:canada \
  ${PROJECT_ID}:gargamel
```

`--location` is **immutable** after creation. Get it right the first time.

### Feature support in `northamerica-northeast1` (May 2026)

| Feature | Supported? | Notes |
|---|---|---|
| `WITH RECURSIVE` | Yes | 500-iteration cap |
| Window functions (`SUM/COUNT/AVG OVER`) | Yes | Standard |
| `COUNT(DISTINCT x) OVER (...)` | **No** | Engine limitation. Workaround: `APPROX_COUNT_DISTINCT` per pre-grouped CTE, or HLL++ sketches |
| `ARRAY_AGG`, `ARRAY_CONCAT_AGG` | Yes | |
| Procedural `LOOP` / `WHILE` / `REPEAT` / `FOR..IN` | Yes | Core scripting |
| Materialized views | Yes | Restricted: no window functions, no recursive CTEs, no UNION ALL |
| External tables over GCS | Yes | Pay only for columns scanned (Parquet) |
| Table snapshots | Yes | Use to freeze "the demo dataset" |
| Partition & cluster recommender | Yes (NE1) / **No** (NE2) | One reason to prefer Montréal |
| Continuous queries | Yes (NE1) / **No** (NE2) | Same |

### Table layout — partitioned + clustered

```sql
CREATE TABLE gargamel.transactions (
  txn_id STRING NOT NULL,
  ts TIMESTAMP NOT NULL,
  sender_account STRING NOT NULL,
  receiver_account STRING NOT NULL,
  amount NUMERIC NOT NULL,
  currency STRING NOT NULL,
  -- ...
)
PARTITION BY DATE(ts)
CLUSTER BY sender_account, receiver_account, amount
OPTIONS (
  require_partition_filter = TRUE  -- defensive: every query MUST hit a date predicate
);
```

`require_partition_filter = TRUE` is the cost-control safety net — accidental full-table scans become errors, not bills.

### Recursive CTE — bounded cycle detection

BigQuery's recursive CTE caps at 500 iterations. For AML cycle detection (depth 2-4), bound explicitly with the `ARRAY` visited-path idiom:

```sql
WITH RECURSIVE
  edges AS (
    SELECT sender_account AS src, receiver_account AS dst
    FROM gargamel.transactions
    WHERE ts BETWEEN @window_start AND @window_end
  ),
  paths AS (
    SELECT src AS origin, dst AS current_node, [src, dst] AS path, 1 AS depth
    FROM edges
    WHERE src IN UNNEST(@seed_accounts)
    UNION ALL
    SELECT p.origin, e.dst, ARRAY_CONCAT(p.path, [e.dst]), p.depth + 1
    FROM paths p
    JOIN edges e ON e.src = p.current_node
    WHERE p.depth < 4
      AND (e.dst = p.origin OR e.dst NOT IN UNNEST(p.path))
  )
SELECT origin, path, depth
FROM paths
WHERE current_node = origin AND depth BETWEEN 2 AND 4;
```

### Procedural LOOP — connected components via label propagation

Avoids the 500-iter recursive CTE cap when graphs are large:

```sql
DECLARE changed INT64 DEFAULT 1;
DECLARE iter INT64 DEFAULT 0;

CREATE OR REPLACE TEMP TABLE node_label AS
SELECT DISTINCT account AS node, account AS label FROM (
  SELECT sender_account AS account FROM gargamel.transactions
  UNION DISTINCT
  SELECT receiver_account FROM gargamel.transactions
);

LOOP
  SET iter = iter + 1;
  CREATE OR REPLACE TEMP TABLE node_label_next AS
  SELECT n.node,
         LEAST(MIN(n.label), MIN(neighbor.label)) AS label
  FROM node_label n
  LEFT JOIN gargamel.transactions e
    ON e.sender_account = n.node OR e.receiver_account = n.node
  LEFT JOIN node_label neighbor
    ON neighbor.node = IF(e.sender_account = n.node, e.receiver_account, e.sender_account)
  GROUP BY n.node;
  SET changed = (SELECT COUNT(*) FROM node_label_next nl
                 JOIN node_label cur USING (node)
                 WHERE nl.label != cur.label);
  CREATE OR REPLACE TEMP TABLE node_label AS SELECT * FROM node_label_next;
  IF changed = 0 OR iter >= 20 THEN LEAVE; END IF;
END LOOP;

SELECT label AS component_id, ARRAY_AGG(node) AS members
FROM node_label
GROUP BY component_id
HAVING COUNT(*) >= 3;
```

### `COUNT(DISTINCT) OVER` workaround

No SQL engine supports `COUNT(DISTINCT x) OVER (...)`. Workaround:

```sql
-- BAD — does not parse
SELECT COUNT(DISTINCT receiver_account) OVER (PARTITION BY sender_account) FROM ...

-- GOOD — pre-group, then APPROX_COUNT_DISTINCT in a CTE
WITH per_day AS (
  SELECT sender_account, DATE(ts) AS day,
         APPROX_COUNT_DISTINCT(receiver_account) AS daily_unique_recv
  FROM gargamel.transactions
  GROUP BY sender_account, day
)
SELECT * FROM per_day;
```

For higher-precision rolling distinct counts use HLL++ sketches:

```sql
HLL_COUNT.INIT(value, 14) AS sketch  -- precision 14 = ~99.5%
-- then HLL_COUNT.MERGE_PARTIAL / HLL_COUNT.EXTRACT for windowed merging
```

### IAM — minimum roles for BQ runtime

| Role | Why |
|---|---|
| `roles/bigquery.dataViewer` (dataset-scoped) | Read tables in dataset |
| `roles/bigquery.jobUser` (project-scoped) | Run query jobs |
| `roles/storage.objectViewer` (bucket-scoped) | Read raw data from GCS |

---

## Vertex AI Gemini

### Model selection (residency-forced)

The Vertex AI [data residency docs](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency) are unambiguous: the global endpoint does NOT guarantee regional ML processing. For Canadian residency:

- **`gemini-2.5-pro`** — GA in `northamerica-northeast1`, regional residency guarantee. **USE THIS.**
- `gemini-2.5-flash` — same, cheaper, faster, smaller context. Backup model.
- `gemini-2.5-flash-lite` — too small for analyst-grade reasoning; useful for triage.
- ❌ **`gemini-3.1-pro-preview`** — global-only. **DO NOT USE for FINTRAC / Crown / Canadian residency builds.**

### SDK — `google-genai`, not `google-cloud-aiplatform`

`google-cloud-aiplatform`'s `vertexai.generative_models` etc. are **deprecated** as of 2025-06-24, removal 2026-06-24. Unified replacement: `google-genai`.

```python
# requirements.txt: google-genai>=1.7.0
from google import genai
from google.genai import types

# ADC picks up the Cloud Run service account automatically — no JSON keys
client = genai.Client(
    vertexai=True,
    project="my-project",
    location="northamerica-northeast1",  # CRITICAL — regional, not "global"
)
```

Equivalent env-var form (preferred for Cloud Run):

```bash
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=my-project
GOOGLE_CLOUD_LOCATION=northamerica-northeast1
```

### Structured output — the `_clean_schema` shim is still required

As of May 2026, the `google-genai` Python SDK still rejects `additionalProperties` client-side even though the API accepts it server-side ([issue #1815, closed-not-planned](https://github.com/googleapis/python-genai/issues/1815)). The team will not fix this on the SDK side.

**Pattern A — Pydantic, when no `dict[str, X]` fields:**

```python
from pydantic import BaseModel, Field

class Finding(BaseModel):
    suspect_account: str = Field(min_length=1)
    confidence: float = Field(ge=0, le=1)  # use ge/le, NOT exclusiveMinimum
    reasoning: str
    cycle_path: list[str] = Field(default_factory=list)

resp = client.models.generate_content(
    model="gemini-2.5-pro",
    contents=prompt,
    config=types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=Finding,  # SDK converts; no additionalProperties because no dict fields
        temperature=0.1,
    ),
)
finding = Finding.model_validate_json(resp.text)
```

**Pattern B — `_clean_schema` shim, when Pydantic uses `dict[str, X]`:**

```python
def _clean_schema(s):
    """Strip fields google-genai rejects client-side. Recursive, in-place."""
    if isinstance(s, dict):
        s.pop("additionalProperties", None)
        s.pop("$defs", None)
        s.pop("$schema", None)
        if "exclusiveMinimum" in s:
            s["minimum"] = s.pop("exclusiveMinimum")
        if "exclusiveMaximum" in s:
            s["maximum"] = s.pop("exclusiveMaximum")
        if "$ref" in s:
            raise ValueError("inline $ref before _clean_schema")
        for v in s.values():
            _clean_schema(v)
    elif isinstance(s, list):
        for item in s:
            _clean_schema(item)
    return s

import json
schema = _clean_schema(Finding.model_json_schema())

resp = client.models.generate_content(
    model="gemini-2.5-pro",
    contents=prompt,
    config=types.GenerateContentConfig(
        response_mime_type="application/json",
        response_json_schema=schema,  # bypasses client validator
    ),
)
```

Vertex's supported schema field set: `anyOf, enum, format, items, maximum, maxItems, minimum, minItems, nullable, properties, description, propertyOrdering, required`. Anything else is silently dropped.

### Cost & quota (2026)

- `gemini-2.5-pro`: $1.25/M input tokens, $10/M output (≤200K context); $2.50/$20 above 200K
- `gemini-2.5-flash`: cheaper across the board
- Vertex uses Dynamic Shared Quota; new projects start with conservative RPM caps
- New GCP accounts get $300 credits valid 90 days

---

## Cloud Run

### Runtime envelope (gen2, May 2026)

| CPU | Memory range |
|---|---|
| 0.08 vCPU | up to 512 MiB |
| 0.5 vCPU | up to 1 GiB |
| 1 vCPU | up to 4 GiB |
| 2 vCPU | up to 8 GiB |
| 4 vCPU | 2–16 GiB |
| 6 vCPU | 4–24 GiB |
| 8 vCPU | 4–32 GiB |

- Gen2 minimum memory: 512 MiB
- Request timeout: max **60 minutes** (default 5 min)
- For longer batch jobs use Cloud Run **Jobs** (max 7-day task)

### Deployment

**Backend (FastAPI):**

```bash
gcloud run deploy backend-api \
  --source . \
  --region=northamerica-northeast1 \
  --service-account=runtime@${PROJECT_ID}.iam.gserviceaccount.com \
  --memory=2Gi --cpu=2 \
  --concurrency=10 \
  --min-instances=1 --max-instances=5 \
  --timeout=600 \
  --execution-environment=gen2 \
  --set-env-vars=GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=northamerica-northeast1 \
  --no-allow-unauthenticated
```

**Frontend (SvelteKit, adapter-node):**

```bash
gcloud run deploy frontend-web \
  --source . \
  --region=northamerica-northeast1 \
  --service-account=frontend@${PROJECT_ID}.iam.gserviceaccount.com \
  --memory=512Mi --cpu=1 \
  --execution-environment=gen2 \
  --set-env-vars=ORIGIN=https://frontend-web-xxx.a.run.app,API_URL=https://backend-api-xxx.a.run.app,PROTOCOL_HEADER=x-forwarded-proto,HOST_HEADER=x-forwarded-host \
  --allow-unauthenticated
```

**Cold-start mitigation**: `--min-instances=1` for the orchestrator keeps one warm, saves ~3-5s per cold start, costs ~$10/month idle. Frontend can stay at 0.

**Concurrency**: For LLM-fronted APIs, `--concurrency=10` (default 80). Gemini calls hold memory longer; horizontal scaling over per-instance.

**VPC connector**: NOT needed. BigQuery and Vertex AI APIs are public Google endpoints; ADC handles auth without VPC.

### CORS — or sidestep it entirely

If frontend and backend are separate Cloud Run services, the backend must echo `Access-Control-Allow-Origin`:

```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware,
    allow_origins=[os.environ["FRONTEND_ORIGIN"]],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Better**: proxy backend through SvelteKit `+server.ts` endpoints — eliminates CORS entirely, secrets never leave the server. See `sveltekit` skill for the proxy pattern.

---

## IAM and service accounts

Pattern: one SA per service surface.

| Service Account | Purpose | Roles |
|---|---|---|
| `runtime@` | Cloud Run backend | `bigquery.dataViewer`, `bigquery.jobUser`, `aiplatform.user`, `storage.objectViewer`, `logging.logWriter`, `monitoring.metricWriter` |
| `frontend@` | Cloud Run frontend | `run.invoker` (on backend), `logging.logWriter` |
| `batch@` | Optional ingest job | `bigquery.dataEditor`, `bigquery.jobUser`, `storage.objectViewer` |
| `deploy@` | GitHub Actions via Workload Identity | `run.admin`, `iam.serviceAccountUser`, `artifactregistry.writer`, `cloudbuild.builds.editor` |

### Workload Identity Federation for keyless GH Actions

Replaces JSON service-account keys with GitHub OIDC token exchange:

```bash
gcloud iam workload-identity-pools create gh-pool \
  --location=global --display-name="GitHub WIF pool"

gcloud iam workload-identity-pools providers create-oidc gh-provider \
  --workload-identity-pool=gh-pool --location=global \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='ORG/REPO'"

gcloud iam service-accounts add-iam-policy-binding deploy@${PROJECT_ID}.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/gh-pool/attribute.repository/ORG/REPO"
```

For a hackathon demo deploying from a laptop, skip WIF — `gcloud auth login` is fine.

---

## Storage

### Bucket layout

```
gs://my-project-${PROJECT_ID}/
  raw/
    saml-d/SAML-D.csv
  curated/
    transactions/         # Parquet, partitioned by ingestion_date
  audit/
    demo-frozen-2026-05-12/
```

### Provisioning — single regional bucket

```bash
gcloud storage buckets create gs://my-project-${PROJECT_ID} \
  --location=northamerica-northeast1 \
  --uniform-bucket-level-access \
  --soft-delete-duration=7d \
  --public-access-prevention
```

### Loading CSV → BigQuery

```bash
# Land raw CSV in GCS
gcloud storage cp ./SAML-D.csv gs://my-project-${PROJECT_ID}/raw/saml-d/

# Autodetect schema, load into staging
bq --location=northamerica-northeast1 load \
  --autodetect --skip_leading_rows=1 \
  --source_format=CSV \
  my-project.transactions_raw \
  gs://my-project-${PROJECT_ID}/raw/saml-d/SAML-D.csv

# Project into partitioned/clustered table with FX normalisation
bq query --use_legacy_sql=false --location=northamerica-northeast1 "..."
```

### Audit-grade freeze

```bash
bq cp --snapshot --location=northamerica-northeast1 \
  ${PROJECT_ID}:dataset.transactions \
  ${PROJECT_ID}:dataset.transactions__demo_frozen_2026_05_12
```

Snapshots are immutable, region-local, pay only for delta storage.

---

## Verbatim provisioning script (Bash + PowerShell)

### Bash (Linux / macOS)

```bash
#!/usr/bin/env bash
# bootstrap.sh — idempotent, ~15 min from clean GCP project
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?must set PROJECT_ID}"
REGION="${REGION:-northamerica-northeast1}"
DATASET="${DATASET:-app}"
BUCKET="app-${PROJECT_ID}"
BILLING="${BILLING:?must set BILLING}"

echo "=== 1. Create project + link billing ==="
gcloud projects create "${PROJECT_ID}" --quiet 2>/dev/null || true
gcloud config set project "${PROJECT_ID}"
gcloud billing projects link "${PROJECT_ID}" --billing-account="${BILLING}"

echo "=== 2. Enable APIs ==="
gcloud services enable \
  bigquery.googleapis.com aiplatform.googleapis.com run.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com \
  storage.googleapis.com iamcredentials.googleapis.com \
  logging.googleapis.com monitoring.googleapis.com

echo "=== 3. Create regional bucket ==="
gcloud storage buckets create "gs://${BUCKET}" \
  --location="${REGION}" --uniform-bucket-level-access \
  --public-access-prevention 2>/dev/null || true

echo "=== 4. Create BQ dataset ==="
bq --location="${REGION}" mk --dataset --label=residency:canada \
  "${PROJECT_ID}:${DATASET}" 2>/dev/null || true

echo "=== 5. Create Artifact Registry repo ==="
gcloud artifacts repositories create app \
  --repository-format=docker --location="${REGION}" 2>/dev/null || true

echo "=== 6. Create service accounts ==="
for SA in runtime frontend batch; do
  gcloud iam service-accounts create "${SA}" \
    --display-name="${SA}" 2>/dev/null || true
done

RUNTIME="runtime@${PROJECT_ID}.iam.gserviceaccount.com"

echo "=== 7. Bind IAM roles ==="
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME}" --role="roles/bigquery.jobUser"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME}" --role="roles/aiplatform.user"
bq add-iam-policy-binding \
  --member="serviceAccount:${RUNTIME}" --role="roles/bigquery.dataViewer" \
  "${PROJECT_ID}:${DATASET}"
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${RUNTIME}" --role="roles/storage.objectViewer"

echo "Done. Region: ${REGION}. Dataset: ${DATASET}. Bucket: ${BUCKET}."
```

### PowerShell (Windows)

```powershell
# bootstrap.ps1 — same logic, Windows-native
param(
  [Parameter(Mandatory)] [string]$ProjectId,
  [Parameter(Mandatory)] [string]$BillingAccount,
  [string]$Region = "northamerica-northeast1",
  [string]$Dataset = "app"
)

$ErrorActionPreference = "Stop"
$Bucket = "app-$ProjectId"

Write-Host "=== 1. Project + billing ==="
gcloud projects create $ProjectId --quiet 2>$null
gcloud config set project $ProjectId
gcloud billing projects link $ProjectId --billing-account=$BillingAccount

Write-Host "=== 2. APIs ==="
gcloud services enable `
  bigquery.googleapis.com aiplatform.googleapis.com run.googleapis.com `
  cloudbuild.googleapis.com artifactregistry.googleapis.com `
  storage.googleapis.com iamcredentials.googleapis.com `
  logging.googleapis.com monitoring.googleapis.com

Write-Host "=== 3. Bucket ==="
gcloud storage buckets create "gs://$Bucket" `
  --location=$Region --uniform-bucket-level-access `
  --public-access-prevention 2>$null

Write-Host "=== 4. BQ dataset ==="
bq --location=$Region mk --dataset --label=residency:canada `
  "${ProjectId}:${Dataset}" 2>$null

Write-Host "=== 5. Artifact Registry ==="
gcloud artifacts repositories create app `
  --repository-format=docker --location=$Region 2>$null

Write-Host "=== 6. Service accounts ==="
foreach ($sa in @("runtime", "frontend", "batch")) {
  gcloud iam service-accounts create $sa --display-name=$sa 2>$null
}

# IAM bindings — same as bash
$Runtime = "runtime@${ProjectId}.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding $ProjectId `
  --member="serviceAccount:$Runtime" --role="roles/bigquery.jobUser"
gcloud projects add-iam-policy-binding $ProjectId `
  --member="serviceAccount:$Runtime" --role="roles/aiplatform.user"

Write-Host "Done."
```

---

## Region pinning audit (May 2026)

| Service | NE1 (Montréal) | NE2 (Toronto) |
|---|---|---|
| BigQuery core | GA, full | GA, full |
| BigQuery ML — DNN, AutoEncoder, Boosted Trees, hyperparameter tuning | Yes | **No** |
| BigQuery SQL translator | Yes | **No** |
| BigQuery Continuous queries | Yes | **No** |
| BigQuery Partition/cluster recommender | Yes | **No** |
| Vertex AI Gemini 2.5 Pro/Flash | GA, regional residency guarantee | GA |
| Vertex AI Gemini 3.1 Pro Preview | **Global only** | Same |
| Cloud Run gen2 | GA, 32 GiB max, 60-min timeout | GA |
| Cloud Storage (regional bucket) | GA | GA |
| Artifact Registry | GA | GA |
| Spanner Enterprise | GA | GA |

**Use NE1 (Montréal) for everything.** NE2 only for DR.

---

## Gotchas

1. **`gemini-3.1-pro-preview` is global-only.** Breaks Canadian residency. Use `gemini-2.5-pro` on regional endpoint.
2. **`google-genai` SDK rejects `additionalProperties`** even though the API accepts it. Keep the `_clean_schema` shim or use Pydantic models without `dict[str, X]` fields.
3. **`exclusiveMinimum` / `exclusiveMaximum` are silently dropped** by Vertex schema validation. Use `ge=`/`le=` in Pydantic, not `gt=`/`lt=`.
4. **`COUNT(DISTINCT) OVER` doesn't exist** in any SQL engine. Pre-group with a CTE + `APPROX_COUNT_DISTINCT`, or HLL++ for windowed merging.
5. **BigQuery recursive CTE caps at 500 iterations.** For label propagation use procedural `LOOP`, not recursion.
6. **Materialized views can't use window functions, recursive CTEs, or UNION ALL.** Limited utility for complex queries.
7. **Cloud Run gen2 minimum memory is 512 MiB.** Smaller services use gen1.
8. **Cloud Run request timeout maxes at 60 minutes.** For longer jobs use Cloud Run Jobs (max 7 days).
9. **VPC connector NOT needed** for BQ/Vertex from Cloud Run — public Google API endpoints work via ADC.
10. **`gcloud run deploy --source`** requires Artifact Registry + Cloud Build APIs enabled in the target region.
11. **BigQuery Graph (GQL preview)** requires Enterprise reservation (~$4k/mo). Hackathon-incompatible.
12. **Spanner Graph** is GA but ~$800/node/month minimum. Production future, not Monday.
13. **`require_partition_filter=TRUE`** is your cost safety net. Forces every query to hit a date predicate or fail.
14. **Region is immutable** for BigQuery datasets, Cloud Storage buckets, Cloud Run services. Get it right at creation.
15. **NE2 (Toronto) lacks several BQ features** present in NE1 (Montréal). Stay on Montréal.

---

## Quality checklist

Before shipping a GCP-native service:

- [ ] Every resource pinned to `northamerica-northeast1` at creation
- [ ] Vertex AI uses `gemini-2.5-pro` on regional endpoint, NOT `gemini-3.1-pro-preview`
- [ ] `google-genai` SDK with `vertexai=True, location="northamerica-northeast1"`
- [ ] `_clean_schema` shim applied or Pydantic models avoid `dict[str, X]`
- [ ] Pydantic uses `ge=`/`le=`, not `gt=`/`lt=` (those become `exclusiveMinimum/Maximum`, silently dropped)
- [ ] BigQuery tables partitioned + clustered with `require_partition_filter=TRUE`
- [ ] No `COUNT(DISTINCT) OVER` — pre-group with CTE + `APPROX_COUNT_DISTINCT`
- [ ] Cycle detection uses recursive CTE with `ARRAY` visited-path, depth-bound
- [ ] Connected components use procedural `LOOP`, not recursive CTE
- [ ] Cloud Run service-account attached at deploy, no JSON keys mounted
- [ ] Cold-start mitigation: `--min-instances=1` for LLM-fronted APIs
- [ ] CORS handled or sidestepped via SvelteKit proxy
- [ ] Provisioning script idempotent and tested clean
- [ ] No BigQuery Graph (Preview) or Spanner Graph (Enterprise) on hackathon-budget builds

---

*The cloud is regional. The compliance story only works if every byte stays where you say it stays. Pin everything at creation; you don't get a second chance.*
