"use strict";

// Generieke verkenner voor het GGM in Virtuoso.
// Werkt zonder configuratie: versies worden ontdekt via de named graphs
// (alles onder .../graph/), klassen via owl:Class in de gekozen graph.

const ENDPOINT = "/sparql";

const PREFIXES = `
PREFIX owl:  <http://www.w3.org/2002/07/owl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
`;

// De curated domein-indeling (DOMEIN_MAP, HOOFDDOMEIN_VOLGORDE, HOOFDDOMEIN_KLEUR
// en hoofddomeinVan) staat in domeinen.js — gedeeld met de LOD-cloud. index.html
// laadt dat bestand vóór app.js.

const state = {
  graphs: [],   // {uri, naam, triples}
  graph: null,  // gekozen graph-URI
  klassen: [],  // {uri, label, definitie, domein, pad}
  domein: null, // actief deelmodelfilter
  term: "",     // zoekterm
  open: new Set(), // uitgeklapte hoofddomeinen
};

// ---------- SPARQL ----------

async function sparql(query) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/sparql-results+json",
    },
    body: "query=" + encodeURIComponent(PREFIXES + query),
  });
  if (!res.ok) throw new Error("SPARQL-endpoint antwoordde met HTTP " + res.status);
  return (await res.json()).results.bindings;
}

// ---------- helpers ----------

const $ = (sel) => document.querySelector(sel);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function padVan(uri) {
  try { return new URL(uri).pathname; } catch { return uri; }
}

function domeinVan(uri) {
  const delen = padVan(uri).split("/");
  return delen.length > 2 ? decodeURIComponent(delen[1]) : "";
}

function labelVanUri(u) {
  return decodeURIComponent(padVan(u).split("/").pop());
}

function graphNaam(uri) {
  return uri.replace(/\/$/, "").split("/").pop();
}

function toonStatus(html, fout = false) {
  const el = $("#status");
  el.innerHTML = html;
  el.hidden = false;
  el.classList.toggle("fout", fout);
}

function verbergStatus() { $("#status").hidden = true; }

// ---------- initialisatie ----------

async function init() {
  toonStatus("Versies laden…");
  let rows;
  try {
    rows = await sparql(`
      SELECT ?g (COUNT(*) AS ?n)
      WHERE { GRAPH ?g { ?s ?p ?o } }
      GROUP BY ?g`);
  } catch (e) {
    toonStatus(
      "<strong>Kan het SPARQL-endpoint niet bereiken.</strong><br>" +
      esc(e.message) + "<br>Draait de Virtuoso-container en is er al een release geladen?",
      true);
    return;
  }

  state.graphs = rows
    .filter((r) => r.g.value.includes("/graph/"))
    .map((r) => ({ uri: r.g.value, naam: graphNaam(r.g.value), triples: Number(r.n.value) }))
    .sort((a, b) => b.naam.localeCompare(a.naam, undefined, { numeric: true }));

  if (!state.graphs.length) {
    toonStatus(
      "<strong>Nog geen GGM-release geladen.</strong><br>" +
      "Voeg een <code>data/ggm-&lt;versie&gt;.ttl</code> toe aan de repo en herdeploy de stack in Portainer.", true);
    return;
  }

  const latest = state.graphs.find((g) => g.naam === "latest");
  state.graph = (latest || state.graphs[0]).uri;
  renderGraphSelect();

  await laadKlassen();
  route();
}

function renderGraphSelect() {
  const sel = $("#graph-select");
  sel.innerHTML = state.graphs
    .map((g) => `<option value="${esc(g.uri)}" ${g.uri === state.graph ? "selected" : ""}>` +
                `${esc(g.naam)} (${g.triples.toLocaleString("nl-NL")} triples)</option>`)
    .join("");
  sel.onchange = async () => {
    state.graph = sel.value;
    state.domein = null;
    await laadKlassen();
    toonLijst();
  };
}

