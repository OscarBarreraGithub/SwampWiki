# SW-001 isolated text smoke

One Chromium smoke after the root-owned product commit is sealed. No model, companion, public-domain test or owner-browser access. Slurm allocation: `randall_lab`, 2 CPU, 4 GB, 10 minutes. Existing accepted Q025 archives and browser dependencies are reused; a complete committed code delta is applied in node-local temporary storage and every resulting file is verified against the sealed Git tree. Frozen source inputs must be unchanged.

The checks cover the Swampland entrance and its fifteen choices, absence of all-physics/graphical navigation, an actual recorded direction, title/alias search, source scope, compact URL reopening, Back/New path and a 390px viewport. Three representative screenshots and a short JSON report are retained. Failures remain explicit. This is rendered loopback HTTP evidence, not a deployment or public-origin proof.

After root supplies `COMMIT`, run `python3 docs/evidence/sw-001/browser-smoke/seal.py COMMIT /private/tmp/swampwiki-smoke-envelope`, transfer that envelope to the authorized scratch run directory, then submit its `run.sbatch` with `SWAMPWIKI_RUN_DIR` set. Do not seal or submit an unfinished working tree. Root owns commits and external publication.
