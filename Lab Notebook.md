# SwampWiki Lab Notebook

## Now

- **Project/question:** SW-001 — Publish the existing text-based Swampland navigator at swampwiki.com, with its own GitHub and Cloudflare setup.
- **Known:** The owner explicitly chose the text navigator we built and only its Swampland parts, not the separate sr-744/swampwiki prototype. The accepted source release is Eigenquestions commit 387e95edb11aca883cbf1d05ceba9513bfd1e364. Keep scientific scopes, source qualifications and adjacent literature in the curated Swampland collection; remove the all-physics navigation and graphical views from this product.
- **Known checks/save:** Release 8c271ed is verified on GitHub main. All 119 tests and static checks pass locally and in GitHub Node 22 CI. The isolated desktop/mobile browser smoke passed; no jobs remain running. Evidence is linked below.
- **Known hosting:** Cloudflare access is restored. The free zone exists and the complete site is uploaded as Worker version d4510ee7-ac78-4e7d-8357-c40a25a0db86 with no public targets. API readback confirms the staged version, no routes/domains and disabled public subdomains.
- **Unfinished/attention:** Namecheap delegation is pending. The owner clarified this is Codex CLI: its custom desktop browser bridge has no access host. A separate opt-in CLI browser profile is now configured and its MCP handshake passes; it needs a resumed CLI session, browser approval and a Namecheap sign-in before UI/DNS verification. Existing Chrome access remains denied. GitHub automatic deployment still awaits a dedicated token.
- **Next:** Resume with the cli-browser profile and approval prompts, inspect Namecheap mail/custom DNS, and change nameservers to ophelia.ns.cloudflare.com / razvan.ns.cloudflare.com. Then attach the domains using committed wrangler.toml after zone activation and verify HTTPS. No jobs are running.
- **Save:** Project folder /Users/emmy/Documents/SwampWiki. Eigenquestions is preserved at its existing domain/repository. Earlier research history remains in the upstream Git history and its notebook; this is the single active notebook for SwampWiki.

## Requests

**SW-001 (summary):** Pause expansion of Eigenquestions; configure the newly purchased Namecheap domain swampwiki.com and its GitHub/Cloudflare deployment for only the existing text-based Swampland navigation.

**SW-002 (summary):** Repair the browser integration for Codex CLI so the agent can complete the Namecheap setup.

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
