# Azure Patterns Reference

Code examples and syntax for Azure services. Loaded on demand by the azure-ops skill.

---

## Core Stack

| Layer | Service | Use Case |
|-------|---------|----------|
| Compute (API) | **App Service** | FastAPI/Node backend, always-on |
| Compute (Async) | **Azure Functions** | Queue-triggered processors, event-driven |
| Database | **Cosmos DB** (SQL API) | Document store, serverless, global distribution |
| Storage | **Blob Storage** | Files, documents, media |
| Queues | **Storage Queues** | Async job dispatch |
| Secrets | **Key Vault** | Connection strings, API keys, certificates |
| Identity | **Entra ID** (Managed Identities) | Service-to-service auth, no credentials in code |
| AI | **Azure AI Services** | Speech, Document Intelligence, Translator, OpenAI |
| IaC | **Bicep** | Infrastructure as code |
| CI/CD | **Azure DevOps YAML Pipelines** | Build, test, deploy |

---

## Security — Managed Identities First

**Never store connection strings or API keys in code or app settings directly.** Use managed identities + Key Vault.

### The Pattern

```
App Service / Functions
    → Managed Identity (system-assigned)
        → RBAC role on target resource
            → No credentials needed in code
```

### Python SDK with DefaultAzureCredential

```python
from azure.identity import DefaultAzureCredential

# Works locally (Azure CLI auth) AND in Azure (managed identity)
credential = DefaultAzureCredential()

# Cosmos DB
from azure.cosmos import CosmosClient
cosmos = CosmosClient(url=COSMOS_ENDPOINT, credential=credential)

# Blob Storage
from azure.storage.blob import BlobServiceClient
blob = BlobServiceClient(account_url=STORAGE_URL, credential=credential)

# Key Vault
from azure.keyvault.secrets import SecretClient
kv = SecretClient(vault_url=KEYVAULT_URL, credential=credential)
secret = kv.get_secret("my-secret").value
```

### Key Vault References in App Settings

Instead of storing secrets in app settings, reference Key Vault:

```
# App Service / Functions app setting
MY_SECRET=@Microsoft.KeyVault(VaultName=myvault;SecretName=my-secret)
```

The platform resolves these at runtime — your code just reads `os.environ["MY_SECRET"]`.

---

## Azure Functions (Python v2)

### Queue-Triggered Processor

```python
import azure.functions as func
import logging
import json

app = func.FunctionApp()

@app.queue_trigger(
    arg_name="msg",
    queue_name="processing-queue",
    connection="AzureWebJobsStorage",
)
async def process_job(msg: func.QueueMessage) -> None:
    logging.info(f"Processing message: {msg.id}")

    try:
        payload = json.loads(msg.get_body().decode("utf-8"))
        job_id = payload["job_id"]

        # Do the work
        result = await process(payload)

        # Store result
        await save_result(job_id, result)

        logging.info(f"Job {job_id} completed successfully")

    except Exception as e:
        logging.error(f"Job failed: {e}")
        raise  # Let Functions runtime handle retry
```

### Blob-Triggered Function

```python
@app.blob_trigger(
    arg_name="blob",
    path="uploads/{name}",
    connection="AzureWebJobsStorage",
)
async def process_upload(blob: func.InputStream) -> None:
    logging.info(f"Processing blob: {blob.name}, size: {blob.length}")
    content = blob.read()
    # Process the file...
```

### Timer-Triggered Function (Cron)

```python
@app.timer_trigger(
    schedule="0 */5 * * * *",  # Every 5 minutes
    arg_name="timer",
)
async def scheduled_job(timer: func.TimerRequest) -> None:
    if timer.past_due:
        logging.warning("Timer is past due")
    logging.info("Running scheduled job")
```

### Local Development

```bash
# local.settings.json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "COSMOS_ENDPOINT": "https://localhost:8081",
    "COSMOS_KEY": "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw=="
  }
}

# Start Azurite (local storage emulator)
azurite --silent --location ./azurite-data

# Start Functions
func start
```

---

## Blob Storage

### Upload / Download

