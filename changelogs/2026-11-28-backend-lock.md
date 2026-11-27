# 2026-11-28 — Backend versions are locked

Every backend dependency was `>=`, so each image build installed whatever was newest that day. The numbers could change without any code change (pingouin 0.6 already renamed its result columns once).

- `backend/requirements.lock` pins all 55 packages with hashes, at the versions the `main` image was built with on 4 November 2026 (GitHub Actions `docker.yml` log): pandas 3.1.0, numpy 2.5.4, scipy 1.18.1, statsmodels 0.15.0, pingouin 0.7.0, fastapi 0.162.0.
- `backend/requirements-dev.lock` adds pytest and httpx at the same pins.
- The image, CI and the dev container install from the locks with `--require-hashes`. `requirements.txt` stays as the list of minimum versions.
- How to upgrade: `CONTRIBUTING.md`, "Backend dependencies".

Checked: the full `pytest` suite passes in a fresh environment installed from `requirements-dev.lock` (225 passed).