async function laadKlassen() {
  toonStatus("Model laden…");
  const rows = await sparql(`
    SELECT ?c ?label ?definitie
    WHERE {
      GRAPH <${state.graph}> {
        ?c a owl:Class ; rdfs:label ?label .
        OPTIONAL { ?c rdfs:comment ?definitie }
      }
    } ORDER BY ?label`);

  state.klassen = rows.map((r) => ({
    uri: r.c.value,
    label: r.label.value,
    definitie: r.definitie ? r.definitie.value : "",
    domein: domeinVan(r.c.value),
    pad: padVan(r.c.value),
  }));

  verbergStatus();
  $("#browser").hidden = false;
  renderBoom();
}

// ---------- navigatie: hiërarchische boom (hoofddomein → deelmodel) ----------

function renderBoom() {
  const telling = new Map();
  for (const k of state.klassen) telling.set(k.domein, (telling.get(k.domein) || 0) + 1);

  const groepen = new Map(); // hoofddomein → [{deel, aantal}]
  for (const [deel, aantal] of telling) {
    const hd = hoofddomeinVan(deel);
    if (!groepen.has(hd)) groepen.set(hd, []);
    groepen.get(hd).push({ deel, aantal });
  }
  for (const arr of groepen.values()) arr.sort((a, b) => a.deel.localeCompare(b.deel));

  const volgorde = HOOFDDOMEIN_VOLGORDE.filter((h) => groepen.has(h))
    .concat([...groepen.keys()].filter((h) => !HOOFDDOMEIN_VOLGORDE.includes(h)));

  const totaal = (arr) => arr.reduce((s, x) => s + x.aantal, 0);

  let html = `<button class="boom-alle ${state.domein ? "" : "actief"}" data-alle="1">
      <span>Alle klassen</span><span class="aantal">${state.klassen.length}</span></button>`;

  for (const hd of volgorde) {
    const arr = groepen.get(hd);
    const open = state.open.has(hd);
    html += `<div class="boom-groep">
      <button class="boom-kop" data-groep="${esc(hd)}" aria-expanded="${open}">
        <span class="chevron">${open ? "▾" : "▸"}</span>
        <span class="naam">${esc(hd)}</span>
        <span class="aantal">${totaal(arr)}</span>
      </button>`;
    if (open) {
      html += arr.map((x) =>
        `<button class="boom-deel ${state.domein === x.deel ? "actief" : ""}" data-deel="${esc(x.deel)}">
           <span>${esc(x.deel || "(zonder deelmodel)")}</span><span class="aantal">${x.aantal}</span>
         </button>`).join("");
    }
    html += `</div>`;
  }
  $("#domain-list").innerHTML = html;

  $("#domain-list").querySelector(".boom-alle").onclick = () => {
    state.domein = null; renderBoom(); toonLijst(true);
  };
  for (const b of document.querySelectorAll("#domain-list .boom-kop")) {
    b.onclick = () => {
      const hd = b.dataset.groep;
      state.open.has(hd) ? state.open.delete(hd) : state.open.add(hd);
      renderBoom();
    };
  }
  for (const b of document.querySelectorAll("#domain-list .boom-deel")) {
    b.onclick = () => {
      state.domein = b.dataset.deel;
      state.open.add(hoofddomeinVan(state.domein));
      renderBoom(); toonLijst(true);
    };
  }
}

function gefilterd() {
  const term = state.term.trim().toLowerCase();
  return state.klassen.filter((k) =>
    (!state.domein || k.domein === state.domein) &&
    (!term || k.label.toLowerCase().includes(term) || k.definitie.toLowerCase().includes(term)));
}

