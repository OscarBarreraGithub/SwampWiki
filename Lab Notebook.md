# SwampWiki Lab Notebook

## Now

- **Project/question:** SW-001 — Publish the existing text-based Swampland navigator at swampwiki.com, with its own GitHub and Cloudflare setup.
- **Known:** The owner explicitly chose the text navigator we built and only its Swampland parts, not the separate sr-744/swampwiki prototype. The accepted source release is Eigenquestions commit 387e95edb11aca883cbf1d05ceba9513bfd1e364. Keep scientific scopes, source qualifications and adjacent literature in the curated Swampland collection; remove the all-physics navigation and graphical views from this product.
- **Unfinished/running:** The focused site builds and all 119 tests pass. Saving the GitHub release and checking the rendered interface in one small isolated Slurm browser job. Domain still uses Namecheap parking DNS. Cloudflare lookup requires approval unavailable in this session; do not bypass that refusal through another login or CI credential.
- **Next:** Push the checked release, verify its GitHub checks and isolated browser result, then finish domain activation when Cloudflare tool access is permitted.
- **Save:** Project folder /Users/emmy/Documents/SwampWiki. Eigenquestions is preserved at its existing domain/repository. Earlier research history remains in the upstream Git history and its notebook; this is the single active notebook for SwampWiki.

## Requests

**SW-001 (summary):** Pause expansion of Eigenquestions; configure the newly purchased Namecheap domain swampwiki.com and its GitHub/Cloudflare deployment for only the existing text-based Swampland navigation.

## 2026-11-18 — SW-001: Establish the intended project and access boundaries

**Observed.** The owner resolved the codebase ambiguity: use our text navigator, not the private sr-744 prototype. Root created a separate local checkout from the accepted public release. No private prototype content is copied. Namecheap currently serves its parking A/CNAME and default forwarding MX records; no DS record was returned. Cloudflare lookup was rejected before account information was returned. GitHub access works through the installed CLI; the connector lacks repository-creation capability.

**Decision/next.** Use a separate repository and Worker with swampwiki.com branding and a Swampland collection entrance. Keep the frozen scientific input intact and derive a separately versioned distribution. Preserve useful connections and qualifications; no new scientific filtering based only on title keywords. Prepare the deploy configuration without attempting to evade the Cloudflare approval boundary. Registrar DNS changes must preserve any existing mail records and use the actual nameservers Cloudflare assigns.

**Repository checkpoint.** Root created [OscarBarreraGithub/SwampWiki](https://github.com/OscarBarreraGithub/SwampWiki), verified admin access, and set the deployment gate to false. No deployment credentials are configured. Astra implementation is preparing the focused served distribution; a second Astra owns the isolated Worker/CI configuration. The original site remains unchanged. [DNS and access preflight](docs/evidence/sw-001/setup-preflight.json).

## 2026-11-18 — SW-001: Prepare the focused text release

**Question/approach.** Could the existing scientific navigation become a separate Swampland-only product without losing source context? Astra `swampwiki_text_site` derived a new, versioned distribution from the accepted frozen inputs; `swampwiki_deployment` prepared its separate Worker, domain configuration and gated GitHub checks. Root reviewed the product boundaries and provenance. `atlas_product_integration` prepared a bounded rendered-browser smoke.

**Observed.** The distribution has 10,440 destinations and 13,128 relations, opening at 15 Swampland collection choices. All 8,473 extracted questions and 17,937 method descriptions remain; removing 213 general-classification/portal records and their 236 incident routes removes the all-physics entrance without filtering scientific papers by keywords. Graphical explorers are absent from served assets. Search, source qualifications, typed connections, history, compact links and agent navigation use the shared engine. Frozen source files have no Git changes.

**Checks.** Local build passed; root independently confirmed all 119 tests pass with no skips and the site check verifies 7,669 atlas assets plus 14 source-text shards. [Test receipt](docs/evidence/sw-001/local-tests.log) · [Static/checksum receipt](docs/evidence/sw-001/local-site-check.log). Root used Node v26.7.0; GitHub is configured for Node 22. The isolated browser check is prepared but not yet run. The deployment agent also passed three host-routing tests and a small fixture dry-run; this does not prove live hosting.

**Meaning/next.** The release is ready for GitHub and rendered-browser verification. Cloudflare deployment remains disabled (`CLOUDFLARE_DEPLOY_ENABLED=false`); no deployment secrets, Cloudflare resources or registrar changes were made. [Deployment handoff](docs/SW-001-deployment.md) records exact pending steps and the Namecheap forwarding dependency. Existing Eigenquestions remains unchanged.
