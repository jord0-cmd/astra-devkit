#!/bin/bash
#
# Gemini CLI Config Installer
# Installs the portable config package to ~/.gemini/
#
# Usage: ./install.sh [--dry-run]
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GEMINI_HOME="${HOME}/.gemini"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "[DRY RUN] No files will be modified."
fi

log() { echo "[install] $*"; }
copy_file() {
    local src="$1" dst="$2"
    if $DRY_RUN; then
        log "WOULD copy: $src -> $dst"
    else
        mkdir -p "$(dirname "$dst")"
        cp "$src" "$dst"
        log "Copied: $src -> $dst"
    fi
}

# --- Pre-checks ---
if ! command -v gemini &>/dev/null; then
    echo "ERROR: Gemini CLI not installed. Run: npm install -g @google/gemini-cli@preview"
    exit 1
fi

if [ ! -d "$GEMINI_HOME" ]; then
    echo "ERROR: ~/.gemini/ doesn't exist. Run 'gemini' once to initialize and authenticate."
    exit 1
fi

log "Gemini CLI version: $(gemini --version)"
log "Installing config package from: $SCRIPT_DIR"
echo ""

# --- Backup Existing Config ---
BACKUP_DIR="$GEMINI_HOME/backup_$(date +%Y%m%d_%H%M%S)"
HAS_EXISTING=false
for f in "$GEMINI_HOME/settings.json" "$GEMINI_HOME/GEMINI.md" "$GEMINI_HOME/standards" "$GEMINI_HOME/skills" "$GEMINI_HOME/agents" "$GEMINI_HOME/hooks"; do
    [ -e "$f" ] && HAS_EXISTING=true && break
done

if $HAS_EXISTING && ! $DRY_RUN; then
    mkdir -p "$BACKUP_DIR"
    [ -f "$GEMINI_HOME/settings.json" ] && cp "$GEMINI_HOME/settings.json" "$BACKUP_DIR/"
    [ -f "$GEMINI_HOME/GEMINI.md" ] && cp "$GEMINI_HOME/GEMINI.md" "$BACKUP_DIR/"
    [ -d "$GEMINI_HOME/standards" ] && cp -r "$GEMINI_HOME/standards" "$BACKUP_DIR/"
    log "Existing config backed up to: $BACKUP_DIR"
elif $HAS_EXISTING && $DRY_RUN; then
    log "WOULD backup existing config to: $GEMINI_HOME/backup_TIMESTAMP/"
fi

# --- Core Config ---
log "=== Core Config ==="

# settings.json — MERGE, don't overwrite (preserve auth credentials)
if [ -f "$GEMINI_HOME/settings.json" ]; then
    log "settings.json exists — merging (preserving auth)..."
    if ! $DRY_RUN; then
        # Use python to deep-merge: package values override, but preserve security.auth
        python3 -c "
import json, sys

with open('$GEMINI_HOME/settings.json') as f:
    existing = json.load(f)
with open('$SCRIPT_DIR/settings.json') as f:
    package = json.load(f)

def deep_merge(base, overlay):
    result = base.copy()
    for key, value in overlay.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result

# Preserve existing auth
auth_backup = existing.get('security', {}).get('auth', {})
merged = deep_merge(existing, package)
if auth_backup:
    merged.setdefault('security', {})['auth'] = auth_backup

with open('$GEMINI_HOME/settings.json', 'w') as f:
    json.dump(merged, f, indent=2)
    f.write('\n')
" && log "settings.json merged successfully"
    fi
else
    copy_file "$SCRIPT_DIR/settings.json" "$GEMINI_HOME/settings.json"
fi

# GEMINI.md
if [ -f "$SCRIPT_DIR/GEMINI.md" ]; then
    copy_file "$SCRIPT_DIR/GEMINI.md" "$GEMINI_HOME/GEMINI.md"
else
    log "GEMINI.md not in package yet — skipping"
fi

