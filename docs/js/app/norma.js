/* VICTOR app: Export to NORMA (normaviz.org): payload, hand-over by postMessage, file download. */
import { G, NORMA_ORIGIN, NORMA_URL, global } from "./config.js";
import { state } from "./state.js";
import { $ } from "./dom.js";

export var normaWindow = null, normaTimer = null;

// Clusters of every loaded set, restricted to the nodes of the network.
// The default grouping holds the clusters of all sets together ("Set: cluster"), so a node belongs to one
// group per set and NORMA draws it as a pie chart; each single set is offered as a further grouping.
export function normaData() {
  if (!state.network || state.sets.length === 0) return null;
  var inNetwork = new Set(state.network.nodes), perSet = [];
  state.sets.forEach(function (set) {
    var clusters = state.qualityStage === "raw" ? set.raw : set.filtered, groups = [];
    clusters.forEach(function (c) {
      var members = c.members.filter(function (o) { return inNetwork.has(o); });
      if (members.length > 0) groups.push({ name: c.name, members: members });
    });
    if (groups.length > 0) perSet.push({ name: set.name, groups: groups });
  });
  if (perSet.length === 0) return null;
  var combined = [];
  perSet.forEach(function (a) {
    a.groups.forEach(function (g) { combined.push({ name: perSet.length > 1 ? a.name + ": " + g.name : g.name, members: g.members }); });
  });
  return { perSet: perSet, combined: combined };
}

export function normaPayload(data) {
  var payload = {
    name: "VICTOR " + state.networkName,
    edges: state.network.edges.map(function (e) {
      var edge = { source: state.network.nodes[e.s], target: state.network.nodes[e.t] };
      if (state.network.weighted) edge.weight = e.w;
      return edge;
    }),
    groups: data.combined,
    // pie-chart nodes: fill by group colours, no hulls drawn around the groups
    settings: { nodeFillSelect: "groups", showGroupHulls: false, legendShow: data.combined.length <= 30, layout: "fr" }
  };
  if (data.perSet.length > 1) payload.annotations = data.perSet.map(function (a) { return { name: a.name, groups: a.groups }; });
  return payload;
}

export function setNormaStatus(text, bad) {
  ["normaStatus", "normaStatusInline"].forEach(function (id) {
    $(id).textContent = text;
    $(id).className = "hint" + (bad ? " status-bad" : "");
  });
}

export function openInNorma() {
  var data = normaData();
  if (!data) { setNormaStatus("Load a network and a cluster set whose objects are nodes of it first.", true); return; }
  if (state.network.nodes.length > 10000) setNormaStatus("NORMA shows the first 10,000 nodes of larger networks.");
  var payload = normaPayload(data);
  normaWindow = global.open(NORMA_URL, "_blank"); // no "noopener": NORMA must be able to answer this page
  if (!normaWindow) { setNormaStatus("The browser blocked the new window. Allow pop-ups for this page, or download the files instead.", true); return; }
  setNormaStatus("Waiting for NORMA to start\u2026");
  clearTimeout(normaTimer);
  normaTimer = setTimeout(function () {
    setNormaStatus("NORMA did not answer. If its window is open but empty, use \"Download the files for NORMA instead\" and upload them there.", true);
  }, 45000);
  openInNorma.pending = payload;
}

global.addEventListener("message", function (e) {
  if (e.origin !== NORMA_ORIGIN || !normaWindow || e.source !== normaWindow || !e.data) return;
  if (e.data.type === "norma:ready" && openInNorma.pending) {
    normaWindow.postMessage({ type: "norma:load", requestId: 1, payload: openInNorma.pending }, NORMA_ORIGIN);
    openInNorma.pending = null;
    setNormaStatus("Sending the network and clusters to NORMA\u2026");
  } else if (e.data.type === "norma:loaded") {
    clearTimeout(normaTimer);
    if (e.data.ok) setNormaStatus("Opened in NORMA. Use its Grouping list to switch between the cluster sets.");
    else setNormaStatus("NORMA could not load the data: " + String(e.data.error || "unknown error").slice(0, 200), true);
  }
});

// Same data as tab-separated files, for uploading to NORMA by hand
export function downloadNormaFiles() {
  var data = normaData();
  if (!data) { setNormaStatus("Load a network and a cluster set whose objects are nodes of it first.", true); return; }
  var base = "victor_" + state.networkName.replace(/[^A-Za-z0-9._-]+/g, "_");
  var network = state.network.edges.map(function (e) {
    return state.network.nodes[e.s] + "\t" + state.network.nodes[e.t] + (state.network.weighted ? "\t" + e.w : "");
  }).join("\n") + "\n";
  var annotation = data.combined.map(function (g) { return g.name + "\t" + g.members.join(","); }).join("\n") + "\n";
  [[network, base + "_network.txt"], [annotation, base + "_annotation.txt"]].forEach(function (f, k) {
    setTimeout(function () {
      var url = URL.createObjectURL(new Blob([f[0]], { type: "text/plain" }));
      G.download(url, f[1]);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }, k * 400);
  });
  setNormaStatus("Two files were downloaded. In NORMA, upload the first as the network and the second as the annotation.");
}
