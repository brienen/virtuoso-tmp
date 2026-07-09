"use strict";

// Domeinindeling van het GGM — NIET verzonnen, maar afgeleid uit de
// package-boom van het bronmodel (crunch_uml). De LOD-export is plat (elke
// klasse-URI is .../<deelmodel>/<klasse>); dit bestand koppelt elk deelmodel
// (URI-segment) aan zijn IV3-domein zoals dat in het model staat, plus de
// modelvolgorde en een kleur per domein. Gedeeld door de verkenner (app.js) en
// de LOD-cloud (cloud.html); index.html laadt dit vóór app.js.
//
// Regenereren uit het model (GGM-repo):
//   sqlite3 crunch_uml.db "<recursive package-boom query>"  (zie GGM-README)
// URI-segment = pakketnaam zonder 'Model '-prefix, lowercase.
// TODO (netter): dit als triples mee-exporteren in de LOD, dan is het
// data-gedreven i.p.v. afgeleid.

const DOMEIN_MAP = {
  "aanvragen en meldingen": "Volkshuisvesting, Leefomgeving en Stedelijke Vernieuwing",
  "afval": "Volksgezondheid en Milieu",
  "archeologie": "Sport, Cultuur en Recreatie",
  "archief": "Sport, Cultuur en Recreatie",
  "bag": "Kern",
  "beheer openbare ruimte": "Volkshuisvesting, Leefomgeving en Stedelijke Vernieuwing",
  "complex datatype": "Kern",
  "dak- en thuislozen": "Sociaal Domein",
  "datatypes": "Sociaal Domein",
  "diagram": "Sport, Cultuur en Recreatie",
  "diensten": "Sociaal Domein",
  "dienstverlening": "Dienstverlening",
  "economie": "Economie",
  "erfgoed generiek": "Sport, Cultuur en Recreatie",
  "financien": "Interne Organisatie",
  "gemeentebegrafenissen": "Sociaal Domein",
  "generiek": "Kern",
  "griffie": "Bestuur, Politiek en Ondersteuning",
  "groepattribuutsoort": "Kern",
  "hr": "Interne Organisatie",
  "ict": "Interne Organisatie",
  "imbor": "Volkshuisvesting, Leefomgeving en Stedelijke Vernieuwing",
  "inburgering": "Sociaal Domein",
  "inkomen": "Sociaal Domein",
  "inkomsten": "Sociaal Domein",
  "inkoop": "Interne Organisatie",
  "jeugd en wmo generiek": "Sociaal Domein",
  "jeugdbescherming": "Sociaal Domein",
  "kern rgbz": "Kern",
  "kern rsgb": "Kern",
  "leerplicht en leerlingenvervoer": "Onderwijs",
  "metagegevens": "Kern",
  "mobiliteit": "Verkeer, Vervoer en Waterstaat",
  "monumenten": "Sport, Cultuur en Recreatie",
  "musea": "Sport, Cultuur en Recreatie",
  "normafwijking": "Sociaal Domein",
  "officiele publicaties": "Volkshuisvesting, Leefomgeving en Stedelijke Vernieuwing",
  "omgevingswet": "Volkshuisvesting, Leefomgeving en Stedelijke Vernieuwing",
  "onderwijs": "Onderwijs",
  "organisatie": "Interne Organisatie",
  "parkeren": "Verkeer, Vervoer en Waterstaat",
  "reden aanvraag": "Sociaal Domein",
  "referentielijsten": "Kern",
  "relatieklasse": "Kern",
  "schuldhulpverlening": "Sociaal Domein",
  "semantische relaties": "Kern",
  "sociaal domein generiek": "Sociaal Domein",
  "sociale teams": "Sociaal Domein",
  "sport": "Sport, Cultuur en Recreatie",
  "subsidies": "Interne Organisatie",
  "tekenwijze": "Kern",
  "terug- en invordering": "Sociaal Domein",
  "toepasbare regels": "Volkshuisvesting, Leefomgeving en Stedelijke Vernieuwing",
  "union": "Kern",
  "vastgoed": "Interne Organisatie",
  "vermogen": "Sociaal Domein",
  "view (zaak)objecten": "Kern",
  "view betrokkene": "Kern",
  "vroegsignalering": "Sociaal Domein",
  "vth": "Veiligheid en Vergunningen",
  "werk": "Sociaal Domein",
  "wonen": "Volkshuisvesting, Leefomgeving en Stedelijke Vernieuwing",
};

// Volgorde zoals in het model (numeriek prefix 0..10, Kern = 99).
const HOOFDDOMEIN_VOLGORDE = [
  "Bestuur, Politiek en Ondersteuning",
  "Veiligheid en Vergunningen",
  "Verkeer, Vervoer en Waterstaat",
  "Economie",
  "Onderwijs",
  "Sport, Cultuur en Recreatie",
  "Sociaal Domein",
  "Volksgezondheid en Milieu",
  "Volkshuisvesting, Leefomgeving en Stedelijke Vernieuwing",
  "Interne Organisatie",
  "Dienstverlening",
  "Kern",
  "Overig",
];

// Kleur per domein: [achtergrond, tekst]. Gebruikt door de relatiegraaf en de cloud.
const HOOFDDOMEIN_KLEUR = {
  "Bestuur, Politiek en Ondersteuning": ["#e8ebf1", "#3a4a63"],
  "Veiligheid en Vergunningen": ["#f6e6e6", "#9c3a3a"],
  "Verkeer, Vervoer en Waterstaat": ["#e0eeec", "#1f6b6b"],
  "Economie": ["#f3ecda", "#8a6a1a"],
  "Onderwijs": ["#e7e6f3", "#463a8f"],
  "Sport, Cultuur en Recreatie": ["#f5e7ea", "#9c3a58"],
  "Sociaal Domein": ["#e6f0e8", "#2f6b3a"],
  "Volksgezondheid en Milieu": ["#edf0df", "#5c6b1a"],
  "Volkshuisvesting, Leefomgeving en Stedelijke Vernieuwing": ["#f1e8da", "#8a5a1a"],
  "Interne Organisatie": ["#e2eef4", "#2e6f9e"],
  "Dienstverlening": ["#efe6ef", "#7a4a7a"],
  "Kern": ["#e7ecf1", "#1f4e79"],
  "Overig": ["#eceef0", "#57606a"],
};

function hoofddomeinVan(deelmodel) {
  return DOMEIN_MAP[deelmodel] || "Overig";
}