```python
from azure.storage.blob.aio import BlobServiceClient
from azure.identity.aio import DefaultAzureCredential

credential = DefaultAzureCredential()
blob_service = BlobServiceClient(account_url=STORAGE_URL, credential=credential)

# Upload
container = blob_service.get_container_client("documents")
blob = container.get_blob_client(f"uploads/{file_id}/{filename}")
await blob.upload_blob(file_content, overwrite=True)

# Download
stream = await blob.download_blob()
content = await stream.readall()

# Generate SAS URL (time-limited access)
from azure.storage.blob import generate_blob_sas, BlobSasPermissions
from datetime import datetime, timedelta

sas_token = generate_blob_sas(
    account_name=STORAGE_ACCOUNT,
    container_name="documents",
    blob_name=f"uploads/{file_id}/{filename}",
    account_key=STORAGE_KEY,  # Or use user delegation key with managed identity
    permission=BlobSasPermissions(read=True),
    expiry=datetime.utcnow() + timedelta(hours=1),
)
sas_url = f"{blob.url}?{sas_token}"
```

### Storage Queues (Job Dispatch)

```python
from azure.storage.queue.aio import QueueClient

queue = QueueClient.from_connection_string(conn_str, "processing-queue")

# Send message
import base64, json
message = base64.b64encode(json.dumps({"job_id": "123", "action": "process"}).encode()).decode()
await queue.send_message(message, time_to_live=3600)
```

---

## Cosmos DB

### Container Setup

```python
database = cosmos.get_database_client("mydb")

# Create container with partition key
await database.create_container_if_not_exists(
    id="documents",
    partition_key=PartitionKey(path="/category"),
    offer_throughput=400,  # Or use serverless
)
```

### CRUD Operations

```python
container = database.get_container_client("documents")

# Create
doc = {
    "id": str(uuid4()),
    "category": "reports",  # Partition key
    "title": "Q1 Report",
    "status": "draft",
    "created_at": datetime.utcnow().isoformat(),
}
await container.create_item(body=doc)

# Read (point read — cheapest, 1 RU)
item = await container.read_item(item="doc-id", partition_key="reports")

# Query
query = "SELECT * FROM c WHERE c.status = @status AND c.category = @category"
items = container.query_items(
    query=query,
    parameters=[
        {"name": "@status", "value": "active"},
        {"name": "@category", "value": "reports"},
    ],
    partition_key="reports",
)
results = [item async for item in items]

# Update (replace entire document)
item["status"] = "published"
await container.replace_item(item=item["id"], body=item)

# Delete
await container.delete_item(item="doc-id", partition_key="reports")
```

### Cosmos DB Tips

- **Partition key** — choose based on query patterns, high cardinality
- **Point reads** over queries when possible (1 RU vs 5+ RU)
- **Avoid cross-partition queries** — design schema to keep related data in same partition
- **Use serverless** for dev/POC, provisioned throughput for production
- **Index policy** — exclude paths you never query to save RUs

---

## Bicep (Infrastructure as Code)

### Module Pattern

```
infra/
├── main.bicep          # Orchestrator
├── parameters/
│   ├── dev.bicepparam
│   └── test.bicepparam
└── modules/
    ├── appservice.bicep
    ├── functions.bicep
    ├── cosmos.bicep
    ├── storage.bicep
    ├── keyvault.bicep
    ├── cognitive.bicep
    └── rbac.bicep
```

### Main Orchestrator

```bicep
// main.bicep
targetScope = 'resourceGroup'

@description('Environment name')
param environment string

@description('Azure region')
param location string = resourceGroup().location

var prefix = 'myapp-${environment}'

// Storage
module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    name: '${replace(prefix, '-', '')}storage'
    location: location
  }
}

// Cosmos DB
module cosmos 'modules/cosmos.bicep' = {
  name: 'cosmos'
  params: {
    name: '${prefix}-cosmos'
    location: location
  }
}

// Key Vault
module keyvault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    name: '${prefix}-kv'
    location: location
  }
}

// App Service
module appservice 'modules/appservice.bicep' = {
  name: 'appservice'
  params: {
    name: '${prefix}-api'
    location: location
    keyVaultName: keyvault.outputs.name
    cosmosEndpoint: cosmos.outputs.endpoint
    storageAccountName: storage.outputs.name
  }
}

// RBAC — give App Service identity access to resources
module rbac 'modules/rbac.bicep' = {
  name: 'rbac'
  params: {
    principalId: appservice.outputs.identityPrincipalId
    cosmosAccountName: cosmos.outputs.name
    storageAccountName: storage.outputs.name
    keyVaultName: keyvault.outputs.name
  }
}
```

### Deploy

