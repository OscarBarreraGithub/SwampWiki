# SwampWiki controller

The website, CLI and MCP companion use the shared prepared-destination engine. The public discovery index supplies the exact atlas ID, version and home destination. A selector has fields `kind` (the value `atlas-destination`), `atlasId`, `atlasVersion` and `destinationId`.

[Setup and examples](https://swampwiki.com/docs/agent-interface.md) · [Discovery index](https://swampwiki.com/data/atlas/index.json)

| Operation | Browser | CLI | MCP |
| --- | --- | --- | --- |
| Read state | `ready()`, `read()` | `state` | `navigator_state` |
| Title/alias search | `lookup(query)` | `search --query QUERY` | `navigator_search` |
| Read question | `describe(selector)` | `compute --destination ID` | Read linked destination HTML |
| Membership or contribution | `sources(selector,options)` | `sources` | `navigator_sources` |
| Typed connections and proof | `connections(selector,options)` | `connections` | `navigator_connections` |
| Loaded source descriptions | `evidence(ids)` | `evidence --ids ID,ID` | `navigator_evidence` |
| Source objects and locators | `context(unitId,selector,options)` | `context --id ID` | `navigator_context` |
| Move through the collection | `navigate(action,{expectedRevision})` | `navigate`, `select`, `back`, `replay`, `reset` | `navigator_navigate` |
| Follow an exact endpoint | `navigate(returnedAction,{expectedRevision})` | `inspect-source`, `close-source` | `navigator_navigate` |

Call these browser methods on `window.swampwikiNavigator`. Source context defaults to bounded pages. A missing row can reflect the page, index or dated extraction. Inspect additional pages and the paper before drawing conclusions.
