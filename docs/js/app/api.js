/* VICTOR app: Programmatic access: load data and read results by a #json= link, window.postMessage or window.VICTOR.api. */
import { C, VICTOR, VIZ_TITLES, global } from "./config.js";
import { state } from "./state.js";
import { $ } from "./dom.js";
import { activePairs, addNetwork, addParsedClusterSet, compare, refresh, setActiveNetwork } from "./data.js";
import { renderMetricList } from "./view-compare.js";
import { showTab } from "./main.js";

export var API_VERSION = "1.0";
var TAB_NAMES = { home: "home", files: "files", load: "files", compare: "compare", plots: "visualize", visualize: "visualize", quality: "quality", network: "quality" };

function fail(message) { throw new Error(message); }
function text(value) { return String(value === null || value === undefined ? "" : value).trim(); }

// "clusters" of one set as [{ name, members }], from an object, a list or VICTOR's text format
function clustersFrom(spec, label) {
  if (typeof spec.text === "string") return C.parseClusterFile(spec.text).clusters;
  var given = spec.clusters, list = [];
  if (Array.isArray(given)) {
    given.forEach(function (c) { list.push({ name: text(c && c.name), members: c && c.members }); });
  } else if (given && typeof given === "object") {
    Object.keys(given).forEach(function (name) { list.push({ name: text(name), members: given[name] }); });
  } else {
    fail(label + ' needs "clusters" (an object or a list) or "text".');
  }
  var names = new Set(), out = [];
  list.forEach(function (c, k) {
    if (!Array.isArray(c.members)) fail(label + ", cluster " + (k + 1) + ': "members" must be a list.');
    var seen = new Set(), members = [];
    c.members.forEach(function (m) { m = text(m); if (m && !seen.has(m)) { seen.add(m); members.push(m); } });
    if (members.length === 0) return;
    var name = c.name || "cluster" + (k + 1);
    while (names.has(name)) name += "_";
    names.add(name);
    out.push({ name: name, members: members });
  });
  if (out.length === 0) fail(label + " has no clusters with members.");
  return out;
}

// A network as the tab-separated text that the edge-list parser reads
function networkTextFrom(spec, label) {
  if (typeof spec.text === "string") return spec.text;
  if (!Array.isArray(spec.edges)) fail(label + ' needs "edges" (a list) or "text".');
  var clean = function (v) { return text(v).replace(/\t/g, " "); };
  return spec.edges.map(function (e, k) {
    if (!e || text(e.source) === "" || text(e.target) === "") fail(label + ", edge " + (k + 1) + ': needs "source" and "target".');
    return clean(e.source) + "\t" + clean(e.target) + (e.weight === undefined || e.weight === null ? "" : "\t" + Number(e.weight));
  }).join("\n");
}

