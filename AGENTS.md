# SwampWiki

Text-only navigation of the existing curated Swampland corpus. This is an independent product derived from Eigenquestions commit 387e95edb11aca883cbf1d05ceba9513bfd1e364.

- Read Lab Notebook.md before resuming. Active request: SW-001.
- Root owns the notebook, Git checkpoints, publication and external configuration. Assigned implementation agents own only their scoped files and do not commit or deploy independently.
- Preserve frozen scientific input, source provenance, assumptions and reading limits. Derive a new atlas distribution/version for this site's navigation; do not rewrite the frozen upstream manifest in place.
- Serve the text navigator and Swampland-related source records. Do not expose the all-physics classification or graphical explorer/overview in the SwampWiki UI.
- Keep the shared navigation/controller and agent protocol; avoid a separate navigation engine. Agent guidance must continue to encourage independent research beyond atlas orientation.
- Use Node >=22 and the pinned package manager/dependencies. Validate the build, relevant runtime tests and public/static links.
- Keep Cloudflare resource names and domains separate from Eigenquestions. The owner restored Cloudflare tool access on 2026-11-18; account and zone operations now work. Existing Wrangler OAuth authenticates the same account. Chrome computer-use and connector account-token administration are still unavailable; respect those specific boundaries. Root owns domain cutover and deployment.
- Checkpoint bodies include Request: SW-001 and Agent: <tag>. Stage only intended changes. Push authorized checkpoints and verify the remote SHA. Never claim a local commit or validation is a live deployment.
