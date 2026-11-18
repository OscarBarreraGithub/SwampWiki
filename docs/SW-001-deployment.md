# Deploying SwampWiki

## Status on November 18, 2026

The `OscarBarreraGithub/SwampWiki` repository is configured to check pushes to `main`. Its `CLOUDFLARE_DEPLOY_ENABLED` variable is `false` and its deployment secrets are pending. Cloudflare account lookup requires approval, which this session could not obtain. Zone activation, registrar delegation, Worker deployment and live HTTPS verification are pending.

The production configuration names one Worker, `swampwiki`, and publishes `dist/` through the `ASSETS` binding. Each static asset request invokes the Worker and counts toward Workers request usage. Requests to `www.swampwiki.com` return a permanent HTTP 308 to `https://swampwiki.com` with the original path and query. File import and export remain available locally. Stored-view reads and uploads return HTTP 503 because this deployment has no storage bindings. The former storage deployment profile is retired. [Worker-first asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)

## DNS cutover after Cloudflare access is available

Public DNS showed these records. Obtain the full Namecheap DNS record inventory and mail-forwarding aliases before changing delegation.

| Record | Observed value |
| --- | --- |
| Authoritative NS | `dns1.registrar-servers.com`, `dns2.registrar-servers.com` |
| Apex A | `192.64.119.132` (parking) |
| `www` CNAME | `parkingpage.namecheap.com` |
| Apex MX | Priority 10 for `eforward1`, `eforward2` and `eforward3`, priority 15 for `eforward4`, and priority 20 for `eforward5`. All targets end in `.registrar-servers.com`. |
| Apex TXT | `v=spf1 include:spf.efwd.registrar-servers.com ~all` |
| Parent DS | No record returned |

1. Add `swampwiki.com` to the intended Cloudflare account. Compare the proposed zone against the full Namecheap inventory. Preserve mail, verification and other service records, including MX and TXT. Namecheap free forwarding depends on Namecheap DNS. If any aliases are active, arrange equivalent forwarding first, configure the receiving service's required DNS records and test each alias at cutover. [Cloudflare zone setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/) · [Namecheap forwarding requirements](https://www.namecheap.com/support/knowledgebase/article.aspx/323/10/why-cant-i-modify-email-domain-redirect-and-host-records-in-my-namecheap-account/)
2. Copy the nameserver pair assigned to this zone by Cloudflare. In Namecheap's **Domain List → swampwiki.com → Manage → Nameservers → Custom DNS**, enter that pair and save. The available Namecheap connector only checks availability and pricing, so this change uses the signed-in registrar interface. Wait until Cloudflare reports the zone active. [Namecheap nameserver instructions](https://www.namecheap.com/support/knowledgebase/article.aspx/767/10/how-to-change-dns-for-a-domain/)
3. Remove any imported parking A record at the apex and parking CNAME at `www` from the Cloudflare zone before attaching the hostnames. Preserve the other records. Wrangler declares both hostnames as Custom Domains in `wrangler.toml`, allowing Cloudflare to create their DNS records and issue certificates. [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

## First deployment

After Cloudflare access is permitted and the zone is ready, create the `swampwiki` Worker under the intended account. In **SwampWiki → Settings → Secrets and variables → Actions**, store the account ID as `CLOUDFLARE_ACCOUNT_ID` and a dedicated deployment token as `CLOUDFLARE_API_TOKEN`. Scope it to the intended account and grant the permissions required for Worker deployment and Custom Domains in the `swampwiki.com` zone. [Cloudflare CI authentication](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) · [Workers and Custom Domain permissions](https://developers.cloudflare.com/workers/authorization/workers/)

Set the SwampWiki repository variable `CLOUDFLARE_DEPLOY_ENABLED` to `true` when ready to publish. The next push to `main` installs locked dependencies, builds, runs the tests and checks the static site before deploying `wrangler.toml`. Confirm that `https://swampwiki.com/` opens the text navigator and `https://www.swampwiki.com/?q=test` returns HTTP 308 with `Location: https://swampwiki.com/?q=test`. Recheck the domain's mail service after delegation.
