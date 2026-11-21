/*
 * VICTOR app: state and user interface. Calculations live in core.js, drawing in charts.js.
 */
(function (global) {
  "use strict";

  var VICTOR = global.VICTOR, C = VICTOR.core, G = VICTOR.charts;
  var MAX_FILE_BYTES = 50 * 1024 * 1024;
  var CONFIRM_ABOVE_SECONDS = 4; // estimated calculation time above which the user is asked before the page is blocked
  var CROWDED_ABOVE_SETS = 15;   // Sankey, circos and network plots get hard to read beyond this many sets
  var ORIGINAL_TEN = ["adjrand", "fmi", "jaccard", "overlap", "wallace1", "wallace2", "mmm", "nmi1", "nmi2", "nvi"];

  // Bundled examples. `metrics` are ticked in addition to the current selection when the example is loaded.
  var EXAMPLES = [
    { label: "Seven cluster sets (A to G)",
      description: "Seven clusterings of the same 50 objects, from the publication. Ready to compare.",
      files: ["A", "B", "C", "D", "E", "F", "G"].map(function (x) { return "Clustering_" + x + ".txt"; }) },
    { label: "Three sets that need filtering",
      description: "Three clusterings that do not contain the same objects. Use the Intersection or Superset filter; the UpSet plot shows what they share.",
      files: ["Clustering_data1.txt", "Clustering_data2.txt", "Clustering_data3.txt"] },
    { label: "Four algorithms on yeast proteins",
      description: "Label Propagation, Louvain, MCL and Walktrap on a yeast protein interaction network of 1,430 proteins (first case study of the publication).",
      files: ["Labelprop.txt", "Louvain.txt", "MCL.txt", "Walktrap.txt"] },
    { label: "Gene expression in myocardial infarction",
      description: "Hierarchical clusters of differentially expressed genes in four GEO datasets (third case study of the publication). The datasets share only part of their genes, so a filter is needed.",
      files: ["MI_GSE48060.txt", "MI_GSE60993.txt", "MI_GSE61144.txt", "MI_GSE66360.txt"] },
    { label: "Noise ladder (synthetic)",
      description: "A reference clustering of 200 objects and four copies in which 5%, 10%, 20% and 40% of the objects were moved to another cluster. Every metric should fall step by step.",
      files: ["Noise_00_reference.txt", "Noise_05_percent.txt", "Noise_10_percent.txt", "Noise_20_percent.txt", "Noise_40_percent.txt"] },
    { label: "Finer and finer clusters (synthetic)",
      description: "240 objects in 4, 8, 16 and 32 clusters, each level splitting the clusters of the one before. Homogeneity and Completeness show which set refines which.",
      files: ["Levels_04_clusters.txt", "Levels_08_clusters.txt", "Levels_16_clusters.txt", "Levels_32_clusters.txt"],
      metrics: ["homogeneity", "completeness"] },
    { label: "Unrelated random clusterings (synthetic)",
      description: "Four random clusterings of 300 objects with 5, 20 and 100 clusters. They share nothing, yet the Normalized Mutual Information rises with the number of clusters while the adjusted metrics stay near 0.",
      files: ["Random_005_clusters.txt", "Random_020_clusters.txt", "Random_100_clusters_a.txt", "Random_100_clusters_b.txt"],
      metrics: ["nmi2", "ami", "adjrand"] },
    { label: "Overlapping clusters (synthetic)",
      description: "Three clusterings of 60 objects in which some objects belong to two clusters. Only the Omega Index and the Overlapping NMI can compare them.",
      files: ["Overlap_reference.txt", "Overlap_similar.txt", "Overlap_different.txt"],
      metrics: ["omega", "onmi"] }
  ];

  var state = {
    sets: [],            // { id, name, raw: clusters, filtered: clusters, selected, overlapping: n, warnings: [] }
    nextId: 1,
    sizeMin: 1,
    sizeMax: 1,
    sizeMaxTouched: false,
    filterMode: "none",
    metrics: ORIGINAL_TEN.slice(),
    result: null,        // { names, codes, matrix } of the selected sets
    resultError: "",
    pending: null,       // { seconds } when a large comparison waits for the user's go-ahead
    approvedSeconds: 0,  // largest estimate the user has agreed to run
    inspectId: null,
    inspectStage: "filtered",
    matchA: null,
    matchB: null,
    viz: { kind: "bar", metric: null, threshold: null, layout: "force" },
    network: null,       // parsed edge list
    networkName: "",
    qualityId: null,
    qualityStage: "raw",
    quality: null,
    qualitySort: { key: "conductance", dir: 1 }
  };

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") node.className = attrs[k]; else node.setAttribute(k, attrs[k]);
    });
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  function empty(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function selectedSets() { return state.sets.filter(function (s) { return s.selected; }); }
  function setById(id) { return state.sets.filter(function (s) { return s.id === id; })[0] || null; }
  function setNotice(node, kind, parts) {
    node.className = "notice" + (kind ? " " + kind : "");
    empty(node);
    parts.forEach(function (p) { node.appendChild(typeof p === "string" ? document.createTextNode(p) : p); });
  }
  function bold(text) { return el("b", null, text); }
  // Names come from user files. A text cell that starts with = + - @ would run as a formula in a spreadsheet,
  // so it gets a leading apostrophe. Numbers are written as they are.
  function csvCell(v) {
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(v)) v = "'" + v;
    v = String(v);
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function downloadCsv(rows, filename) {
    var blob = new Blob([rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n") + "\n"], { type: "text/csv" });
    var url = URL.createObjectURL(blob);
    G.download(url, filename);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  // ---------------------------------------------------------------- data flow
  function uniqueName(name, exceptId) {
    var taken = new Set();
    state.sets.forEach(function (s) { if (s.id !== exceptId) taken.add(s.name); });
    if (!taken.has(name)) return name;
    var k = 2;
    while (taken.has(name + " (" + k + ")")) k++;
    return name + " (" + k + ")";
  }

  function addClusterSet(fileName, text) {
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
  function applyFilters() {
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

  function compare() {
    state.result = null;
    state.resultError = "";
    var chosen = selectedSets();
    if (chosen.length < 2) { state.resultError = "Select at least two cluster sets in the Files tab."; return; }
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

  function computeQuality() {
    state.quality = null;
    var set = setById(state.qualityId);
    if (!state.network || !set) return;
    var clusters = state.qualityStage === "raw" ? set.raw : set.filtered;
    state.quality = C.clusterQuality(state.network, clusters);
    state.quality.clusters = clusters;
  }

  // Notice content for a comparison that did not run: the reason, plus a button when it only waits for a go-ahead.
  function notRunParts() {
    var parts = [state.resultError + " "];
    if (state.pending) {
      var run = el("button", { class: "btn small primary", type: "button" }, "Run it anyway");
      run.addEventListener("click", function () {
        var seconds = state.pending.seconds;
        run.disabled = true;
        run.textContent = "Calculating\u2026";
        setTimeout(function () { // lets the button repaint before the page is blocked
          state.approvedSeconds = seconds;
          compare();
          render();
        }, 40);
      });
      parts.push(run);
    }
    return parts;
  }

  function skippedText(r) {
    if (!r.skipped || r.skipped.length === 0) return "";
    return "Left out: " + r.skipped.map(function (s) { return s.label + " (" + s.reason + ")"; }).join("; ") + ". ";
  }

  // Everything downstream of a change in files, selection or filters
  function refresh() {
    applyFilters();
    if (state.inspectId === null || !setById(state.inspectId)) state.inspectId = state.sets.length ? state.sets[0].id : null;
    if (state.qualityId === null || !setById(state.qualityId)) state.qualityId = state.sets.length ? state.sets[0].id : null;
    compare();
    computeQuality();
    render();
  }

  // ---------------------------------------------------------------- pair list for the plots
  function pairList() {
    var r = state.result, m = r.matrix[state.viz.metric], out = [];
    for (var i = 0; i < r.names.length; i++) for (var j = i + 1; j < r.names.length; j++) out.push({ i: i, j: j, value: m[i][j] });
    return out;
  }

  // ---------------------------------------------------------------- rendering: files
  function renderFiles() {
    $("countSets").textContent = state.sets.length;
    $("filesEmpty").hidden = state.sets.length > 0;
    $("filesBody").hidden = state.sets.length === 0;
    $("sizeMin").value = state.sizeMin;
    $("sizeMax").value = state.sizeMax;
    Array.prototype.forEach.call(document.querySelectorAll('input[name="filterMode"]'), function (r) { r.checked = r.value === state.filterMode; });
    if (state.sets.length === 0) return;

    // readiness
    var chosen = selectedSets(), readiness = $("readiness");
    if (chosen.length < 2) {
      setNotice(readiness, "", ["Select at least two cluster sets to compare them."]);
    } else if (state.result) {
      setNotice(readiness, state.result.note ? "warn" : "good", [bold("Ready for comparison. "), "The " + chosen.length + " selected sets contain the same " +
        C.objectSet(chosen[0].filtered).size + " objects. ", state.result.note ? state.result.note + " " : "", linkTo("compare", "See the comparison")]);
    } else {
      setNotice(readiness, "warn", [bold(state.pending ? "Not calculated yet. " : "Not ready for comparison. ")].concat(notRunParts()));
    }
    var warnings = $("fileWarnings");
    empty(warnings);
    state.sets.forEach(function (s) {
      s.warnings.forEach(function (w) { warnings.appendChild(el("p", { class: "hint" }, s.name + ": " + w)); });
    });

    // table of sets
    var tbody = $("setsTable").querySelector("tbody");
    empty(tbody);
    state.sets.forEach(function (s) {
      var tr = el("tr"), td;
      td = el("td");
      var cb = el("input", { type: "checkbox", "aria-label": "Include " + s.name });
      cb.checked = s.selected;
      cb.addEventListener("change", function () { s.selected = cb.checked; refresh(); });
      td.appendChild(cb);
      tr.appendChild(td);
      td = el("td");
      var input = el("input", { type: "text", "aria-label": "Name of cluster set" });
      input.value = s.name;
      input.addEventListener("change", function () {
        var v = input.value.trim().slice(0, 120);
        s.name = v ? uniqueName(v, s.id) : s.name;
        refresh();
      });
      td.appendChild(input);
      if (s.overlapping > 0) {
        td.appendChild(document.createTextNode(" "));
        var badge = el("span", { class: "badge warn", title: "Objects that belong to more than one cluster. Only the Omega Index and the Overlapping NMI can compare such sets." },
          s.overlapping + " overlapping object" + (s.overlapping > 1 ? "s" : ""));
        td.appendChild(badge);
      }
      tr.appendChild(td);
      tr.appendChild(el("td", { class: "num" }, s.raw.length));
      tr.appendChild(el("td", { class: "num" }, C.countObjects(s.raw)));
      tr.appendChild(el("td", { class: "num" }, s.selected ? s.filtered.length : "–"));
      tr.appendChild(el("td", { class: "num" }, s.selected ? C.countObjects(s.filtered) : "–"));
      td = el("td", { class: "num" });
      var rm = el("button", { class: "btn small", "aria-label": "Remove " + s.name }, "Remove");
      rm.addEventListener("click", function () {
        state.sets = state.sets.filter(function (x) { return x !== s; });
        if (state.sets.length === 0) { state.sizeMaxTouched = false; state.sizeMin = 1; state.filterMode = "none"; state.approvedSeconds = 0; }
        refresh();
      });
      td.appendChild(rm);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    $("selectAll").checked = chosen.length === state.sets.length;
    $("selectAll").indeterminate = chosen.length > 0 && chosen.length < state.sets.length;

    // statistics
    var names = chosen.map(function (s) { return s.name; });
    G.columns($("chartClusters"), names, [
      { name: "As loaded", values: chosen.map(function (s) { return s.raw.length; }) },
      { name: "After filters", values: chosen.map(function (s) { return s.filtered.length; }) }
    ], { label: "Number of clusters per cluster set" });
    G.columns($("chartObjects"), names, [
      { name: "As loaded", values: chosen.map(function (s) { return C.countObjects(s.raw); }) },
      { name: "After filters", values: chosen.map(function (s) { return C.countObjects(s.filtered); }) }
    ], { label: "Number of objects per cluster set" });

    // UpSet plot of the objects: only useful when the selected sets differ in what they contain
    var shared = chosen.length >= 2 ? C.objectIntersections(chosen.map(function (s) { return s.raw; })) : null;
    var differ = !!shared && !(shared.combos.length === 1 && shared.combos[0].degree === chosen.length);
    $("upsetCard").hidden = !differ;
    if (differ) {
      var inAll = shared.combos.filter(function (c) { return c.degree === chosen.length; })[0];
      $("upsetNote").textContent = (inAll ? inAll.count.toLocaleString() : "0") + " of " + shared.total.toLocaleString() + " objects are in every set, as loaded." +
        (shared.combos.length > 40 ? " Showing the 40 largest of " + shared.combos.length + " combinations." : "");
      G.upset($("chartUpset"), names, shared, { label: "UpSet plot of the objects shared between cluster sets", maxColumns: 40 });
    }

    // inspector
    fillSelect($("inspectSet"), state.sets.map(function (s) { return [s.id, s.name]; }), state.inspectId);
    setPressed($("inspectStage"), "stage", state.inspectStage);
    var set = setById(state.inspectId), clusters = set ? (state.inspectStage === "raw" ? set.raw : set.filtered) : [];
    G.histogram($("chartSizes"), clusters.map(function (c) { return c.members.length; }), {
      integer: true, xLabel: "Objects per cluster", yLabel: "Clusters", label: "Distribution of cluster sizes",
      empty: "No clusters left after filtering."
    });
    var body = $("inspectTable").querySelector("tbody");
    empty(body);
    clusters.slice(0, 500).forEach(function (c) {
      var tr = el("tr");
      tr.appendChild(el("td", null, c.name));
      tr.appendChild(el("td", { class: "num" }, c.members.length));
      tr.appendChild(el("td", { class: "members" }, c.members.join(", ")));
      body.appendChild(tr);
    });
    if (clusters.length > 500) {
      var more = el("tr");
      more.appendChild(el("td", { colspan: 3, class: "members" }, "Showing the first 500 of " + clusters.length + " clusters."));
      body.appendChild(more);
    }
  }

  function linkTo(tab, text) {
    var b = el("button", { class: "btn link" }, text);
    b.addEventListener("click", function () { showTab(tab); });
    return b;
  }

  function fillSelect(select, options, value) {
    empty(select);
    options.forEach(function (o) {
      var opt = el("option", { value: o[0] }, o[1]);
      if (String(o[0]) === String(value)) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function setPressed(group, key, value) {
    Array.prototype.forEach.call(group.querySelectorAll("button"), function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-" + key) === value ? "true" : "false");
    });
  }

  // ---------------------------------------------------------------- rendering: compare
  function renderMetricList() {
    var box = $("metricList"), groups = {};
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
          compare();
          render();
        });
        label.appendChild(cb);
        label.appendChild(el("span", null, m.label + (m.symmetric ? "" : " *")));
        wrap.appendChild(label);
      });
      box.appendChild(wrap);
    });
    box.appendChild(el("p", { class: "hint" }, "* asymmetric: in \"A vs B\", A is the reference."));
  }

  function renderCompare() {
    var r = state.result, msg = $("compareMessage");
    $("compareBody").hidden = !r;
    if (!r) {
      setNotice(msg, state.sets.length ? "warn" : "", (state.sets.length ? notRunParts() : ["Load cluster set files first. "]).concat([linkTo("files", "Go to Files")]));
      return;
    }
    var nPairs = r.names.length * (r.names.length - 1) / 2;
    var caveats = (r.note ? r.note + " " : "") + skippedText(r);
    setNotice(msg, caveats ? "warn" : "good", [bold(r.names.length + " cluster sets, " + nPairs + " pair" + (nPairs > 1 ? "s" : "") + ", " + r.codes.length + " metric" + (r.codes.length > 1 ? "s" : "") + ". "),
      caveats, linkTo("visualize", "Plot these results")]);

    var table = $("resultsTable"), pairs = [], i, j;
    for (i = 0; i < r.names.length; i++) for (j = i + 1; j < r.names.length; j++) pairs.push([i, j]);
    empty(table);
    var thead = el("thead"), hr = el("tr");
    hr.appendChild(el("th", null, "Metric"));
    pairs.forEach(function (p) { hr.appendChild(el("th", { class: "num" }, r.names[p[0]] + " vs " + r.names[p[1]])); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody"), anyAsym = false;
    r.codes.forEach(function (code) {
      var def = C.metricByCode(code), tr = el("tr"), values = pairs.map(function (p) { return r.matrix[code][p[0]][p[1]]; });
      var lo = Math.min.apply(null, values), hi = Math.max.apply(null, values), color = G.sequential(lo, hi);
      if (!def.symmetric) anyAsym = true;
      tr.appendChild(el("td", null, def.label + (def.symmetric ? "" : " *")));
      pairs.forEach(function (p, k) {
        var td = el("td", { class: "val" }, G.fmt(values[k]));
        if (pairs.length > 1) {
          var bg = color(values[k]);
          td.style.background = bg;
          td.style.color = G.readableOn(bg);
        }
        if (!def.symmetric) td.title = r.names[p[1]] + " vs " + r.names[p[0]] + ": " + G.fmt(r.matrix[code][p[1]][p[0]]);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    $("asymmetricNote").textContent = anyAsym ? "* Asymmetric metric: the first set of each pair is the reference. Hover a value to see the reverse direction." : "";

    // maximum cluster match
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

  // ---------------------------------------------------------------- rendering: visualize
  var VIZ_TITLES = { bar: "Bar plot", heatmap: "Hierarchical heatmap", sankey: "Sankey plot", network: "Network of cluster sets", circos: "Circos plot" };
  var VIZ_NOTES = {
    bar: "One bar per pair of cluster sets, sorted from most to least similar.",
    heatmap: "Rows and columns are ordered by hierarchical clustering, so similar sets sit together.",
    sankey: "Band thickness is relative to the other pairs shown.",
    network: "Thicker edges join more similar sets. Drag a node to move it.",
    circos: "Ribbons join pairs of sets and are shaded by similarity."
  };

  function renderVisualize() {
    var r = state.result, msg = $("vizMessage");
    $("vizBody").hidden = !r;
    msg.hidden = !!r;
    if (!r) {
      setNotice(msg, state.sets.length ? "warn" : "", (state.sets.length ? notRunParts() : ["Load cluster set files first. "]).concat([linkTo("files", "Go to Files")]));
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

    var def = C.metricByCode(v.metric), shown = pairs.filter(function (p) { return p.value >= v.threshold - 1e-9; });
    $("vizTitle").textContent = VIZ_TITLES[v.kind] + ": " + def.label;
    $("vizNote").textContent = VIZ_NOTES[v.kind] + " Showing " + shown.length + " of " + pairs.length + " pairs." +
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

  // ---------------------------------------------------------------- rendering: network quality
  var QUALITY_COLUMNS = [
    { key: "name", label: "Cluster" },
    { key: "objects", label: "Objects", num: true },
    { key: "inNetwork", label: "In network", num: true },
    { key: "internalEdges", label: "Internal edges", num: true },
    { key: "cutEdges", label: "Cut edges", num: true },
    { key: "conductance", label: "Conductance", num: true, dec: true },
    { key: "internalDensity", label: "Internal density", num: true, dec: true },
    { key: "cutRatio", label: "Cut ratio", num: true, dec: true }
  ];

  function sortedQualityRows() {
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

  function renderQuality() {
    var msg = $("qualityMessage"), q = state.quality;
    $("networkName").textContent = state.network
      ? state.networkName + ": " + state.network.nodes.length + " nodes, " + state.network.edges.length + " edges"
      : "No network loaded";
    fillSelect($("qualitySet"), state.sets.map(function (s) { return [s.id, s.name]; }), state.qualityId);
    setPressed($("qualityStage"), "stage", state.qualityStage);
    $("qualityBody").hidden = !q;
    if (!q) {
      var need = !state.network && !state.sets.length ? "Load a network file and at least one cluster set file, or use the example."
        : !state.network ? "Load a network file to evaluate the clusters on it." : "Load a cluster set file in the Files tab.";
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

  function renderQualityTable() {
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

  // ---------------------------------------------------------------- tabs and top-level render
  var currentTab = "files";
  function showTab(tab) {
    currentTab = tab;
    Array.prototype.forEach.call($("tabs").querySelectorAll("button"), function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-tab") === tab ? "true" : "false");
    });
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (s) { s.classList.toggle("active", s.id === "tab-" + tab); });
    render();
    global.scrollTo(0, 0);
  }

  // Charts measure their container, so only the visible tab is drawn.
  function render() {
    $("countSets").textContent = state.sets.length;
    if (currentTab === "files") renderFiles();
    else if (currentTab === "compare") renderCompare();
    else if (currentTab === "visualize") renderVisualize();
    else if (currentTab === "quality") renderQuality();
  }

  // ---------------------------------------------------------------- loading files
  function readFiles(fileList, handler, done) {
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

  function loadClusterFiles(fileList) {
    readFiles(fileList, addClusterSet, function (errors) {
      refresh();
      if (errors.length) global.alert("Some files could not be loaded:\n\n" + errors.join("\n"));
    });
  }

  function loadNetworkFile(fileList) {
    readFiles([fileList[0]], function (name, text) {
      state.network = C.parseEdgeList(text);
      state.networkName = name;
    }, function (errors) {
      refresh();
      if (errors.length) global.alert("The network could not be loaded:\n\n" + errors.join("\n"));
    });
  }

  function loadExample(files, opts) {
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
    if (opts.network) {
      state.network = C.parseEdgeList(VICTOR.examples[opts.network]);
      state.networkName = opts.network;
    }
    refresh();
  }

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

  // ---------------------------------------------------------------- export dialog
  var exportTarget = null; // { chartId, title }

  function exportChoice() {
    var format = document.querySelector('input[name="exportFormat"]:checked').value;
    return {
      format: format, scale: +$("exportScale").value, background: $("exportBackground").value,
      title: $("exportWithTitle").checked ? exportTarget.title : "",
      filename: ($("exportName").value.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 100)) || "victor_plot"
    };
  }

  function syncExportDialog() {
    var source = G.exportSource($(exportTarget.chartId)), svgRadio = document.querySelector('input[name="exportFormat"][value="svg"]');
    svgRadio.disabled = !source || source.kind !== "svg"; // the large network is drawn as pixels
    if (svgRadio.disabled && svgRadio.checked) document.querySelector('input[name="exportFormat"][value="png"]').checked = true;
    var choice = exportChoice(), format = G.EXPORT_FORMATS[choice.format];
    $("exportExt").textContent = "." + format.ext;
    $("exportScale").disabled = !!format.vector;
    var transparent = $("exportBackground").querySelector('option[value="transparent"]');
    transparent.disabled = !format.transparent;
    if (!format.transparent && $("exportBackground").value === "transparent") $("exportBackground").value = "white";
    $("exportError").textContent = "";
    if (!source) { $("exportInfo").textContent = "There is no plot to export yet."; $("exportGo").disabled = true; return; }
    $("exportGo").disabled = false;
    var w = source.width, h = source.height + (choice.title ? G.TITLE_BAND : 0);
    var inches = function (px, dpi) { return (px / dpi).toFixed(1); }, cm = function (px, dpi) { return (px / dpi * 2.54).toFixed(1); };
    if (format.vector) {
      $("exportInfo").textContent = "Vector image, " + Math.round(w) + " \u00d7 " + Math.round(h) + " units; scales to any size without loss.";
    } else {
      var pw = Math.round(w * choice.scale), ph = Math.round(h * choice.scale), dpi = 96 * choice.scale;
      $("exportInfo").textContent = pw.toLocaleString() + " \u00d7 " + ph.toLocaleString() + " px \u00b7 " + dpi + " dpi when printed at the on-screen size, " +
        inches(w, 96) + " \u00d7 " + inches(h, 96) + " in (" + cm(w, 96) + " \u00d7 " + cm(h, 96) + " cm) \u00b7 " +
        inches(pw, 300) + " \u00d7 " + inches(ph, 300) + " in (" + cm(pw, 300) + " \u00d7 " + cm(ph, 300) + " cm) at 300 dpi" +
        (source.kind === "canvas" ? " \u00b7 this plot is drawn as pixels, so it does not get sharper above the screen's own resolution" : "") +
        (choice.format === "pdf" ? " \u00b7 the PDF holds the plot as an image" : "");
    }
  }

  function openExportDialog(button) {
    var chartId = button.getAttribute("data-chart");
    if (chartId === "vizChart") {
      exportTarget = { chartId: chartId, title: $("vizTitle").textContent };
      $("exportName").value = "victor_" + state.viz.kind + "_" + state.viz.metric;
    } else {
      exportTarget = { chartId: chartId, title: button.getAttribute("data-title") };
      $("exportName").value = button.getAttribute("data-name");
    }
    syncExportDialog();
    $("exportDialog").showModal();
  }

  function runExport() {
    var choice = exportChoice(), dialog = $("exportDialog"), go = $("exportGo");
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    // A white background needs the light colours: in the dark theme the plot is redrawn light for the export.
    var relight = dark && choice.background === "white";
    function finish(error) {
      if (relight) { document.documentElement.setAttribute("data-theme", "dark"); render(); }
      go.disabled = false;
      go.textContent = "Download";
      if (error) $("exportError").textContent = error; else dialog.close();
    }
    go.disabled = true;
    go.textContent = "Preparing\u2026";
    if (!relight) { G.exportImage($(exportTarget.chartId), choice, finish); return; }
    document.documentElement.setAttribute("data-theme", "light");
    render();
    var animated = exportTarget.chartId === "chartGraph" || (exportTarget.chartId === "vizChart" && state.viz.kind === "network" && state.viz.layout === "force");
    setTimeout(function () { G.exportImage($(exportTarget.chartId), choice, finish); }, animated ? 2500 : 60); // moving layouts get time to settle
  }

  function initExportDialog() {
    Array.prototype.forEach.call(document.querySelectorAll(".export-btn"), function (b) {
      b.addEventListener("click", function () { openExportDialog(b); });
    });
    ["exportScale", "exportBackground", "exportWithTitle"].forEach(function (id) { $(id).addEventListener("change", syncExportDialog); });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="exportFormat"]'), function (r) { r.addEventListener("change", syncExportDialog); });
    $("exportCancel").addEventListener("click", function () { $("exportDialog").close(); });
    $("exportGo").addEventListener("click", runExport);
  }

  // ---------------------------------------------------------------- events
  function init() {
    Array.prototype.forEach.call($("tabs").querySelectorAll("button"), function (b) {
      b.addEventListener("click", function () { showTab(b.getAttribute("data-tab")); });
    });
    wireDropzone($("dropzone"), loadClusterFiles);
    wireDropzone($("networkDropzone"), loadNetworkFile);

    fillSelect($("exampleSelect"), EXAMPLES.map(function (e, k) { return [k, e.label]; }), 0);
    function describeExample() { $("exampleDescription").textContent = EXAMPLES[+$("exampleSelect").value].description; }
    $("exampleSelect").addEventListener("change", describeExample);
    describeExample();
    $("exampleLoad").addEventListener("click", function () { var e = EXAMPLES[+$("exampleSelect").value]; loadExample(e.files, e); });
    $("emptyExample").addEventListener("click", function () { loadExample(EXAMPLES[0].files, EXAMPLES[0]); });
    $("exampleNetwork").addEventListener("click", function () {
      loadExample(["Clustering_data1.txt", "Clustering_data2.txt", "Clustering_data3.txt"], { network: "Network_file.txt" });
    });

    $("sizeMin").addEventListener("change", function () { state.sizeMin = Math.max(1, Math.floor(+this.value || 1)); refresh(); });
    $("sizeMax").addEventListener("change", function () { state.sizeMax = Math.max(1, Math.floor(+this.value || 1)); state.sizeMaxTouched = true; refresh(); });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="filterMode"]'), function (r) {
      r.addEventListener("change", function () { if (r.checked) { state.filterMode = r.value; refresh(); } });
    });
    $("resetFilters").addEventListener("click", function () { state.sizeMin = 1; state.sizeMaxTouched = false; state.filterMode = "none"; refresh(); });
    $("selectAll").addEventListener("change", function () {
      var on = this.checked;
      state.sets.forEach(function (s) { s.selected = on; });
      refresh();
    });
    $("inspectSet").addEventListener("change", function () { state.inspectId = +this.value; render(); });
    $("inspectStage").addEventListener("click", function (e) {
      var stage = e.target.getAttribute("data-stage");
      if (stage) { state.inspectStage = stage; render(); }
    });

    function setMetrics(codes) { state.metrics = codes; renderMetricList(); compare(); render(); }
    $("metricsAll").addEventListener("click", function () { setMetrics(C.METRICS.map(function (m) { return m.code; })); });
    $("metricsNone").addEventListener("click", function () { setMetrics([]); });
    $("metricsDefault").addEventListener("click", function () { setMetrics(ORIGINAL_TEN.slice()); });
    $("matchA").addEventListener("change", function () { state.matchA = +this.value; render(); });
    $("matchB").addEventListener("change", function () { state.matchB = +this.value; render(); });
    $("downloadCsv").addEventListener("click", function () {
      var r = state.result, rows = [["metric", "first_set", "second_set", "value"]];
      r.codes.forEach(function (code) {
        var sym = C.metricByCode(code).symmetric;
        for (var i = 0; i < r.names.length; i++) for (var j = 0; j < r.names.length; j++) {
          if (i === j || (sym && j < i)) continue;
          rows.push([code, r.names[i], r.names[j], r.matrix[code][i][j]]);
        }
      });
      downloadCsv(rows, "victor_comparison.csv");
    });
    $("downloadMatchCsv").addEventListener("click", function () {
      var a = setById(state.matchA), b = setById(state.matchB);
      if (!a || !b) return;
      var rows = [[a.name, b.name, "shared_objects", "size_first", "size_second", "jaccard"]];
      (state.matchRows || []).forEach(function (m) { rows.push([m.a, m.b, m.overlap, m.sizeA, m.sizeB, m.jaccard]); });
      downloadCsv(rows, "victor_cluster_match.csv");
    });

    $("vizKind").addEventListener("click", function (e) {
      var kind = e.target.getAttribute("data-kind");
      if (kind) { state.viz.kind = kind; render(); }
    });
    $("vizMetric").addEventListener("change", function () { state.viz.metric = this.value; state.viz.threshold = null; render(); });
    $("vizThreshold").addEventListener("input", function () { state.viz.threshold = +this.value; render(); });
    $("netLayout").addEventListener("change", function () { state.viz.layout = this.value; render(); });
    initExportDialog();

    $("qualitySet").addEventListener("change", function () { state.qualityId = +this.value; computeQuality(); render(); });
    $("qualityStage").addEventListener("click", function (e) {
      var stage = e.target.getAttribute("data-stage");
      if (stage) { state.qualityStage = stage; computeQuality(); render(); }
    });
    $("downloadQualityCsv").addEventListener("click", function () {
      var rows = [QUALITY_COLUMNS.map(function (c) { return c.label; })];
      sortedQualityRows().forEach(function (r) { rows.push(QUALITY_COLUMNS.map(function (c) { return r[c.key] === null ? "" : r[c.key]; })); });
      downloadCsv(rows, "victor_cluster_quality.csv");
    });

    var resizeTimer = null;
    global.addEventListener("resize", function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 150); });

    function syncThemeButton() {
      var dark = document.documentElement.getAttribute("data-theme") === "dark";
      $("themeToggle").textContent = dark ? "Light theme" : "Dark theme";
      $("themeToggle").setAttribute("aria-pressed", dark ? "true" : "false");
    }
    $("themeToggle").addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { global.localStorage.setItem("victor-theme", next); } catch (e) { /* not remembered without storage */ }
      syncThemeButton();
      render();
    });
    syncThemeButton();

    renderMetricList();
    refresh();
  }

  VICTOR.state = state; // exposed for debugging and tests
  VICTOR.showTab = showTab;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(window);
