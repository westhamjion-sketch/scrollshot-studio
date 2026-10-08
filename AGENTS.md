## Deploy Configuration (configured by /setup-deploy)

- Platform: Render Free Web Service
- Production URL: https://scrollshot-studio-westhamjion.onrender.com
- Deploy workflow: automatic deployment from GitHub `main`
- Deploy status command: HTTP health check
- Merge method: direct push to `main`
- Project type: full-stack web app with CPU-bound video processing
- Post-deploy health check: `/api/health`

### Custom deploy hooks

- Pre-merge: `PYTHONPATH=backend .venv/bin/python -m unittest discover -s tests -v && npm --prefix frontend run build`
- Deploy trigger: automatic on push to `main`
- Deploy status: poll the Render deployment and production URL
- Health check: `GET /api/health` must return HTTP 200

### Render runtime

- Blueprint: root `render.yaml`
- Build: root `Dockerfile`
- Public port: injected through Render's `PORT` variable
- Runtime data: `SCROLLSHOT_DATA_DIR=/tmp/scrollshot/jobs` (ephemeral)
- Free-instance processing: `SCROLLSHOT_WORKERS=1`
- Healthcheck: `/api/health`
