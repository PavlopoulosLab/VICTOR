/* VICTOR app: Step 2, Compare: metric chooser, results table, network summary, cluster matching. */
import { C, G, global } from "./config.js";
import { setById, state } from "./state.js";
import { $, bold, el, empty, fillSelect, linkTo, setNotice, setPressed } from "./dom.js";
import { activePairs, compare } from "./data.js";
import { infoButton } from "./info.js";
import { notRunParts, skippedText } from "./view-files.js";
import { renderSetQualityTable } from "./view-quality.js";
import { render } from "./main.js";

export function renderMetricList() {
  var box = $("metricList"), groups = {};
  $("metricCount").textContent = state.metrics.length + " selected";
  empty(box);
  C.METRICS.forEach(function (m) { (groups[m.group] = groups[m.group] || []).push(m); });
  Object.keys(groups).forEach(function (g) {
    var wrap = el("div", { class: "metric-group" });
    wrap.appendChild(el("h3", null, g));
    groups[g].forEach(function (m) {
      var label = el("label", { class: "check" }), cb = el("input", { type: "checkbox", value: m.code });
      cb.checked = state.metrics.indexOf(m.code) >= 0;
      cb.addEventListener("change", function () {
        if (cb.checked) state.metrics.push(m.code); else state.metrics = state.metrics.filter(function (c) { return c !== m.code; });
        $("metricCount").textContent = state.metrics.length + " selected";
        compare();
        render();
      });
      label.appendChild(cb);
      label.appendChild(el("span", null, m.label + (m.symmetric ? "" : " *")));
      var row = el("div", { class: "metric-row" });
      row.appendChild(label);
      row.appendChild(infoButton(m.code));
      wrap.appendChild(row);
    });
    box.appendChild(wrap);
  });
  box.appendChild(el("p", { class: "hint" }, "* asymmetric: in \"A vs B\", A is the reference."));
}

export function renderCompare() {
  var r = state.result, msg = $("compareMessage");
  $("compareBody").hidden = !r;
  if (!r) {
    setNotice(msg, state.sets.length ? "warn" : "", (state.sets.length ? notRunParts() : ["Load cluster set files first. "]).concat([linkTo("files", "Go to step 1")]));
    return;
  }
  if (r.ids.indexOf(state.referenceId) < 0) state.referenceId = r.ids[0];
  fillSelect($("referenceSet"), r.ids.map(function (id, k) { return [id, "Reference: " + r.names[k]]; }), state.referenceId);
  $("referenceSet").hidden = state.compareMode !== "reference";
  var nPairs = activePairs(r).length;
  var caveats = (r.note ? r.note + " " : "") + skippedText(r);
  setNotice(msg, caveats ? "warn" : "good", [bold(r.names.length + " cluster sets, " + nPairs + " pair" + (nPairs > 1 ? "s" : "") + ", " + r.codes.length + " metric" + (r.codes.length > 1 ? "s" : "") + ". "),
    caveats, linkTo("visualize", "Plot these results \u2192", "btn small primary")]);

  var pairs = activePairs(r);
  renderCompareSummary(r, pairs);
  renderResultsTable(r, pairs);
  renderNetworkBridge(r);
  renderClusterMatch(r);
}

function pairLabel(r, p) { return r.names[p[0]] + " vs " + r.names[p[1]]; }

// Headline: the most and the least similar pair by the metric shown in the plots.
function renderCompareSummary(r, pairs) {
  var headline = r.codes.indexOf(state.viz.metric) >= 0 ? state.viz.metric : r.codes[0], summary = $("compareSummary");
  empty(summary);
  if (pairs.length > 1) {
    var ranked = pairs.slice().sort(function (a, b) { return r.matrix[headline][b[0]][b[1]] - r.matrix[headline][a[0]][a[1]]; });
    var top = ranked[0], bottom = ranked[ranked.length - 1];
    [document.createTextNode("By " + C.metricByCode(headline).label + ", the most similar pair is "), bold(pairLabel(r, top)),
      document.createTextNode(" (" + G.fmt(r.matrix[headline][top[0]][top[1]]) + ") and the least similar is "), bold(pairLabel(r, bottom)),
      document.createTextNode(" (" + G.fmt(r.matrix[headline][bottom[0]][bottom[1]]) + ").")].forEach(function (n) { summary.appendChild(n); });
  } else {
    summary.appendChild(document.createTextNode(pairLabel(r, pairs[0]) + ": " + r.codes.length + " metric" + (r.codes.length > 1 ? "s" : "") + " below."));
  }
}

