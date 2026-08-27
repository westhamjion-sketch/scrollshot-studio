# Debug report: local site unreachable

- **Symptom:** `http://127.0.0.1:5173/` remained open in the browser but refused connections.
- **Root cause:** `run.sh` launched Vite and Uvicorn as foreground development processes tied to the invoking execution session. The desktop command runner also reaps detached descendants, so `nohup` cannot extend their lifetime beyond that session; no process remained on ports 5173 or 8000.
- **Fix:** Added `start.sh` backed by two macOS user-level launchd services, plus `stop.sh` for controlled unloading. Kept `run.sh` for foreground development.
- **Evidence:** Both `/api/health` and the Vite root return HTTP 200 in a fresh shell after the launching command exits. Both launchd service registrations remain loaded.
- **Regression test:** `tests/test_server_lifecycle.sh` starts the product, verifies both HTTP endpoints, and verifies both launchd services.
- **Related:** launchd does not inherit the interactive shell PATH, so the frontend service explicitly invokes `/usr/local/bin/node`; this was a process-lifecycle/configuration issue, not a frontend route or browser-cache failure.
- **Status:** DONE
