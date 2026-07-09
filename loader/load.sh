#!/bin/sh
# Importeert alle TTL-bestanden in named graphs en ververst 'latest'. Draait als
# one-shot container bij elke (re)deploy. De TTL's zitten in het image (/seed) en
# worden naar het gedeelde volume /data gekopieerd, dat Virtuoso ook mount; daar
# leest file_to_string_output ze. Idempotent: elke graph wordt eerst geleegd en
# opnieuw geladen.
set -eu

: "${DBA_PASSWORD:?DBA_PASSWORD ontbreekt}"
GRAPH_BASE="${GRAPH_BASE:-https://lod.gemeentelijkgegevensmodel.nl/graph}"
HOST="${VIRTUOSO_HOST:-virtuoso}:1111"

isql_run() { isql "$HOST" dba "$DBA_PASSWORD"; }

# De in het image gebakken TTL's naar het gedeelde volume dat Virtuoso ook mount.
# Eerst legen zodat verwijderde releases niet blijven staan.
echo "loader: TTL-data uit image naar gedeeld volume /data kopiëren"
mkdir -p /data
rm -f /data/*.ttl
cp /seed/*.ttl /data/ 2>/dev/null || true

echo "loader: wachten tot Virtuoso (isql) bereikbaar is op $HOST ..."
i=0
max=100   # ~5 min: ruim genoeg voor de eerste boot van een lege database
until echo "status();" | isql "$HOST" dba "$DBA_PASSWORD" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge "$max" ]; then
    echo "loader: Virtuoso niet bereikbaar via isql na ~5 min. Laatste melding:" >&2
    echo "status();" | isql "$HOST" dba "$DBA_PASSWORD" 2>&1 | sed 's/^/loader:   /' >&2 || true
    echo "loader: hint: 'Bad login'/SQ074 = DBA_PASSWORD past niet bij de" >&2
    echo "loader:   bestaande virtuoso-data; 'Connection refused' = poort 1111" >&2
    echo "loader:   nog niet open (Virtuoso nog aan het opstarten)." >&2
    exit 1
  fi
  sleep 3
done
echo "loader: Virtuoso is bereikbaar via isql."

latest_file=""
for f in $(ls /data/*.ttl 2>/dev/null | sort -V); do
  base=$(basename "$f")
  # ggm-v2.5.1.ttl -> v2.5.1 (voorvoegsel 'ggm-' en extensie eraf)
  version=$(printf '%s' "$base" | sed -E 's/^ggm[-_]?//I; s/\.ttl$//')
  graph="$GRAPH_BASE/$version"
  latest_file="$base"
  echo "loader: laden $base -> <$graph>"
  isql_run <<SQL
SPARQL CLEAR GRAPH <$graph>;
DB.DBA.TTLP_MT(file_to_string_output('/data/$base'), '', '$graph');
checkpoint;
SQL
done

if [ -z "$latest_file" ]; then
  echo "loader: geen TTL in /data. Voeg data/ggm-<versie>.ttl toe en herdeploy."
  exit 0
fi

echo "loader: 'latest' -> $latest_file"
isql_run <<SQL
SPARQL CLEAR GRAPH <$GRAPH_BASE/latest>;
DB.DBA.TTLP_MT(file_to_string_output('/data/$latest_file'), '', '$GRAPH_BASE/latest');
checkpoint;
SQL

echo "loader: klaar."
