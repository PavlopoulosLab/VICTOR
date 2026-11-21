/* VICTOR app: Network quality: networks, the sets-by-networks grid, per-set and per-cluster tables, charts. */
import { G, GRID_MEASURES, QUALITY_COLUMNS } from "./config.js";
import { setById, state } from "./state.js";
import { $, bold, el, empty, fillSelect, setNotice, setPressed } from "./dom.js";
import { computeQuality } from "./data.js";
import { render } from "./main.js";

// Table with one row per cluster set: how it scores on the loaded network. onPick(id) makes rows clickable.
export function renderSetQualityTable(table, rows, pickedId, onPick) {
  var columns = [
    { key: "name", label: "Cluster set" }, { key: "clusters", label: "Clusters", num: true },
    { key: "inNetwork", label: "Objects in network", num: true },
    { key: "modularity", label: "Modularity", num: true, dec: true, best: "max" },
    { key: "coverage", label: "Coverage", num: true, dec: true, best: "max" },
    { key: "medianConductance", label: "Median conductance", num: true, dec: true, best: "min" }
  ];
  empty(table);
  var thead = el("thead"), hr = el("tr"), tbody = el("tbody");
  columns.forEach(function (c) { hr.appendChild(el("th", c.num ? { class: "num" } : null, c.label)); });
  thead.appendChild(hr);
  var best = {};
  columns.forEach(function (c) {
    if (!c.best || rows.length < 2) return;
    var values = rows.map(function (r) { return r[c.key]; }).filter(function (v) { return v !== null; });
    if (values.length) best[c.key] = c.best === "max" ? Math.max.apply(null, values) : Math.min.apply(null, values);
  });
  rows.forEach(function (r) {
    var tr = el("tr", { class: (onPick ? "pickable" : "") + (r.id === pickedId ? " picked" : "") });
    columns.forEach(function (c) {
      var text = c.key === "inNetwork" ? r.inNetwork.toLocaleString() + " of " + r.objects.toLocaleString() : c.dec ? G.fmt(r[c.key]) : r[c.key];
      tr.appendChild(el("td", { class: (c.num ? "num" : "") + (best[c.key] !== undefined && r[c.key] === best[c.key] ? " best" : "") }, text));
    });
    if (onPick) {
      tr.tabIndex = 0;
      tr.setAttribute("role", "button");
      tr.setAttribute("aria-label", "Show " + r.name + " in detail");
      tr.addEventListener("click", function () { onPick(r.id); });
      tr.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(r.id); } });
    }
    tbody.appendChild(tr);
  });
  table.appendChild(thead);
  table.appendChild(tbody);
}

export function sortedQualityRows() {
  var s = state.qualitySort, rows = state.quality.rows.slice();
  rows.sort(function (a, b) {
    var x = a[s.key], y = b[s.key];
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    if (typeof x === "string") return s.dir * x.localeCompare(y, undefined, { numeric: true });
    return s.dir * (x - y);
  });
  return rows;
}

