/* VICTOR app: Step 3, Plots: heatmap, ranking, map and the pair plots of one metric. */
import { C, CLUSTER_PLOTS, CROWDED_ABOVE_SETS, G, MAX_PAIR_BARS, PAIR_PLOTS, VIZ_NOTES, VIZ_TITLES } from "./config.js";
import { setById, state } from "./state.js";
import { $, empty, fillSelect, linkTo, setNotice, setPressed } from "./dom.js";
import { pairList } from "./data.js";
import { infoButton } from "./info.js";
import { notRunParts } from "./view-files.js";

// The value of a pair regardless of direction (asymmetric metrics are averaged over both directions).
function symmetric(matrix, i, j) { return (matrix[i][j] + matrix[j][i]) / 2; }

// For each cluster set: its mean, lowest and highest similarity to the other sets.
function rankingItems(r, matrix) {
  return r.names.map(function (name, i) {
    var others = r.names.map(function (other, j) { return { other: other, value: j === i ? null : symmetric(matrix, i, j) }; })
      .filter(function (o) { return o.value !== null; }).sort(function (a, b) { return b.value - a.value; });
    var sum = 0;
    others.forEach(function (o) { sum += o.value; });
    var top = others[0], bottom = others[others.length - 1];
    return { label: name, value: sum / others.length, min: bottom.value, max: top.value,
      rows: [["Average", G.fmt(sum / others.length)], ["Highest: " + top.other, G.fmt(top.value)], ["Lowest: " + bottom.other, G.fmt(bottom.value)]] };
  });
}

function distanceMatrix(r, matrix) {
  return r.names.map(function (a, i) { return r.names.map(function (b, j) { return i === j ? 0 : Math.max(0, 1 - symmetric(matrix, i, j)); }); });
}

// One column per cluster set (similar sets next to each other), one node per cluster: the largest `top`
// clusters, and one node for all the others.
function clusterColumns(r, top) {
  var order = r.names.length > 2 ? C.hclust(distanceMatrix(r, r.matrix[state.viz.metric])).order : r.names.map(function (n, i) { return i; });
  return order.map(function (idx) {
    var clusters = setById(r.ids[idx]).filtered.slice().sort(function (a, b) { return b.members.length - a.members.length; });
    var nodes = clusters.slice(0, top).map(function (c) { return { name: c.name, size: c.members.length, members: c.members }; });
    var rest = clusters.slice(top);
    if (rest.length) {
      var members = [];
      rest.forEach(function (c) { members = members.concat(c.members); });
      nodes.push({ name: "Other (" + rest.length + " clusters)", size: members.length, members: members });
    }
    var where = new Map();
    nodes.forEach(function (n, i) { n.members.forEach(function (o) { where.set(o, i); }); });
    return { name: r.names[idx], nodes: nodes, where: where };
  });
}

// Objects shared by the nodes of two columns: [{ i, j, value }]
function flowBetween(a, b) {
  var counts = new Map(), J = b.nodes.length, out = [];
  a.where.forEach(function (i, object) { var key = i * J + b.where.get(object); counts.set(key, (counts.get(key) || 0) + 1); });
  counts.forEach(function (value, key) { out.push({ i: Math.floor(key / J), j: key % J, value: value }); });
  return out;
}

// Where the objects of one node are in every column and on every band between neighbouring columns
function traceObjects(columns, k, i) {
  var nodes = columns.map(function (c) { return new Array(c.nodes.length).fill(0); }), links = {};
  columns[k].nodes[i].members.forEach(function (object) {
    columns.forEach(function (c, col) {
      var at = c.where.get(object);
      nodes[col][at]++;
      if (col + 1 < columns.length) {
        var key = col + "|" + at + "|" + columns[col + 1].where.get(object);
        links[key] = (links[key] || 0) + 1;
      }
    });
  });
  return { nodes: nodes, links: links };
}