function toonLijst(push = false) {
  if (push && location.pathname !== "/") history.pushState(null, "", "/");
  const lijst = gefilterd();
  $("#content").innerHTML =
    `<p class="telling">${lijst.length} van ${state.klassen.length} klassen` +
    (state.domein ? ` · ${esc(state.domein)}` : "") + `</p>` +
    lijst.map((k) => `
      <article class="kaart" data-uri="${esc(k.uri)}">
        <h3><a href="${esc(k.pad)}">${esc(k.label)}</a></h3>
        <span class="domein-chip">${esc(k.domein)}</span>
        ${k.definitie ? `<p>${esc(k.definitie)}</p>` : ""}
      </article>`).join("");

  for (const kaart of document.querySelectorAll(".kaart")) {
    kaart.onclick = (e) => {
      e.preventDefault();
      toonDetail(kaart.dataset.uri, true);
    };
  }
}

// ---------- relatiegraaf (buurtgraaf per klasse) ----------

function buurtgraaf(klasse, uit, inn) {
  const nb = new Map();
  const add = (uri, label, rel, dir) => {
    if (!nb.has(uri)) nb.set(uri, { uri, label, domein: domeinVan(uri), out: [], in: [] });
    nb.get(uri)[dir].push(rel);
  };
  for (const r of uit) add(r.doel.value, r.doelLabel ? r.doelLabel.value : labelVanUri(r.doel.value), r.label.value, "out");
  for (const r of inn) add(r.bron.value, r.bronLabel ? r.bronLabel.value : labelVanUri(r.bron.value), r.label.value, "in");

  const alle = [...nb.values()];
  if (!alle.length) return "";

  const CAP = 16;
  const meer = alle.length - CAP;
  const nodes = alle.slice(0, CAP);

  const W = 680, H = 420, cx = W / 2, cy = H / 2, rx = W / 2 - 92, ry = H / 2 - 52;
  const toonLabels = nodes.length <= 9;

  const box = (x, y, label, fill, txt, bold, uri) => {
    const w = Math.max(58, Math.min(152, label.length * 7 + 16));
    const kort = label.length > 22 ? label.slice(0, 21) + "…" : label;
    const kl = uri ? ` class="knoop" data-uri="${esc(uri)}"` : ` class="knoop-vast"`;
    return `<g${kl}>` +
      `<rect x="${(x - w / 2).toFixed(1)}" y="${(y - 15).toFixed(1)}" width="${w}" height="30" rx="7" ` +
      `fill="${fill}" stroke="${bold ? txt : "#d0d7de"}" stroke-width="${bold ? 1.5 : 0.7}"/>` +
      `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="11" text-anchor="middle" ` +
      `fill="${txt}"${bold ? ' font-weight="600"' : ""}>${esc(kort)}</text></g>`;
  };

  let edges = "", labels = "", boxes = "";
  nodes.forEach((n, i) => {
    const th = -Math.PI / 2 + (i / nodes.length) * 2 * Math.PI;
    const x = cx + rx * Math.cos(th), y = cy + ry * Math.sin(th);
    const mx = ((cx + x) / 2).toFixed(1), my = ((cy + y) / 2).toFixed(1);
    if (n.out.length)
      edges += `<polyline points="${cx},${cy} ${mx},${my} ${x.toFixed(1)},${y.toFixed(1)}" fill="none" stroke="#c1cad3" stroke-width="1.3" marker-mid="url(#pijl)"/>`;
    if (n.in.length)
      edges += `<polyline points="${x.toFixed(1)},${y.toFixed(1)} ${mx},${my} ${cx},${cy}" fill="none" stroke="#c1cad3" stroke-width="1.3" marker-mid="url(#pijl)"/>`;
    if (toonLabels) {
      const rel = [...new Set([...n.out, ...n.in])].join(", ");
      const rk = rel.length > 22 ? rel.slice(0, 21) + "…" : rel;
      labels += `<text x="${mx}" y="${(my - 3)}" font-size="11" text-anchor="middle" fill="#57606a">${esc(rk)}</text>`;
    }
    const bekend = state.klassen.some((k) => k.uri === n.uri);
    const [bg, tx] = HOOFDDOMEIN_KLEUR[hoofddomeinVan(n.domein)] || HOOFDDOMEIN_KLEUR["Overig"];
    boxes += box(x, y, n.label, bg, tx, false, bekend ? n.uri : null);
  });

  const svg = `<svg viewBox="0 0 ${W} ${H}" class="graaf" role="img" aria-label="Relatiegraaf van ${esc(klasse.label)}">
      <defs><marker id="pijl" markerWidth="9" markerHeight="9" refX="4" refY="3" orient="auto">
        <path d="M0,0 L7,3 L0,6 Z" fill="#8a97a5"/></marker></defs>
      ${edges}${labels}${boxes}${box(cx, cy, klasse.label, "#1f4e79", "#ffffff", true, null)}
    </svg>`;

  const hdSet = new Set([hoofddomeinVan(klasse.domein), ...alle.map((n) => hoofddomeinVan(n.domein))]);
  const legenda = `<div class="graaf-legenda">` + [...hdSet].sort().map((hd) => {
    const [bg, tx] = HOOFDDOMEIN_KLEUR[hd] || HOOFDDOMEIN_KLEUR["Overig"];
    return `<span><span class="swatch" style="background:${bg};border-color:${tx}"></span>${esc(hd)}</span>`;
  }).join("") + `</div>`;

  const noot = meer > 0
    ? `<p class="graaf-noot">+${meer} klassen niet getekend — zie de tabellen hieronder.</p>` : "";

  return svg + legenda + noot;
}

