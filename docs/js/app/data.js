/* VICTOR app: Data flow: loading files and examples, filters, the comparison, networks and their quality numbers. */
import { C, CONFIRM_ABOVE_SECONDS, MAX_FILE_BYTES, VICTOR, global } from "./config.js";
import { selectedSets, setById, state } from "./state.js";
import { renderMetricList } from "./view-compare.js";
import { render } from "./main.js";

export function uniqueName(name, exceptId) {
  var taken = new Set();
  state.sets.forEach(function (s) { if (s.id !== exceptId) taken.add(s.name); });
  if (!taken.has(name)) return name;
  var k = 2;
  while (taken.has(name + " (" + k + ")")) k++;
  return name + " (" + k + ")";
}

export function addClusterSet(fileName, text) {
  var parsed = C.parseClusterFile(text);
  var name = uniqueName(fileName.replace(/\.(txt|tsv|tab|csv)$/i, ""));
  var set = {
    id: state.nextId++, name: name, raw: parsed.clusters, filtered: parsed.clusters, selected: true,
    overlapping: C.overlappingObjects(parsed.clusters).length, warnings: parsed.warnings
  };
  state.sets.push(set);
  return set;
}

// Applies the size range, then the intersection / superset option, to the selected sets.
export function applyFilters() {
  var largest = 1;
  state.sets.forEach(function (s) { largest = Math.max(largest, C.maxClusterSize(s.raw)); });
  if (!state.sizeMaxTouched || state.sizeMax > largest) state.sizeMax = largest;
  state.sizeMin = Math.max(1, Math.min(state.sizeMin, state.sizeMax));
  state.sets.forEach(function (s) {
    s.filtered = s.selected ? C.filterBySize(s.raw, state.sizeMin, state.sizeMax) : s.raw;
  });
  var chosen = selectedSets();
  if (chosen.length > 1 && state.filterMode !== "none") {
    var lists = chosen.map(function (s) { return s.filtered; });
    var out = state.filterMode === "intersection" ? C.intersectionFilter(lists) : C.supersetFilter(lists);
    chosen.forEach(function (s, i) { s.filtered = out[i]; });
  }
}

export function compare() {
  state.result = null;
  state.resultError = "";
  var chosen = selectedSets();
  if (chosen.length < 2) { state.resultError = "Tick at least two cluster sets in step 1 (Load & prepare)."; return; }
  if (state.metrics.length === 0) { state.resultError = "Choose at least one metric."; return; }
  state.pending = null;
  var objects = 0;
  chosen.forEach(function (s) { objects = Math.max(objects, C.countObjects(s.filtered)); });
  var seconds = C.estimateSeconds(chosen.length, objects);
  if (seconds > CONFIRM_ABOVE_SECONDS && seconds > state.approvedSeconds) {
    state.pending = { seconds: seconds };
    state.resultError = "This is a large comparison: " + chosen.length + " sets of up to " + objects.toLocaleString() +
      " objects, roughly " + Math.ceil(seconds) + " seconds during which the page will not respond.";
    return;
  }
  try {
    var codes = C.METRICS.map(function (m) { return m.code; }).filter(function (c) { return state.metrics.indexOf(c) >= 0; });
    state.result = C.compareAll(chosen.map(function (s) { return { name: s.name, clusters: s.filtered }; }), codes);
    state.result.ids = chosen.map(function (s) { return s.id; });
    if (state.result.codes.length === 0) { state.result = null; state.resultError = "Choose at least one metric."; }
  } catch (e) {
    state.resultError = e.message;
  }
  if (state.result) {
    if (state.result.codes.indexOf(state.viz.metric) < 0) { state.viz.metric = state.result.codes[0]; state.viz.threshold = null; }
    if (state.result.ids.indexOf(state.matchA) < 0) state.matchA = state.result.ids[0];
    if (state.result.ids.indexOf(state.matchB) < 0 || state.matchB === state.matchA) {
      state.matchB = state.result.ids.filter(function (id) { return id !== state.matchA; })[0];
    }
  }
}

export function addNetwork(name, text) {
  var net = C.parseEdgeList(text), base = name.replace(/\.(txt|tsv|tab|csv)$/i, ""), unique = base, k = 2;
  while (state.networks.some(function (n) { return n.name === unique; })) unique = base + " (" + (k++) + ")";
  var entry = { id: state.nextId++, name: unique, net: net };
  state.networks.push(entry);
  setActiveNetwork(entry.id);
  return entry;
}

export function setActiveNetwork(id) {
  var entry = state.networks.filter(function (n) { return n.id === id; })[0] || state.networks[0] || null;
  state.networkId = entry ? entry.id : null;
  state.network = entry ? entry.net : null;
  state.networkName = entry ? entry.name : "";
}