// Replaces what is loaded with the payload. Everything is checked before the current data is touched.
// Returns a summary: { clusterSets, networks, objects, ready, message }.
export function loadPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) fail("The payload must be a JSON object.");
  var setSpecs = payload.clusterSets || [], netSpecs = payload.networks || [];
  if (!Array.isArray(setSpecs) || !Array.isArray(netSpecs)) fail('"clusterSets" and "networks" must be lists.');
  if (setSpecs.length === 0 && netSpecs.length === 0) fail('The payload needs "clusterSets" (and optionally "networks").');
  var sets = setSpecs.map(function (spec, k) {
    var label = "Cluster set " + (k + 1);
    if (!spec || typeof spec !== "object") fail(label + " must be an object.");
    return { name: text(spec.name) || "Set " + (k + 1), clusters: clustersFrom(spec, label) };
  });
  var networks = netSpecs.map(function (spec, k) {
    var label = "Network " + (k + 1);
    if (!spec || typeof spec !== "object") fail(label + " must be an object.");
    var parsedText = networkTextFrom(spec, label);
    C.parseEdgeList(parsedText); // throws with a readable message when the edges are unusable
    return { name: text(spec.name) || "Network " + (k + 1), text: parsedText };
  });
  var metrics = null;
  if (payload.metrics !== undefined) {
    if (!Array.isArray(payload.metrics)) fail('"metrics" must be a list of metric codes.');
    var unknown = payload.metrics.filter(function (code) { return !C.metricByCode(code); });
    if (unknown.length) fail("Unknown metric code(s): " + unknown.join(", ") + ". Known codes: " + C.METRICS.map(function (m) { return m.code; }).join(", ") + ".");
    metrics = payload.metrics.slice();
  }
  var filter = payload.filter === undefined ? "none" : payload.filter;
  if (["none", "intersection", "superset"].indexOf(filter) < 0) fail('"filter" must be "none", "intersection" or "superset".');
  if (payload.tab !== undefined && !TAB_NAMES[payload.tab]) fail('"tab" must be one of: ' + Object.keys(TAB_NAMES).join(", ") + ".");
  if (payload.plot !== undefined && !VIZ_TITLES[payload.plot]) fail('"plot" must be one of: ' + Object.keys(VIZ_TITLES).join(", ") + ".");

  // the payload is valid: replace the current data
  state.sets = [];
  state.networks = [];
  state.approvedSeconds = 0;
  state.sizeMin = Math.max(1, Math.floor(+payload.sizeMin || 1));
  state.sizeMaxTouched = payload.sizeMax !== undefined;
  if (state.sizeMaxTouched) state.sizeMax = Math.max(1, Math.floor(+payload.sizeMax || 1));
  state.filterMode = filter;
  state.viz.threshold = null;
  sets.forEach(function (s) { addParsedClusterSet(s.name, s.clusters, []); });
  networks.forEach(function (n) { addNetwork(n.name, n.text); });
  if (networks.length) setActiveNetwork(state.networks[0].id);
  if (metrics) { state.metrics = metrics; renderMetricList(); }
  state.compareMode = payload.reference !== undefined ? "reference" : "all";
  if (payload.reference !== undefined) {
    var ref = state.sets.filter(function (s) { return s.name === text(payload.reference); })[0];
    if (ref) state.referenceId = ref.id;
  }
  if (payload.plot) state.viz.kind = payload.plot;
  if (payload.theme === "light" || payload.theme === "dark") document.documentElement.setAttribute("data-theme", payload.theme);
  refresh();
  if (payload.metric && state.result && state.result.codes.indexOf(payload.metric) >= 0) state.viz.metric = payload.metric;
  showTab(TAB_NAMES[payload.tab] || (state.result ? "compare" : state.sets.length ? "files" : "quality"));
  return {
    clusterSets: state.sets.map(function (s) { return { name: s.name, clusters: s.raw.length, objects: C.objectSet(s.raw).size }; }),
    networks: state.networks.map(function (n) { return { name: n.name, nodes: n.net.nodes.length, edges: n.net.edges.length }; }),
    ready: !!state.result,
    message: state.result ? (state.result.note || "") : state.resultError
  };
}

// The comparison that is on screen, as plain data
export function comparisonResults() {
  var r = state.result;
  if (!r) return { ready: false, message: state.resultError };
  return {
    ready: true,
    clusterSets: r.names.slice(),
    metrics: r.codes.map(function (code) { var m = C.metricByCode(code); return { code: code, label: m.label, symmetric: m.symmetric }; }),
    pairs: activePairs(r).map(function (p) {
      var values = {}, reverse = {};
      r.codes.forEach(function (code) {
        values[code] = r.matrix[code][p[0]][p[1]];
        if (!C.metricByCode(code).symmetric) reverse[code] = r.matrix[code][p[1]][p[0]];
      });
      return { first: r.names[p[0]], second: r.names[p[1]], values: values, reverse: reverse };
    }),
    matrix: r.matrix,
    skipped: (r.skipped || []).map(function (s) { return { code: s.code, reason: s.reason }; }),
    note: r.note || ""
  };
}

// Every loaded cluster set on every loaded network
export function qualityResults() {
  var rows = [];
  state.networks.forEach(function (n) {
    state.sets.forEach(function (set) {
      var g = state.qualityGrid[n.id + "|" + set.id];
      if (g) rows.push({ network: n.name, clusterSet: set.name, clusters: g.clusters, objects: g.objects, objectsInNetwork: g.inNetwork,
        modularity: g.modularity, coverage: g.coverage, medianConductance: g.medianConductance });
    });
  });
  return rows;
}

