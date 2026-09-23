"""Validate site/data/instruments.json against the schema and check cross-references.

Run locally:  pip install jsonschema && python scripts/validate.py
Also runs in GitHub Actions before every deploy.
"""
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent.parent
data = json.loads((ROOT / "site/data/instruments.json").read_text(encoding="utf-8"))
schema = json.loads((ROOT / "schema/instrument.schema.json").read_text(encoding="utf-8"))
glossary = json.loads((ROOT / "site/data/glossary.json").read_text(encoding="utf-8"))
sections = json.loads((ROOT / "site/data/sections.json").read_text(encoding="utf-8"))

validator = Draft202012Validator(schema)
errors = []

for i, entry in enumerate(data):
    label = entry.get("id", f"index {i}")
    for err in validator.iter_errors(entry):
        path = ".".join(str(p) for p in err.path) or "(entry)"
        errors.append(f"{label}: {path}: {err.message}")

ids = [e.get("id") for e in data]
for dup in {x for x in ids if ids.count(x) > 1}:
    errors.append(f"duplicate id: {dup}")

known = set(ids)
for e in data:
    for rel in e.get("related", []):
        if rel not in known:
            errors.append(f"{e['id']}: related id '{rel}' does not exist")
    if e.get("related") and e["id"] in e["related"]:
        errors.append(f"{e['id']}: lists itself as related")

for g in glossary:
    for key in ("term", "definition", "why"):
        if not g.get(key):
            errors.append(f"glossary: entry '{g.get('term', '?')}' is missing '{key}'")

for sec in sections.get("sections", []):
    if not sec.get("id") or not sec.get("title"):
        errors.append(f"sections.json: a section is missing 'id' or 'title'")
        continue
    for block in sec.get("blocks", []):
        if block.get("type") == "table":
            for row in block.get("rows", []):
                ref = row.get("ref")
                if ref and ref not in known:
                    errors.append(f"sections.json/{sec['id']}/{block.get('id')}: ref '{ref}' does not exist in instruments.json")
                if len(row.get("cells", [])) != len(block.get("columns", [])):
                    errors.append(f"sections.json/{sec['id']}/{block.get('id')}: a row has {len(row.get('cells', []))} cells but {len(block.get('columns', []))} columns")

unverified = [e["id"] for e in data if not e.get("last_verified")]
no_source = [e["id"] for e in data if not e.get("url")]

print(f"{len(data)} entries checked.")
print(f"  {len(unverified)} not yet verified against a primary source")
print(f"  {len(no_source)} without a source link")

if errors:
    print("\nErrors:")
    for line in errors:
        print("  -", line)
    sys.exit(1)

print("Data is valid.")