// One line of numbers for a cluster set on a network
export function summarizeQuality(q, set) {
  var cond = q.rows.map(function (r) { return r.conductance; }).filter(function (v) { return v !== null; }).sort(function (a, b) { return a - b; });
  var inNetwork = 0, objects = 0;
  q.rows.forEach(function (r) { inNetwork += r.inNetwork; objects += r.objects; });
  return { id: set.id, name: set.name, clusters: q.rows.length, inNetwork: inNetwork, objects: objects,
    found: objects > 0 ? inNetwork / objects : null,
    modularity: q.modularity, coverage: q.coverage, medianConductance: cond.length ? cond[Math.floor((cond.length - 1) / 2)] : null };
}

export function computeQuality() {
  state.quality = null;
  state.qualityAll = [];
  state.qualityGrid = {};
  setActiveNetwork(state.networkId);
  var set = setById(state.qualityId);
  if (!state.network || !set) return;
  // every loaded cluster set on every loaded network
  state.networks.forEach(function (n) {
    state.sets.forEach(function (other) {
      var clusters = state.qualityStage === "raw" ? other.raw : other.filtered, q = C.clusterQuality(n.net, clusters);
      state.qualityGrid[n.id + "|" + other.id] = summarizeQuality(q, other);
      if (n.id === state.networkId && other === set) { state.quality = q; state.quality.clusters = clusters; }
    });
  });
  state.qualityAll = state.sets.map(function (other) { return state.qualityGrid[state.networkId + "|" + other.id]; });
}

// Everything downstream of a change in files, selection or filters
export function refresh() {
  applyFilters();
  if (state.inspectId === null || !setById(state.inspectId)) state.inspectId = state.sets.length ? state.sets[0].id : null;
  if (state.qualityId === null || !setById(state.qualityId)) state.qualityId = state.sets.length ? state.sets[0].id : null;
  compare();
  computeQuality();
  render();
}

// The pairs the user asked for, as [first, second] indexes into the result: every pair, or the reference set
// against each of the others (the reference comes first, which is what the asymmetric metrics expect).
export function activePairs(r) {
  var pairs = [], i, j;
  if (state.compareMode === "reference" && r.names.length > 2) {
    var ref = Math.max(0, r.ids.indexOf(state.referenceId));
    for (j = 0; j < r.names.length; j++) if (j !== ref) pairs.push([ref, j]);
  } else {
    for (i = 0; i < r.names.length; i++) for (j = i + 1; j < r.names.length; j++) pairs.push([i, j]);
  }
  return pairs;
}

export function pairList() {
  var r = state.result, m = r.matrix[state.viz.metric];
  return activePairs(r).map(function (p) { return { i: p[0], j: p[1], value: m[p[0]][p[1]] }; });
}

export function readFiles(fileList, handler, done) {
  var files = Array.prototype.slice.call(fileList), errors = [], pending = files.length;
  if (!pending) return;
  files.forEach(function (file) {
    if (file.size > MAX_FILE_BYTES) { // a huge file would freeze the tab while it is parsed
      errors.push(file.name + ": larger than " + Math.round(MAX_FILE_BYTES / 1048576) + " MB.");
      if (--pending === 0) done(errors);
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      try { handler(file.name, String(reader.result)); } catch (e) { errors.push(file.name + ": " + e.message); }
      if (--pending === 0) done(errors);
    };
    reader.onerror = function () { errors.push(file.name + ": could not be read."); if (--pending === 0) done(errors); };
    reader.readAsText(file);
  });
}

export function loadClusterFiles(fileList) {
  readFiles(fileList, addClusterSet, function (errors) {
    refresh();
    if (errors.length) global.alert("Some files could not be loaded:\n\n" + errors.join("\n"));
  });
}

export function loadNetworkFile(fileList) {
  readFiles(fileList, addNetwork, function (errors) {
    refresh();
    if (errors.length) global.alert("Some networks could not be loaded:\n\n" + errors.join("\n"));
  });
}

export function loadExample(files, opts) {
  opts = opts || {};
  state.sets = [];
  state.approvedSeconds = 0;
  state.sizeMin = 1;
  state.sizeMaxTouched = false;
  state.filterMode = opts.filterMode || "none";
  state.viz.threshold = null;
  files.forEach(function (f) { addClusterSet(f, VICTOR.examples[f]); });
  if (opts.metrics) { // make sure the metrics the example is about are ticked
    opts.metrics.forEach(function (code) { if (state.metrics.indexOf(code) < 0) state.metrics.push(code); });
    renderMetricList();
  }
  if (opts.networks) {
    state.networks = [];
    opts.networks.forEach(function (f) { addNetwork(f, VICTOR.examples[f]); });
    setActiveNetwork(state.networks[0].id);
  }
  refresh();
}
