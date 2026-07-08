#!/bin/sh
# Importeert alle TTL-bestanden uit /data in named graphs en ververst 'latest'.
# Draait als one-shot container bij elke (re)deploy van de stack. Idempotent:
# elke graph wordt eerst geleegd en opnieuw geladen.
set -eu

: "${DBA_PASSWORD:?DBA_PASSWORD ontbreekt}"
GRAPH_BASE="${GRAPH_BASE:-https://lod.gemeentelijkgegevensmodel.nl/graph}"
HOST="${VIRTUOSO_HOST:-virtuoso}:1111"

isql_run() { isql "$HOST" dba "$DBA_PASSWORD"; }

echo "loader: wachten tot Virtuoso bereikbaar is op $HOST ..."
i=0
until echo "status();" | isql "$HOST" dba "$DBA_PASSWORD" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "loader: Virtuoso niet bereikbaar na ~3 min, stop." >&2
    exit 1
  fi
  sleep 3
done
echo "loader: Virtuoso is bereikbaar."

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
