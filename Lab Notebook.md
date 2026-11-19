# SwampWiki Lab Notebook

## Now

- **Project/question:** SW-005 and SW-006 ask how the Swampland wiki can narrow scientific questions coherently, lead readers to evidence, and stay readable at desktop and phone widths. SW-001 established the published navigator.
- **Known:** The owner explicitly chose the text navigator we built and only its Swampland parts, not the separate sr-744/swampwiki prototype. The accepted source release is Eigenquestions commit 387e95edb11aca883cbf1d05ceba9513bfd1e364. Keep scientific scopes, source qualifications and adjacent literature in the curated Swampland collection; remove the all-physics navigation and graphical views from this product.
- **Known checks/save:** Release 8c271ed is verified on GitHub main. All 119 tests and static checks pass locally and in GitHub Node 22 CI. The isolated desktop/mobile browser smoke passed; no jobs remain running. Evidence is linked below.
- **Known hosting:** https://swampwiki.com/ is live. Production Worker version ec66b63a-8313-45bd-b7eb-25b680d77c58 serves both domains; certificates and redirects are verified. All 23 public-content checks and 42 retired-route checks pass. Live browser navigation opens a topic and returns to the collection with New path.
- **Latest review:** SW-003 reproduced the same Dark Dimension question from SwampWiki search and Eigenquestions overview links. SW-004 found that a paper-specific question appears as an ordinary next direction under a broad topic. The source link is already typed, but the browse list includes it alongside topic links. See the dated entries for reproducible examples.
- **Known review:** The independent audit and LZ pilot are complete. Root repeated the key counts and verified the LZ laboratory contribution. [Findings and decisions](docs/SW-005-independent-atlas-review.md).
- **Unfinished/attention:** Enterprise rounds are testing browse policies and auditing weak-gravity organization. The first mobile scrolling candidate is verified locally. Expanded reading records still overflow at phone widths and are queued next. The recurring job has completed two ticks. The real provider reset is still ahead. No cluster jobs are running.
- **Next:** Verify wrapping of expanded records, compare alternative browse layouts, and check the actual post-reset dispatch. Keep the published release separate from the experimental UI branch.
- **Save:** Project folder /Users/emmy/Documents/SwampWiki. Eigenquestions is preserved at its existing domain/repository. Earlier research history remains in the upstream Git history and its notebook; this is the single active notebook for SwampWiki.

## Requests

**SW-001 (summary):** Pause expansion of Eigenquestions; configure the newly purchased Namecheap domain swampwiki.com and its GitHub/Cloudflare deployment for only the existing text-based Swampland navigation.

**SW-002 (summary):** Repair the browser integration for Codex CLI so the agent can complete the Namecheap setup.

**SW-003 (summary):** Review the current wiki and atlas and navigate both live sites.

**SW-004 (summary):** Assess why a detailed paper question about brane symmetry breaking and the reported LZ event appears one step below a broad topic.

**SW-005 (summary):** Commission an independent Claude Enterprise audit of the live wiki and atlas, with evidence for what works, scientific and organizational corrections, and better principles for navigation across subfields.

**SW-006 (summary):** Run useful SwampWiki research and UI improvement rounds through the Enterprise account's five-hour windows. Supervise progress and resume at the provider's reset. Use Opus 5.5 at xhigh, with Fable 5.2 for a difficult question if available within the allowance. Iterate on responsive layout and browsing.

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

## 2026-11-18 — SW-001: Cloudflare access restored; create the domain zone

**Amendment to the earlier access status.** After the owner changed session access, the Cloudflare connector successfully read the intended account and confirmed no swampwiki.com zone existed. Root created the zone on the Free Website plan; Cloudflare assigned `ophelia.ns.cloudflare.com` and `razvan.ns.cloudflare.com`. The zone is pending registrar delegation. [Creation and access receipt](docs/evidence/sw-001/cloudflare-zone-created.json).

**Remaining boundaries.** Chrome computer use still returns an explicit denial, so no registrar UI action was attempted beyond the denied access request. Root asked whether the new domain has email aliases or custom DNS. Existing Wrangler OAuth authenticates the correct Cloudflare account and can support deployment. The connector cannot administer account API tokens (HTTP 403, missing account-api-tokens.write), so no new CI credential was created and the GitHub deployment gate stays false. Astra `swampwiki_deployment` is checking full-asset packaging and staging options; domain activation and live HTTPS verification remain pending.

**DNS preparation.** Cloudflare's public scan found the same eight records as the earlier preflight: two parking records and six mail records. Root preserved the five default forwarding MX records and SPF TXT in the pending zone, without importing parking. This preserves known DNS data but does not establish continuity of the Namecheap forwarding service. [DNS receipt](docs/evidence/sw-001/cloudflare-dns-preserved.json).

