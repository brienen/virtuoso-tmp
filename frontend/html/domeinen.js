"use strict";

// Gedeelde curated domein-indeling voor de verkenner én de LOD-cloud.
// De LOD-export bevat geen deelmodel-hiërarchie; deze mapping groepeert de
// deelmodellen (het eerste pad-segment) onder een hoofddomein. Handmatig
// onderhouden: pas aan/vul aan; onbekende deelmodellen vallen onder "Overig".
// Dit bestand wordt geladen vóór app.js (index.html) en door cloud.html.

const DOMEIN_MAP = {
  "kern rsgb": "Kern", "kern rgbz": "Kern", "bag": "Kern", "generiek": "Kern",
  "werk": "Sociaal domein", "inkomen": "Sociaal domein", "inkomsten": "Sociaal domein",
  "inburgering": "Sociaal domein", "jeugd en wmo generiek": "Sociaal domein",
  "jeugdbescherming": "Sociaal domein", "schuldhulpverlening": "Sociaal domein",
  "sociaal domein generiek": "Sociaal domein", "sociale teams": "Sociaal domein",
  "leerplicht en leerlingenvervoer": "Sociaal domein", "onderwijs": "Sociaal domein",
  "dak- en thuislozen": "Sociaal domein", "vroegsignalering": "Sociaal domein",
  "reden aanvraag": "Sociaal domein", "gemeentebegrafenissen": "Sociaal domein",
  "vastgoed": "Fysiek domein", "vth": "Fysiek domein", "omgevingswet": "Fysiek domein",
  "beheer openbare ruimte": "Fysiek domein", "imbor": "Fysiek domein",
  "archeologie": "Fysiek domein", "monumenten": "Fysiek domein",
  "erfgoed generiek": "Fysiek domein", "wonen": "Fysiek domein",
  "mobiliteit": "Fysiek domein", "parkeren": "Fysiek domein", "afval": "Fysiek domein",
  "toepasbare regels": "Fysiek domein",
  "hr": "Bedrijfsvoering", "ict": "Bedrijfsvoering", "financien": "Bedrijfsvoering",
  "inkoop": "Bedrijfsvoering", "archief": "Bedrijfsvoering", "griffie": "Bedrijfsvoering",
  "terug- en invordering": "Bedrijfsvoering", "vermogen": "Bedrijfsvoering",
  "subsidies": "Bedrijfsvoering", "organisatie": "Bedrijfsvoering", "economie": "Bedrijfsvoering",
  "dienstverlening": "Dienstverlening", "diensten": "Dienstverlening",
  "aanvragen en meldingen": "Dienstverlening", "officiele publicaties": "Dienstverlening",
  "musea": "Cultuur & sport", "sport": "Cultuur & sport",
  "groepattribuutsoort": "Technisch", "referentielijsten": "Technisch",
  "complex datatype": "Technisch", "datatypes": "Technisch", "diagram": "Technisch",
  "normafwijking": "Technisch", "relatieklasse": "Technisch", "union": "Technisch",
  "tekenwijze": "Technisch", "metagegevens": "Technisch", "semantische relaties": "Technisch",
  "view (zaak)objecten": "Technisch", "view betrokkene": "Technisch",
};

const HOOFDDOMEIN_VOLGORDE = [
  "Kern", "Sociaal domein", "Fysiek domein", "Bedrijfsvoering",
  "Dienstverlening", "Cultuur & sport", "Overig", "Technisch",
];

// Kleur per hoofddomein: [achtergrond, tekst]. Ook gebruikt door de relatiegraaf
// en de LOD-cloud.
const HOOFDDOMEIN_KLEUR = {
  "Kern": ["#e7ecf1", "#1f4e79"],
  "Sociaal domein": ["#e6f0e8", "#2f6b3a"],
  "Fysiek domein": ["#f1e9da", "#8a5a1a"],
  "Bedrijfsvoering": ["#e0eeec", "#1f6b6b"],
  "Dienstverlening": ["#efe6ef", "#7a4a7a"],
  "Cultuur & sport": ["#f5e7ea", "#9c3a58"],
  "Overig": ["#eceef0", "#57606a"],
  "Technisch": ["#eceef0", "#57606a"],
};

function hoofddomeinVan(deelmodel) {
  return DOMEIN_MAP[deelmodel] || "Overig";
}