// base64url of the UTF-8 JSON text, as used after "#json="
function encodePayload(payload) {
  var bytes = new TextEncoder().encode(JSON.stringify(payload)), binary = "";
  for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return global.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodePayload(encoded) {
  var b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  var binary = global.atob(b64), bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}

// A link to this copy of VICTOR that carries the payload. The part after # is never sent to a server.
export function payloadLink(payload) {
  return global.location.href.split("#")[0] + "#json=" + encodePayload(payload);
}

function loadFromHash() {
  var match = /^#json=(.+)$/.exec(global.location.hash);
  if (!match) return;
  try {
    loadPayload(decodePayload(match[1]));
  } catch (e) {
    global.alert("The data in the link could not be loaded:\n\n" + e.message);
  }
}

// Messages from the page that opened or embeds VICTOR. Results are only returned for data the caller sent itself,
// so a page can never read what the user loaded here by hand.
function onMessage(e) {
  var allowed = e.source && (e.source === global.opener || e.source === global.parent);
  var data = e.data;
  if (!allowed || !data || typeof data.type !== "string" || data.type.indexOf("victor:") !== 0) return;
  var reply = function (message) {
    message.requestId = data.requestId;
    e.source.postMessage(message, e.origin && e.origin !== "null" ? e.origin : "*");
  };
  if (data.type === "victor:ping") {
    reply({ type: "victor:ready", api: API_VERSION });
  } else if (data.type === "victor:load" || data.type === "victor:compute") {
    try {
      var summary = loadPayload(data.payload);
      if (data.type === "victor:load") reply({ type: "victor:loaded", ok: true, summary: summary });
      else reply({ type: "victor:results", ok: true, summary: summary, comparison: comparisonResults(), quality: qualityResults() });
    } catch (err) {
      reply({ type: data.type === "victor:load" ? "victor:loaded" : "victor:results", ok: false, error: err.message });
    }
  }
}

export function initApi() {
  VICTOR.api = { version: API_VERSION, load: loadPayload, results: comparisonResults, quality: qualityResults, link: payloadLink };
  global.addEventListener("message", onMessage);
  global.addEventListener("hashchange", loadFromHash);
  loadFromHash();
  var ready = { type: "victor:ready", api: API_VERSION };
  if (global.opener) global.opener.postMessage(ready, "*");
  if (global.parent && global.parent !== global) global.parent.postMessage(ready, "*");
}

// ------- the "Try it" panel of the API tab
export var API_EXAMPLE = {
  clusterSets: [
    { name: "Method A", clusters: { c1: ["a", "b", "c"], c2: ["d", "e"], c3: ["f", "g", "h"] } },
    { name: "Method B", clusters: { k1: ["a", "b"], k2: ["c", "d", "e"], k3: ["f", "g", "h"] } },
    { name: "Method C", clusters: [{ name: "x1", members: ["a", "b", "c", "d"] }, { name: "x2", members: ["e", "f", "g", "h"] }] }
  ],
  networks: [
    { name: "Example network", edges: [
      { source: "a", target: "b" }, { source: "b", target: "c" }, { source: "a", target: "c" }, { source: "c", target: "d" },
      { source: "d", target: "e" }, { source: "e", target: "f", weight: 0.5 }, { source: "f", target: "g" }, { source: "g", target: "h" }, { source: "f", target: "h" }
    ] }
  ],
  metrics: ["adjrand", "ami", "jaccard", "bcubed_f"],
  filter: "none",
  tab: "compare"
};

function tryPayload() {
  try { return JSON.parse($("apiPayload").value); }
  catch (e) { fail("The text is not valid JSON: " + e.message); }
}

function showApiOutput(value, bad) {
  $("apiOutput").textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  $("apiOutput").className = bad ? "status-bad" : "";
}

export function initApiPanel() {
  var reset = function () { $("apiPayload").value = JSON.stringify(API_EXAMPLE, null, 2); showApiOutput("Results appear here."); };
  reset();
  $("apiReset").addEventListener("click", reset);
  $("apiLoad").addEventListener("click", function () {
    try { var payload = tryPayload(); payload.tab = payload.tab || "compare"; showApiOutput(loadPayload(payload)); }
    catch (e) { showApiOutput(e.message, true); }
  });
  $("apiCompute").addEventListener("click", function () {
    try {
      var payload = tryPayload();
      delete payload.tab; // stay on this tab to show the answer
      var summary = loadPayload(payload);
      showTab("api");
      showApiOutput({ summary: summary, comparison: comparisonResults(), quality: qualityResults() });
    } catch (e) { showApiOutput(e.message, true); }
  });
  $("apiLink").addEventListener("click", function () {
    try {
      var link = payloadLink(tryPayload());
      showApiOutput(link + "\n\n(" + link.length.toLocaleString() + " characters" + (link.length > 8000 ? "; long links may be cut by mail and chat programs" : "") + ")");
    } catch (e) { showApiOutput(e.message, true); }
  });
}