## 2026-11-18 — SW-001: Upload the complete site before registrar cutover

**Approach.** The full dry run confirmed that 18,163 build files fit the current static-asset limits. Astra `swampwiki_deployment` prepared and compared a temporary configuration with no routes and both public URL features disabled. The agent's own connector context still required approval; root's restored connector independently confirmed no existing SwampWiki Worker, and root performed the authorized upload using the existing authenticated Wrangler. No alternate credential was used to bypass a failed connector operation.

**Observed.** The upload completed successfully, creating Worker version `d4510ee7-ac78-4e7d-8357-c40a25a0db86` with only ASSETS bound. Cloudflare readback confirms that version is deployed but no custom domains, zone routes, workers.dev URL or version-preview URL expose it. The zone remains pending delegation. [Dry run and configuration comparison](docs/evidence/sw-001/predelegation-deploy/dry-run.json) · [Upload log](docs/evidence/sw-001/predelegation-deploy/upload.log) · [Cloudflare readback](docs/evidence/sw-001/predelegation-deploy/readback.json).

**Meaning/next.** Server-side preparation is complete; the domain is still parked, so no live-site claim is made. After the owner changes Namecheap to the assigned nameservers (with any mail/custom DNS needs resolved), use the committed configuration to attach both hostnames and perform real HTTPS/content checks. The GitHub account-ID secret is now configured; API-token creation remains unavailable, and automated deployment stays disabled. This checkpoint changes only setup documentation and evidence; the tested navigator code and frozen data are unchanged.

## 2026-11-18 — SW-002: Diagnose the CLI/browser mismatch and prepare a supported connection

**Correction.** Earlier desktop Settings instructions did not apply to the owner's Codex CLI session. Codex 0.169.0's diagnostic command reports that the custom node_repl server lacks three browser-access variables. The local configuration points to the desktop app's bridge; the browser tool reports an unavailable host. Official documentation says the built-in Browser is unavailable in CLI. Full Access alone does not supply this host. [Browser availability](https://learn.chatgpt.com/docs/browser).

