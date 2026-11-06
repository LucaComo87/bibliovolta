#!/usr/bin/env bash
# BIBLIOVOLTA · Copia di sicurezza del database Supabase
#
#   SUPABASE_DB_URL="postgresql://postgres.[ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" \
#     npm run db:backup
#
# Crea backups/bibliovolta-AAAA-MM-GG-HHMM.sql.gz (schema public + auth, dati
# compresi). Il file contiene dati personali: conservalo cifrato, in un luogo
# accessibile solo all'amministratore, e cancella le copie più vecchie di 30
# giorni (lo script lo fa da solo nella cartella backups/).
set -euo pipefail
: "${SUPABASE_DB_URL:?Imposta SUPABASE_DB_URL (Supabase → Project Settings → Database → Connection string, modalità Session)}"
command -v pg_dump >/dev/null || { echo "Serve pg_dump (PostgreSQL 15 o successivo)"; exit 1; }
mkdir -p backups
chmod 700 backups
out="backups/bibliovolta-$(date +%Y-%m-%d-%H%M).sql.gz"
pg_dump "$SUPABASE_DB_URL" --schema=public --schema=auth --no-owner --no-privileges --quote-all-identifiers | gzip -9 > "$out"
chmod 600 "$out"
find backups -name 'bibliovolta-*.sql.gz' -mtime +30 -delete
echo "Backup creato: $out ($(du -h "$out" | cut -f1))"