// ---------- detailweergave ----------

async function toonDetail(uri, push = false) {
  const klasse = state.klassen.find((k) => k.uri === uri);
  if (!klasse) { toonLijst(); return; }
  if (push) history.pushState(null, "", klasse.pad);

  $("#content").innerHTML = `<div class="detail"><p>Laden…</p></div>`;

  const [attrs, uit, inn, supers, subs] = await Promise.all([
    sparql(`
      SELECT ?label ?range ?definitie WHERE {
        GRAPH <${state.graph}> {
          ?p a owl:DatatypeProperty ; rdfs:domain <${uri}> ; rdfs:label ?label .
          OPTIONAL { ?p rdfs:range ?range }
          OPTIONAL { ?p rdfs:comment ?definitie }
        }
      } ORDER BY ?label`),
    sparql(`
      SELECT ?label ?doel ?doelLabel WHERE {
        GRAPH <${state.graph}> {
          ?p a owl:ObjectProperty ; rdfs:domain <${uri}> ; rdfs:label ?label ; rdfs:range ?doel .
          OPTIONAL { ?doel rdfs:label ?doelLabel }
        }
      } ORDER BY ?label`),
    sparql(`
      SELECT ?label ?bron ?bronLabel WHERE {
        GRAPH <${state.graph}> {
          ?p a owl:ObjectProperty ; rdfs:range <${uri}> ; rdfs:label ?label ; rdfs:domain ?bron .
          OPTIONAL { ?bron rdfs:label ?bronLabel }
        }
      } ORDER BY ?label`),
    sparql(`
      SELECT ?super ?superLabel WHERE {
        GRAPH <${state.graph}> {
          <${uri}> rdfs:subClassOf ?super . FILTER(?super != <${uri}>)
          OPTIONAL { ?super rdfs:label ?superLabel }
        }
      } ORDER BY ?superLabel`),
    sparql(`
      SELECT ?sub ?subLabel WHERE {
        GRAPH <${state.graph}> {
          ?sub rdfs:subClassOf <${uri}> . FILTER(?sub != <${uri}>)
          OPTIONAL { ?sub rdfs:label ?subLabel }
        }
      } ORDER BY ?subLabel`),
  ]);

  const klasseLink = (u, lbl) => {
    const bekend = state.klassen.find((k) => k.uri === u);
    const naam = lbl || (bekend ? bekend.label : labelVanUri(u));
    return bekend
      ? `<a href="${esc(bekend.pad)}" data-uri="${esc(u)}">${esc(naam)}</a>`
      : esc(naam);
  };

  const xsdNaam = (u) => (u || "").split(/[#/]/).pop();

  const tabel = (rijen, kop, leeg) => rijen.length
    ? `<table><thead><tr>${kop}</tr></thead><tbody>${rijen.join("")}</tbody></table>`
    : `<p class="leeg">${leeg}</p>`;

  const graafHtml = buurtgraaf(klasse, uit, inn);

  const overerving = (supers.length || subs.length) ? `
      <h3>Overerving</h3>
      <table><tbody>
        ${supers.length ? `<tr><th>is een</th><td>${supers.map((r) => "↑ " + klasseLink(r.super.value, r.superLabel ? r.superLabel.value : null)).join("<br>")}</td></tr>` : ""}
        ${subs.length ? `<tr><th>subtypes</th><td>${subs.map((r) => "↓ " + klasseLink(r.sub.value, r.subLabel ? r.subLabel.value : null)).join("<br>")}</td></tr>` : ""}
      </tbody></table>` : "";

  $("#content").innerHTML = `
    <div class="detail">
      <a href="/" class="terug">← Alle klassen</a>
      <h2>${esc(klasse.label)}</h2>
      <span class="domein-chip">${esc(klasse.domein)}</span>
      <p class="uri"><code>${esc(uri)}</code></p>
      ${klasse.definitie ? `<p class="definitie">${esc(klasse.definitie)}</p>` : ""}

      ${graafHtml ? `<h3>Relatiegraaf</h3><div class="graaf-wrap">${graafHtml}</div>` : ""}
      ${overerving}

      <h3>Attributen (${attrs.length})</h3>
      ${tabel(
        attrs.map((r) => `<tr><th>${esc(r.label.value)}</th>` +
          `<td>${esc(xsdNaam(r.range ? r.range.value : ""))}</td>` +
          `<td>${esc(r.definitie ? r.definitie.value : "")}</td></tr>`),
        "<th>naam</th><th>type</th><th>definitie</th>",
        "Geen attributen.")}

      <h3>Relaties — uitgaand (${uit.length})</h3>
      ${tabel(
        uit.map((r) => `<tr><th>${esc(r.label.value)}</th>` +
          `<td>→ ${klasseLink(r.doel.value, r.doelLabel ? r.doelLabel.value : null)}</td></tr>`),
        "<th>relatie</th><th>naar</th>",
        "Geen uitgaande relaties.")}

      <h3>Relaties — inkomend (${inn.length})</h3>
      ${tabel(
        inn.map((r) => `<tr><th>${esc(r.label.value)}</th>` +
          `<td>← ${klasseLink(r.bron.value, r.bronLabel ? r.bronLabel.value : null)}</td></tr>`),
        "<th>relatie</th><th>van</th>",
        "Geen inkomende relaties.")}
    </div>`;

  $(".detail .terug").onclick = (e) => { e.preventDefault(); toonLijst(true); };
  for (const a of document.querySelectorAll(".detail a[data-uri]")) {
    a.onclick = (e) => { e.preventDefault(); toonDetail(a.dataset.uri, true); };
  }
  for (const g of document.querySelectorAll(".graaf .knoop")) {
    g.onclick = () => toonDetail(g.dataset.uri, true);
  }
}

// ---------- routing (linked-data dereferencing) ----------

function route() {
  if (location.pathname === "/" || location.pathname.endsWith(".html")) {
    toonLijst();
    return;
  }
  const klasse = state.klassen.find((k) => k.pad === location.pathname);
  if (klasse) {
    toonDetail(klasse.uri);
  } else {
    toonStatus(
      `Geen klasse gevonden voor <code>${esc(location.pathname)}</code> in deze versie. ` +
      `<a href="/">Naar het overzicht</a>.`, true);
    toonLijst();
  }
}

window.addEventListener("popstate", route);

$("#search").addEventListener("input", (e) => {
  state.term = e.target.value;
  if (location.pathname !== "/") history.pushState(null, "", "/");
  toonLijst();
});

init();