// The table of values, with metrics or pairs as rows and one colour scale per metric.
function renderResultsTable(r, pairs) {
  var table = $("resultsTable");
  var cellsOf = {}, anyAsym = false;
  r.codes.forEach(function (code) {
    var def = C.metricByCode(code), values = pairs.map(function (p) { return r.matrix[code][p[0]][p[1]]; });
    var color = G.sequential(Math.min.apply(null, values), Math.max.apply(null, values));
    if (!def.symmetric) anyAsym = true;
    cellsOf[code] = pairs.map(function (p, k) {
      return function () {
        var td = el("td", { class: "val" }, G.fmt(values[k]));
        if (pairs.length > 1) { var bg = color(values[k]); td.style.background = bg; td.style.color = G.readableOn(bg); }
        if (!def.symmetric) td.title = r.names[p[1]] + " vs " + r.names[p[0]] + ": " + G.fmt(r.matrix[code][p[1]][p[0]]);
        return td;
      };
    });
  });
  var rowsAre = state.tableRows || (pairs.length > r.codes.length || global.innerWidth < 700 ? "pairs" : "metrics");
  setPressed($("tableRows"), "rows", rowsAre);
  empty(table);
  var thead = el("thead"), hr = el("tr"), tbody = el("tbody");
  if (rowsAre === "metrics") {
    hr.appendChild(el("th", null, "Metric"));
    pairs.forEach(function (p) { hr.appendChild(el("th", { class: "num" }, pairLabel(r, p))); });
    r.codes.forEach(function (code) {
      var def = C.metricByCode(code), tr = el("tr"), head = el("td", null, def.label + (def.symmetric ? "" : " *"));
      head.appendChild(infoButton(code));
      tr.appendChild(head);
      cellsOf[code].forEach(function (make) { tr.appendChild(make()); });
      tbody.appendChild(tr);
    });
  } else {
    hr.appendChild(el("th", null, "Pair"));
    r.codes.forEach(function (code) {
      var def = C.metricByCode(code);
      var th = el("th", { class: "num metric-head" }, def.label + (def.symmetric ? "" : " *"));
      th.appendChild(infoButton(code));
      hr.appendChild(th);
    });
    pairs.forEach(function (p, k) {
      var tr = el("tr");
      tr.appendChild(el("td", null, pairLabel(r, p)));
      r.codes.forEach(function (code) { tr.appendChild(cellsOf[code][k]()); });
      tbody.appendChild(tr);
    });
  }
  thead.appendChild(hr);
  table.appendChild(thead);
  table.appendChild(tbody);
  $("asymmetricNote").textContent = anyAsym ? "* Asymmetric metric: the first set of each pair is the reference. Point at a value to see the reverse direction." : "";
}

// Bridge to Network quality: the compared sets on the loaded network, or how to get there.
function renderNetworkBridge(r) {
  var onNetwork = (state.qualityAll || []).filter(function (q) { return r.ids.indexOf(q.id) >= 0; });
  $("compareNetworkWrap").hidden = onNetwork.length === 0;
  if (onNetwork.length > 0) {
    $("compareNetworkHint").textContent = "Similarity says whether results agree; this says how well each one fits \"" + state.networkName +
      "\". Higher modularity and coverage and lower conductance are better. Calculated on the sets " +
      (state.qualityStage === "raw" ? "as loaded" : "after filters") + ", as chosen in Network quality.";
    $("compareNetworkGo").textContent = "Details in Network quality \u2192";
    renderSetQualityTable($("compareNetworkTable"), onNetwork, null, null);
  } else {
    $("compareNetworkHint").textContent = "Do you have the network these clusters came from? Load it to see how well each compared set fits it: conductance, modularity and coverage.";
    $("compareNetworkGo").textContent = "Load a network \u2192";
  }
}

// Maximum cluster match between two chosen sets.
function renderClusterMatch(r) {
  var options = r.ids.map(function (id, k) { return [id, r.names[k]]; });
  fillSelect($("matchA"), options, state.matchA);
  fillSelect($("matchB"), options, state.matchB);
  var a = setById(state.matchA), b = setById(state.matchB), body = $("matchTable").querySelector("tbody");
  empty(body);
  $("matchHeadA").textContent = a ? a.name : "A";
  $("matchHeadB").textContent = b ? b.name : "B";
  var matchError = "";
  if (a && b && a !== b) {
    try { state.matchRows = C.maximumMatch(a.filtered, b.filtered); }
    catch (e) { state.matchRows = []; matchError = "Cluster matching needs strict partitions; one of these sets has objects in more than one cluster."; }
    if (matchError) {
      var errRow = el("tr");
      errRow.appendChild(el("td", { colspan: 6, class: "members" }, matchError));
      body.appendChild(errRow);
    }
    state.matchRows.forEach(function (m) {
      var tr = el("tr");
      tr.appendChild(el("td", null, m.a));
      tr.appendChild(el("td", null, m.b));
      tr.appendChild(el("td", { class: "num" }, m.overlap));
      tr.appendChild(el("td", { class: "num" }, m.sizeA));
      tr.appendChild(el("td", { class: "num" }, m.sizeB));
      tr.appendChild(el("td", { class: "num" }, G.fmt(m.jaccard)));
      body.appendChild(tr);
    });
  } else {
    state.matchRows = [];
    var tr = el("tr");
    tr.appendChild(el("td", { colspan: 6, class: "members" }, "Choose two different cluster sets."));
    body.appendChild(tr);
  }
}

// Rows of the comparison for CSV export: one line per metric and pair (both directions for asymmetric metrics).
export function comparisonCsvRows() {
  var r = state.result, rows = [["metric", "first_set", "second_set", "value"]];
  r.codes.forEach(function (code) {
    var symmetric = C.metricByCode(code).symmetric;
    activePairs(r).forEach(function (p) {
      rows.push([code, r.names[p[0]], r.names[p[1]], r.matrix[code][p[0]][p[1]]]);
      if (!symmetric) rows.push([code, r.names[p[1]], r.names[p[0]], r.matrix[code][p[1]][p[0]]]);
    });
  });
  return rows;
}

export function clusterMatchCsvRows() {
  var a = setById(state.matchA), b = setById(state.matchB);
  if (!a || !b) return null;
  var rows = [[a.name, b.name, "shared_objects", "size_first", "size_second", "jaccard"]];
  (state.matchRows || []).forEach(function (m) { rows.push([m.a, m.b, m.overlap, m.sizeA, m.sizeB, m.jaccard]); });
  return rows;
}
