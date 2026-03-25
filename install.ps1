#
# Gemini CLI Config Installer (Windows PowerShell)
# Installs the portable config package to ~\.gemini\
#
# Usage: .\install.ps1 [-DryRun]
#

param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$GeminiHome = Join-Path $env:USERPROFILE ".gemini"

if ($DryRun) {
    Write-Host "[DRY RUN] No files will be modified." -ForegroundColor Yellow
}

function Log($msg) { Write-Host "[install] $msg" -ForegroundColor Cyan }

function Copy-FileTracked($src, $dst) {
    if ($DryRun) {
        Log "WOULD copy: $src -> $dst"
    } else {
        $dstDir = Split-Path -Parent $dst
        if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
        Copy-Item -Path $src -Destination $dst -Force
        Log "Copied: $src -> $dst"
    }
}

# --- Pre-checks ---
$geminiCmd = Get-Command gemini -ErrorAction SilentlyContinue
if (-not $geminiCmd) {
    Write-Host "ERROR: Gemini CLI not installed. Run: npm install -g @google/gemini-cli@preview" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $GeminiHome)) {
    Write-Host "ERROR: ~\.gemini\ doesn't exist. Run 'gemini' once to initialize and authenticate." -ForegroundColor Red
    exit 1
}

$version = & gemini --version 2>&1
Log "Gemini CLI version: $version"
Log "Installing config package from: $ScriptDir"
Write-Host ""

# --- Backup Existing Config ---
$hasExisting = (Test-Path (Join-Path $GeminiHome "settings.json")) -or
               (Test-Path (Join-Path $GeminiHome "GEMINI.md")) -or
               (Test-Path (Join-Path $GeminiHome "standards")) -or
               (Test-Path (Join-Path $GeminiHome "skills")) -or
               (Test-Path (Join-Path $GeminiHome "agents"))