// Sankey or circos of the objects flowing between clusters. Returns the sentences describing it.
function drawClusterPlot(r, chart, label) {
  var overlapping = r.ids.some(function (id) { return setById(id).overlapping > 0; });
  if (overlapping) {
    G.bars(chart, [], { empty: "This view needs cluster sets in which every object is in exactly one cluster." });
    return [];
  }
  var columns = clusterColumns(r, state.viz.topClusters), notes = [CLUSTER_PLOTS[state.viz.kind]];
  if (state.viz.kind === "sankey") {
    var links = [];
    columns.slice(0, -1).forEach(function (c, k) { flowBetween(c, columns[k + 1]).forEach(function (l) { links.push({ k: k, i: l.i, j: l.j, value: l.value }); }); });
    G.alluvial(chart, columns, links, { label: label, trace: function (k, i) { return traceObjects(columns, k, i); } });
  } else {
    var pairs = [];
    columns.forEach(function (a, x) {
      columns.slice(x + 1).forEach(function (b, off) { flowBetween(a, b).forEach(function (l) { pairs.push({ a: x, i: l.i, b: x + 1 + off, j: l.j, value: l.value }); }); });
    });
    G.clusterChord(chart, columns, pairs, { label: label });
    if (columns.length > 4) notes.push("With " + columns.length + " sets there are many ribbons: untick sets in step 1, show fewer clusters, or click an arc to isolate it.");
  }
  if (columns.some(function (c) { return /^Other \(/.test(c.nodes[c.nodes.length - 1].name); })) notes.push("Clusters beyond the " + state.viz.topClusters + " largest of a set are merged into \"Other\".");
  return notes;
}

// Metric selector, threshold slider and plot-type buttons
function renderPlotControls(r, pairs) {
  var v = state.viz, values = pairs.map(function (p) { return p.value; });
  var lo = Math.floor(Math.min.apply(null, values) * 100) / 100, hi = Math.ceil(Math.max.apply(null, values) * 100) / 100;
  if (v.threshold === null || v.threshold < lo || v.threshold > hi) v.threshold = lo;
  fillSelect($("vizMetric"), r.codes.map(function (c) { return [c, C.metricByCode(c).label]; }), v.metric);
  var slider = $("vizThreshold");
  slider.min = lo;
  slider.max = hi;
  slider.value = v.threshold;
  slider.disabled = !(hi > lo);
  $("vizThresholdValue").textContent = Number(v.threshold).toFixed(2);
  var byClusters = !!CLUSTER_PLOTS[v.kind] && v.level === "clusters";
  $("vizThresholdField").hidden = !PAIR_PLOTS[v.kind] || byClusters;
  $("levelField").hidden = !CLUSTER_PLOTS[v.kind];
  setPressed($("vizLevel"), "level", v.level);
  $("topClusters").hidden = !byClusters;
  $("topClusters").value = String(v.topClusters);
  setPressed($("vizKind"), "kind", v.kind);
  $("netLayoutField").hidden = v.kind !== "network";
  if (!$("netLayout").options.length) fillSelect($("netLayout"), Object.keys(G.NETWORK_LAYOUTS).map(function (k) { return [k, G.NETWORK_LAYOUTS[k]]; }), v.layout);
  $("netLayout").value = v.layout;
  empty($("vizMetricInfo"));
  $("vizMetricInfo").appendChild(infoButton(v.metric));
}

// Draws the chosen plot and returns the sentences that describe what is shown.
function drawPlot(r, pairs) {
  var v = state.viz, def = C.metricByCode(v.metric), matrix = r.matrix[v.metric], chart = $("vizChart");
  var opts = { metric: def.label, label: VIZ_TITLES[v.kind] + " of " + def.label }, notes = [VIZ_NOTES[v.kind]];
  var shown = pairs.filter(function (p) { return p.value >= v.threshold - 1e-9; });
  var pairLabel = function (p) { return r.names[p.i] + " vs " + r.names[p.j]; };
  if (CLUSTER_PLOTS[v.kind] && v.level === "clusters") return drawClusterPlot(r, chart, VIZ_TITLES[v.kind] + " of the objects shared between clusters");
  if (v.kind === "ranking") {
    if (r.names.length < 3) notes.push("With two sets there is a single pair, so both bars are equal.");
    opts.empty = "Nothing to rank.";
    G.bars(chart, rankingItems(r, matrix), opts);
  } else if (v.kind === "map") {
    var placed = C.mds(distanceMatrix(r, matrix));
    opts.matrix = r.names.map(function (a, i) { return r.names.map(function (b, j) { return i === j ? 1 : symmetric(matrix, i, j); }); });
    G.map(chart, r.names, placed.points, opts);
    if (placed.fit !== null && r.names.length > 3) {
      notes.push("The distances on the map match the real ones with a correlation of " + placed.fit.toFixed(2) +
        (placed.fit < 0.8 ? "; treat the positions as a rough guide and check the heatmap." : "."));
    }
  } else if (v.kind === "heatmap") {
    opts.threshold = v.threshold - 1e-9;
    G.heatmap(chart, r.names, matrix, opts);
  } else {
    notes.push("Showing " + shown.length + " of " + pairs.length + " pairs.");
    if (v.kind === "bar") {
      var bars = shown.slice().sort(function (a, b) { return b.value - a.value; });
      if (bars.length > MAX_PAIR_BARS) {
        notes.push("Only the " + MAX_PAIR_BARS + " most similar are drawn; the heatmap shows every pair.");
        bars = bars.slice(0, MAX_PAIR_BARS);
      }
      G.bars(chart, bars.map(function (p) { return { label: pairLabel(p), value: p.value }; }), opts);
    } else if (v.kind === "sankey") {
      G.sankey(chart, r.names, shown, opts);
    } else if (v.kind === "network") {
      opts.layout = v.layout;
      G.network(chart, r.names, shown, opts);
    } else {
      G.chord(chart, r.names, shown, opts);
    }
    if (r.names.length > CROWDED_ABOVE_SETS && v.kind !== "bar") {
      notes.push("With " + r.names.length + " sets this plot is crowded: raise \"Hide below\" or use the heatmap.");
    }
  }
  var reference = state.compareMode === "reference" && r.names.length > 2;
  if (reference) notes.push(v.kind === "bar" || v.kind === "sankey" || v.kind === "network" || v.kind === "circos"
    ? "Pairs: each set against the reference." : "This plot always uses every pair, not only those with the reference.");
  if (!def.symmetric) notes.push(v.kind === "ranking" || v.kind === "map"
    ? "Asymmetric metric: the two directions of each pair are averaged." : "Asymmetric metric: the first set of each pair is the reference.");
  return notes;
}

export function renderVisualize() {
  var r = state.result, msg = $("vizMessage");
  $("vizBody").hidden = !r;
  msg.hidden = !!r;
  if (!r) {
    setNotice(msg, state.sets.length ? "warn" : "", (state.sets.length ? notRunParts() : ["Load cluster set files first. "]).concat([linkTo("files", "Go to step 1")]));
    return;
  }
  if (state.viz.kind === "map" && r.names.length < 3) state.viz.kind = "heatmap";
  var pairs = pairList();
  renderPlotControls(r, pairs);
  $("vizTitle").textContent = VIZ_TITLES[state.viz.kind] + ": " +
    (CLUSTER_PLOTS[state.viz.kind] && state.viz.level === "clusters" ? "objects shared between clusters" : C.metricByCode(state.viz.metric).label);
  $("vizNote").textContent = drawPlot(r, pairs).join(" ");
}
