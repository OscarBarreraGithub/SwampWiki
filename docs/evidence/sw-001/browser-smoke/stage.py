"""Reuse verified accepted inputs; overlay and verify the complete sealed Git tree."""
import hashlib,importlib.util,json,shutil,sys,tarfile
from pathlib import Path
run,project=map(Path,sys.argv[1:3]);config=json.loads((run/'input.json').read_text())
prior=Path(config['reusedRun'])
spec=importlib.util.spec_from_file_location('accepted_ingress',prior/'stage.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
receipt=module.stage(prior/'final-input.json',project)
archive=run/'delta.tar.gz';assert hashlib.sha256(archive.read_bytes()).hexdigest()==config['deltaSha256']
with tarfile.open(archive) as tar:
 for member in tar:
  if member.isdir():continue
  relative=module.safe_path(member.name);assert member.isfile();target=project/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(tar.extractfile(member).read())
expected=config['tree']
for file in project.rglob('*'):
 if file.is_file() and str(file.relative_to(project)) not in expected:file.unlink()
for name,oid in expected.items():
 data=(project/name).read_bytes();assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==oid,name
receipt={'commit':config['commit'],'verifiedGitFiles':len(expected),'deltaSha256':config['deltaSha256'],'reusedAcceptedIngress':receipt,'sourcePolicy':'Immutable prior source archives reused; every resulting file matches the sealed SwampWiki Git tree.'}
(run/'ingress.json').write_text(json.dumps(receipt,indent=2)+'\n')
