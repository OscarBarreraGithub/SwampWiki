"""One isolated rendered-text smoke; no companion, model, or public-origin claim."""
import argparse,json,subprocess,time,traceback,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--project',required=True);p.add_argument('--output',required=True);p.add_argument('--node',required=True);a=p.parse_args()
root=Path(a.project).resolve();out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
report={'kind':'swampwiki-text-smoke','passed':False,'checks':[],'pageErrors':[],'scope':'Isolated Slurm Chromium on loopback HTTP, not swampwiki.com or owner browser.'}
server=None;browser=None;page=None
home='collection:q025-quantum-gravity'
def check(name,**extra):report['checks'].append({'name':name,'passed':True,**extra})
def wait(id):
 page.wait_for_function('(id)=>document.documentElement.dataset.destinationId===id && window.swampwikiNavigator?.read().renderedRevision===window.swampwikiNavigator.read().revision',arg=id)
def read():return page.evaluate('window.swampwikiNavigator.read()')
try:
 server=subprocess.Popen([a.node,'scripts/site-serve.mjs','4319'],cwd=root,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 for _ in range(100):
  try:urllib.request.urlopen('http://127.0.0.1:4319/',timeout=1);break
  except Exception:
   if server.poll() is not None:raise RuntimeError('Preview server exited')
   time.sleep(.05)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True);context=browser.new_context(viewport={'width':1120,'height':900});page=context.new_page();page.set_default_timeout(45000);page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
  report['browserVersion']=browser.version;report['phase']='home';start=time.monotonic();page.goto('http://127.0.0.1:4319/',wait_until='domcontentloaded');wait(home)
  assert page.locator('#current-question').inner_text()=='Swampland collection'
  assert page.locator('#directions button.direction').count()==15
  links=page.locator('a').evaluate_all('(xs)=>xs.map(x=>({text:x.textContent,href:x.getAttribute("href")}))')
  assert not any('overview' in (x['href']or'') or (x['text']or'').strip() in ['All physics','All physics fields','Atlas overview','Source map'] for x in links)
  assert page.locator('canvas,svg').count()==0
  check('Swampland text home has 15 choices and no all-physics or graphical navigation',readyMilliseconds=round(1000*(time.monotonic()-start),1));page.screenshot(path=str(out/'home-desktop.png'),full_page=True)
  report['phase']='recorded-direction';before=read();choice=before['capsule']['snapshot']['view']['directions'][0];target=choice['selector']['destinationId'];page.locator('#directions button.direction').first.click();wait(target)
  current=read();assert current['capsule']['snapshot']['view']['atlas']['destination']['metadataOnly'] is not True if 'metadataOnly' in current['capsule']['snapshot']['view']['atlas']['destination'] else True
  check('A visible recorded direction opens its exact scientific destination',destinationId=target,label=choice['label'])
  report['phase']='search';page.locator('#question').fill('linear cosmology');page.locator('#question-form').evaluate('(f)=>f.requestSubmit()');page.locator('#atlas-lookup button').first.wait_for()
  labels=page.locator('#atlas-lookup button').all_text_contents();assert labels
  page.locator('#atlas-lookup button').first.click();page.wait_for_function('()=>document.documentElement.dataset.busy==="false" && !document.querySelector("#atlas-lookup button")')
  current=read();selected=current['capsule']['snapshot']['view']['atlas']['destination']['id'];assert selected!=target
  check('Title/alias search opens a scientific result',query='linear cosmology',labels=labels,selected=selected)
  report['phase']='source-scope';scope=page.locator('#evidence details').filter(has=page.locator('summary',has_text='Source scope & provenance')).first;scope.locator(':scope > summary').click()
  scope_text=scope.inner_text();assert 'Source ID:' in scope_text and 'not a direct quotation' in scope_text
  check('Source scope and provenance remain readable',sourceScopeText=scope_text);page.screenshot(path=str(out/'source-desktop.png'),full_page=True)
  compact=page.url;assert '#' in compact;state_id=current['capsule']['snapshot']['view']['stateId'] if 'stateId' in current['capsule']['snapshot']['view'] else current['capsule']['snapshot']['session']['states'][current['capsule']['snapshot']['session']['cursor']]['id']
  report['phase']='compact-reopen';second=context.new_page();second.goto(compact,wait_until='domcontentloaded');second.wait_for_function('(id)=>document.documentElement.dataset.destinationId===id',arg=selected);assert second.locator('html').get_attribute('data-state-id')==page.locator('html').get_attribute('data-state-id');second.close();check('Compact URL reopens the same destination and state without upload',url=compact,stateId=state_id)
  report['phase']='path-controls';page.locator('#back').click();wait(target);page.locator('#reset').click();wait(home);assert page.locator('#directions button.direction').count()==15;check('Back restores the previous destination; New path restores the Swampland entrance')
  report['phase']='narrow';page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(200)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Horizontal document overflow'
  check('390px viewport has no horizontal document overflow',viewport=390);page.screenshot(path=str(out/'home-mobile.png'),full_page=True)
  assert not report['pageErrors'];report['passed']=True;report['phase']='complete'
except Exception as e:
 report['error']=str(e);report['traceback']=traceback.format_exc()
 if page:
  try:page.screenshot(path=str(out/'failure.png'),full_page=True)
  except Exception:pass
finally:
 if browser:
  try:browser.close()
  except Exception:pass
 if server:server.terminate()
 (out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
raise SystemExit(0 if report['passed'] else 1)
