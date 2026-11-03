#!/usr/bin/env sh
# Backup de PostgreSQL (prompt 6): pg_dump comprimido subido a Cloudflare R2 (S3) con retención.
# Uso: DATABASE_URL=... R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=... sh scripts/backup-db.sh
# Variables opcionales: R2_ENDPOINT (default https://<account>.r2.cloudflarestorage.com), BACKUP_PREFIX (backups/db),
# BACKUP_RETENTION_DAYS (30), BACKUP_DIR (./backups: sin credenciales R2 el archivo queda ahí).
set -eu

: "${DATABASE_URL:?Falta DATABASE_URL}"
PREFIX="${BACKUP_PREFIX:-backups/db}"
RETENTION="${BACKUP_RETENTION_DAYS:-30}"
DIR="${BACKUP_DIR:-./backups}"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
FILE="vedere-${STAMP}.sql.gz"
mkdir -p "$DIR"

echo "pg_dump -> $DIR/$FILE"
pg_dump --no-owner --no-privileges --format=plain "$DATABASE_URL" | gzip -9 > "$DIR/$FILE"
SIZE=$(wc -c < "$DIR/$FILE")
echo "ok: $SIZE bytes"

if [ -z "${R2_ACCESS_KEY_ID:-}" ] || [ -z "${R2_SECRET_ACCESS_KEY:-}" ] || [ -z "${R2_BUCKET:-}" ]; then
  echo "Sin credenciales R2: el backup queda en $DIR/$FILE"
  exit 0
fi

ENDPOINT="${R2_ENDPOINT:-https://${R2_ACCOUNT_ID:?Falta R2_ACCOUNT_ID}.r2.cloudflarestorage.com}"
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto
aws s3 cp "$DIR/$FILE" "s3://$R2_BUCKET/$PREFIX/$FILE" --endpoint-url "$ENDPOINT" --only-show-errors
echo "subido: s3://$R2_BUCKET/$PREFIX/$FILE"

# Retención: borra los backups más viejos que $RETENTION días (por la fecha del nombre).
LIMITE=$(date -u -d "-${RETENTION} days" +%Y-%m-%d 2>/dev/null || date -u -v-"${RETENTION}"d +%Y-%m-%d)
aws s3 ls "s3://$R2_BUCKET/$PREFIX/" --endpoint-url "$ENDPOINT" | awk '{print $4}' | while read -r name; do
  [ -z "$name" ] && continue
  fecha=$(echo "$name" | sed -n 's/^vedere-\([0-9-]*\)T.*/\1/p')
  if [ -n "$fecha" ] && [ "$fecha" \< "$LIMITE" ]; then
    aws s3 rm "s3://$R2_BUCKET/$PREFIX/$name" --endpoint-url "$ENDPOINT" --only-show-errors
    echo "borrado (retencion $RETENTION dias): $name"
  fi
done
