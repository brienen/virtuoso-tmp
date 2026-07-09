# GGM Linked Data — Portainer stack

Virtuoso triple store + generieke linked-data-verkenner + Caddy als interne
router, klaar om via **Portainer** te deployen (build method: **Repository**).
De stack draait **achter een externe (systeem-)nginx die de TLS termineert**;
Caddy luistert plat op `:80` en wordt alleen op `127.0.0.1` gepubliceerd, waar
nginx naartoe proxyt. Elke GGM-release staat als TTL in `data/`; een
loader-container importeert die bij elke (re)deploy in named graphs. De frontend
praat via Caddy met het read-only SPARQL-endpoint op `/sparql`.

## Structuur
- `docker-compose.yml` — virtuoso, loader (one-shot import), frontend, caddy
- `caddy/` — Caddy-image (`Dockerfile` + `Caddyfile`); interne routing, alleen
  `/sparql` publiek (TLS doet de nginx)
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
   in elk geval `DBA_PASSWORD`. `HTTP_BIND` bepaalt waar Caddy op de host
   luistert (standaard `127.0.0.1:8080`); daar proxyt de nginx naartoe. Kies een
   poort die vrij is — Portainer zelf gebruikt al 8000/9000/9443.
4. **Deploy the stack**. Portainer bouwt de frontend en start alles; de loader
   importeert de TTL('s) en stopt.
5. Zet in de systeem-nginx een server-block dat naar `HTTP_BIND` proxyt (zie
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
`Caddyfile`; de nginx hoeft dus maar één `proxy_pass` te kennen. Wil je van
buitenaf alleen de verkenner en `/sparql` toestaan, dan kan dat ook al in de
nginx per `location`.

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
- De stack publiceert alleen Caddy, en standaard alleen op `127.0.0.1`
  (`HTTP_BIND`), zodat enkel de nginx op de host erbij kan. Virtuoso's isql
  (1111), de http-poort (8890) en de Conductor-admin blijven intern; naar buiten
  is alleen `/sparql` bereikbaar en dat endpoint is read-only.
- `stack.env` met het echte wachtwoord staat in `.gitignore` — niet committen.

## Let op
- De loader herlaadt bij elke redeploy alle TTL's in `data/` (idempotent: CLEAR +
  load). Bij veel opgehoopte versies loopt de deploytijd op; ruim dan oude TTL's
  op of breid de loader uit met een "sla over als graph al gevuld is"-check.
- `data/` bevat mogelijk grote bestanden (~4 MB per export). Overweeg Git LFS als
  er veel versies bijkomen.
