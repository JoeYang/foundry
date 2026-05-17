# Foundry Ops Runbook

This runbook covers running the foundry stack in containers — "prod mode" — where the dashboard is always available, restarts on failure, and backs up daily. For active coding use dev mode instead (see [Dev vs prod mode](#dev-vs-prod-mode)).

---

## Quick start

```bash
# 1. Ensure prerequisites (see below)
sudo apt install podman-compose

# 2. Copy the example env file (once per machine)
cp .env.example .env

# 3. Bring up the full stack
./scripts/foundry up
```

Within ~30 seconds all four containers should be healthy and the dashboard will be reachable at **http://localhost:5173**.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| `podman` | >= 4.x | `sudo apt install podman` |
| `podman-compose` | any | `sudo apt install podman-compose` — OR use `podman compose` if your podman has a compose provider |
| Node 22+ | >= 22 | **Only for dev mode.** The containers do not need a host Node install. |

The CLI auto-detects the available compose tool at runtime in this order: `podman-compose` → `podman compose` → `docker compose`.

---

## CLI reference

All commands are run from the repo root:

```bash
./scripts/foundry <command> [args]
```

| Command | Description | Example |
|---|---|---|
| `up` | Start all containers (build if images don't exist) | `./scripts/foundry up` |
| `down` | Stop and remove all containers | `./scripts/foundry down` |
| `restart` | Stop, rebuild, and start all containers | `./scripts/foundry restart` |
| `build` | Build the api and web images | `./scripts/foundry build` |
| `rebuild` | Force-rebuild without Docker layer cache | `./scripts/foundry rebuild` |
| `logs [service]` | Tail logs; omit service to follow all | `./scripts/foundry logs api` |
| `status` | Show container status + per-container healthcheck state | `./scripts/foundry status` |
| `ps` | Alias for `status` | `./scripts/foundry ps` |
| `backup` | Trigger an immediate backup right now | `./scripts/foundry backup` |
| `list-backups` | List all backup files under `FOUNDRY_BACKUP_DIR` | `./scripts/foundry list-backups` |
| `restore <file>` | Restore from a backup file (DESTRUCTIVE — prompts for confirmation) | `./scripts/foundry restore ~/foundry-backups/daily/foundry-20260517-030000.sql.gz` |
| `shell [service]` | Open a shell in a container (defaults to `api`) | `./scripts/foundry shell web` |
| `psql` | Open psql against postgres as the superuser | `./scripts/foundry psql` |
| `help` | Print this reference | `./scripts/foundry help` |

**Environment variable:**

```bash
FOUNDRY_BACKUP_DIR=~/foundry-backups  # default; override in .env or shell
```

---

## Autostart on boot

To have the foundry stack come back up automatically after a reboot, run the installer **once per machine**:

```bash
sudo apt install podman-compose
./scripts/install-systemd-autostart.sh
```

The script does two things:

1. **`loginctl enable-linger $USER`** — allows your user's systemd session to run even when you are not logged in. Required so podman's user services can start at boot time before you open a terminal.

2. **`systemctl --user enable --now podman-restart.service`** — enables the podman-provided user service that restarts any container whose `restart` policy is `unless-stopped`. Since all four foundry services use `restart: unless-stopped` in `docker-compose.yml`, they will come back up automatically.

Verify after running:

```bash
loginctl show-user $USER | grep Linger     # expect: Linger=yes
systemctl --user status podman-restart.service  # expect: active (running)
```

This only needs to be done **once per machine**. After that, `./scripts/foundry up` registers the containers and they survive reboots automatically.

---

## Backups

The `backup` container (based on `prodrigestivill/postgres-backup-local:16`) runs `pg_dump` on a schedule inside the container and writes to `FOUNDRY_BACKUP_DIR` on the host (default: `~/foundry-backups`).

**Schedule:** `@daily` — approximately midnight in the container's timezone.

**Output structure:**

```
~/foundry-backups/
  last/
    foundry-latest.sql.gz     ← most recent dump (always overwritten)
  daily/
    foundry-YYYYMMDD-HHmmss.sql.gz   ← kept 7 days
  weekly/
    foundry-YYYYMMDD-HHmmss.sql.gz   ← kept 4 weeks
  monthly/
    foundry-YYYYMMDD-HHmmss.sql.gz   ← kept 6 months
```

**Trigger an immediate backup:**

```bash
./scripts/foundry backup
```

**List existing backups:**

```bash
./scripts/foundry list-backups
```

**Offsite sync recommendation:** Rsync `~/foundry-backups/` to offsite storage on your own schedule. A simple cron entry is sufficient:

```cron
0 4 * * * rsync -az ~/foundry-backups/ user@backup-host:/backups/foundry/
```

---

## Restore

> **DESTRUCTIVE.** Restore drops the `foundry` database and recreates it from the dump. Back up first if you have any doubt.

```bash
./scripts/foundry restore /home/joeyang/foundry-backups/daily/foundry-20260517-030000.sql.gz
```

The script will:

1. Print a warning and ask you to type `restore` to confirm.
2. Stop the `api` and `web` containers to release all database connections.
3. Drop and recreate the `foundry` database.
4. Pipe the dump (gunzip'd if `.gz`) into `psql`.
5. Restart `api` and `web`.
6. Print `status` so you can confirm everything is healthy.

After a successful restore:

```bash
./scripts/foundry status   # all services should show healthy
```

---

## Troubleshooting

- **Port conflicts (5173, 5380, or 5433 already in use):** Find and kill the conflicting process:
  ```bash
  ss -tlnp | grep -E ':(5173|5380|5433)'
  ```
  Then re-run `./scripts/foundry up`. Common culprit: a leftover dev-mode server. Run `./scripts/foundry down` first if switching from dev mode.

- **Containers won't start / healthcheck stuck in "starting":** Inspect logs for the failing service:
  ```bash
  ./scripts/foundry logs api
  ./scripts/foundry logs postgres
  ```

- **Migrations failing on startup:** Usually means the `foundry_app` role doesn't exist. The postgres init script (`docker/init/`) creates it on first boot but won't re-run on an existing volume. If you're sure you want to start fresh (this destroys all data — back up first!):
  ```bash
  ./scripts/foundry backup          # save current data
  ./scripts/foundry down
  podman volume rm foundry-pgdata   # DESTRUCTIVE — drops all data
  ./scripts/foundry up              # init script runs fresh
  ```

- **Backup directory missing:** The container can't create the host bind-mount target itself. Create it manually:
  ```bash
  mkdir -p ~/foundry-backups
  ```

- **`podman-compose: command not found`:**
  ```bash
  sudo apt install podman-compose
  ```

- **`podman-restart.service` not found:** Your podman version may be older than 4.4. Update podman: `sudo apt install --only-upgrade podman`.

---

## Dev vs prod mode

| Mode | How to start | Use when |
|---|---|---|
| **Dev** | `npm run dev --workspace @foundry/api` + `npm run dev --workspace @foundry/web` | Actively writing code — hot reload, source-mounted |
| **Prod** | `./scripts/foundry up` | Dashboard should always be reachable — containers, auto-restart, daily backups |

Both modes share the same Postgres database on port **5433**. Do not run both modes simultaneously — they will conflict on ports 5380 and 5173.

Before switching from prod to dev:

```bash
./scripts/foundry down
# then start your dev servers normally
```

Before switching from dev to prod:

```bash
# stop dev servers (Ctrl-C or pkill -f tsx)
./scripts/foundry up
```
