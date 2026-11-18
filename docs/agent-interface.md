# SwampWiki agent interface

Read the collection entrance and follow its links in a regular HTTP client. Each destination has an HTML page with its scope, assumptions, methods, sources and typed connections. The discovery index identifies the current atlas ID, version and entrance. Use SwampWiki to orient independent research and check the original papers.

[Text archive](/atlas/index.html) · [Discovery index](/data/atlas/index.json) · [Portable skill](/skills/physics-navigator/SKILL.md)

## Browser

The browser exposes the shared controller as `window.swampwikiNavigator`. The compatible name `window.eigenquestionsNavigator` addresses the same object. Read-only calls preserve the open path.

```js
const nav = window.swampwikiNavigator;
const parent = await nav.ready();
const hits = await nav.lookup('dark dimension');
const candidate = hits[0]?.selector;
if (candidate) {
  const question = await nav.describe(candidate);
  const sources = await nav.sources(candidate, {limit: 10});
  const links = await nav.connections(candidate);
  // Check the question's scope and sources before choosing a destination.
}
```

Capture the revision before interpreting the user's request. When they want a visible change, call `nav.navigate({type:'navigate', selector:candidate}, {expectedRevision:parent.revision})`. A revision conflict asks the agent to reconsider the proposed action in the new context. Confirm the change by checking that `nav.read().renderedRevision === nav.read().revision` and that the selector matches the intended record.

Use `nav.sources(selector,{collection:'contributions'})` for reviewed roles and qualifications. Use `nav.connections(selector,{relationId,includeProof:true})` for a full relation record. Page context with `nav.context(unitId,selector,{section:'relations',offset:0,limit:20})`. An exact endpoint in `sourceRoutes` has a ready-to-use action for source inspection. Back, replay and close-source preserve the distinction between a question and the inspected source object.

## Local CLI and MCP

Clone the SwampWiki repository and use Node 22 or later. Build the distribution and start the companion.

```sh
npm ci
npm run build
node bin/navigate.mjs serve
```

Open the local URL that the companion prints. The session token in this URL controls the local session. Keep it private. To attach the public site, use the printed public URL and allow the browser’s loopback connection if prompted. The local link works on the companion’s own origin.

```sh
node bin/navigate.mjs state
node bin/navigate.mjs search --query "dark dimension"
node bin/navigate.mjs connections --destination DESTINATION_ID
node bin/navigate.mjs sources --destination DESTINATION_ID --limit 10
node bin/navigate.mjs navigate --destination DESTINATION_ID --expected-revision N
node bin/navigate.mjs state
```

Replace the destination and revision placeholders with a reviewed search result and the revision observed before choosing it. The companion reports `browserStatus.acknowledgedCurrent` after an attached browser renders the exact state. For an offline snapshot, run `node bin/navigate.mjs compute --destination DESTINATION_ID`. Omitting the destination opens the collection entrance.

For MCP, configure a stdio server running `node /absolute/path/to/SwampWiki/bin/mcp-navigator.mjs` while the companion runs. A custom connection file must be passed to both processes with `--connection FILE`. Use `navigator_state`, `navigator_search`, `navigator_sources`, `navigator_connections`, `navigator_evidence` and `navigator_context` for inspection. Use `navigator_navigate` with the observed revision for an authorized update.

[Repository](https://github.com/OscarBarreraGithub/SwampWiki) · [Controller reference](/skills/physics-navigator/references/interface.md)
