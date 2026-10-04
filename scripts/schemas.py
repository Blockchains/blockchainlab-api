# Infer a JSON Schema (draft 2020-12) for every dataset in v1/ and write v1/schemas/<name>.schema.json.
# Also used by CI (scripts/validate.py) and by the typed SDK generator in Blockchains/blockchainlab-sdk.
import json, os, glob
os.makedirs('v1/schemas', exist_ok=True)
def jtype(v):
    if v is None: return 'null'
    if isinstance(v, bool): return 'boolean'
    if isinstance(v, int): return 'integer'
    if isinstance(v, float): return 'number'
    if isinstance(v, str): return 'string'
    if isinstance(v, list): return 'array'
    return 'object'
def infer(values, depth=0):
    types = {jtype(v) for v in values}
    if 'integer' in types: types.discard('integer'); types.add('number')
    if types & {'number', 'string', 'boolean'}: types.add('null')  # scalars may become null upstream
    types = sorted(types)
    s = {'type': types[0] if len(types) == 1 else types}
    objs = [v for v in values if isinstance(v, dict)]
    if objs and depth < 4:
        keys = {}
        for o in objs:
            for k, v in o.items(): keys.setdefault(k, []).append(v)
        s['properties'] = {k: infer(v, depth + 1) for k, v in keys.items()}
        s['required'] = [] if PASSTHROUGH else sorted(k for k, v in keys.items() if len(v) == len(objs))
    arrs = [x for v in values if isinstance(v, list) for x in v]
    if 'array' in types: s['items'] = infer(arrs, depth + 1) if arrs and depth < 4 else {}
    return s
n = 0
PASSTHROUGH = False
for f in sorted(glob.glob('v1/*.json')):
    name = os.path.basename(f)[:-5]
    if name == 'index': continue
    d = json.load(open(f))
    PASSTHROUGH = name in ('hackathons', 'events')
    rows = d['data'] if isinstance(d.get('data'), list) else [d.get('data')]
    env = {k: v for k, v in d.items() if k != 'data'}
    schema = {'$schema': 'https://json-schema.org/draft/2020-12/schema', '$id': f'https://blockchains.github.io/blockchainlab-api/v1/schemas/{name}.schema.json', 'title': name, 'description': d.get('description'), 'x-schema-version': d.get('schema_version'),
              'type': 'object', 'required': ['dataset', 'generated_at', 'source', 'source_url', 'data'],
              'properties': {**{k: infer([v]) for k, v in env.items()}, 'data': {'type': 'array', 'items': infer(rows)}}}
    for k in ('generated_at', 'count', 'schema_url', 'upstream_generated_at'):  # these vary / may be null
        if k in schema['properties']: schema['properties'][k] = {'type': ['string', 'integer', 'null']}
    json.dump(schema, open(f'v1/schemas/{name}.schema.json', 'w'), indent=1); n += 1
print(n, 'schemas')
