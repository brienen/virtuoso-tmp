# Data — GGM linked-data exports

Plaats hier de TTL-export van elke GGM-release, met bestandsnaam:

    ggm-<versie>.ttl        bijv. ggm-v2.5.1.ttl

De loader-container importeert bij elke (re)deploy elk bestand in een named graph
`<GRAPH_BASE>/<versie>`, en zet het hoogste versienummer ook in
`<GRAPH_BASE>/latest`.

## Nieuwe release publiceren
1. Kopieer de export uit de GGM-repo hierheen als `ggm-<versie>.ttl`
   (bron: `<versie>/Gemeentelijk Gegevensmodel Linked Data-draft.ttl`).
2. Commit en push.
3. In Portainer: bij de stack op **Pull and redeploy** (of laat **GitOps updates**
   dit automatisch doen).