export function renderQuality() {
  var msg = $("qualityMessage"), q = state.quality;
  renderNetworkList();
  fillSelect($("qualitySet"), state.sets.map(function (s) { return [s.id, s.name]; }), state.qualityId);
  $("normaOpen").disabled = $("normaDownload").disabled = !(state.network && state.sets.length > 0);
  setPressed($("qualityStage"), "stage", state.qualityStage);
  $("qualityBody").hidden = !q;
  if (!q) {
    var need = !state.network && !state.sets.length ? "Load a network file and at least one cluster set file, or use the example."
      : !state.network ? "Load a network file to evaluate the clusters on it." : "Load a cluster set file in step 1 (Load & prepare).";
    setNotice(msg, "", [need]);
    return;
  }
  var set = setById(state.qualityId), matched = 0, total = 0;
  q.rows.forEach(function (r) { matched += r.inNetwork; total += r.objects; });
  if (matched === 0) {
    setNotice(msg, "bad", [bold("No object of \"" + set.name + "\" is a node of this network. "), "Check that the cluster set and the network use the same names."]);
  } else if (q.missingObjects > 0 || q.unassignedNodes > 0) {
    var notes = [];
    if (q.missingObjects > 0) notes.push(q.missingObjects + " of " + total + " cluster objects are not in the network and are ignored.");
    if (q.unassignedNodes > 0) notes.push(q.unassignedNodes + " of " + state.network.nodes.length + " network nodes are in no cluster.");
    setNotice(msg, "warn", [bold("Partial match. "), notes.join(" ")]);
  } else {
    setNotice(msg, "good", [bold("All " + total + " objects of \"" + set.name + "\" were found in the network.")]);
  }
  var cond = q.rows.map(function (r) { return r.conductance; }).filter(function (v) { return v !== null; });
  var tiles = [
    ["Nodes", state.network.nodes.length], ["Edges", state.network.edges.length], ["Clusters", q.rows.length],
    ["Modularity", G.fmt(q.modularity)], ["Coverage", G.fmt(q.coverage)],
    ["Median conductance", cond.length ? G.fmt(cond.slice().sort(function (a, b) { return a - b; })[Math.floor((cond.length - 1) / 2)]) : "n/a"]
  ];
  var box = $("qualityTiles");
  empty(box);
  tiles.forEach(function (t) {
    var tile = el("div", { class: "tile" });
    tile.appendChild(el("div", { class: "k" }, t[0]));
    tile.appendChild(el("div", { class: "v" }, t[1]));
    box.appendChild(tile);
  });
  renderQualityGrid();
  $("qualityAllCard").hidden = state.qualityAll.length < 2;
  renderSetQualityTable($("qualityAllTable"), state.qualityAll, state.qualityId, function (id) {
    state.qualityId = id;
    computeQuality();
    render();
  });
  $("qualityDetailTitle").textContent = "In detail: " + set.name;
  var legendItems = G.graph($("chartGraph"), state.network, q, q.clusters), legend = $("graphLegend");
  empty(legend);
  legendItems.forEach(function (it) {
    var span = el("span"), dot = el("i");
    dot.style.background = it.color;
    span.appendChild(dot);
    span.appendChild(document.createTextNode(it.label));
    legend.appendChild(span);
  });
  G.histogram($("chartConductance"), cond.map(function (v) { return Math.min(v, 1); }), {
    domain: [0, 1], bins: 10, xLabel: "Conductance", yLabel: "Clusters", label: "Histogram of cluster conductance",
    empty: "No cluster has a defined conductance."
  });
  renderQualityTable();
}

// Loaded networks: choose the one shown in detail, or remove one
export function renderNetworkList() {
  var box = $("networkList");
  empty(box);
  state.networks.forEach(function (n) {
    var row = el("div", { class: "pick-row" + (n.id === state.networkId ? " active" : "") });
    var radio = el("input", { type: "radio", name: "activeNetwork", "aria-label": "Show " + n.name + " in detail" });
    radio.checked = n.id === state.networkId;
    radio.addEventListener("change", function () { state.networkId = n.id; computeQuality(); render(); });
    var remove = el("button", { class: "btn small", type: "button", "aria-label": "Remove network " + n.name }, "Remove");
    remove.addEventListener("click", function () {
      state.networks = state.networks.filter(function (x) { return x !== n; });
      computeQuality();
      render();
    });
    row.appendChild(radio);
    row.appendChild(el("span", { class: "name", title: n.name }, n.name));
    row.appendChild(el("span", { class: "meta" }, n.net.nodes.length.toLocaleString() + " nodes, " + n.net.edges.length.toLocaleString() + " edges"));
    row.appendChild(remove);
    box.appendChild(row);
  });
}

