/* VICTOR app: Event wiring, one small function per area of the interface. */
import { C, EXAMPLES, G, ORIGINAL_TEN, RECOMMENDED, global } from "./config.js";
import { state } from "./state.js";
import { $, downloadCsv, fillSelect } from "./dom.js";
import { compare, computeQuality, loadClusterFiles, loadExample, loadNetworkFile, refresh } from "./data.js";
import { clusterMatchCsvRows, comparisonCsvRows, renderMetricList } from "./view-compare.js";
import { gridCsvRows, qualityCsvRows, renderQualityGrid } from "./view-quality.js";
import { downloadNormaFiles, openInNorma } from "./norma.js";
import { initExportDialog } from "./export-dialog.js";
import { render, showTab } from "./main.js";

function on(id, type, handler) { $(id).addEventListener(type, handler); }

// A group of buttons that each carry data-<attribute>: calls handler(value) for the one clicked.
function onChoice(groupId, attribute, handler) {
  on(groupId, "click", function (e) {
    var value = e.target.getAttribute("data-" + attribute);
    if (value) handler(value);
  });
}

function onRadio(name, handler) {
  Array.prototype.forEach.call(document.querySelectorAll('input[name="' + name + '"]'), function (radio) {
    radio.addEventListener("change", function () { if (radio.checked) handler(radio.value); });
  });
}

// File picker and drag-and-drop on one drop zone
function wireDropzone(zone, onFiles) {
  ["dragenter", "dragover"].forEach(function (type) {
    zone.addEventListener(type, function (e) { e.preventDefault(); zone.classList.add("over"); });
  });
  ["dragleave", "drop"].forEach(function (type) {
    zone.addEventListener(type, function (e) { e.preventDefault(); zone.classList.remove("over"); });
  });
  zone.addEventListener("drop", function (e) { if (e.dataTransfer && e.dataTransfer.files.length) onFiles(e.dataTransfer.files); });
  var input = zone.querySelector("input");
  input.addEventListener("change", function () { if (input.files.length) onFiles(input.files); input.value = ""; });
}

function resetFilters() {
  state.sizeMin = 1;
  state.sizeMaxTouched = false;
  state.filterMode = "none";
}

var NETWORK_EXAMPLE = {
  files: ["Clustering_data1.txt", "Clustering_data2.txt", "Clustering_data3.txt"],
  networks: ["Network_file.txt", "Network_file_rewired.txt"]
};

function initNavigation() {
  Array.prototype.forEach.call($("tabs").querySelectorAll("button"), function (b) {
    b.addEventListener("click", function () { showTab(b.getAttribute("data-tab")); });
  });
}

function initHome() {
  on("homeStart", "click", function () { showTab("files"); });
  on("homeExample", "click", function () { loadExample(EXAMPLES[0].files, EXAMPLES[0]); showTab("files"); });
  on("homeNetwork", "click", function () { showTab("quality"); });
  on("homeNetworkExample", "click", function () { loadExample(NETWORK_EXAMPLE.files, NETWORK_EXAMPLE); showTab("quality"); });
  on("homeHelp", "click", function () { showTab("help"); });
}

function initLoading() {
  wireDropzone($("dropzone"), loadClusterFiles);
  wireDropzone($("networkDropzone"), loadNetworkFile);
  fillSelect($("exampleSelect"), EXAMPLES.map(function (e, k) { return [k, e.label]; }), 0);
  function chosenExample() { return EXAMPLES[+$("exampleSelect").value]; }
  function describeExample() { $("exampleDescription").textContent = chosenExample().description; }
  on("exampleSelect", "change", describeExample);
  describeExample();
  on("exampleLoad", "click", function () { loadExample(chosenExample().files, chosenExample()); });
  on("emptyExample", "click", function () { loadExample(EXAMPLES[0].files, EXAMPLES[0]); });
  on("exampleNetwork", "click", function () { loadExample(NETWORK_EXAMPLE.files, NETWORK_EXAMPLE); });
}

function initFilters() {
  on("sizeMin", "change", function () { state.sizeMin = Math.max(1, Math.floor(+this.value || 1)); refresh(); });
  on("sizeMax", "change", function () { state.sizeMax = Math.max(1, Math.floor(+this.value || 1)); state.sizeMaxTouched = true; refresh(); });
  on("dropSingletons", "click", function () { state.sizeMin = state.sizeMin >= 2 ? 1 : 2; refresh(); });
  onRadio("filterMode", function (mode) { state.filterMode = mode; refresh(); });
  on("resetFilters", "click", function () { resetFilters(); refresh(); });
}

