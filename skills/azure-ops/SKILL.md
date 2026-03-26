---
name: azure-ops
description: Use this skill when working with Azure services, Azure deployment, Azure infrastructure, or any project targeting Azure cloud. Activates for App Service, Azure Functions, Cosmos DB, Blob Storage, Storage Queues, Key Vault, Entra ID, Bicep IaC, Azure DevOps Pipelines, managed identities, or DefaultAzureCredential.
---

# Azure Ops — Mandatory Service Rules

These rules override default patterns. Follow them exactly. Do not fall back to tutorial defaults.

---

## Service Selection — REQUIREMENTS

When building on Azure, ALWAYS use these services. Do NOT substitute alternatives.

### Database
- ALWAYS use **Azure Cosmos DB** (SQL API, serverless) for document/NoSQL workloads
- NEVER use PostgreSQL, MySQL, or SQLite on Azure projects unless the user explicitly requests relational data with complex joins
- If the user says "database" without specifying, use Cosmos DB

### File Storage
- ALWAYS use **Azure Blob Storage** for file uploads, media, documents, screenshots, logs
- NEVER store files on local disk or in the database

### Async Processing
- ALWAYS use **Azure Functions** (Python v2, queue-triggered) for background/async work
- ALWAYS use **Azure Storage Queues** for job dispatch between the API and Functions
- NEVER use background threads, Celery, or in-process async for long-running tasks

### AI/LLM
- ALWAYS use **Azure OpenAI** (GPT-4o) for text summarisation, classification, or generation
- NEVER use direct OpenAI API on Azure projects — use the Azure-hosted endpoint

### Identity & Security
- ALWAYS use **Managed Identities** (system-assigned) for service-to-service auth
- ALWAYS use **DefaultAzureCredential** in Python code — it works locally (Azure CLI) and in Azure (managed identity)
- NEVER store connection strings, API keys, or secrets in code or app settings
- Use **Key Vault** references for any secret that must be in app settings

### Infrastructure as Code
- ALWAYS generate **Bicep** files for all Azure resources
- Create a `main.bicep` orchestrator with per-resource modules
- Include **RBAC role assignments** in Bicep (least privilege)
- Create `.bicepparam` files for environment separation (dev/test/prod)

### CI/CD
- ALWAYS generate **Azure DevOps YAML Pipelines** for CI (lint, type check, test) and CD (Bicep deploy, app deploy)

---

## Architecture — REQUIREMENTS

### Structure
- ALWAYS use **DDD/hexagonal architecture** with explicit domain, API, and infrastructure layers
- Create a `domain/` directory with models and business logic
- Use `typing.Protocol` for port definitions (repository, queue publisher, blob store)
- Use **in-memory fakes** in tests, NEVER `mock.patch` or `MagicMock`
- Wire dependencies through **FastAPI Depends** (dependency injection)

### Patterns
- ALWAYS implement the **Repository pattern** for data access
- ALWAYS create a **queue publisher abstraction** (Protocol) for async dispatch
- Use **structlog** for structured logging (not stdlib logging)
- Use **pydantic-settings** with `ConfigDict` for configuration (NEVER `class Config:`)

---

## Local Development — REQUIREMENTS

- Generate a `docker-compose.yml` with **Azurite** (storage emulator) and **Cosmos DB emulator**
- Generate a `Makefile` with targets: `infra-up`, `dev`, `test`, `lint`, `deploy-dev`
- Generate a `.gitignore` that excludes `__pycache__/`, `.venv/`, `*.db`, cache dirs

---

## Code Patterns Reference

For detailed code examples, SDK syntax, and Bicep templates, read:
- [references/azure-patterns.md](references/azure-patterns.md) — Complete Azure SDK patterns, Cosmos DB CRUD, Blob Storage, Functions, Bicep modules, DevOps Pipelines, local development setup

---

*These are not suggestions. These are requirements. Do not deviate without explicit user instruction.*
