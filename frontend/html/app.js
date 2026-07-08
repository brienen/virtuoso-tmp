"use strict";

// Generieke verkenner voor het GGM in Virtuoso.
// Werkt zonder configuratie: versies worden ontdekt via de named graphs
// (alles onder .../graph/), klassen via owl:Class in de gekozen graph.

const ENDPOINT = "/sparql";

const PREFIXES = `
PREFIX owl:  <http://www.w3.org/2002/07/owl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
`;

const state = {
  graphs: [],   // {uri, naam, triples}
  graph: null,  // gekozen graph-URI
  klassen: [],  // {uri, label, definitie, domein, pad}
  domein: null, // actief domeinfilter
  term: "",     // zoekterm
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
  renderDomeinen();
}

// ---------- lijstweergave ----------

function renderDomeinen() {
  const telling = new Map();
  for (const k of state.klassen) {
    telling.set(k.domein, (telling.get(k.domein) || 0) + 1);
  }
  const domeinen = [...telling.keys()].sort((a, b) => a.localeCompare(b));

  const li = (naam, aantal, waarde) =>
    `<li><button data-domein="${esc(waarde ?? "")}" class="${state.domein === waarde ? "actief" : ""}">
       <span>${esc(naam)}</span><span class="aantal">${aantal}</span></button></li>`;

  $("#domain-list").innerHTML =
    li("Alle domeinen", state.klassen.length, null) +
    domeinen.map((d) => li(d || "(zonder domein)", telling.get(d), d)).join("");

  for (const btn of document.querySelectorAll("#domain-list button")) {
    btn.onclick = () => {
      state.domein = btn.dataset.domein || null;
      renderDomeinen();
      toonLijst(true);
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
    `<p class="telling">${lijst.length} van ${state.klassen.length} klassen</p>` +
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

// ---------- detailweergave ----------

async function toonDetail(uri, push = false) {
  const klasse = state.klassen.find((k) => k.uri === uri);
  if (!klasse) { toonLijst(); return; }
  if (push) history.pushState(null, "", klasse.pad);

  $("#content").innerHTML = `<div class="detail"><p>Laden…</p></div>`;

  const [attrs, uit, inn] = await Promise.all([
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
  ]);

  const klasseLink = (u, lbl) => {
    const bekend = state.klassen.find((k) => k.uri === u);
    const naam = lbl || (bekend ? bekend.label : decodeURIComponent(padVan(u).split("/").pop()));
    return bekend
      ? `<a href="${esc(bekend.pad)}" data-uri="${esc(u)}">${esc(naam)}</a>`
      : esc(naam);
  };

  const xsdNaam = (u) => (u || "").split(/[#/]/).pop();

  const tabel = (rijen, kop, leeg) => rijen.length
    ? `<table><thead><tr>${kop}</tr></thead><tbody>${rijen.join("")}</tbody></table>`
    : `<p class="leeg">${leeg}</p>`;

  $("#content").innerHTML = `
    <div class="detail">
      <a href="/" class="terug">← Alle klassen</a>
      <h2>${esc(klasse.label)}</h2>
      <span class="domein-chip">${esc(klasse.domein)}</span>
      <p class="uri"><code>${esc(uri)}</code></p>
      ${klasse.definitie ? `<p class="definitie">${esc(klasse.definitie)}</p>` : ""}

      <h3>Attributen (${attrs.length})</h3>
      ${tabel(
        attrs.map((r) => `<tr><th>${esc(r.label.value)}</th>` +
          `<td>${esc(xsdNaam(r.range?.value))}</td>` +
          `<td>${esc(r.definitie?.value || "")}</td></tr>`),
        "<th>naam</th><th>type</th><th>definitie</th>",
        "Geen attributen.")}

      <h3>Relaties — uitgaand (${uit.length})</h3>
      ${tabel(
        uit.map((r) => `<tr><th>${esc(r.label.value)}</th>` +
          `<td>→ ${klasseLink(r.doel.value, r.doelLabel?.value)}</td></tr>`),
        "<th>relatie</th><th>naar</th>",
        "Geen uitgaande relaties.")}

      <h3>Relaties — inkomend (${inn.length})</h3>
      ${tabel(
        inn.map((r) => `<tr><th>${esc(r.label.value)}</th>` +
          `<td>← ${klasseLink(r.bron.value, r.bronLabel?.value)}</td></tr>`),
        "<th>relatie</th><th>van</th>",
        "Geen inkomende relaties.")}
    </div>`;

  $(".detail .terug").onclick = (e) => { e.preventDefault(); toonLijst(true); };
  for (const a of document.querySelectorAll(".detail a[data-uri]")) {
    a.onclick = (e) => { e.preventDefault(); toonDetail(a.dataset.uri, true); };
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
