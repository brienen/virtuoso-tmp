# GGM Linked Data — Portainer stack

Virtuoso triple store + generieke linked-data-verkenner + Caddy als interne
router, klaar om via **Portainer** te deployen (build method: **Repository**).
De stack draait **achter een externe (systeem-)nginx die de TLS termineert**;
Caddy luistert plat op `:80` en wordt alleen op `127.0.0.1` gepubliceerd, waar
nginx naartoe proxyt.

Nieuwe Linked Data-versies komen **via rsync-over-SSH** binnen in een dropmap op
de host; een `lod-watch`-container bewaakt die map en laadt elke
`ggm-<versie>.ttl` in een named graph. De frontend praat via Caddy met het
read-only SPARQL-endpoint op `/sparql`.

## Structuur
- `docker-compose.yml` — virtuoso, lod-watch, frontend, caddy
- `caddy/` — Caddy-image (`Dockerfile` + `Caddyfile`); interne routing, alleen
  `/sparql` publiek (TLS doet de nginx)
- `lod-watch/` — watcher-image (`Dockerfile` + `watch.sh`) dat de dropmap bewaakt
  en `ggm-<versie>.ttl` in `…/graph/<versie>` + `…/graph/latest` laadt
- `frontend/` — generieke verkenner (nginx); later inruilbaar voor Ashkans image
- `stack.env.example` — sjabloon voor de Portainer-env-vars

De data zit **niet** in de repo of de images: die komt via rsync in de dropmap
(`LOD_HOST_DIR` op de host).

## Deployen in Portainer
1. Maak op de server de **dropmap** aan en zet de rechten goed:
   ```bash
   sudo mkdir -p /srv/ggm-lod && sudo chmod 755 /srv/ggm-lod
   ```
   (De container leest de map read-only; bestanden moeten `644` zijn — dat regelt
   de rsync-taak in de GGM-repo.)
2. Push deze repo naar GitHub/GitLab.
3. Portainer → **Stacks → Add stack** → build method **Repository**.
   - Repository URL: deze repo
   - Repository reference: `refs/heads/main`
   - Compose path: `docker-compose.yml`
4. Onder **Environment variables** de waarden uit `stack.env.example` invullen —
   in elk geval `DBA_PASSWORD` en `LOD_HOST_DIR` (het dropmap-pad). `HTTP_BIND`
   bepaalt waar Caddy op de host luistert (standaard `127.0.0.1:8080`); kies een
   vrije poort — Portainer zelf gebruikt al 8000/9000/9443.
5. **Deploy the stack**. Alles start; `lod-watch` wacht op Virtuoso en laadt wat
   er in de dropmap staat (bij een verse deploy is dat leeg tot je rsyncet).
6. Zet in de systeem-nginx een server-block dat naar `HTTP_BIND` proxyt (zie
   hieronder) en herlaad nginx.

Daarna: verkenner op `https://<domein>/` (via de nginx), SPARQL-endpoint op
`/sparql`.

## Reverse proxy (systeem-nginx)
Caddy termineert geen TLS meer; dat doet de nginx op de host. De nginx proxyt
naar de localhost-poort uit `HTTP_BIND`. Een minimaal server-block:

```nginx
server {
    listen 443 ssl;
    server_name lod.gemeentelijkgegevensmodel.nl;

    # ssl_certificate ... ;            # bijv. via certbot / Let's Encrypt
    # ssl_certificate_key ... ;

    location / {
        proxy_pass http://127.0.0.1:8080;      # = HTTP_BIND
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

De routing binnen de stack (`/sparql` → Virtuoso, rest → frontend) blijft in de
`Caddyfile`; de nginx hoeft dus maar één `proxy_pass` te kennen.

## Nieuwe LD-versie publiceren (vanuit de GGM-repo)
Geen stack-redeploy nodig. Vanuit de GGM-repo:

```bash
task generate:lod VERSION=v3.0.0     # TTL genereren (optioneel als 'ie al bestaat)
task publish:lod  VERSION=v3.0.0     # rsync naar de dropmap op de server
task publish:lod-list                # controleren wat er live staat
```

`publish:lod` rsyncet de TTL als `ggm-v3.0.0.ttl` naar `LOD_HOST_DIR` op de
server (alleen SSH nodig — geen dba-wachtwoord op de client). Binnen ~`WATCH_INTERVAL`
seconden ziet `lod-watch` het bestand en laadt het in `…/graph/v3.0.0` en
`…/graph/latest`. Oude versies blijven bevraagbaar.

## De frontend van Ashkan inpassen
De generieke verkenner is een placeholder met een klein contract:
- serveert HTTP op één poort (`FRONTEND_PORT`);
- benadert het SPARQL-endpoint same-origin op `/sparql`;
- data staat in named graphs `…/graph/<versie>` en `…/graph/latest`.

Inpassen: in `docker-compose.yml` bij service `frontend` `build: ./frontend`
vervangen door `image: <ashkan-image>`, en `FRONTEND_PORT` op zijn poort zetten.

## Beveiliging
- De stack publiceert alleen Caddy, en standaard alleen op `127.0.0.1`
  (`HTTP_BIND`), zodat enkel de nginx op de host erbij kan. Virtuoso's isql
  (1111), de http-poort (8890) en de Conductor-admin blijven intern; naar buiten
  is alleen `/sparql` bereikbaar en dat endpoint is read-only.
- Het dba-wachtwoord leeft alleen server-side (stack-env). Publiceren gebeurt met
  rsync-over-SSH: de client heeft alleen SSH-toegang tot de dropmap nodig.
- `stack.env` met het echte wachtwoord staat in `.gitignore` — niet committen.

## Let op
- **Repo-relatieve bind-mounts werken niet in Portainer.** Portainer draait zelf
  in een container, waardoor de gekloonde stackbestanden niet op de host-FS staan
  waar de daemon een `./iets`-mount oplost. Daarom zit alle repo-inhoud (Caddyfile,
  `watch.sh`) ín de images via `build:`. Een **absoluut** host-pad (de dropmap
  `LOD_HOST_DIR`) mág wél als bind-mount — dat lost de daemon op de host op.
- `lod-watch` herlaadt bij (her)start alle TTL's in de dropmap (idempotent: CLEAR +
  load; daarna alleen bij checksum-wijziging). Bij veel opgehoopte versies loopt de
  herstarttijd op; ruim dan oude `ggm-<versie>.ttl` uit de dropmap op.
- De dropmap op de host is de bron-van-waarheid en overleeft redeploys. Wis je het
  `virtuoso-data`-volume, dan herlaadt `lod-watch` de dropmap bij de volgende start.
