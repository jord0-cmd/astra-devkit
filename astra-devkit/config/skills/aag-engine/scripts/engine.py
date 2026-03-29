"""Active Architectural Graph (AAG) Engine.

Scans a fullstack codebase using ast-grep to build a semantic dependency map.
Maps backend models -> routes -> frontend types -> components -> API calls.
Detects State Drift when frontend types have no backend equivalent.

Usage:
    python3 scripts/aag-engine/engine.py [project_root]
"""

import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from pathlib import Path
from typing import Any


class AAGEngine:
    def __init__(self, root_dir: str, rules_dir: str | None = None) -> None:
        self.root_dir = Path(root_dir)
        # Rules can live in the skill installation or alongside the engine
        if rules_dir:
            self.rules_dir = Path(rules_dir)
        else:
            # Check skill install location first, then project-local
            skill_rules = Path.home() / ".gemini" / "skills" / "aag-engine" / "scripts" / "rules"
            local_rules = self.root_dir / "scripts" / "aag-engine" / "rules"
            self.rules_dir = skill_rules if skill_rules.exists() else local_rules
        self.graph: dict[str, Any] = {
            "nodes": {
                "backend_models": {},
                "backend_routes": {},
                "frontend_types": {},
                "frontend_components": {},
                "frontend_api_calls": {},
            },
            "edges": [],
            "drift_warnings": [],
        }

    def run_rule(self, rule_file: str, target_dir: str) -> list[dict[str, Any]]:
        """Run an ast-grep scan rule against a directory."""
        rule_path = self.rules_dir / rule_file
        target = self.root_dir / target_dir

        if not rule_path.exists():
            print(f"  WARN: Rule not found: {rule_path}", file=sys.stderr)
            return []
        if not target.exists():
            print(f"  WARN: Target not found: {target}", file=sys.stderr)
            return []

        try:
            result = subprocess.run(
                ["sg", "scan", "-r", str(rule_path), str(target), "--json"],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if not result.stdout.strip():
                return []
            return json.loads(result.stdout)
        except subprocess.TimeoutExpired:
            print(f"  ERROR: Timeout on {rule_file}", file=sys.stderr)
            return []
        except subprocess.CalledProcessError as e:
            if e.stdout and e.stdout.strip():
                try:
                    return json.loads(e.stdout)
                except json.JSONDecodeError:
                    pass
            print(f"  ERROR: sg failed on {rule_file}: {e.stderr[:200]}", file=sys.stderr)
            return []
        except json.JSONDecodeError as e:
            print(f"  ERROR: Bad JSON from {rule_file}: {e}", file=sys.stderr)
            return []

    @staticmethod
    def _var(match: dict, name: str) -> str | None:
        """Extract a metavariable from ast-grep match."""
        return (
            match.get("metaVariables", {})
            .get("single", {})
            .get(name, {})
            .get("text")
        )

    def build_map(self) -> None:
        """Scan the codebase and build the graph."""
        print("AAG Engine: Scanning...")

        with ThreadPoolExecutor(max_workers=5) as ex:
            futures = {
                "models": ex.submit(self.run_rule, "backend-models.yml", "backend/src"),
                "routes": ex.submit(self.run_rule, "backend-routes.yml", "backend/src/api"),
                "types": ex.submit(self.run_rule, "frontend-types.yml", "frontend/src"),
                "components": ex.submit(self.run_rule, "frontend-components.yml", "frontend/src"),
                "api_calls": ex.submit(self.run_rule, "frontend-api-calls.yml", "frontend/src"),
            }
            results = {}
            for key, fut in futures.items():
                try:
                    results[key] = fut.result(timeout=60)
                except (TimeoutError, Exception) as e:
                    print(f"  ERROR: {key}: {e}", file=sys.stderr)
                    results[key] = []

        # Parse nodes
        for m in results.get("models", []):
            name = self._var(m, "NAME")
            if name:
                self.graph["nodes"]["backend_models"][name] = {
                    "file": m.get("file", ""),
                    "line": m.get("range", {}).get("start", {}).get("line", 0),
                    "base": self._var(m, "BASE"),
                }

        for m in results.get("routes", []):
            method = self._var(m, "METHOD")
            text = m.get("text", "")
            if method:
                path = self._extract(r'["\']([^"\']*)["\']', text)
                resp = self._extract(r'response_model\s*=\s*(\w+(?:\[[\w, ]+\])?)', text)
                func = self._extract(r'async def (\w+)', text)
                key = f"{method.upper()} {path or 'unknown'}"
                self.graph["nodes"]["backend_routes"][key] = {
                    "method": method, "path": path, "response_model": resp,
                    "function": func, "file": m.get("file", ""),
                    "line": m.get("range", {}).get("start", {}).get("line", 0),
                }

        for m in results.get("types", []):
            name = self._var(m, "NAME")
            if name:
                self.graph["nodes"]["frontend_types"][name] = {
                    "file": m.get("file", ""),
                    "line": m.get("range", {}).get("start", {}).get("line", 0),
                }

        for m in results.get("components", []):
            name = self._var(m, "COMP")
            if name and name[0].isupper():
                self.graph["nodes"]["frontend_components"][name] = {
                    "file": m.get("file", ""),
                    "line": m.get("range", {}).get("start", {}).get("line", 0),
                }

        for m in results.get("api_calls", []):
            method = self._var(m, "METHOD")
            if method:
                self.graph["nodes"]["frontend_api_calls"][method] = {
                    "file": m.get("file", ""),
                    "line": m.get("range", {}).get("start", {}).get("line", 0),
                }

        self.compute_edges()
        self.detect_drift()
        self.save_map()

    @staticmethod
    def _extract(pattern: str, text: str) -> str | None:
        m = re.search(pattern, text)
        return m.group(1) if m else None

    def scan_imports(self) -> None:
        """Scan import statements using grep (more reliable than ast-grep for imports)."""
        print("AAG Engine: Scanning imports...")

        # Build file-to-node index for edge resolution
        file_to_nodes: dict[str, list[str]] = {}
        for category, nodes in self.graph["nodes"].items():
            for name, data in nodes.items():
                f = data.get("file", "")
                if f:
                    # Normalise to relative path
                    rel = f.replace(str(self.root_dir) + "/", "").replace(str(self.root_dir), "")
                    file_to_nodes.setdefault(rel, []).append(f"{category}:{name}")

        # Python imports: from app.module import Name
        self._scan_py_imports(file_to_nodes)
        # TypeScript imports: import { Name } from './path'
        self._scan_ts_imports(file_to_nodes)

    def _scan_py_imports(self, file_to_nodes: dict[str, list[str]]) -> None:
        """Scan Python internal imports using grep."""
        backend_dirs = [d for d in ["backend/src", "backend/app", "backend", "src"]
                        if (self.root_dir / d).exists()]
        if not backend_dirs:
            return

        for bdir in backend_dirs[:1]:  # Use first match
            try:
                result = subprocess.run(
                    ["grep", "-rn", "^from.*import\\|^import ", str(self.root_dir / bdir),
                     "--include=*.py"],
                    capture_output=True, text=True, timeout=10,
                )
            except (subprocess.TimeoutExpired, Exception):
                return

            for line in result.stdout.strip().split("\n"):
                if not line:
                    continue
                parts = line.split(":", 2)
                if len(parts) < 3:
                    continue
                file_path = parts[0].replace(str(self.root_dir) + "/", "")
                code = parts[2].strip()

                # Extract module path and imported names
                m = re.match(r'from\s+([\w.]+)\s+import\s+(.+)', code)
                if not m:
                    continue
                module = m.group(1)
                names = [n.strip().split(" as ")[0].strip() for n in m.group(2).split(",")]

                # Only care about internal imports
                if not any(module.startswith(p) for p in ["app.", "src.", "domain.", "api.", "infrastructure."]):
                    continue

                # Find which file the import source resolves to
                source_nodes = file_to_nodes.get(file_path, [])
                for name in names:
                    name = name.strip()
                    if not name or name.startswith("("):
                        continue
                    # Find target node by name
                    for cat_nodes in self.graph["nodes"].values():
                        if name in cat_nodes:
                            target_file = cat_nodes[name].get("file", "")
                            target_rel = target_file.replace(str(self.root_dir) + "/", "")
                            # Create edge from importing file to imported symbol
                            self.graph["edges"].append({
                                "from": f"file:{file_path.split('/')[-1]}",
                                "to": f"{self._node_category(name)}:{name}",
                                "type": "imports",
                            })
                            break

    def _scan_ts_imports(self, file_to_nodes: dict[str, list[str]]) -> None:
        """Scan TypeScript/TSX internal imports using grep."""
        frontend_dirs = [d for d in ["frontend/src", "src"]
                         if (self.root_dir / d).exists()]
        if not frontend_dirs:
            return

        for fdir in frontend_dirs[:1]:
            try:
                result = subprocess.run(
                    ["grep", "-rn", "import.*from.*['\"]\\./\\|import.*from.*['\"]\\.\\./ ",
                     str(self.root_dir / fdir),
                     "--include=*.ts", "--include=*.tsx"],
                    capture_output=True, text=True, timeout=10,
                )
            except (subprocess.TimeoutExpired, Exception):
                return

            for line in result.stdout.strip().split("\n"):
                if not line:
                    continue
                parts = line.split(":", 2)
                if len(parts) < 3:
                    continue
                file_path = parts[0].replace(str(self.root_dir) + "/", "")
                code = parts[2].strip()

                # Extract imported names
                m = re.match(r'import\s+(?:type\s+)?{([^}]+)}\s+from\s+["\']([^"\']+)["\']', code)
                if not m:
                    continue
                names = [n.strip().split(" as ")[0].strip() for n in m.group(1).split(",")]
                module_path = m.group(2)

                for name in names:
                    name = name.strip()
                    if not name:
                        continue
                    # Find target node by name
                    for cat_nodes in self.graph["nodes"].values():
                        if name in cat_nodes:
                            self.graph["edges"].append({
                                "from": f"file:{file_path.split('/')[-1]}",
                                "to": f"{self._node_category(name)}:{name}",
                                "type": "imports",
                            })
                            break

    def _node_category(self, name: str) -> str:
        """Find which category a node belongs to."""
        for cat, nodes in self.graph["nodes"].items():
            if name in nodes:
                return cat
        return "unknown"

    def compute_edges(self) -> None:
        """Build relationships between nodes."""
        print("AAG Engine: Computing edges...")

        # Route -> Model (via response_model)
        for route_key, rd in self.graph["nodes"]["backend_routes"].items():
            rm = rd.get("response_model")
            if rm:
                inner = re.search(r'\[(\w+)\]', rm)
                model = inner.group(1) if inner else rm
                if model in self.graph["nodes"]["backend_models"]:
                    self.graph["edges"].append({
                        "from": f"route:{route_key}", "to": f"model:{model}", "type": "returns"
                    })

        # Frontend Type -> Backend Model (name match)
        for ts in self.graph["nodes"]["frontend_types"]:
            if ts in self.graph["nodes"]["backend_models"]:
                self.graph["edges"].append({
                    "from": f"ts_type:{ts}", "to": f"py_model:{ts}", "type": "api_contract_binding"
                })

        # API Call -> Route (heuristic)
        for call in self.graph["nodes"]["frontend_api_calls"]:
            for rk, rd in self.graph["nodes"]["backend_routes"].items():
                func = rd.get("function", "")
                if func and func.replace("_", "") in call.lower():
                    self.graph["edges"].append({
                        "from": f"api_call:{call}", "to": f"route:{rk}", "type": "calls"
                    })

        # Import edges (grep-based, cross-file dependencies)
        self.scan_imports()

        # Resolve file: edges to named nodes
        self._resolve_file_edges()

    def _resolve_file_edges(self) -> None:
        """Convert file: edges to named node edges by looking up which nodes live in that file."""
        # Build reverse index: filename → list of node IDs
        file_to_node_ids: dict[str, list[str]] = {}
        for cat, nodes in self.graph["nodes"].items():
            for name, data in nodes.items():
                fname = data.get("file", "").split("/")[-1]
                if fname:
                    file_to_node_ids.setdefault(fname, []).append(f"{cat}:{name}")

        resolved = []
        kept = []
        for edge in self.graph["edges"]:
            if edge["from"].startswith("file:"):
                fname = edge["from"].replace("file:", "")
                source_nodes = file_to_node_ids.get(fname, [])
                if source_nodes:
                    # Create an edge from each node in that file to the target
                    for src in source_nodes:
                        if src != edge["to"]:  # No self-edges
                            resolved.append({
                                "from": src, "to": edge["to"],
                                "type": "imports",
                            })
                # Drop unresolved file: edges
            else:
                kept.append(edge)

        # Deduplicate
        seen = set()
        for e in kept + resolved:
            key = (e["from"], e["to"], e["type"])
            if key not in seen:
                seen.add(key)
                kept.append(e) if e in kept else None

        # Rebuild with deduplication
        final = []
        seen = set()
        for e in kept + resolved:
            key = (e["from"], e["to"])
            if key not in seen:
                seen.add(key)
                final.append(e)

        self.graph["edges"] = final

    def detect_drift(self) -> None:
        """Detect State Drift between stacks."""
        print("AAG Engine: Drift analysis...")
        py = set(self.graph["nodes"]["backend_models"].keys())
        ts = set(self.graph["nodes"]["frontend_types"].keys())

        for t in ts:
            if t not in py:
                self.graph["drift_warnings"].append({
                    "severity": "high", "type": "orphaned_type",
                    "message": f"Frontend type '{t}' has no backend model.",
                })
        for model, data in self.graph["nodes"]["backend_models"].items():
            if data.get("base") == "BaseModel" and model not in ts:
                self.graph["drift_warnings"].append({
                    "severity": "info", "type": "no_frontend_type",
                    "message": f"Backend model '{model}' has no frontend type (may be internal).",
                })
        for rk, rd in self.graph["nodes"]["backend_routes"].items():
            if not rd.get("response_model"):
                self.graph["drift_warnings"].append({
                    "severity": "medium", "type": "missing_response_model",
                    "message": f"Route '{rk}' has no explicit response_model.",
                })

    def save_map(self) -> None:
        out = self.root_dir / "docs" / "architectural-graph.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, "w") as f:
            json.dump(self.graph, f, indent=2)

        n = self.graph["nodes"]
        print(f"\nAAG Engine: Done.")
        print(f"  Models:     {len(n['backend_models'])}")
        print(f"  Routes:     {len(n['backend_routes'])}")
        print(f"  TS Types:   {len(n['frontend_types'])}")
        print(f"  Components: {len(n['frontend_components'])}")
        print(f"  API Calls:  {len(n['frontend_api_calls'])}")
        print(f"  Edges:      {len(self.graph['edges'])}")

        warnings = self.graph["drift_warnings"]
        if warnings:
            high = sum(1 for w in warnings if w["severity"] == "high")
            print(f"\n  Drift: {len(warnings)} warnings ({high} high)")
            for w in warnings:
                icon = {"high": "!!!", "medium": " ! ", "info": " i "}.get(w["severity"], " ? ")
                print(f"    [{icon}] {w['message']}")
        else:
            print(f"\n  No drift. Stacks in sync.")

        print(f"\nSaved: {out}")


if __name__ == "__main__":
    root = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
    AAGEngine(root).build_map()
