"""AST-Driven Mutation Testing Engine.

Built by Astra (concept), hardened by Rayne (verification + operators).
Uses ast-grep (sg) for structural code mutations.

Usage:
    1. Copy this file to scripts/mutate_test.py in your project
    2. Edit the MUTATIONS list to target your codebase
    3. Run: python3 scripts/mutate_test.py

Requirements: ast-grep (sg), uv + pytest
"""

import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Mutation:
    file: str
    pattern: str
    replacement: str
    description: str
    category: str  # value | logic | structural | boundary


def apply_mutation(mutation: Mutation) -> tuple[bool, str, str]:
    """Apply mutation via sg. Returns (applied, diff_text, backup_path)."""
    backup = f"{mutation.file}.bak"
    shutil.copy2(mutation.file, backup)

    cmd = [
        "sg", "-p", mutation.pattern, "-r", mutation.replacement,
        "--lang", "python", "--update-all", mutation.file,
    ]
    subprocess.run(cmd, capture_output=True, text=True, check=False)

    # CRITICAL: Verify mutation actually applied
    res = subprocess.run(
        ["diff", "-u", backup, mutation.file],
        capture_output=True, text=True, check=False,
    )
    return bool(res.stdout.strip()), res.stdout, backup


def run_tests() -> tuple[bool, str]:
    """Run pytest, return (passed, output)."""
    res = subprocess.run(
        ["uv", "run", "pytest", "-x", "-q"],
        capture_output=True, text=True, check=False,
    )
    return res.returncode == 0, res.stdout + res.stderr


# ============================================================
# EDIT THIS: Define mutations for YOUR codebase
# ============================================================
MUTATIONS = [
    # --- Value mutations: flip defaults ---
    # Mutation(
    #     file="src/domain/models.py",
    #     pattern="status: Status = Status.BACKLOG",
    #     replacement="status: Status = Status.DONE",
    #     description="Flip default status BACKLOG -> DONE",
    #     category="value",
    # ),

    # --- Logic mutations: change return values, status codes ---
    # Mutation(
    #     file="src/api/routes/tasks.py",
    #     pattern="return await repo.list($$$ARGS)",
    #     replacement="return []",
    #     description="Force list endpoint to return []",
    #     category="logic",
    # ),

    # --- Structural mutations: remove fields, middleware ---
    # Mutation(
    #     file="src/api/main.py",
    #     pattern="app.add_middleware(\n    CORSMiddleware,\n    $$$ARGS\n)",
    #     replacement="# CORS removed by mutation",
    #     description="Remove CORS middleware",
    #     category="structural",
    # ),

    # --- Boundary mutations: remove validation ---
    # Mutation(
    #     file="src/domain/models.py",
    #     pattern="title: str = Field(..., min_length=1, max_length=200)",
    #     replacement="title: str",
    #     description="Remove title validation constraints",
    #     category="boundary",
    # ),
]


def main():
    if not MUTATIONS:
        print("No mutations defined. Edit the MUTATIONS list in this file.")
        return

    results: list[tuple[str, str, str]] = []

    for m in MUTATIONS:
        if not Path(m.file).exists():
            print(f"SKIP: {m.file} not found")
            continue

        applied, diff_text, backup = apply_mutation(m)

        if not applied:
            results.append((m.description, m.category, "FAILED TO APPLY"))
            Path(backup).unlink()
            continue

        print(f"\n{'='*60}")
        print(f"MUTATION: {m.description} [{m.category}]")
        print(f"{'~'*60}")
        print(diff_text.strip())
        print(f"{'~'*60}")

        passed, test_output = run_tests()

        if passed:
            verdict = "SURVIVED"
            print("!! SURVIVED — test gap found")
            for line in test_output.split("\n"):
                if "passed" in line or "failed" in line or "error" in line.lower():
                    print(f"  {line.strip()}")
        else:
            verdict = "KILLED"
            print("OK KILLED — tests caught this mutation")

        results.append((m.description, m.category, verdict))

        # Restore original
        shutil.copy2(backup, m.file)
        Path(backup).unlink()

    # Report
    print(f"\n\n{'='*70}")
    print("AST-DRIVEN MUTATION TESTING REPORT")
    print(f"{'='*70}")

    killed = sum(1 for _, _, v in results if v == "KILLED")
    survived = sum(1 for _, _, v in results if v == "SURVIVED")
    failed = sum(1 for _, _, v in results if v == "FAILED TO APPLY")
    applied = killed + survived

    for category in ["value", "logic", "structural", "boundary"]:
        cat_results = [(d, v) for d, c, v in results if c == category]
        if cat_results:
            print(f"\n  {category.upper()}")
            for desc, verdict in cat_results:
                icon = "OK" if verdict == "KILLED" else "!!" if verdict == "SURVIVED" else "XX"
                print(f"    {icon} {desc:<50} {verdict}")

    print(f"\n{'~'*70}")
    print(f"  Applied: {applied}/{len(results)}  |  Killed: {killed}  |  Survived: {survived}  |  Failed: {failed}")
    if applied > 0:
        score = killed / applied * 100
        print(f"  Mutation Score: {score:.0f}% ({killed}/{applied} killed)")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