```bash
# What-if (dry run)
az deployment group what-if \
  --resource-group myapp-dev-rg \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam

# Deploy
az deployment group create \
  --resource-group myapp-dev-rg \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam
```

---

## Azure DevOps Pipelines

### CI Pipeline

```yaml
# pipelines/ci.yml
trigger:
  branches:
    include: [main, develop]
  paths:
    exclude: [docs/*, README.md]

pool:
  vmImage: ubuntu-latest

stages:
  - stage: Build
    jobs:
      - job: Backend
        steps:
          - task: UsePythonVersion@0
            inputs:
              versionSpec: '3.12'
          - script: |
              pip install uv
              uv sync --frozen
              uv run ruff check .
              uv run mypy src/
              uv run pytest --cov=src --junitxml=test-results.xml
            displayName: 'Lint, Type Check, Test'
          - task: PublishTestResults@2
            inputs:
              testResultsFormat: JUnit
              testResultsFiles: test-results.xml

      - job: Frontend
        steps:
          - task: UseNode@1
            inputs:
              version: '22.x'
          - script: |
              npm ci
              npm run lint
              npm run type-check
              npm run test -- --run
              npm run build
            displayName: 'Lint, Type Check, Test, Build'
```

### CD Pipeline

```yaml
# pipelines/cd-dev.yml
trigger: none

resources:
  pipelines:
    - pipeline: CI
      source: CI
      trigger:
        branches:
          include: [main]

stages:
  - stage: DeployDev
    jobs:
      - deployment: Deploy
        environment: dev
        strategy:
          runOnce:
            deploy:
              steps:
                - task: AzureCLI@2
                  inputs:
                    azureSubscription: 'MyServiceConnection'
                    scriptType: bash
                    scriptLocation: inlineScript
                    inlineScript: |
                      az deployment group create \
                        --resource-group myapp-dev-rg \
                        --template-file infra/main.bicep \
                        --parameters infra/parameters/dev.bicepparam

                - task: AzureFunctionApp@2
                  inputs:
                    azureSubscription: 'MyServiceConnection'
                    appType: functionAppLinux
                    appName: myapp-dev-functions

                - task: AzureWebApp@1
                  inputs:
                    azureSubscription: 'MyServiceConnection'
                    appType: webAppLinux
                    appName: myapp-dev-api
```

---

## Local Development

### Azurite (Storage Emulator)

```bash
# Install
npm install -g azurite

# Run
azurite --silent --location ./azurite-data --blobPort 10000 --queuePort 10001

# Connection string
"UseDevelopmentStorage=true"
```

### Cosmos DB Emulator

```bash
# Docker
docker run -p 8081:8081 -p 10250-10255:10250-10255 \
  mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest

# Connection
COSMOS_ENDPOINT=https://localhost:8081
COSMOS_KEY=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==
```

### Makefile Pattern

```makefile
.PHONY: dev test lint

infra-up:
	azurite --silent --location ./azurite-data &
	docker run -d -p 8081:8081 mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest

backend-dev:
	cd backend && uv run uvicorn src.msrcmp.main:app --reload --port 8000

frontend-dev:
	cd frontend && npm run dev

test:
	cd backend && uv run pytest -v
	cd frontend && npm run test -- --run
	cd functions && uv run pytest -v

lint:
	cd backend && uv run ruff check . && uv run mypy src/
	cd frontend && npm run lint && npm run type-check

deploy-dev:
	az deployment group create --resource-group myapp-dev-rg \
		--template-file infra/main.bicep \
		--parameters infra/parameters/dev.bicepparam
```

---

## Verification Checklist

### Security
- [ ] Managed identities enabled (no connection strings in code)
- [ ] Key Vault references for all secrets
- [ ] RBAC roles assigned (least privilege)
- [ ] No secrets in pipeline YAML or app settings

### Infrastructure
- [ ] All resources defined in Bicep (no manual portal changes)
- [ ] Parameters separated by environment (dev/test/prod)
- [ ] What-if run before deployment
- [ ] Resource naming follows convention

### Functions
- [ ] Error handling with proper logging
- [ ] Retry policy configured for queue triggers
- [ ] Local development works with emulators
- [ ] Function timeout appropriate for workload

### Pipeline
- [ ] CI runs on every PR (lint, type check, test)
- [ ] CD deploys infrastructure then application
- [ ] Environment approvals for production
- [ ] Test results published

---

*Infrastructure as code. Managed identities. No secrets in code. These aren't aspirational — they're the baseline.*
