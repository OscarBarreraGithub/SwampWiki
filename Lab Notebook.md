# SwampWiki Lab Notebook

## Now

- **Project/question:** SW-001 — Publish the existing text-based Swampland navigator at swampwiki.com, with its own GitHub and Cloudflare setup.
- **Known:** The owner explicitly chose the text navigator we built and only its Swampland parts, not the separate sr-744/swampwiki prototype. The accepted source release is Eigenquestions commit 387e95edb11aca883cbf1d05ceba9513bfd1e364. Keep scientific scopes, source qualifications and adjacent literature in the curated Swampland collection; remove the all-physics navigation and graphical views from this product.
- **Known checks/save:** Release 8c271ed is verified on GitHub main. All 119 tests and static checks pass locally and in GitHub Node 22 CI. The isolated desktop/mobile browser smoke passed; no jobs remain running. Evidence is linked below.
- **Unfinished/attention:** swampwiki.com is not live; it still uses Namecheap parking DNS. Cloudflare lookup requires approval unavailable in this session. Deployment remains disabled, with no secrets configured. Do not bypass the connector refusal through another credential.
- **Next:** Once Cloudflare access is permitted, activate the zone, configure its assigned Namecheap nameservers with any mail needs preserved, configure deployment credentials, deploy and verify HTTPS using docs/SW-001-deployment.md.
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

## 2026-11-18 — SW-001: Verify the release and preserve the hosting handoff

**Observed.** Product commit `8c271edbca01864fda09dc3b75b7f8d34dbccd57` is on [SwampWiki main](https://github.com/OscarBarreraGithub/SwampWiki). [GitHub run 44376257811](https://github.com/OscarBarreraGithub/SwampWiki/actions/runs/44376257811) passed the build, all tests and site check under Node 22; deployment was correctly skipped. [CI receipt](docs/evidence/sw-001/github-checks.json). The initial HTTPS push used the wrong cached account; the owner account's HTTPS token then lacked workflow-write scope. The already configured SSH key authenticated as the repository owner and published successfully. Global credentials were left unchanged.

**Rendered result.** Astra `atlas_product_integration` ran Slurm job 61891140 on Randall Lab: 2 CPU, 4 GB, completed successfully in 36 seconds. The job verified the complete committed tree and frozen input before building. All seven browser checks passed, with zero page errors: entrance, scientific direction, title/alias search, readable source scope, compact-link replay, Back/New path and mobile width. Both the agent and root inspected the three screenshots; text and qualifications were legible. Root verified every retained evidence hash. [Report](docs/evidence/sw-001/browser-smoke/result-v1/browser/report.json) · [Screenshots and receipts](docs/evidence/sw-001/browser-smoke/result-v1/capture.json). The 501 ms entrance time is same-host loopback evidence, not an internet performance claim.

**Meaning/next.** The focused product and GitHub setup are ready. This checkpoint adds evidence and the handoff only. No Cloudflare or Namecheap mutation has occurred, and no live-domain claim is made. The remaining work is domain/account activation and deployment once the connector approval restriction is resolved; exact steps are in the deployment document. No further research or clustering is needed for this cutover.
