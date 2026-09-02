## Deploy Configuration (configured by /setup-deploy)

- Platform: Railway
- Production URL: assigned by Railway after the first successful deployment
- Deploy workflow: automatic deployment from GitHub `main`
- Deploy status command: HTTP health check
- Merge method: direct push to `main`
- Project type: full-stack web app with CPU-bound video processing
- Post-deploy health check: `/api/health`

### Custom deploy hooks

- Pre-merge: `PYTHONPATH=backend .venv/bin/python -m unittest discover -s tests -v && npm --prefix frontend run build`
- Deploy trigger: automatic on push to `main`
- Deploy status: poll the Railway deployment and production URL
- Health check: `GET /api/health` must return HTTP 200

### Railway runtime

- Build: root `Dockerfile` (automatically detected)
- Public port: injected through Railway's `PORT` variable
- Runtime data: `SCROLLSHOT_DATA_DIR=/data/jobs`
- Optional persistent volume mount: `/data`
- Healthcheck is configured in the Railway service settings because legacy Config as Code is unavailable for new services.
