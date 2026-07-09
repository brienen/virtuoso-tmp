FROM openlink/virtuoso-opensource-7:latest
# load.sh én de TTL-data in het image bakken. Bind-mounts van repo-inhoud werken
# niet betrouwbaar in Portainer (de stackbestanden staan niet op de host-FS waar
# de Docker-daemon mounts oplost), dus alles via image + named volume.
# Build-context is de repo-root (zie docker-compose.yml) zodat data/ mee kan.
COPY loader/load.sh /loader/load.sh
COPY data/ /seed/
