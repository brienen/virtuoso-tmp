FROM openlink/virtuoso-opensource-7:latest
# Alleen het watch-script in het image; de TTL-data komt via rsync in de dropmap
# (host-map, als /data gemount), niet in het image.
COPY watch.sh /watch.sh