# Standards (always-loaded @imports)
STANDARDS_DIR="$SCRIPT_DIR/standards"
if [ -d "$STANDARDS_DIR" ] && [ "$(ls -A "$STANDARDS_DIR" 2>/dev/null)" ]; then
    for std_file in "$STANDARDS_DIR"/*; do
        std_name="$(basename "$std_file")"
        dst="$GEMINI_HOME/standards/$std_name"
        if $DRY_RUN; then
            log "WOULD install standard: $std_name -> $dst"
        else
            mkdir -p "$GEMINI_HOME/standards"
            cp "$std_file" "$dst"
            log "Installed standard: $std_name"
        fi
    done
else
    log "No standards files — skipping"
fi

# --- Agents ---
log ""
log "=== Agents ==="
AGENTS_DIR="$SCRIPT_DIR/agents"
if [ -d "$AGENTS_DIR" ] && [ "$(ls -A "$AGENTS_DIR" 2>/dev/null)" ]; then
    for agent_file in "$AGENTS_DIR"/*.md; do
        agent_name="$(basename "$agent_file")"
        dst="$GEMINI_HOME/agents/$agent_name"
        if $DRY_RUN; then
            log "WOULD install agent: $agent_name -> $dst"
        else
            mkdir -p "$GEMINI_HOME/agents"
            cp "$agent_file" "$dst"
            log "Installed agent: $agent_name"
        fi
    done
else
    log "No agents — skipping"
fi

# --- Commands ---
log ""
log "=== Commands ==="
COMMANDS_DIR="$SCRIPT_DIR/commands"
if [ -d "$COMMANDS_DIR" ] && [ "$(ls -A "$COMMANDS_DIR" 2>/dev/null)" ]; then
    for cmd_file in "$COMMANDS_DIR"/*.toml; do
        cmd_name="$(basename "$cmd_file")"
        dst="$GEMINI_HOME/commands/$cmd_name"
        if $DRY_RUN; then
            log "WOULD install command: $cmd_name -> $dst"
        else
            mkdir -p "$GEMINI_HOME/commands"
            cp "$cmd_file" "$dst"
            log "Installed command: $cmd_name"
        fi
    done
else
    log "No commands — skipping"
fi

# --- Skills ---
log ""
log "=== Skills ==="
SKILLS_DIR="$SCRIPT_DIR/skills"
if [ -d "$SKILLS_DIR" ] && [ "$(ls -A "$SKILLS_DIR" 2>/dev/null)" ]; then
    for skill_dir in "$SKILLS_DIR"/*/; do
        skill_name="$(basename "$skill_dir")"
        dst="$GEMINI_HOME/skills/$skill_name"
        if $DRY_RUN; then
            log "WOULD install skill: $skill_name -> $dst"
        else
            mkdir -p "$dst"
            cp -r "$skill_dir"* "$dst/"
            log "Installed skill: $skill_name"
        fi
    done
else
    log "No skills in package yet — skipping"
fi

# --- Hooks ---
log ""
log "=== Hooks ==="
HOOKS_DIR="$SCRIPT_DIR/hooks"
if [ -d "$HOOKS_DIR" ] && [ "$(ls -A "$HOOKS_DIR" 2>/dev/null)" ]; then
    for hook_file in "$HOOKS_DIR"/*; do
        hook_name="$(basename "$hook_file")"
        dst="$GEMINI_HOME/hooks/$hook_name"
        if $DRY_RUN; then
            log "WOULD install hook: $hook_name -> $dst"
        else
            mkdir -p "$GEMINI_HOME/hooks"
            cp "$hook_file" "$dst"
            chmod +x "$dst"
            log "Installed hook: $hook_name"
        fi
    done
else
    log "No hooks in package yet — skipping"
fi

# --- Summary ---
echo ""
log "=== Done ==="
log "Config package installed to $GEMINI_HOME"
log "Run 'gemini' to verify."
