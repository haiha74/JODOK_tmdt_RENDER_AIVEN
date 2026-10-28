#!/usr/bin/env bash
set -euo pipefail

# Import demo SQL just once per Aiven database. Do not run on existing important data!
# The seed marker is in MySQL, because Render's local filesystem is ephemeral.
if [[ "${JODOK_AUTO_SEED:-true}" == "true" ]]; then
  : "${MYSQLHOST:?Required: MYSQLHOST (Aiven host)}"
  : "${MYSQLPORT:?Required: MYSQLPORT (Aiven port, NOT always 3306)}"
  : "${MYSQLDATABASE:?Required: MYSQLDATABASE (usually defaultdb)}"
  : "${MYSQLUSER:?Required: MYSQLUSER (usually avnadmin)}"
  : "${MYSQLPASSWORD:?Required: MYSQLPASSWORD}"

  db() {
    MYSQL_PWD="$MYSQLPASSWORD" mysql --protocol=TCP --ssl --connect-timeout=12 \
      --host="$MYSQLHOST" --port="$MYSQLPORT" --user="$MYSQLUSER" \
      --database="$MYSQLDATABASE" "$@"
  }

  ready=false
  for _ in {1..30}; do
    if db --batch --skip-column-names -e 'SELECT 1' >/dev/null 2>&1; then
      ready=true
      break
    fi
    echo '[JODOK] Waiting for Aiven MySQL connection...'
    sleep 4
  done
  if [[ "$ready" != 'true' ]]; then
    echo '[JODOK] Aiven is unreachable. Verify host/port/defaultdb/username/password and that service is RUNNING.' >&2
    exit 1
  fi

  seeded="$(db --batch --skip-column-names -e \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='jodok_deploy_seed'" | tr -d '\r[:space:]')"
  # Protect databases that already have tables but were not initialized by JODOK.
  # A failed/partial import also stops here, rather than dropping tables on restart.
  existing_tables="$(db --batch --skip-column-names -e \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE' AND table_name <> 'jodok_deploy_seed'" | tr -d '\r[:space:]')"
  if [[ "$seeded" == '0' && "$existing_tables" != '0' ]]; then
    echo '[JODOK] Database is not empty and seed marker is missing. Refusing to overwrite existing tables.' >&2
    echo '[JODOK] For a preloaded database: set JODOK_AUTO_SEED=false. For a demo seed: create a fresh empty Aiven database.' >&2
    exit 1
  fi

  if [[ "$seeded" == '0' ]]; then
    echo '[JODOK] First run: importing provided MySQL demo dump into Aiven...'
    # Aiven defaults to enforcing primary keys. The user's original junction table
    # sale_event_products has no PK; seed file temporarily disables this for its session.
    db < /app/seed/fashionweb.sql
    db -e 'CREATE TABLE IF NOT EXISTS jodok_deploy_seed (id INTEGER PRIMARY KEY, imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP); INSERT INTO jodok_deploy_seed (id) VALUES (1) ON DUPLICATE KEY UPDATE id=id;'
    echo '[JODOK] SQL demo import completed.'
  else
    echo '[JODOK] Demo data already loaded; skipping import.'
  fi
fi
mkdir -p /app/uploads
exec java -jar /app/app.jar
