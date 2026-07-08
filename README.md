# GGM Linked Data — Portainer stack

Virtuoso triple store + generieke linked-data-verkenner + Caddy (reverse proxy
met automatische TLS), klaar om via **Portainer** te deployen (build method:
**Repository**). Elke GGM-release staat als TTL in `data/`; een loader-container
importeert die bij elke (re)deploy in named graphs. De frontend praat via Caddy
met het read-only SPARQL-endpoint op `/sparql`.

## Structuur
- `docker-compose.yml` — virtuoso, loader (one-shot import), frontend, caddy
- `Caddyfile` — routing + TLS; alleen `/sparql` publiek
- `loader/load.sh` — importeert `data/*.ttl` in named graphs + `latest`
- `frontend/` — generieke verkenner (nginx); later inruilbaar voor Ashkans image
- `data/` — de TTL-exports (`ggm-<versie>.ttl`), meegecommit
- `stack.env.example` — sjabloon voor de Portainer-env-vars

## Deployen in Portainer
1. Push deze repo naar GitHub/GitLab en zorg dat er minstens één
   `data/ggm-<versie>.ttl` in staat.
2. Portainer → **Stacks → Add stack** → build method **Repository**.
   - Repository URL: deze repo
   - Repository reference: `refs/heads/main`
   - Compose path: `docker-compose.yml`
3. Onder **Environment variables** de waarden uit `stack.env.example` invullen —
   in elk geval `DBA_PASSWORD`. `SITE_ADDRESS=:80` om via het server-IP te testen,
   of je domein voor automatische HTTPS (vereist een DNS-record naar de server).
4. **Deploy the stack**. Portainer bouwt de frontend en start alles; de loader
   importeert de TTL('s) en stopt.

Daarna: verkenner op `http://<server>/` (of `https://<domein>/`), SPARQL-endpoint
op `/sparql`.

## Nieuwe GGM-release publiceren
1. Kopieer de export naar `data/ggm-<versie>.ttl`
   (bron: `<versie>/Gemeentelijk Gegevensmodel Linked Data-draft.ttl` in de GGM-repo).
2. Commit + push.
3. Portainer → de stack → **Pull and redeploy** (of zet **GitOps updates** aan,
   dan gebeurt dit automatisch bij elke push).

De loader importeert de nieuwe versie in `…/graph/<versie>` en ververst
`…/graph/latest`. Oude versies blijven bevraagbaar.

## De frontend van Ashkan inpassen
De generieke verkenner is een placeholder met een klein contract:
- serveert HTTP op één poort (`FRONTEND_PORT`);
- benadert het SPARQL-endpoint same-origin op `/sparql`;
- data staat in named graphs `…/graph/<versie>` en `…/graph/latest`.

Inpassen: in `docker-compose.yml` bij service `frontend` `build: ./frontend`
vervangen door `image: <ashkan-image>`, en `FRONTEND_PORT` op zijn poort zetten.

## Beveiliging
- Alleen `/sparql` is publiek (via Caddy). Virtuoso's isql (1111) en de
  Conductor-admin worden niet gepubliceerd; het endpoint is read-only.
- `stack.env` met het echte wachtwoord staat in `.gitignore` — niet committen.

## Let op
- De loader herlaadt bij elke redeploy alle TTL's in `data/` (idempotent: CLEAR +
  load). Bij veel opgehoopte versies loopt de deploytijd op; ruim dan oude TTL's
  op of breid de loader uit met een "sla over als graph al gevuld is"-check.
- `data/` bevat mogelijk grote bestanden (~4 MB per export). Overweeg Git LFS als
  er veel versies bijkomen.
