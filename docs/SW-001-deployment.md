# Deploying SwampWiki

## Status on November 18, 2026

The text navigator is live at **https://swampwiki.com/**. The `OscarBarreraGithub/SwampWiki` repository checks pushes to `main`. Namecheap delegates to **ophelia.ns.cloudflare.com** and **razvan.ns.cloudflare.com**, verified in the registrar and at the .com registry. Cloudflare activated the zone at 03:01 UTC on November 19 (November 18 local time), and the production Worker version is `ec66b63a-8313-45bd-b7eb-25b680d77c58`.

Both Custom Domains and their certificates are active. The public site passed all 23 exact-content checks and all 42 retired-route checks. Root inspected the rendered home page, opened the dark-sector direction and verified that New path returns to the 15 collection choices. `www` returns HTTP 308 to the apex, preserving paths and queries; Cloudflare's `always_use_https=on` redirects HTTP to HTTPS. [Publication check](evidence/sw-001/publication-live.json) · [Redirect checks](evidence/sw-001/live-http-checks.json) · [Cloudflare readback](evidence/sw-001/public-deploy-readback.json) · [Certificates/settings](evidence/sw-001/certificate-active-status.json).

The public DNS scan found only Namecheap parking plus five default forwarding MX records and one SPF record. The six mail records were copied into Cloudflare; the parking A/CNAME were not imported. Root inspected the signed-in registrar through the newly configured CLI browser: no email-forwarding aliases or custom host records existed, and DNSSEC was off. No existing mail service needed migration. The saved nameservers persisted after reloading the registrar page. [Registrar verification](evidence/sw-001/namecheap-nameservers-verified.yml) · [DNS receipt](evidence/sw-001/nameserver-cutover.json).

The GitHub `CLOUDFLARE_ACCOUNT_ID` secret is configured. `CLOUDFLARE_DEPLOY_ENABLED` remains `false`, and the dedicated deployment API token is pending. Existing local Wrangler OAuth authenticates the correct account and can publish the site. The connector lacks `account-api-tokens.write`, so creation of a dedicated CI token remains unavailable; do not export personal OAuth credentials into CI.

The production configuration names one Worker, `swampwiki`, and publishes `dist/` through the `ASSETS` binding. Each static asset request invokes the Worker and counts toward Workers request usage. Requests to `www.swampwiki.com` return a permanent HTTP 308 to `https://swampwiki.com` with the original path and query. File import and export remain available locally. Stored-view reads and uploads return HTTP 503 because this deployment has no storage bindings. The former storage deployment profile is retired. [Worker-first asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)

## DNS cutover record

Before cutover, public DNS showed these records. The Namecheap inventory and absence of forwarding aliases were verified before changing delegation; this table preserves the previous state.

| Record | Observed value |
| --- | --- |
| Authoritative NS | `dns1.registrar-servers.com`, `dns2.registrar-servers.com` |
| Apex A | `192.64.119.132` (parking) |
| `www` CNAME | `parkingpage.namecheap.com` |
| Apex MX | Priority 10 for `eforward1`, `eforward2` and `eforward3`, priority 15 for `eforward4`, and priority 20 for `eforward5`. All targets end in `.registrar-servers.com`. |
| Apex TXT | `v=spf1 include:spf.efwd.registrar-servers.com ~all` |
| Parent DS | No record returned |

1. The zone has been created. Compare the proposed zone against the full Namecheap inventory. Preserve mail, verification and other service records, including MX and TXT. Namecheap free forwarding depends on Namecheap DNS. If any aliases are active, arrange equivalent forwarding first, configure the receiving service's required DNS records and test each alias at cutover. [Cloudflare zone setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/) · [Namecheap forwarding requirements](https://www.namecheap.com/support/knowledgebase/article.aspx/323/10/why-cant-i-modify-email-domain-redirect-and-host-records-in-my-namecheap-account/)
2. The assigned nameserver pair is `ophelia.ns.cloudflare.com` and `razvan.ns.cloudflare.com`. In Namecheap's **Domain List → swampwiki.com → Manage → Nameservers → Custom DNS**, enter that pair and save. The available Namecheap connector only checks availability and pricing, so this change uses the signed-in registrar interface. Wait until Cloudflare reports the zone active. [Namecheap nameserver instructions](https://www.namecheap.com/support/knowledgebase/article.aspx/767/10/how-to-change-dns-for-a-domain/)
3. The public parking A and CNAME were not imported. Recheck that no conflicting web records have been added before attaching the hostnames. Preserve the other records. Wrangler declares both hostnames as Custom Domains in `wrangler.toml`, allowing Cloudflare to create their DNS records and issue certificates. [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

## Initial staging and future deployments

The first upload staged Worker version `d4510ee7-ac78-4e7d-8357-c40a25a0db86` with **no public targets** while registrar access was repaired. A temporary configuration differed from committed `wrangler.toml` only by resolving file paths and replacing its two domain routes with an empty list. [Staging receipt](evidence/sw-001/predelegation-deploy/readback.json). Once the zone activated, root deployed the committed production configuration; the domain attachment succeeded and certificates became active after a short issuance delay. [Public deployment log](evidence/sw-001/public-deploy.log). Both `workers_dev` and `preview_urls` remain false.

For future publication, build and validate the intended release first, then deploy with the committed configuration and existing authenticated Wrangler:

```sh
CLOUDFLARE_ACCOUNT_ID=60ab5e4b784f9a15e59eb851df3e8c0b ./node_modules/.bin/wrangler deploy --config wrangler.toml
```

This publishes to `swampwiki.com` and `www.swampwiki.com`. Verify HTTPS and the www redirect, then run `node tests/integration/publication_check.mjs --origin https://swampwiki.com` against the exact build uploaded. A successful upload or an active Cloudflare zone alone does not prove the site works.

## Automatic GitHub deployment

The Worker and repository account-ID secret already exist. When token administration is available, create a dedicated deployment token and store it as `CLOUDFLARE_API_TOKEN` in **SwampWiki → Settings → Secrets and variables → Actions**. Scope it to the SwampWiki Worker and the permissions required for Custom Domains in the `swampwiki.com` zone; do not copy a personal OAuth token into GitHub. [Cloudflare CI authentication](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) · [Workers and Custom Domain permissions](https://developers.cloudflare.com/workers/authorization/workers/)

Set the SwampWiki repository variable `CLOUDFLARE_DEPLOY_ENABLED` to `true` when ready to publish. The next push to `main` installs locked dependencies, builds, runs the tests and checks the static site before deploying `wrangler.toml`. Confirm that `https://swampwiki.com/` opens the text navigator and `https://www.swampwiki.com/?q=test` returns HTTP 308 with `Location: https://swampwiki.com/?q=test`. Recheck the domain's mail service after delegation.