function initSets() {
  on("selectAll", "change", function () {
    var include = this.checked;
    state.sets.forEach(function (s) { s.selected = include; });
    refresh();
  });
  on("removeAll", "click", function () {
    if (!global.confirm("Remove all " + state.sets.length + " cluster sets?")) return;
    state.sets = [];
    state.approvedSeconds = 0;
    resetFilters();
    refresh();
  });
  on("inspectSet", "change", function () { state.inspectId = +this.value; render(); });
  onChoice("inspectStage", "stage", function (stage) { state.inspectStage = stage; render(); });
}

function initCompare() {
  function setMetrics(codes) { state.metrics = codes; renderMetricList(); compare(); render(); }
  on("metricsRecommended", "click", function () { setMetrics(RECOMMENDED.slice()); });
  on("metricsDefault", "click", function () { setMetrics(ORIGINAL_TEN.slice()); });
  on("metricsAll", "click", function () { setMetrics(C.METRICS.map(function (m) { return m.code; })); });
  on("metricsNone", "click", function () { setMetrics([]); });
  onRadio("compareMode", function (mode) { state.compareMode = mode; state.viz.threshold = null; render(); });
  on("referenceSet", "change", function () { state.referenceId = +this.value; state.viz.threshold = null; render(); });
  onChoice("tableRows", "rows", function (rows) { state.tableRows = rows; render(); });
  on("downloadCsv", "click", function () { downloadCsv(comparisonCsvRows(), "victor_comparison.csv"); });
  on("matchA", "change", function () { state.matchA = +this.value; render(); });
  on("matchB", "change", function () { state.matchB = +this.value; render(); });
  on("downloadMatchCsv", "click", function () {
    var rows = clusterMatchCsvRows();
    if (rows) downloadCsv(rows, "victor_cluster_match.csv");
  });
  on("compareNetworkGo", "click", function () { showTab("quality"); });
  if (global.innerWidth < 860) $("metricDetails").open = false; // phones: results first, metric chooser folded
}

function initPlots() {
  onChoice("vizKind", "kind", function (kind) { state.viz.kind = kind; render(); });
  on("vizMetric", "change", function () { state.viz.metric = this.value; state.viz.threshold = null; render(); });
  on("vizThreshold", "input", function () { state.viz.threshold = +this.value; render(); });
  on("netLayout", "change", function () { state.viz.layout = this.value; render(); });
  on("netFit", "click", function () { G.fitNetwork($("vizChart")); });
  initExportDialog();
}

function initQuality() {
  on("qualitySet", "change", function () { state.qualityId = +this.value; computeQuality(); render(); });
  onChoice("qualityStage", "stage", function (stage) { state.qualityStage = stage; computeQuality(); render(); });
  onChoice("gridMeasure", "measure", function (measure) { state.gridMeasure = measure; renderQualityGrid(); });
  on("downloadGridCsv", "click", function () { downloadCsv(gridCsvRows(), "victor_sets_on_networks.csv"); });
  on("downloadQualityCsv", "click", function () { downloadCsv(qualityCsvRows(), "victor_cluster_quality.csv"); });
  on("graphLayout", "change", function () { state.graphLayout = this.value; render(); });
  on("graphFit", "click", function () { G.fitNetwork($("chartGraph")); });
  on("normaOpen", "click", openInNorma);
  on("normaOpenInline", "click", openInNorma);
  on("normaDownload", "click", downloadNormaFiles);
}

function initTheme() {
  function syncButton() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    $("themeToggle").textContent = dark ? "Light theme" : "Dark theme";
    $("themeToggle").setAttribute("aria-pressed", dark ? "true" : "false");
  }
  on("themeToggle", "click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { global.localStorage.setItem("victor-theme", next); } catch (e) { /* not remembered without storage */ }
    syncButton();
    render();
  });
  syncButton();
}

function initWindow() {
  var resizeTimer = null;
  global.addEventListener("resize", function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 150); });
}

export function initEvents() {
  initNavigation();
  initHome();
  initLoading();
  initFilters();
  initSets();
  initCompare();
  initPlots();
  initQuality();
  initTheme();
  initWindow();
}
