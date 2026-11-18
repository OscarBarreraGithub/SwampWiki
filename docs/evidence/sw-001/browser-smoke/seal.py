"""Run only after root supplies the sealed commit; no submission is performed."""
import hashlib,json,subprocess,sys
from pathlib import Path
commit,out=sys.argv[1:];out=Path(out);out.mkdir(parents=True,exist_ok=False)
base='aeda8e75a36b62ab4d063a897262be9095e19485'
def git(*args):return subprocess.check_output(['git',*args])
commit=git('rev-parse',commit).decode().strip()
paths=git('diff','--name-only','--diff-filter=ACMRT','-z',base,commit).decode().strip('\0').split('\0');assert not any(p.startswith('data/') for p in paths),'Frozen input changed; coordinate before staging'
archive=out/'delta.tar.gz';archive.write_bytes(git('archive','--format=tar.gz',commit,'--',*paths))
tree={}
for row in git('ls-tree','-r','-z',commit).split(b'\0'):
 if not row:continue
 meta,name=row.split(b'\t');mode,kind,oid=meta.decode().split();assert kind=='blob' and mode in ['100644','100755'];tree[name.decode()]=oid
config={'commit':commit,'baseCommit':base,'reusedRun':'/n/netscratch/randall_lab/Everyone/obarrera/eigenquestions-q025/integration/final-public-v2','deltaSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'tree':tree}
(out/'input.json').write_text(json.dumps(config,separators=(',',':'))+'\n')
for name in ['stage.py','browser.py','run.sbatch']:(out/name).write_bytes(git('show',commit+':docs/evidence/sw-001/browser-smoke/'+name))
print(json.dumps({'commit':commit,'deltaBytes':archive.stat().st_size,'deltaSha256':config['deltaSha256'],'trackedFiles':len(tree)}))
