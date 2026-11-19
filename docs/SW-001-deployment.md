# Deploying SwampWiki

## Status on November 18, 2026

The `OscarBarreraGithub/SwampWiki` repository checks pushes to `main`. Cloudflare access was restored after the owner changed session access. A free `swampwiki.com` zone exists in the intended account. Namecheap now delegates to **ophelia.ns.cloudflare.com** and **razvan.ns.cloudflare.com**, verified in the registrar and at the .com registry. Cloudflare zone activation and live HTTPS verification remain pending.

The public DNS scan found only Namecheap parking plus five default forwarding MX records and one SPF record. The six mail records were copied into Cloudflare; the parking A/CNAME were not imported. Root inspected the signed-in registrar through the newly configured CLI browser: no email-forwarding aliases or custom host records existed, and DNSSEC was off. No existing mail service needed migration. The saved nameservers persisted after reloading the registrar page. [Registrar verification](evidence/sw-001/namecheap-nameservers-verified.yml) · [DNS receipt](evidence/sw-001/nameserver-cutover.json).

The GitHub `CLOUDFLARE_ACCOUNT_ID` secret is configured. `CLOUDFLARE_DEPLOY_ENABLED` remains `false`, and the dedicated deployment API token is pending. Existing local Wrangler OAuth authenticates the correct account and can publish the site. The connector lacks `account-api-tokens.write`, so creation of a dedicated CI token remains unavailable; do not export personal OAuth credentials into CI.

The production configuration names one Worker, `swampwiki`, and publishes `dist/` through the `ASSETS` binding. Each static asset request invokes the Worker and counts toward Workers request usage. Requests to `www.swampwiki.com` return a permanent HTTP 308 to `https://swampwiki.com` with the original path and query. File import and export remain available locally. Stored-view reads and uploads return HTTP 503 because this deployment has no storage bindings. The former storage deployment profile is retired. [Worker-first asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)

## DNS cutover after Cloudflare access is available

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

## Staged Worker and public activation

The checked site has been uploaded as Worker `swampwiki`, version `d4510ee7-ac78-4e7d-8357-c40a25a0db86`, with **no public targets**. A temporary configuration differed from committed `wrangler.toml` only by resolving file paths and replacing its two domain routes with an empty list. Both `workers_dev` and `preview_urls` remain false. Connector readback verified an active version, no custom domains, no zone routes and disabled public subdomains. This is staged hosting, not a live site. [Deployment receipt](evidence/sw-001/predelegation-deploy/readback.json).

After Namecheap uses the assigned nameservers and Cloudflare reports the zone active, deploy using the committed configuration and existing authenticated Wrangler:

```sh
CLOUDFLARE_ACCOUNT_ID=60ab5e4b784f9a15e59eb851df3e8c0b ./node_modules/.bin/wrangler deploy --config wrangler.toml
```

This attaches `swampwiki.com` and `www.swampwiki.com` to the prepared Worker. Verify HTTPS and the www redirect, then run the existing publication check against the real origin. A successful upload or an active Cloudflare zone alone does not prove the site works.

## Automatic GitHub deployment

The Worker and repository account-ID secret already exist. When token administration is available, create a dedicated deployment token and store it as `CLOUDFLARE_API_TOKEN` in **SwampWiki → Settings → Secrets and variables → Actions**. Scope it to the SwampWiki Worker and the permissions required for Custom Domains in the `swampwiki.com` zone; do not copy a personal OAuth token into GitHub. [Cloudflare CI authentication](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) · [Workers and Custom Domain permissions](https://developers.cloudflare.com/workers/authorization/workers/)

Set the SwampWiki repository variable `CLOUDFLARE_DEPLOY_ENABLED` to `true` when ready to publish. The next push to `main` installs locked dependencies, builds, runs the tests and checks the static site before deploying `wrangler.toml`. Confirm that `https://swampwiki.com/` opens the text navigator and `https://www.swampwiki.com/?q=test` returns HTTP 308 with `Location: https://swampwiki.com/?q=test`. Recheck the domain's mail service after delegation.
