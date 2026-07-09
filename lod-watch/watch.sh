#!/bin/sh
# lod-watch: bewaakt de dropmap /data en laadt nieuwe of gewijzigde
# ggm-<versie>.ttl in Virtuoso als named graph <GRAPH_BASE>/<versie>, en ververst
# <GRAPH_BASE>/latest naar de hoogste versie. Idempotent: een bestand wordt alleen
# (her)laden als de checksum wijzigt. Draait continu (poll).
#
# De TTL's komen via rsync-over-SSH in de dropmap (een host-map die als /data is
# gemount, ook in Virtuoso). Zo is er geen dba-wachtwoord op de client nodig: dit
# proces kent het (uit de stack-env) en draait op de server.
set -eu

: "${DBA_PASSWORD:?DBA_PASSWORD ontbreekt}"
GRAPH_BASE="${GRAPH_BASE:-https://lod.gemeentelijkgegevensmodel.nl/graph}"
HOST="${VIRTUOSO_HOST:-virtuoso}:1111"
INTERVAL="${WATCH_INTERVAL:-20}"
STATE="/state"
mkdir -p "$STATE"

isql_run() { isql "$HOST" dba "$DBA_PASSWORD"; }

wacht_op_virtuoso() {
  i=0
  until echo "status();" | isql "$HOST" dba "$DBA_PASSWORD" >/dev/null 2>&1; do
    i=$((i + 1))
    if [ "$i" -gt 100 ]; then
      echo "lod-watch: Virtuoso niet bereikbaar via isql. Laatste melding:" >&2
      echo "status();" | isql "$HOST" dba "$DBA_PASSWORD" 2>&1 | sed 's/^/lod-watch:   /' >&2 || true
      return 1
    fi
    sleep 3
  done
  return 0
}

laad() {  # $1 = graph-URI, $2 = bestandsnaam in /data
  isql_run <<SQL
SPARQL CLEAR GRAPH <$1>;
DB.DBA.TTLP_MT(file_to_string_output('/data/$2'), '', '$1');
checkpoint;
SQL
}

ververs_latest() {
  laatste=$(ls /data/*.ttl 2>/dev/null | sort -V | tail -n1 || true)
  if [ -n "$laatste" ]; then
    base=$(basename "$laatste")
    echo "lod-watch: latest -> $base"
    if ! laad "$GRAPH_BASE/latest" "$base"; then
      echo "lod-watch: latest bijwerken mislukt" >&2
    fi
  fi
}

echo "lod-watch: start (dropmap /data, poll elke ${INTERVAL}s)"
if ! wacht_op_virtuoso; then
  echo "lod-watch: kan Virtuoso niet bereiken, stop." >&2
  exit 1
fi
echo "lod-watch: Virtuoso bereikbaar."

# Bij (her)start alles opnieuw laden: wis de checksum-state. Dekt ook een verse
# Virtuoso (leeg database) zonder handmatige actie.
rm -f "$STATE"/*.md5 2>/dev/null || true

while true; do
  gewijzigd=0
  for f in $(ls /data/*.ttl 2>/dev/null | sort -V); do
    base=$(basename "$f")
    version=$(printf '%s' "$base" | sed -E 's/^ggm[-_]?//I; s/\.ttl$//')
    sum=$(md5sum "$f" | cut -d' ' -f1)
    key="$STATE/$base.md5"
    oud=""
    if [ -f "$key" ]; then oud=$(cat "$key" 2>/dev/null || true); fi
    if [ "$oud" != "$sum" ]; then
      echo "lod-watch: laden $base -> <$GRAPH_BASE/$version>"
      if laad "$GRAPH_BASE/$version" "$base"; then
        printf '%s' "$sum" > "$key"
        gewijzigd=1
      else
        echo "lod-watch: laden $base mislukt; opnieuw bij volgende ronde" >&2
      fi
    fi
  done
  if [ "$gewijzigd" = "1" ]; then
    ververs_latest
  fi
  sleep "$INTERVAL"
done
