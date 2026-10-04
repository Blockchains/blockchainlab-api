# CI: every dataset must parse, be non-empty, and validate against its committed schema. pip install jsonschema
import json, glob, os, sys
from jsonschema import Draft202012Validator
bad = 0
idx = json.load(open('v1/index.json'))
for d in idx['datasets']:
    name = d['dataset']; data = json.load(open(f'v1/{name}.json')); sch = json.load(open(f'v1/schemas/{name}.schema.json'))
    errs = list(Draft202012Validator(sch).iter_errors(data))
    empty = isinstance(data.get('data'), list) and len(data['data']) == 0
    status = 'OK' if not errs and not empty else 'FAIL'
    if status == 'FAIL': bad += 1
    print(f"{status:4} {name:22} rows={len(data['data']) if isinstance(data['data'], list) else '-':>6} gen={data['generated_at']} {'stale' if d.get('stale') else ''} {errs[0].message[:120] if errs else ''}")
print(f"{len(idx['datasets'])} datasets, {bad} failing"); sys.exit(1 if bad else 0)