if ($hasExisting -and -not $DryRun) {
    $backupDir = Join-Path $GeminiHome ("backup_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    $settingsFile = Join-Path $GeminiHome "settings.json"
    $geminiMdFile = Join-Path $GeminiHome "GEMINI.md"
    $standardsDir = Join-Path $GeminiHome "standards"
    if (Test-Path $settingsFile) { Copy-Item $settingsFile $backupDir }
    if (Test-Path $geminiMdFile) { Copy-Item $geminiMdFile $backupDir }
    if (Test-Path $standardsDir) { Copy-Item $standardsDir $backupDir -Recurse }
    Log "Existing config backed up to: $backupDir"
} elseif ($hasExisting -and $DryRun) {
    Log "WOULD backup existing config to backup_TIMESTAMP/"
}

# --- Core Config ---
Log "=== Core Config ==="

$existingSettings = Join-Path $GeminiHome "settings.json"
$packageSettings = Join-Path $ScriptDir "settings.json"

if (Test-Path $existingSettings) {
    Log "settings.json exists - merging (preserving auth)..."
    if (-not $DryRun) {
        # Use Python for deep merge (available on most dev machines)
        $pythonAvailable = Get-Command python3 -ErrorAction SilentlyContinue
        if (-not $pythonAvailable) { $pythonAvailable = Get-Command python -ErrorAction SilentlyContinue }

        if ($pythonAvailable) {
            $pyCmd = $pythonAvailable.Name
            $mergeScript = @"
import json, sys

with open(r'$existingSettings') as f:
    existing = json.load(f)
with open(r'$packageSettings') as f:
    package = json.load(f)

def deep_merge(base, overlay):
    result = base.copy()
    for key, value in overlay.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result

auth_backup = existing.get('security', {}).get('auth', {})
merged = deep_merge(existing, package)
if auth_backup:
    merged.setdefault('security', {})['auth'] = auth_backup

with open(r'$existingSettings', 'w') as f:
    json.dump(merged, f, indent=2)
    f.write('\n')
"@
            $mergeScript | & $pyCmd -c -
            Log "settings.json merged successfully"
        } else {
            # Fallback: no Python, just overwrite but warn
            Log "WARNING: Python not found, cannot merge. Overwriting settings.json (auth may need re-setup)."
            Copy-Item -Path $packageSettings -Destination $existingSettings -Force
        }
    }
} else {
    Copy-FileTracked $packageSettings $existingSettings
}

# GEMINI.md
$packageGeminiMd = Join-Path $ScriptDir "GEMINI.md"
if (Test-Path $packageGeminiMd) {
    Copy-FileTracked $packageGeminiMd (Join-Path $GeminiHome "GEMINI.md")
} else {
    Log "GEMINI.md not in package yet - skipping"
}

# Standards (always-loaded @imports)
Write-Host ""
Log "=== Standards ==="
$standardsDir = Join-Path $ScriptDir "standards"
if ((Test-Path $standardsDir) -and (Get-ChildItem $standardsDir -File -ErrorAction SilentlyContinue)) {
    $dstStandards = Join-Path $GeminiHome "standards"
    if (-not (Test-Path $dstStandards)) { New-Item -ItemType Directory -Path $dstStandards -Force | Out-Null }
    foreach ($stdFile in Get-ChildItem $standardsDir -File) {
        $dst = Join-Path $dstStandards $stdFile.Name
        if ($DryRun) {
            Log "WOULD install standard: $($stdFile.Name) -> $dst"
        } else {
            Copy-Item -Path $stdFile.FullName -Destination $dst -Force
            Log "Installed standard: $($stdFile.Name)"
        }
    }
} else {
    Log "No standards files - skipping"
}

# --- Agents ---
Write-Host ""
Log "=== Agents ==="
$agentsDir = Join-Path $ScriptDir "agents"
if ((Test-Path $agentsDir) -and (Get-ChildItem $agentsDir -Filter "*.md" -ErrorAction SilentlyContinue)) {
    $dstAgents = Join-Path $GeminiHome "agents"
    if (-not (Test-Path $dstAgents)) { New-Item -ItemType Directory -Path $dstAgents -Force | Out-Null }
    foreach ($agentFile in Get-ChildItem $agentsDir -Filter "*.md") {
        $dst = Join-Path $dstAgents $agentFile.Name
        if ($DryRun) {
            Log "WOULD install agent: $($agentFile.Name) -> $dst"
        } else {
            Copy-Item -Path $agentFile.FullName -Destination $dst -Force
            Log "Installed agent: $($agentFile.Name)"
        }
    }
} else {
    Log "No agents - skipping"
}

# --- Commands ---
Write-Host ""
Log "=== Commands ==="
$commandsDir = Join-Path $ScriptDir "commands"
if ((Test-Path $commandsDir) -and (Get-ChildItem $commandsDir -Filter "*.toml" -ErrorAction SilentlyContinue)) {
    $dstCommands = Join-Path $GeminiHome "commands"
    if (-not (Test-Path $dstCommands)) { New-Item -ItemType Directory -Path $dstCommands -Force | Out-Null }
    foreach ($cmdFile in Get-ChildItem $commandsDir -Filter "*.toml") {
        $dst = Join-Path $dstCommands $cmdFile.Name
        if ($DryRun) {
            Log "WOULD install command: $($cmdFile.Name) -> $dst"
        } else {
            Copy-Item -Path $cmdFile.FullName -Destination $dst -Force
            Log "Installed command: $($cmdFile.Name)"
        }
    }
} else {
    Log "No commands - skipping"
}

# --- Skills ---
Write-Host ""
Log "=== Skills ==="
$skillsDir = Join-Path $ScriptDir "skills"

if ((Test-Path $skillsDir) -and (Get-ChildItem $skillsDir -Directory -ErrorAction SilentlyContinue)) {
    foreach ($skillDir in Get-ChildItem $skillsDir -Directory) {
        $skillName = $skillDir.Name
        $dst = Join-Path $GeminiHome "skills\$skillName"
        if ($DryRun) {
            Log "WOULD install skill: $skillName -> $dst"
        } else {
            if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Path $dst -Force | Out-Null }
            Copy-Item -Path "$($skillDir.FullName)\*" -Destination $dst -Recurse -Force
            Log "Installed skill: $skillName"
        }
    }
} else {
    Log "No skills in package yet - skipping"
}

# --- Hooks ---
Write-Host ""
Log "=== Hooks ==="
$hooksDir = Join-Path $ScriptDir "hooks"

if ((Test-Path $hooksDir) -and (Get-ChildItem $hooksDir -ErrorAction SilentlyContinue)) {
    $dstHooks = Join-Path $GeminiHome "hooks"
    if (-not (Test-Path $dstHooks)) { New-Item -ItemType Directory -Path $dstHooks -Force | Out-Null }
    foreach ($hookFile in Get-ChildItem $hooksDir -File) {
        $dst = Join-Path $dstHooks $hookFile.Name
        if ($DryRun) {
            Log "WOULD install hook: $($hookFile.Name) -> $dst"
        } else {
            Copy-Item -Path $hookFile.FullName -Destination $dst -Force
            Log "Installed hook: $($hookFile.Name)"
        }
    }
} else {
    Log "No hooks in package yet - skipping"
}

# --- Summary ---
Write-Host ""
Log "=== Done ==="
Log "Config package installed to $GeminiHome"
Log "Run 'gemini' to verify."
