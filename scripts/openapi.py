# Regenerate openapi.json / openapi.yaml from v1/index.json. Requires pyyaml.
import json, yaml
idx=json.load(open('v1/index.json'))
paths={'/v1/index.json':{'get':{'summary':'Dataset catalogue','operationId':'getIndex','tags':['meta'],'responses':{'200':{'description':'List of datasets with counts, sources and generation time','content':{'application/json':{'schema':{'type':'object'}}}}}}}}
for d in idx['datasets']:
  n=d['dataset']
  paths[f'/v1/{n}.json']={'get':{'summary':d['description'],'operationId':'get'+''.join(p.capitalize() for p in n.split('-')),'tags':['datasets'],'description':f"Source: {d['source']} ({d['source_url']}). Rebuilt nightly by GitHub Actions.",'responses':{'200':{'description':'Dataset envelope','content':{'application/json':{'schema':{'$ref':'#/components/schemas/Envelope'}}}}}}}
spec={'openapi':'3.1.0','info':{'title':'Blockchain Lab Open Data API','version':'1.0.0','description':'Free, static, CORS-enabled JSON datasets for blockchain builders: chains, DeFi TVL, hackathons, events, whitepapers, glossary, grants, EIPs/ERCs/BIPs. Rebuilt nightly from public sources. Built by Blockchain Lab — https://blockchainlab.com','contact':{'name':'Blockchain Lab','url':'https://blockchainlab.com/?utm_source=github&utm_medium=openapi&utm_campaign=blockchainlab-api'},'license':{'name':'Code MIT; data belongs to each named source','url':'https://github.com/Blockchains/blockchainlab-api/blob/main/LICENSE'}},
 'servers':[{'url':'https://blockchains.github.io/blockchainlab-api'}],'paths':paths,
 'components':{'schemas':{'Envelope':{'type':'object','required':['dataset','generated_at','source','source_url','data'],'properties':{'dataset':{'type':'string'},'description':{'type':'string'},'generated_at':{'type':'string','format':'date-time'},'source':{'type':'string'},'source_url':{'type':'string','format':'uri'},'built_by':{'type':'string'},'licence_note':{'type':'string'},'count':{'type':'integer'},'data':{'type':'array','items':{'type':'object'}}}}}}}
json.dump(spec,open('openapi.json','w'),indent=1)
yaml.safe_dump(spec,open('openapi.yaml','w'),sort_keys=False,allow_unicode=True)
print(len(paths),'paths')
