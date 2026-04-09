# Local Development Scheme 2

This repository now supports a faster local development mode aimed at reducing Docker rebuild friction:

- Frontend: local Vite dev server
- Backend: local Go process with hot reload
- PostgreSQL / Redis: Docker containers only
- App container (`new-api`): stopped during local backend development to avoid duplicate scheduled tasks

## Recommended workflow

Use the one-click scripts first:

```powershell
.\scripts\dev-start.ps1
```

If you want a true double-click entry on Windows, use the repository root launcher directly:

```text
start-local-dev.bat
```

If you want a stronger "take over preferred ports first" mode, use:

```text
start-local-dev-force.bat
```

Stop everything with:

```powershell
.\scripts\dev-stop.ps1
```

Double-click stop entry:

```text
stop-local-dev.bat
```

This is now the recommended local development path for day-to-day frontend / backend iteration.

## What the one-click script does

`.\scripts\dev-start.ps1` will:

1. Detect whether a previous local dev session is still recorded
2. Stop old local frontend / backend processes if needed
3. Check preferred ports and automatically fall back to the next free port
4. Stop the `new-api` application container if it is still running
5. Start or recreate PostgreSQL + Redis with the selected mapped ports
6. Start the local Go backend with `air` hot reload
7. Start the local Vite frontend
8. Wait for backend and frontend readiness
9. Write runtime state to `logs/dev-local/dev-state.json`
10. Open the frontend in your browser automatically

## Preferred port ranges

The scripts try these ports in order and choose the first free one:

- Frontend: `35173`, `35174`, `35175`, `35176`, `45173`, `45174`
- Backend API: `36173`, `36174`, `36175`, `36176`, `46173`, `46174`
- PostgreSQL: `35432`, `35433`, `35434`, `45432`
- Redis: `36379`, `36380`, `36381`, `46379`

So if your machine already occupies one of the preferred ports, the scripts will automatically use the next available port instead of forcing you to edit files by hand.

## Force start mode

Force mode is meant for the case where you prefer fixed frontend/backend ports first:

- frontend preferred port: `35173`
- backend preferred port: `36173`

When force mode is enabled, startup will:

1. try to stop the processes currently listening on `35173` and `36173`
2. wait briefly for those ports to be released
3. if release succeeds, start on the preferred ports
4. if release fails, still continue with automatic fallback

PowerShell usage:

```powershell
.\scripts\dev-start.ps1 -ForceKillPreferredPorts
```

Windows double-click usage:

```text
start-local-dev-force.bat
```

Important note:

- force mode only targets the preferred **frontend/backend** ports
- it does **not** force-kill PostgreSQL / Redis ports
- if a preferred port still cannot be released, the script falls back automatically rather than failing immediately

## Files

- `docker-compose.dev-infra.yml` — Docker infra only, with overridable mapped ports
- `scripts/dev-common.ps1` — shared helpers for state, ports, process cleanup, and `air`
- `scripts/air.dev.toml` — backend hot reload config
- `scripts/dev-start.ps1` — one-click start for infra + backend + frontend
- `scripts/dev-stop.ps1` — one-click stop for local dev processes and infra
- `start-local-dev.bat` — normal double-click start entry
- `start-local-dev-force.bat` — force-release preferred frontend/backend ports before startup
- `stop-local-dev.bat` — double-click stop entry
- `scripts/dev-infra-up.ps1` — infra only start / recreate
- `scripts/dev-infra-down.ps1` — infra only stop
- `scripts/dev-api.ps1` — backend local start entry
- `scripts/dev-web.ps1` — frontend local start entry
- `.env.dev.example` — default local environment template

## Usage

### 1. One-click start

```powershell
.\scripts\dev-start.ps1
```

### 1.1 Double-click start on Windows

Double-click this file in the repository root:

```text
start-local-dev.bat
```

It will directly call `scripts/dev-start.ps1`, so it still supports:

- automatic port fallback
- Docker infra startup
- backend hot reload
- frontend startup
- automatic browser opening

### 1.2 Force start on Windows

Double-click this file in the repository root:

```text
start-local-dev-force.bat
```

It behaves like normal startup, but first tries to release:

- `35173`
- `36173`

By default it will open the frontend in your browser automatically.

If you temporarily do **not** want the browser to open:

```powershell
.\scripts\dev-start.ps1 -OpenBrowser:$false
```

If you want force mode without opening the browser:

```powershell
.\scripts\dev-start.ps1 -ForceKillPreferredPorts -OpenBrowser:$false
```

### 2. One-click stop

```powershell
.\scripts\dev-stop.ps1
```

### 2.1 Double-click stop on Windows

Double-click this file in the repository root:

```text
stop-local-dev.bat
```

If you only want to stop frontend / backend and keep PostgreSQL + Redis running:

```powershell
.\scripts\dev-stop.ps1 -KeepInfra
```

## Manual mode

If you want to start only part of the stack:

### Start infra only

```powershell
.\scripts\dev-infra-up.ps1
```

Or specify custom mapped ports explicitly:

```powershell
.\scripts\dev-infra-up.ps1 -PostgresPort 35433 -RedisPort 36380
```

### Start backend only

```powershell
.\scripts\dev-api.ps1
```

Custom backend / infra ports:

```powershell
.\scripts\dev-api.ps1 -Port 36174 -PostgresPort 35433 -RedisPort 36380
```

Disable hot reload temporarily:

```powershell
.\scripts\dev-api.ps1 -NoHotReload
```

### Start frontend only

```powershell
.\scripts\dev-web.ps1
```

Custom frontend port and API target:

```powershell
.\scripts\dev-web.ps1 -Port 35174 -ApiTarget http://127.0.0.1:36174
```

## Backend hot reload

`scripts/dev-api.ps1` now prefers running through `air`.

Behavior:

- If `air` already exists, it is used directly
- If `air` is missing, the script will try to install it automatically via:

```powershell
go install github.com/air-verse/air@latest
```

Hot reload config lives in:

```text
scripts/air.dev.toml
```

## Frontend package manager

The frontend script now prefers:

1. `bun`
2. fallback to `npm`

So the dev script aligns with the repository convention as much as the local machine allows.

## State file

One-click startup writes runtime metadata to:

```text
logs/dev-local/dev-state.json
```

It records:

- selected frontend/backend/postgres/redis ports
- local frontend/backend launcher process IDs
- startup timestamp

`dev-stop.ps1` uses this state first, then also falls back to scanning the preferred frontend/backend ports to clean stale local sessions.

## `web/dist` requirement

`main.go` embeds `web/dist`, so the local backend still requires a valid `web/dist` directory at compile time.

If missing, generate it once:

```powershell
cd web
bun install
bun run build
```

If `bun` is unavailable, you can still use:

```powershell
cd web
npm install --legacy-peer-deps
npm run build
```

You do **not** need to rebuild it on every frontend change when using the Vite dev server.

## `ServerAddress` option

The database may still store an older `ServerAddress` value such as `http://localhost:3000`.

That mainly affects:

- copied API base URLs
- payment callback examples
- generated external links

During local dev, if you need those links to be accurate, temporarily set it to the currently selected backend address, for example:

```text
http://127.0.0.1:36173
```

If one-click startup falls back to a different backend port, use that actual port instead.