**Change.** Root installed pinned Microsoft Playwright MCP 0.0.86 and its browser locally, and created an opt-in `cli-browser` configuration profile. The profile uses a fresh in-memory browser, keeps its sandbox enabled, enables approval prompts, and disables the broken desktop bridge only for this profile. Default configuration and existing Chrome access were not changed. No desktop session identity was copied or fabricated. [Microsoft's Codex setup](https://github.com/microsoft/playwright-mcp#codex).

**Observed/limits.** Codex successfully resolves the new MCP configuration. The server's initialization and tool discovery pass (25 tools), and the browser executable is installed. No browser was launched and no account was accessed: the current session must be resumed with this profile before the agent can request browser actions. The owner will need to sign in to Namecheap in that new session. `codex doctor --profile` and `--strict-config` on `codex mcp` are not supported in 0.169.0, so the setup was checked with the supported profile-aware `codex mcp get` and a direct protocol handshake. [Verification receipt](docs/evidence/sw-001/cli-browser-setup.json).

**Resume.** Exit the current CLI and run `codex resume SESSION_ID --profile cli-browser --ask-for-approval on-request`. This preserves the conversation. Approve the new browser connection through the normal prompt, verify its rendered behavior, and continue SW-001 from the pending Namecheap step. Cloudflare's staged version is unchanged.

## 2026-11-18 — SW-001 / SW-002: Verify the CLI browser and delegate the domain

**Observed.** The resumed CLI exposes the new browser tools and successfully opens Namecheap. The owner signed in to the fresh browser. Root inspected the registrar: only the default parking CNAME/URL redirect and forwarding SPF were present; DNSSEC was off and there were no email-forwarding aliases. This resolves the earlier uncertainty about services to migrate. The six known mail DNS records remain preserved in Cloudflare. [DNS inventory](docs/evidence/sw-001/namecheap-before-cutover.yml).

**Action/result.** Root saved `ophelia.ns.cloudflare.com` and `razvan.ns.cloudflare.com` as Custom DNS, then reloaded the registrar page and confirmed persistence. Two .com registry servers already return that pair. Cloudflare accepted one activation-check request; its zone was still pending at 03:00 UTC on November 19 (November 18 local time). [Registrar readback](docs/evidence/sw-001/namecheap-nameservers-verified.yml).

**Meaning/next.** The CLI browser repair and registrar change are complete. This does not yet prove live hosting. Wait for Cloudflare activation, attach the prepared Worker domains and test the real HTTPS site before reporting it live. Native Chrome's earlier denial was not bypassed: this used the separately configured and approved CLI browser.

## 2026-11-18 — SW-001: Publish and verify the live Swampland navigator

**Action.** Cloudflare activated the zone at 03:01 UTC on November 19 (November 18 local time). Root deployed the committed domain configuration using existing Wrangler authentication. The previously uploaded assets required no re-upload. Both hostnames now point to Worker version `ec66b63a-8313-45bd-b7eb-25b680d77c58`; public workers.dev and preview URLs remain disabled. [Deployment log](docs/evidence/sw-001/public-deploy.log) · [API readback](docs/evidence/sw-001/public-deploy-readback.json).

**Observed.** The first HTTPS request failed while certificates were pending; HTTP already served the site. Root waited rather than disabling TLS verification or changing the application. Both domain certificates then became active, and HTTPS returned 200. Cloudflare now redirects HTTP to HTTPS; the Worker redirects www to the apex with paths and queries preserved. [Initial issuance status](docs/evidence/sw-001/certificate-initial-status.json) · [Active certificates/settings](docs/evidence/sw-001/certificate-active-status.json) · [Four passing HTTP checks](docs/evidence/sw-001/live-http-checks.json).

**Validation.** The public release matches all 23 pinned-content checks, and all 42 retired-route checks pass. In the live browser, the collection opens with 15 directions; opening the dark-sector direction shows its next choices and 31 papers, and New path returns to the collection. Root inspected the home screenshot. This confirms live deployment of the previously tested text product, not a new scientific validation. [Publication report](docs/evidence/sw-001/publication-live.json) · [Home screenshot](docs/evidence/sw-001/live-home.png) · [Topic view](docs/evidence/sw-001/live-topic.yml).

**Meaning/remaining.** The requested public site is working. The only deployment automation left is a dedicated GitHub Actions token: connector token-administration permission remains unavailable, so the gate stays false. The live site does not depend on that automation. No source-code or scientific-data changes were needed during cutover; root performed publication and credits the implementation and browser-smoke agents named above.

## 2026-11-18 — SW-003: Follow the same research question through the wiki and atlas

Root checked the published Git branches and used the live browser. Eigenquestions led from Physics through Particles & Fields and high energy theory into Quantum gravity and connected physics. In the overview, Detailed source map → Dark sectors → Extra dimensions and conditional quantum-gravity tests → the premise check reached the same scientific destination as searching its title in SwampWiki. Reopening the wiki link restored that destination. The two-paper view presents the competing arguments about EFT matching of Dark Dimension vacuum energy. The separate wiki text archive also opened its collection page and linked narrower topics. [Wiki question](https://swampwiki.com/#atlas=swampwiki&version=2026-11-18-text-v1&destination=q025-candidate-question%3Abdfb6100643885f4cae8dc2f&lens=combined&intent=explore&relation=either) · [Same question in the atlas](https://eigenquestions.com/atlas-overview#atlas=q025-approved-organization-candidate&version=2026-11-17-post-test-accounted-v1&destination=q025-candidate-question%3Abdfb6100643885f4cae8dc2f&space=detail) · [Text archive](https://swampwiki.com/atlas/).

In the overview, several connections had the same visible label and relation. On SwampWiki's KK scale-separation page, the Sources panel showed five related papers and zero primary descriptions for the current selection, while the separate Source contributions panel contained seven reviewed source roles. Both panels loaded. Their labels make it easy to mistake a filtered view for a gap in the source record. These observations give concrete cases for a future presentation pass. This was a browser review of the published versions.

## 2026-11-18 — SW-004: Identify the jump from a broad topic to a paper question

Root reproduced the quoted example live. “Extra dimensions and conditional quantum-gravity tests” lists the LZ question as Direction 12 of 15. Clicking it opens a single-paper destination with one recorded connection. The release catalogs the link as source access from the broader question and keeps that link distinct from narrower-topic relations. The default direction selector ranks source access lower but includes it when there are available slots. The broad page has seven such links in its data. [Broad topic](https://swampwiki.com/#atlas=swampwiki&version=2026-11-18-text-v1&destination=q025-candidate-question%3A190bdf4415c78268d594ff95&lens=combined&intent=explore&relation=either) · [Original paper](https://arxiv.org/abs/2609.07138) · [Direction selection](lib/geometry/prepared-atlas.mjs).

The example exposes a gap between paper access and scientific depth. A browse step should give comparable ways to narrow the question. Paper examples can remain directly accessible under sources and via search and shared links. A missing intermediate topic needs evidence of a meaningful grouping. For this case, check whether the literature supports an intermediate route through extra-dimensional dark matter, inelastic mechanisms or direct detection. The present catalog has no curated “inelastic dark matter” destination, and a title scan alone cannot establish the right grouping. No change to the live view was made in this diagnostic.

## 2026-11-18 — SW-005: Prepare an independent Enterprise Claude review

Root prepared a private handoff for `claude-enterprise-atlas-review` against SwampWiki release `8c271ed` and Eigenquestions release `387e95e`. The brief asks for a structural census of the graph and browse choices, live journeys across topics, primary-source checks for scientific classifications, tests of convergence and source or agent access, and prioritized regrouping proposals. One reviewer will deliver a report before any implementation. The manager will verify the evidence and label what remains untested. The brief and original tool records belong in ignored `Records/`. [Science with Agents cross-agent workflow](https://github.com/OscarBarreraGithub/sciencewithagents/blob/2a5c57f5c6732d09dfc8cdccb122aa1733703bdd/Workflows/cross-agent.md).

Science with Agents retained prior Harvard Enterprise identity metadata, while Claude Code currently reported Max on both signed-in profiles. Root prepared a separate profile and opened Claude Code's own sign-in flow. No model call has been made. The next launch must verify native Enterprise authentication and preserve the existing account sessions.

## 2026-11-18 — SW-005: Start the independent review under Enterprise

After the owner signed in, root verified Enterprise in the separate native profile and verified that both existing Max profiles remained signed in. The handoff reached `claude-enterprise-atlas-review`. Claude Code reports Opus 5.5, and its isolated browser connected. The session is reviewing the public releases with read access to their catalogs and documentation. The native receipt and handoff are retained privately. The browser connection and start receipt confirm dispatch. Findings are pending.

## 2026-11-18 — SW-006: Start focused science and UI rounds and register recurring supervision

Root launched two distinct Opus 5.5 xhigh pilots. One starts from live navigation and tests how the distant-brane LZ source question should be reached. The second measures phone and desktop layouts and makes one focused responsive pass in the local `experiment/claude-swampwiki-ui` worktree. The preview built successfully. Both isolated browsers connected and recorded live interactions. The broader SW-005 audit is also active. Raw native and browser evidence stays in ignored `Records/`.

Native Enterprise events report a five-hour reset at 00:20 Eastern on November 19 and organization-disabled overage. The recurring job is registered as `com.sciencewithagents.swampwiki-enterprise`. It checks every five minutes while the Mac is awake and logged in, wakes Codex to inspect active work and select a useful next round, and uses native allowance evidence to govern dispatch. Seven local checks exercised the reset gate, rejection, stop and single UI writer. The first actual tick has reached macOS's Python Documents access prompt. Reset behavior on real provider time and recurring dispatch are unverified. The owner can pause recurring work with the private `Records/sw-006/STOP` marker. The live sites still serve their verified releases.

## 2026-11-18 — SW-005 / SW-006: Accept the review evidence and verify a recurring dispatch

The broad Enterprise Opus 5.5 audit and the independent Opus 5.5 xhigh LZ pilot supplied a catalog census, browsed journeys and source checks. Root rechecked the current site bytes, repeated the key counts and verified the LZ laboratory contribution. The two reports differed about whether a Dark Dimension region exists. The catalog confirms one with a narrow cosmic-ray and vacuum focus. Preserve the typed source contribution as a potential second route without treating it as a direct home. The report records accepted findings and the alternatives still to test. [Reviewed findings](docs/SW-005-independent-atlas-review.md).

The first real macOS tick completed successfully after the Documents prompt cleared. A separate Codex run inspected the reports, scoped a weak-gravity round and dispatched a new Enterprise Opus 5.5 xhigh session with a connected isolated browser. A manually invoked tick also selected a browse-policy comparison. The background launch, correct account and single UI checkout are now verified. Provider-reset behavior has only been tested with a fixture. Runtime settings, launch receipts and the stop marker are in the private `Records/sw-006/` folder.

## 2026-11-18 — SW-006: Verify a mobile scrolling candidate and identify the next layout case

The Opus 5.5 xhigh UI pilot found that mobile choices sat in a 606 px scroll box at a 390 px viewport. Its candidate lets current choices flow with the page and brings the next title and path into view after a distant click. Root measured the box and keyboard scroll directly, checked the earlier-step arrow and replayed the long LZ link at 360, 390, 768 and 1280 px. The rendered title and source links fit and page width equals viewport width in those closed-panel states. The first full test run identified a missing dependency in the fresh checkout. After installing the locked dependencies, all 119 tests, the build and static asset checks passed. [Responsive checks](docs/evidence/sw-006/responsive-pilot.json).

Root saved the verified candidate as local commit `64457ce56123e4e535f2dc78d02675a29e9187b1` on `experiment/claude-swampwiki-ui`. The UI worker also found a separate overflow when opening full reading coverage. Root reproduced a document width of 1,885 px in a 390 px viewport on the Dark Dimension matching question. The next UI assignment targets expanded records and proof hashes. The branch is local and has no deployment. The main repository includes the review's [reproducible census](docs/evidence/sw-005/direction-census.mjs).
