# SwampWiki

Text-based navigation of the Swampland literature and its adjacent questions. Browse the recorded topics, follow connections, and inspect the papers, assumptions, methods and reading limits behind each question. The site opens directly into this collection; it has no all-physics browser or graphical map.

The dated collection contains 8,473 extracted questions and 17,937 method descriptions. Topic placement is not a claim of complete fine-grained scientific coverage. The underlying source records and qualifications are preserved from the [accepted Eigenquestions release](https://github.com/OscarBarreraGithub/Eigenquestions/tree/387e95edb11aca883cbf1d05ceba9513bfd1e364); the SwampWiki distribution is built separately and deterministically.

## Run locally

Requires Node 22 or newer.

```sh
npm ci
npm run build
npm start
```

Open `http://127.0.0.1:4173`. The static build is written to `dist/`. Run `npm test` and `npm run check:site` to validate it.

Agents can read the source-linked records or use the [navigation interface](docs/agent-interface.md). Atlas orientation supplements their independent research. Prepared links, manual view files and local work-note exports do not require a hosted upload service.

## Hosting status

The intended address is **swampwiki.com**, with `www.swampwiki.com` redirecting to it. GitHub checks are configured; Cloudflare deployment is disabled pending account access, domain setup and deployment credentials. The Namecheap domain is still parked. No live SwampWiki deployment is claimed.

[Deployment setup and remaining steps](docs/SW-001-deployment.md) · [Lab notebook](Lab%20Notebook.md)
