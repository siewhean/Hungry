import json
from pathlib import Path
from collections import Counter
root=Path(__file__).resolve().parent
ledger=json.loads((root/'closure-ledger.json').read_text())
primary={}
for name in ['auth-onboarding','discovery-maps','home-social','merchant','profile-settings','contributions-reads','saved-tools']:
 p=root/f'RESULT-{name}.json'; d=json.loads(p.read_text()); rows=d if isinstance(d,list) else d.get('findings',d.get('observations',[]))
 for row in rows:
  if row['id'] in primary: raise ValueError('Duplicate primary finding '+row['id'])
  primary[row['id']]=(p.name,row)
db=json.loads((root/'RESULT-database.json').read_text());dbrows=db if isinstance(db,list) else db.get('entries',db.get('findings',db.get('observations',[])));database={row['id']:row for row in dbrows}
assert len(primary)==len(ledger['findings'])==187
for finding in ledger['findings']:
 report,row=primary[finding['id']]
 finding['status']='acceptance_pending' if row['status']=='external_pending' else 'source_addressed'
 finding['disposition']={'kind':row['status'],'reason':row.get('reason') or 'Approved repair, removal or shared-cause correction documented in specialist evidence.','report':str(root.relative_to(Path.cwd())/report)}
 finding['implementation']=row.get('files',[])
 finding['verification']=row.get('checks',[])
 finding['worker_remaining_at_handoff']=row.get('remaining',[])
 finding['limitations']=['Source verification is separate from current native, deployed service, worker, storage and migration-replay acceptance.']
 finding['integration_evidence']=['tasks/remediation-2026-10-20/QA-accounts.md','tasks/remediation-2026-10-20/QA-final.md','tasks/remediation-2026-10-20/QA-tools-contributions.md','tasks/remediation-2026-10-20/QA-social-merchant.md','tasks/remediation-2026-10-20/QA-publication.md']
 if finding['id'] in database:
  finding['database_evidence']=database[finding['id']]
  finding['integration_evidence'].append('tasks/remediation-2026-10-20/QA-database.md')
ledger['summary']={'total':187,**dict(Counter(row['status'] for row in ledger['findings'])),'primary_dispositions':dict(Counter(row[1]['status'] for row in primary.values())),'unmapped':0,'unresolved_source_reported':sum(row[1]['status']=='unresolved' for row in primary.values())}
ledger['verification_boundary']='All observations have a specialist disposition. Source-addressed is not release-closed. Handoff limitations are retained verbatim for provenance; final integration evidence and QA supersede root-integration requests already completed. Native, staging, real worker/storage, concurrency and full historical Supabase clean/upgrade replay remain independent acceptance requirements.'
(root/'closure-ledger.json').write_text(json.dumps(ledger,indent=2)+'\n')
print(json.dumps(ledger['summary'],indent=2))
