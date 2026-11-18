import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {renderAtlasPages} from './render-atlas-pages.mjs';
import {buildDistribution} from './swampwiki-distribution.mjs';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const webAssets = ['index.html','404.html','app.js','styles.css','favicon.svg','_headers','llms.txt','robots.txt','sitemap.xml','atlas-panel.mjs','paper-title.mjs','physics-path.mjs','source-coverage.mjs','source-context.mjs'];
const modules = ['swampwiki.mjs','geometry/prepared-atlas.mjs','geometry/prepared-identity.mjs','protocol/session.mjs','protocol/capsule.mjs','protocol/context-page.mjs','protocol/presentation.mjs','protocol/display-editorial.mjs','protocol/approved-display-editorial.mjs'];
for (const name of webAssets) await cp(path.join(root,'web',name),path.join(out,name));
for (const name of [...modules.map(name=>'lib/'+name),'docs/site.md','docs/agent-interface.md','skills/physics-navigator/SKILL.md','skills/physics-navigator/references/interface.md']) {
  await mkdir(path.dirname(path.join(out,name)),{recursive:true});
  await cp(path.join(root,name),path.join(out,name));
}
await buildDistribution(root,out);
await renderAtlasPages(out);
// Only these explicit product sources reach dist; old public/ and src/ never do.
let count = 0, totalBytes = 0, largest = { path: '', bytes: 0 };
async function audit(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await audit(full);
    else {
      const { size } = await stat(full);
      if (size > 25 * 1024 * 1024) throw new Error(`Cloudflare's 25 MiB asset limit exceeded: ${path.relative(out, full)}`);
      count++; totalBytes += size;
      if (size > largest.bytes) largest = { path: path.relative(out, full), bytes: size };
    }
  }
}
await audit(out);
if (count > 19999) throw new Error(`Static asset count ${count} exceeds the conservative 20,000-file hosting limit.`);
const report = { format: 'swampwiki-static-build-v1', files: count + 1, bytes: totalBytes, largestAsset: largest, staticAssets: true, serverIncludedInAssets: false, apiRoutes: [] };
await writeFile(path.join(out, 'build-info.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Static site: ${report.files} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MiB → dist/`);
