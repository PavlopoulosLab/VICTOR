/* VICTOR app: Step 3, Plots: the five plots of one metric. */
import { C, CROWDED_ABOVE_SETS, G, VIZ_NOTES, VIZ_TITLES } from "./config.js";
import { state } from "./state.js";
import { $, empty, fillSelect, linkTo, setNotice, setPressed } from "./dom.js";
import { pairList } from "./data.js";
import { infoButton } from "./info.js";
import { notRunParts } from "./view-files.js";

export function renderVisualize() {
  var r = state.result, msg = $("vizMessage");
  $("vizBody").hidden = !r;
  msg.hidden = !!r;
  if (!r) {
    setNotice(msg, state.sets.length ? "warn" : "", (state.sets.length ? notRunParts() : ["Load cluster set files first. "]).concat([linkTo("files", "Go to step 1")]));
    return;
  }
  var v = state.viz, pairs = pairList(), values = pairs.map(function (p) { return p.value; });
  var lo = Math.floor(Math.min.apply(null, values) * 100) / 100, hi = Math.ceil(Math.max.apply(null, values) * 100) / 100;
  if (v.threshold === null || v.threshold < lo || v.threshold > hi) v.threshold = lo;
  fillSelect($("vizMetric"), r.codes.map(function (c) { return [c, C.metricByCode(c).label]; }), v.metric);
  var slider = $("vizThreshold");
  slider.min = lo;
  slider.max = hi;
  slider.value = v.threshold;
  slider.disabled = !(hi > lo);
  $("vizThresholdValue").textContent = Number(v.threshold).toFixed(2);
  setPressed($("vizKind"), "kind", v.kind);
  $("netLayoutField").hidden = v.kind !== "network";
  $("netLayout").value = v.layout;

  empty($("vizMetricInfo"));
  $("vizMetricInfo").appendChild(infoButton(v.metric));
  var def = C.metricByCode(v.metric), shown = pairs.filter(function (p) { return p.value >= v.threshold - 1e-9; });
  $("vizTitle").textContent = VIZ_TITLES[v.kind] + ": " + def.label;
  $("vizNote").textContent = VIZ_NOTES[v.kind] + " Showing " + shown.length + " of " + pairs.length + " pairs." +
    (state.compareMode === "reference" && r.names.length > 2 ? " Pairs: each set against the reference" + (v.kind === "heatmap" ? " (the heatmap always shows every pair)." : ".") : "") +
    (def.symmetric ? "" : " Asymmetric metric: the first set of each pair is the reference.") +
    (r.names.length > CROWDED_ABOVE_SETS && (v.kind === "sankey" || v.kind === "network" || v.kind === "circos")
      ? " With " + r.names.length + " sets this plot is crowded: raise \"Hide below\" or use the heatmap." : "");
  var chart = $("vizChart"), opts = { metric: def.label, label: VIZ_TITLES[v.kind] + " of " + def.label };
  if (v.kind === "bar") {
    G.bars(chart, shown.map(function (p) { return { label: r.names[p.i] + " vs " + r.names[p.j], value: p.value }; }), opts);
  } else if (v.kind === "heatmap") {
    opts.threshold = v.threshold - 1e-9;
    G.heatmap(chart, r.names, r.matrix[v.metric], opts);
  } else if (v.kind === "sankey") {
    G.sankey(chart, r.names, shown, opts);
  } else if (v.kind === "network") {
    opts.layout = v.layout;
    G.network(chart, r.names, shown, opts);
  } else {
    G.chord(chart, r.names, shown, opts);
  }
}