// Every ticked cluster set on every ticked network, for one measure. Click a cell to see that combination in detail.
export function renderQualityGrid() {
  var card = $("qualityGridCard"), table = $("qualityGridTable"), measure = GRID_MEASURES[state.gridMeasure];
  card.hidden = state.networks.length < 2;
  if (card.hidden) return;
  setPressed($("gridMeasure"), "measure", state.gridMeasure);
  $("gridHint").textContent = measure.hint + " Untick a cluster set or a network to leave it out; click a value to see that combination in detail below. The best value in each column is in bold.";
  empty(table);
  function toggle(store, id, label) {
    var wrap = el("label"), cb = el("input", { type: "checkbox", "aria-label": "Include " + label });
    cb.checked = !store[id];
    cb.addEventListener("change", function () { if (cb.checked) delete store[id]; else store[id] = true; renderQualityGrid(); });
    wrap.appendChild(cb);
    wrap.appendChild(document.createTextNode(label));
    return wrap;
  }
  var thead = el("thead"), hr = el("tr"), tbody = el("tbody");
  hr.appendChild(el("th", null, "Cluster set / Network"));
  state.networks.forEach(function (n) {
    var th = el("th", { class: state.gridOffNets[n.id] ? "off" : "" });
    th.appendChild(toggle(state.gridOffNets, n.id, n.name));
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  var value = function (n, set) { var g = state.qualityGrid[n.id + "|" + set.id]; return g ? g[state.gridMeasure] : null; };
  var best = {};
  state.networks.forEach(function (n) {
    var values = state.sets.filter(function (set) { return !state.gridOffSets[set.id]; }).map(function (set) { return value(n, set); })
      .filter(function (v) { return v !== null && v !== undefined; });
    if (values.length > 1) best[n.id] = measure.best === "max" ? Math.max.apply(null, values) : Math.min.apply(null, values);
  });
  state.sets.forEach(function (set) {
    var tr = el("tr"), head = el("td", { class: state.gridOffSets[set.id] ? "off" : "" });
    head.appendChild(toggle(state.gridOffSets, set.id, set.name));
    tr.appendChild(head);
    state.networks.forEach(function (n) {
      var off = state.gridOffSets[set.id] || state.gridOffNets[n.id], v = value(n, set);
      var td = el("td", { class: "cell" + (off ? " off" : "") + (!off && v !== null && v === best[n.id] ? " best" : "") +
        (n.id === state.networkId && set.id === state.qualityId ? " current" : ""), tabindex: "0", role: "button",
        "aria-label": set.name + " on " + n.name + ": " + G.fmt(v) }, off ? "\u2013" : G.fmt(v));
      var pick = function () { state.networkId = n.id; state.qualityId = set.id; computeQuality(); render(); };
      td.addEventListener("click", pick);
      td.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(thead);
  table.appendChild(tbody);
}

export function gridCsvRows() {
  var rows = [["cluster_set", "network", "clusters", "objects", "objects_in_network", "modularity", "coverage", "median_conductance"]];
  state.sets.forEach(function (set) {
    if (state.gridOffSets[set.id]) return;
    state.networks.forEach(function (n) {
      var g = state.qualityGrid[n.id + "|" + set.id];
      if (state.gridOffNets[n.id] || !g) return;
      rows.push([set.name, n.name, g.clusters, g.objects, g.inNetwork, g.modularity === null ? "" : g.modularity,
        g.coverage === null ? "" : g.coverage, g.medianConductance === null ? "" : g.medianConductance]);
    });
  });
  return rows;
}

export function renderQualityTable() {
  var table = $("qualityTable"), s = state.qualitySort;
  empty(table);
  var thead = el("thead"), hr = el("tr");
  QUALITY_COLUMNS.forEach(function (c) {
    var th = el("th", { class: "sortable" + (c.num ? " num" : ""), "aria-sort": s.key === c.key ? (s.dir > 0 ? "ascending" : "descending") : "none" },
      c.label + (s.key === c.key ? (s.dir > 0 ? " ▲" : " ▼") : ""));
    th.addEventListener("click", function () {
      state.qualitySort = { key: c.key, dir: s.key === c.key ? -s.dir : 1 };
      renderQualityTable();
    });
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);
  var tbody = el("tbody");
  sortedQualityRows().forEach(function (r) {
    var tr = el("tr");
    QUALITY_COLUMNS.forEach(function (c) {
      tr.appendChild(el("td", c.num ? { class: "num" } : null, c.dec ? G.fmt(r[c.key]) : r[c.key]));
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
}

export function qualityCsvRows() {
  var rows = [QUALITY_COLUMNS.map(function (c) { return c.label; })];
  sortedQualityRows().forEach(function (r) { rows.push(QUALITY_COLUMNS.map(function (c) { return r[c.key] === null ? "" : r[c.key]; })); });
  return rows;
}
