/*
 * VICTOR core: parsing, filtering, cluster set comparison metrics, cluster matching,
 * hierarchical clustering and network cluster quality.
 * Pure functions with no DOM access, so they can be tested on their own (see test/test.html).
 */
(function (global) {
  "use strict";

  var VICTOR = global.VICTOR = global.VICTOR || {};

  // ---------------------------------------------------------------- metric catalogue
  // direction: every metric is a similarity (higher = more similar).
  // symmetric: false means the value depends on which cluster set comes first ("A vs B": A is the reference).
  var METRICS = [
    { code: "adjrand", label: "Adjusted Rand Index", group: "Counting pairs", symmetric: true },
    { code: "rand", label: "Rand Index", group: "Counting pairs", symmetric: true },
    { code: "fmi", label: "Fowlkes-Mallows Index", group: "Counting pairs", symmetric: true },
    { code: "jaccard", label: "Jaccard Index", group: "Counting pairs", symmetric: true },
    { code: "overlap", label: "Overlap Coefficient", group: "Counting pairs", symmetric: true },
    { code: "wallace1", label: "Wallace Criterion Type 1", group: "Counting pairs", symmetric: false },
    { code: "wallace2", label: "Wallace Criterion Type 2", group: "Counting pairs", symmetric: false },
    { code: "mmm", label: "Maximum-Match Measure", group: "Set overlaps / matching", symmetric: true },
    { code: "f", label: "F-Measure", group: "Set overlaps / matching", symmetric: false },
    { code: "match_opt", label: "Optimal-Match Accuracy (Hungarian)", group: "Set overlaps / matching", symmetric: true },
    { code: "mhm", label: "Purity (Meila-Heckerman Measure)", group: "Set overlaps / matching", symmetric: false },
    { code: "vdm_norm", label: "Van Dongen Measure (normalized, inverted)", group: "Set overlaps / matching", symmetric: true },
    { code: "bcubed_p", label: "B-Cubed Precision", group: "Set overlaps / matching", symmetric: false },
    { code: "bcubed_r", label: "B-Cubed Recall", group: "Set overlaps / matching", symmetric: false },
    { code: "bcubed_f", label: "B-Cubed F-Score", group: "Set overlaps / matching", symmetric: true },
    { code: "ecs", label: "Element-Centric Similarity", group: "Set overlaps / matching", symmetric: true },
    { code: "nmi1", label: "NMI by Strehl & Ghosh (geometric mean)", group: "Mutual information", symmetric: true },
    { code: "nmi2", label: "NMI by Fred & Jain (arithmetic mean)", group: "Mutual information", symmetric: true },
    { code: "nmi_max", label: "NMI normalized by the larger entropy", group: "Mutual information", symmetric: true },
    { code: "ami", label: "Adjusted Mutual Information", group: "Mutual information", symmetric: true },
    { code: "nvi", label: "Normalized Variation of Information (inverted)", group: "Mutual information", symmetric: true },
    { code: "vi_norm", label: "Variation of Information (by log n, inverted)", group: "Mutual information", symmetric: true },
    { code: "vi_joint", label: "Variation of Information (by joint entropy, inverted)", group: "Mutual information", symmetric: true },
    { code: "homogeneity", label: "Homogeneity", group: "Mutual information", symmetric: false },
    { code: "completeness", label: "Completeness", group: "Mutual information", symmetric: false },
    // cover metrics: the only ones that also accept overlapping clusterings (an object in several clusters)
    { code: "omega", label: "Omega Index", group: "Overlapping clusterings", symmetric: true, cover: true },
    { code: "onmi", label: "Overlapping NMI (Lancichinetti et al.)", group: "Overlapping clusterings", symmetric: true, cover: true }
  ];

  // asymmetric metric -> the metric that gives its value with the two cluster sets swapped
  var REVERSE_OF = {
    wallace1: "wallace2", wallace2: "wallace1", homogeneity: "completeness", completeness: "homogeneity",
    bcubed_p: "bcubed_r", bcubed_r: "bcubed_p", f: "f_rev", mhm: "mhm_rev"
  };

  function metricByCode(code) {
    for (var i = 0; i < METRICS.length; i++) if (METRICS[i].code === code) return METRICS[i];
    return null;
  }

  // ---------------------------------------------------------------- parsing
  // Cluster set file: one cluster per line, "<cluster name><TAB><comma-separated object names>".
  // Returns { clusters: [{ name, members: [..] }], warnings: [..] }. Throws on unusable input.
  function parseClusterFile(text) {
    var lines = String(text).replace(/^﻿/, "").split(/\r\n|\n|\r/);
    var clusters = [], warnings = [], skipped = 0, usedNames = new Set();
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line.trim()) continue;
      var tab = line.indexOf("\t"), name, rest;
      if (tab >= 0) {
        name = line.slice(0, tab).trim();
        rest = line.slice(tab + 1);
      } else {
        var m = line.trim().match(/^(\S+)\s+(.*)$/);
        if (!m) { skipped++; continue; }
        name = m[1];
        rest = m[2];
      }
      var seen = new Set(), members = [];
      rest.split(",").forEach(function (o) {
        o = o.trim();
        if (o && !seen.has(o)) { seen.add(o); members.push(o); }
      });
      if (!name || members.length === 0) { skipped++; continue; }
      if (usedNames.has(name)) {
        var k = 2;
        while (usedNames.has(name + "_" + k)) k++;
        warnings.push("Duplicate cluster name \"" + name + "\" renamed to \"" + name + "_" + k + "\".");
        name = name + "_" + k;
      }
      usedNames.add(name);
      clusters.push({ name: name, members: members });
    }
    if (clusters.length === 0) {
      throw new Error("No clusters found. Each line needs two columns: a cluster name, a tab, and comma-separated object names.");
    }
    if (skipped > 0) warnings.push(skipped + " line(s) could not be read and were skipped.");
    return { clusters: clusters, warnings: warnings };
  }

  // Edge list: "<source><TAB or space><target>[<TAB or space><weight>]" per line.
  // The network is treated as undirected; duplicate edges are merged (weights summed), self-loops dropped.
  function parseEdgeList(text) {
    var lines = String(text).replace(/^﻿/, "").split(/\r\n|\n|\r/);
    var index = new Map(), nodes = [], edgeMap = new Map(), edges = [], loops = 0, duplicates = 0, weighted = false, rows = 0;
    function nodeId(name) {
      if (!index.has(name)) { index.set(name, nodes.length); nodes.push(name); }
      return index.get(name);
    }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var parts = line.indexOf("\t") >= 0 ? line.split("\t") : line.split(/\s+/);
      parts = parts.map(function (p) { return p.trim(); });
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        throw new Error("Line " + (i + 1) + ": a network needs 2 (unweighted) or 3 (weighted) columns.");
      }
      var w = 1;
      if (parts.length >= 3 && parts[2] !== "") {
        w = Number(parts[2]);
        if (!isFinite(w)) throw new Error("Line " + (i + 1) + ": the weight (3rd column) must be numeric.");
        weighted = true;
      }
      rows++;
      if (parts[0] === parts[1]) { nodeId(parts[0]); loops++; continue; }
      var s = nodeId(parts[0]), t = nodeId(parts[1]);
      var key = s < t ? s + "|" + t : t + "|" + s;
      if (edgeMap.has(key)) { edges[edgeMap.get(key)].w += w; duplicates++; }
      else { edgeMap.set(key, edges.length); edges.push({ s: Math.min(s, t), t: Math.max(s, t), w: w }); }
    }
    if (edges.length === 0) throw new Error("No edges found in the network file.");
    return { nodes: nodes, edges: edges, weighted: weighted, rows: rows, loops: loops, duplicates: duplicates };
  }

  // ---------------------------------------------------------------- cluster set helpers
  function countObjects(clusters) {
    var n = 0;
    for (var i = 0; i < clusters.length; i++) n += clusters[i].members.length;
    return n;
  }

  function objectSet(clusters) {
    var set = new Set();
    clusters.forEach(function (c) { c.members.forEach(function (o) { set.add(o); }); });
    return set;
  }

  // Objects that appear in more than one cluster (the metrics need strict partitions)
  function overlappingObjects(clusters) {
    var seen = new Set(), dup = new Set();
    clusters.forEach(function (c) {
      c.members.forEach(function (o) { if (seen.has(o)) dup.add(o); else seen.add(o); });
    });
    return Array.from(dup);
  }

  function maxClusterSize(clusters) {
    var m = 0;
    clusters.forEach(function (c) { if (c.members.length > m) m = c.members.length; });
    return m;
  }

  function filterBySize(clusters, min, max) {
    return clusters.filter(function (c) { return c.members.length >= min && c.members.length <= max; });
  }

  // Keeps only the objects present in every cluster set; clusters left empty are removed.
  function intersectionFilter(listOfClusters) {
    if (listOfClusters.length === 0) return [];
    var sets = listOfClusters.map(objectSet);
    var common = new Set();
    sets[0].forEach(function (o) {
      for (var i = 1; i < sets.length; i++) if (!sets[i].has(o)) return;
      common.add(o);
    });
    return listOfClusters.map(function (clusters) {
      var out = [];
      clusters.forEach(function (c) {
        var members = c.members.filter(function (o) { return common.has(o); });
        if (members.length > 0) out.push({ name: c.name, members: members });
      });
      return out;
    });
  }

  // Adds a singleton cluster for every object that a cluster set lacks but another one has.
  function supersetFilter(listOfClusters) {
    var sets = listOfClusters.map(objectSet);
    var union = new Set();
    sets.forEach(function (s) { s.forEach(function (o) { union.add(o); }); });
    var all = Array.from(union).sort();
    return listOfClusters.map(function (clusters, idx) {
      var out = clusters.map(function (c) { return { name: c.name, members: c.members.slice() }; });
      var names = new Set();
      out.forEach(function (c) { names.add(c.name); });
      all.forEach(function (o) {
        if (!sets[idx].has(o)) {
          var name = "Singleton_" + o;
          while (names.has(name)) name += "_";
          names.add(name);
          out.push({ name: name, members: [o] });
        }
      });
      return out;
    });
  }

  // Exclusive intersections of the objects of several cluster sets, for an UpSet plot.
  // Returns { sizes: [objects per set], combos: [{ members: [true/false per set], degree, count }] },
  // where count is the number of objects found in exactly those sets. Largest first.
  function objectIntersections(listOfClusters) {
    var sets = listOfClusters.map(objectSet), tally = new Map();
    sets.forEach(function (set, idx) {
      set.forEach(function (o) {
        if (tally.has(o)) return; // already keyed when met in an earlier set
        var key = "";
        for (var k = 0; k < sets.length; k++) key += k === idx || sets[k].has(o) ? "1" : "0";
        tally.set(o, key);
      });
    });
    var counts = new Map();
    tally.forEach(function (key) { counts.set(key, (counts.get(key) || 0) + 1); });
    var combos = [];
    counts.forEach(function (count, key) {
      var members = key.split("").map(function (c) { return c === "1"; });
      combos.push({ members: members, degree: members.filter(Boolean).length, count: count });
    });
    combos.sort(function (a, b) { return b.count - a.count || b.degree - a.degree; });
    return { sizes: sets.map(function (s) { return s.size; }), combos: combos, total: tally.size };
  }

  // ---------------------------------------------------------------- confusion matrix
  // Sparse confusion matrix between two cluster sets of the same objects.
  // Returns { n, a: [sizes of A's clusters], b: [...], cells: [{ i, j, m }], namesA, namesB }.
  function confusion(clustersA, clustersB) {
    var mapA = new Map(), mapB = new Map(), i, k;
    for (i = 0; i < clustersA.length; i++) {
      for (k = 0; k < clustersA[i].members.length; k++) {
        if (mapA.has(clustersA[i].members[k])) throw new Error("overlap:A:" + clustersA[i].members[k]);
        mapA.set(clustersA[i].members[k], i);
      }
    }
    for (i = 0; i < clustersB.length; i++) {
      for (k = 0; k < clustersB[i].members.length; k++) {
        if (mapB.has(clustersB[i].members[k])) throw new Error("overlap:B:" + clustersB[i].members[k]);
        mapB.set(clustersB[i].members[k], i);
      }
    }
    if (mapA.size !== mapB.size) throw new Error("objects:" + mapA.size + ":" + mapB.size);
    var L = clustersB.length, counts = new Map();
    mapA.forEach(function (ia, obj) {
      var ib = mapB.get(obj);
      if (ib === undefined) throw new Error("objects:" + mapA.size + ":" + mapB.size);
      var key = ia * L + ib;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    var cells = [];
    counts.forEach(function (m, key) { cells.push({ i: Math.floor(key / L), j: key % L, m: m }); });
    return {
      n: mapA.size,
      a: clustersA.map(function (c) { return c.members.length; }),
      b: clustersB.map(function (c) { return c.members.length; }),
      cells: cells,
      namesA: clustersA.map(function (c) { return c.name; }),
      namesB: clustersB.map(function (c) { return c.name; })
    };
  }

  // ---------------------------------------------------------------- metrics
  function comb2(v) { return v * (v - 1) / 2; }

  function entropy(sizes, n) {
    var h = 0;
    for (var i = 0; i < sizes.length; i++) if (sizes[i] > 0) { var p = sizes[i] / n; h -= p * Math.log(p); }
    return h;
  }

  function mutualInformation(c) {
    var I = 0;
    for (var k = 0; k < c.cells.length; k++) {
      var x = c.cells[k];
      I += x.m / c.n * Math.log(x.m * c.n / (c.a[x.i] * c.b[x.j]));
    }
    return I;
  }

  // Expected Mutual Information under the hypergeometric model (Vinh, Epps & Bailey 2010).
  // Clusters of equal size give equal terms, so the sum runs over unique sizes weighted by their counts.
  function expectedMutualInformation(a, b, n) {
    var logFact = new Float64Array(n + 2);
    for (var v = 2; v <= n + 1; v++) logFact[v] = logFact[v - 1] + Math.log(v);
    function tally(sizes) {
      var m = new Map();
      sizes.forEach(function (s) { m.set(s, (m.get(s) || 0) + 1); });
      return Array.from(m.entries());
    }
    var ta = tally(a), tb = tally(b), emi = 0;
    for (var i = 0; i < ta.length; i++) {
      var ai = ta[i][0];
      for (var j = 0; j < tb.length; j++) {
        var bj = tb[j][0], lo = Math.max(1, ai + bj - n), hi = Math.min(ai, bj), sum = 0;
        var base = logFact[ai] + logFact[bj] + logFact[n - ai] + logFact[n - bj] - logFact[n];
        for (var nij = lo; nij <= hi; nij++) {
          var logp = base - logFact[nij] - logFact[ai - nij] - logFact[bj - nij] - logFact[n - ai - bj + nij];
          sum += nij / n * Math.log(n * nij / (ai * bj)) * Math.exp(logp);
        }
        emi += ta[i][1] * tb[j][1] * sum;
      }
    }
    return emi;
  }

  // Greedy maximum matching on the confusion matrix: repeatedly take the largest remaining cell
  // and remove its row and column. Returns [{ i, j, m }].
  function greedyMatch(c) {
    var cells = c.cells.slice().sort(function (x, y) { return y.m - x.m || x.i - y.i || x.j - y.j; });
    var usedA = new Uint8Array(c.a.length), usedB = new Uint8Array(c.b.length), out = [];
    for (var k = 0; k < cells.length; k++) {
      if (!usedA[cells[k].i] && !usedB[cells[k].j]) {
        usedA[cells[k].i] = 1;
        usedB[cells[k].j] = 1;
        out.push(cells[k]);
      }
    }
    return out;
  }

  // Error for a metric whose cost is out of reach for these inputs. compareAll skips that metric and carries on.
  function tooLarge(code, message) {
    var e = new Error(message);
    e.tooLarge = true;
    e.code = code;
    return e;
  }

  // Largest total overlap over all one-to-one matchings of clusters (Hungarian algorithm, O(min(K,L)^2 * max(K,L))).
  var MAX_MATCH_CELLS = 4e6;
  function optimalMatchTotal(c) {
    var K = c.a.length, L = c.b.length, rows = Math.min(K, L), cols = Math.max(K, L), flip = K > L;
    if (rows * cols > MAX_MATCH_CELLS) {
      throw tooLarge("match_opt", "needs a " + K + " x " + L + " matrix of clusters, which is too large to solve in the browser");
    }
    var gain = new Float64Array(rows * cols), k;
    for (k = 0; k < c.cells.length; k++) {
      var x = c.cells[k];
      gain[(flip ? x.j : x.i) * cols + (flip ? x.i : x.j)] = x.m;
    }
    var u = new Float64Array(rows + 1), v = new Float64Array(cols + 1), match = new Int32Array(cols + 1), way = new Int32Array(cols + 1);
    var minv = new Float64Array(cols + 1), used = new Uint8Array(cols + 1), i, j;
    for (i = 1; i <= rows; i++) {
      match[0] = i;
      minv.fill(Infinity);
      used.fill(0);
      var j0 = 0;
      do {
        used[j0] = 1;
        var i0 = match[j0], delta = Infinity, j1 = 0;
        for (j = 1; j <= cols; j++) {
          if (used[j]) continue;
          var cur = -gain[(i0 - 1) * cols + (j - 1)] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (j = 0; j <= cols; j++) {
          if (used[j]) { u[match[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
        }
        j0 = j1;
      } while (match[j0] !== 0);
      do { var jPrev = way[j0]; match[j0] = match[jPrev]; j0 = jPrev; } while (j0);
    }
    var total = 0;
    for (j = 1; j <= cols; j++) if (match[j]) total += gain[(match[j] - 1) * cols + (j - 1)];
    return total;
  }

  // Calculates the requested metrics (array of codes) from a confusion matrix. Returns { code: value }.
  function computeMetrics(c, codes) {
    var n = c.n, a = c.a, b = c.b, cells = c.cells, k;
    var K = a.length, L = b.length;
    var identical = cells.length === K && cells.length === L; // same partition up to relabelling
    function ratio(num, den) { return den > 0 ? num / den : (identical ? 1 : 0); }

    // pair counts
    var pairs = comb2(n), together = 0, pa = 0, pb = 0;
    for (k = 0; k < cells.length; k++) together += comb2(cells[k].m);
    for (k = 0; k < K; k++) pa += comb2(a[k]);
    for (k = 0; k < L; k++) pb += comb2(b[k]);

    // row / column summaries
    var rowMax = new Float64Array(K), colMax = new Float64Array(L), rowBestF = new Float64Array(K), colBestF = new Float64Array(L);
    var bcP = 0, bcR = 0, ecs = 0;
    for (k = 0; k < cells.length; k++) {
      var x = cells[k];
      if (x.m > rowMax[x.i]) rowMax[x.i] = x.m;
      if (x.m > colMax[x.j]) colMax[x.j] = x.m;
      var fij = 2 * x.m / (a[x.i] + b[x.j]);
      if (fij > rowBestF[x.i]) rowBestF[x.i] = fij;
      if (fij > colBestF[x.j]) colBestF[x.j] = fij;
      bcP += x.m * x.m / b[x.j];
      bcR += x.m * x.m / a[x.i];
      ecs += x.m * x.m / Math.max(a[x.i], b[x.j]);
    }
    bcP /= n;
    bcR /= n;
    var sumRowMax = 0, sumColMax = 0, fMeasure = 0, fMeasureReverse = 0;
    for (k = 0; k < K; k++) { sumRowMax += rowMax[k]; fMeasure += a[k] / n * rowBestF[k]; }
    for (k = 0; k < L; k++) { sumColMax += colMax[k]; fMeasureReverse += b[k] / n * colBestF[k]; }

    // information
    var ha = entropy(a, n), hb = entropy(b, n);
    var I = Math.min(Math.max(mutualInformation(c), 0), Math.min(ha, hb));

    var out = {};
    codes.forEach(function (code) {
      var v;
      switch (code) {
        case "rand": v = pairs > 0 ? (pairs - pa - pb + 2 * together) / pairs : 1; break;
        case "adjrand":
          var expected = pairs > 0 ? pa * pb / pairs : 0, maximum = (pa + pb) / 2;
          v = (maximum - expected) !== 0 ? (together - expected) / (maximum - expected) : (identical ? 1 : 0);
          break;
        case "fmi": v = ratio(together, Math.sqrt(pa * pb)); break;
        case "jaccard": v = ratio(together, pa + pb - together); break;
        case "overlap": v = ratio(together, Math.min(pa, pb)); break;
        case "wallace1": v = ratio(together, pa); break;
        case "wallace2": v = ratio(together, pb); break;
        case "mmm":
          var matched = 0;
          greedyMatch(c).forEach(function (m) { matched += m.m; });
          v = matched / n;
          break;
        case "match_opt": v = optimalMatchTotal(c) / n; break;
        // Element-centric similarity (Gates et al. 2019). For strict partitions the per-object score reduces to
        // shared objects / size of the larger of the object's two clusters, whatever the alpha parameter.
        case "ecs": v = ecs / n; break;
        case "f": v = fMeasure; break;
        case "mhm": v = sumRowMax / n; break;
        // internal codes: the same two metrics with the cluster sets swapped (see REVERSE_OF)
        case "f_rev": v = fMeasureReverse; break;
        case "mhm_rev": v = sumColMax / n; break;
        case "vdm_norm": v = 1 - (2 * n - sumRowMax - sumColMax) / (2 * n); break;
        case "bcubed_p": v = bcP; break;
        case "bcubed_r": v = bcR; break;
        case "bcubed_f": v = 2 * bcP * bcR / (bcP + bcR); break;
        case "nmi1": v = ha > 0 && hb > 0 ? I / Math.sqrt(ha * hb) : (ha === 0 && hb === 0 ? 1 : 0); break;
        case "nmi2": v = ha + hb > 0 ? 2 * I / (ha + hb) : 1; break;
        case "nmi_max": v = Math.max(ha, hb) > 0 ? I / Math.max(ha, hb) : 1; break;
        case "ami":
          if ((K === 1 && L === 1) || (K === n && L === n)) { v = 1; break; }
          var emi = expectedMutualInformation(a, b, n), den = (ha + hb) / 2 - emi;
          v = Math.abs(den) < 1e-12 ? 0 : (I - emi) / den;
          break;
        case "nvi":
          if (ha === 0 && hb === 0) v = 1;
          else if (ha === 0 || hb === 0) v = 0;
          else v = 1 - 0.5 * ((ha - I) / ha + (hb - I) / hb);
          break;
        case "vi_norm": v = n > 1 ? 1 - Math.max(ha + hb - 2 * I, 0) / Math.log(n) : 1; break;
        case "vi_joint": v = ha + hb - I > 1e-12 ? 1 - Math.max(ha + hb - 2 * I, 0) / (ha + hb - I) : 1; break;
        case "homogeneity": v = ha > 0 ? I / ha : 1; break;
        case "completeness": v = hb > 0 ? I / hb : 1; break;
        default: throw new Error("Unknown metric: " + code);
      }
      out[code] = v;
    });
    return out;
  }

  // Best-matching cluster pairs between two cluster sets (greedy maximum match), largest overlap first.
  function maximumMatch(clustersA, clustersB) {
    var c = confusion(clustersA, clustersB);
    return greedyMatch(c).map(function (m) {
      return {
        a: c.namesA[m.i], b: c.namesB[m.j], overlap: m.m,
        sizeA: c.a[m.i], sizeB: c.b[m.j],
        jaccard: m.m / (c.a[m.i] + c.b[m.j] - m.m)
      };
    });
  }

  // ---------------------------------------------------------------- metrics for overlapping clusterings
  var MAX_OMEGA_PAIRS = 6e6, MAX_ONMI_CELLS = 2e7;

  function objectIndex(clustersA, clustersB) {
    var index = new Map();
    [clustersA, clustersB].forEach(function (clusters) {
      clusters.forEach(function (c) { c.members.forEach(function (o) { if (!index.has(o)) index.set(o, index.size); }); });
    });
    return index;
  }

  // For every pair of objects that share at least one cluster: in how many clusters they are together.
  function pairCounts(clusters, index, n) {
    var total = 0, counts = new Map();
    clusters.forEach(function (c) { total += comb2(c.members.length); });
    if (total > MAX_OMEGA_PAIRS) {
      throw tooLarge("omega", "would have to count " + Math.round(total / 1e6) + " million object pairs, which is too many for the browser");
    }
    clusters.forEach(function (c) {
      var ids = c.members.map(function (o) { return index.get(o); });
      for (var p = 0; p < ids.length; p++) {
        for (var q = p + 1; q < ids.length; q++) {
          var key = ids[p] < ids[q] ? ids[p] * n + ids[q] : ids[q] * n + ids[p];
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      }
    });
    return counts;
  }

  // Omega Index (Collins & Dent 1988): the Adjusted Rand Index generalized to overlapping clusterings.
  // Two clusterings agree on a pair of objects when the pair shares the same number of clusters in both.
  function omegaIndex(clustersA, clustersB) {
    var index = objectIndex(clustersA, clustersB), n = index.size, M = comb2(n);
    if (M === 0) return 1;
    var ca = pairCounts(clustersA, index, n), cb = pairCounts(clustersB, index, n);
    var both = 0, agreeTogether = 0, levelsA = new Map(), levelsB = new Map();
    ca.forEach(function (count, key) {
      levelsA.set(count, (levelsA.get(count) || 0) + 1);
      var other = cb.get(key);
      if (other !== undefined) { both++; if (other === count) agreeTogether++; }
    });
    cb.forEach(function (count) { levelsB.set(count, (levelsB.get(count) || 0) + 1); });
    var neither = M - (ca.size + cb.size - both);
    var observed = (agreeTogether + neither) / M;
    var expected = (M - ca.size) * (M - cb.size) / (M * M); // pairs sharing no cluster
    levelsA.forEach(function (na, level) { if (levelsB.has(level)) expected += na * levelsB.get(level) / (M * M); });
    return Math.abs(1 - expected) < 1e-12 ? (observed >= 1 - 1e-12 ? 1 : 0) : (observed - expected) / (1 - expected);
  }

  // Overlapping NMI of Lancichinetti, Fortunato & Kertesz (2009). Each cluster is a yes/no variable over the objects;
  // every cluster is explained by its best counterpart in the other clustering.
  function overlappingNmi(clustersA, clustersB) {
    var index = objectIndex(clustersA, clustersB), n = index.size, K = clustersA.length, L = clustersB.length;
    if (K * L > MAX_ONMI_CELLS) {
      throw tooLarge("onmi", "needs every pair of clusters (" + K + " x " + L + "), which is too many for the browser");
    }
    var inB = new Map();
    clustersB.forEach(function (c, j) {
      c.members.forEach(function (o) { var list = inB.get(o); if (list) list.push(j); else inB.set(o, [j]); });
    });
    var shared = new Float64Array(K * L);
    clustersA.forEach(function (c, i) {
      c.members.forEach(function (o) { (inB.get(o) || []).forEach(function (j) { shared[i * L + j]++; }); });
    });
    function h(count) { return count > 0 ? -(count / n) * Math.log(count / n) : 0; }
    var sizeA = clustersA.map(function (c) { return c.members.length; }), sizeB = clustersB.map(function (c) { return c.members.length; });
    // normalized conditional entropy of the clusters of X given the clustering Y
    function conditional(sizeX, sizeY, sharedOf) {
      var sum = 0;
      for (var i = 0; i < sizeX.length; i++) {
        var hx = h(sizeX[i]) + h(n - sizeX[i]);
        if (hx <= 0) continue; // a cluster holding every object carries no information
        var best = hx;
        for (var j = 0; j < sizeY.length; j++) {
          var d = sharedOf(i, j), cOnlyX = sizeX[i] - d, bOnlyY = sizeY[j] - d, a = n - sizeX[i] - sizeY[j] + d;
          if (h(a) + h(d) < h(bOnlyY) + h(cOnlyX)) continue; // the pair is closer to complementary than to matching
          var cond = h(a) + h(bOnlyY) + h(cOnlyX) + h(d) - (h(sizeY[j]) + h(n - sizeY[j]));
          if (cond < best) best = cond;
        }
        sum += Math.max(best, 0) / hx;
      }
      return sizeX.length ? sum / sizeX.length : 0;
    }
    var hab = conditional(sizeA, sizeB, function (i, j) { return shared[i * L + j]; });
    var hba = conditional(sizeB, sizeA, function (j, i) { return shared[i * L + j]; });
    return 1 - 0.5 * (hab + hba);
  }

  function coverMetrics(clustersA, clustersB, codes) {
    var out = {};
    codes.forEach(function (code) {
      if (code === "omega") out[code] = omegaIndex(clustersA, clustersB);
      else if (code === "onmi") out[code] = overlappingNmi(clustersA, clustersB);
      else throw new Error("Unknown metric: " + code);
    });
    return out;
  }

  function sameObjects(setA, setB) {
    if (setA.size !== setB.size) return false;
    var same = true;
    setA.forEach(function (o) { if (same && !setB.has(o)) same = false; });
    return same;
  }

  // Compares every pair of the given cluster sets.
  // sets: [{ name, clusters }], codes: metric codes.
  // Returns { names, codes, matrix: { code: n x n array (row = first set, column = second) }, note }.
  // When a set has overlapping clusters, only the cover metrics are calculated and note says so.
  // Throws an Error with a readable message when sets cannot be compared.
  function compareAll(sets, codes) {
    var n = sets.length, matrix = {}, i, j, note = "";
    var coverCodes = codes.filter(function (c) { return metricByCode(c).cover; });
    var partitionCodes = codes.filter(function (c) { return !metricByCode(c).cover; });
    var overlapping = [];
    sets.forEach(function (s) {
      if (s.clusters.length === 0) throw new Error("\"" + s.name + "\" has no clusters left after filtering.");
      if (overlappingObjects(s.clusters).length > 0) overlapping.push(s.name);
    });
    if (overlapping.length > 0) {
      var who = "\"" + overlapping[0] + "\"" + (overlapping.length > 1 ? " and " + (overlapping.length - 1) + " more" : "");
      var has = overlapping.length > 1 ? " have" : " has";
      if (coverCodes.length === 0) {
        throw new Error(who + has + " objects in more than one cluster. Only the Omega Index and the Overlapping NMI can compare " +
          "overlapping clusterings; select one of them in the Compare tab.");
      }
      if (partitionCodes.length > 0) {
        note = who + has + " objects in more than one cluster, so only the metrics for overlapping clusterings are shown.";
      }
      partitionCodes = [];
    }
    var objects = sets.map(function (s) { return objectSet(s.clusters); });
    for (i = 0; i < n; i++) {
      for (j = i + 1; j < n; j++) {
        if (!sameObjects(objects[i], objects[j])) {
          throw new Error("\"" + sets[i].name + "\" (" + objects[i].size + " objects) and \"" + sets[j].name +
            "\" (" + objects[j].size + " objects) do not contain the same objects. " +
            "Choose how to make them comparable in step 1.");
        }
      }
    }
    var skipped = [];
    function skip(e) { // drops the metric of a "too large" error from the comparison; anything else is a real failure
      if (!e.tooLarge) throw e;
      partitionCodes = partitionCodes.filter(function (c) { return c !== e.code; });
      coverCodes = coverCodes.filter(function (c) { return c !== e.code; });
      skipped.push({ code: e.code, label: metricByCode(e.code).label, reason: e.message });
    }
    codes.forEach(function (code) {
      matrix[code] = [];
      for (i = 0; i < n; i++) matrix[code].push(new Array(n).fill(1));
    });
    // Each pair is calculated once. The reverse direction of an asymmetric metric is the value of its
    // counterpart (REVERSE_OF) on the same confusion matrix.
    for (i = 0; i < n; i++) {
      for (j = i + 1; j < n; j++) {
        var values = {}, done = false, conf = partitionCodes.length > 0 ? confusion(sets[i].clusters, sets[j].clusters) : null;
        while (!done) {
          try {
            var wanted = partitionCodes.slice();
            partitionCodes.forEach(function (c) { if (REVERSE_OF[c] && wanted.indexOf(REVERSE_OF[c]) < 0) wanted.push(REVERSE_OF[c]); });
            values = wanted.length > 0 ? computeMetrics(conf, wanted) : {};
            done = true;
          } catch (e) { skip(e); }
        }
        partitionCodes.forEach(function (code) {
          matrix[code][i][j] = values[code];
          matrix[code][j][i] = REVERSE_OF[code] ? values[REVERSE_OF[code]] : values[code];
        });
        coverCodes.slice().forEach(function (code) {
          try {
            var v = coverMetrics(sets[i].clusters, sets[j].clusters, [code])[code];
            matrix[code][i][j] = v;
            matrix[code][j][i] = v;
          } catch (e) { skip(e); }
        });
      }
    }
    var used = codes.filter(function (c) { return partitionCodes.indexOf(c) >= 0 || coverCodes.indexOf(c) >= 0; });
    Object.keys(matrix).forEach(function (code) { if (used.indexOf(code) < 0) delete matrix[code]; });
    return { names: sets.map(function (s) { return s.name; }), codes: used, matrix: matrix, note: note, skipped: skipped };
  }

  // Rough number of seconds compareAll needs for these sets, from timings of about one microsecond
  // per object and pair of sets. Only meant to tell a quick comparison from one that freezes the page.
  function estimateSeconds(numSets, numObjects) {
    return numSets * (numSets - 1) / 2 * numObjects * 1e-6;
  }

  // ---------------------------------------------------------------- hierarchical clustering
  // Average-linkage agglomerative clustering of a symmetric distance matrix.
  // Returns { order: [leaf indexes left to right], root: tree } where a tree node is
  // { leaf: index } or { left, right, height }.
  function hclust(dist) {
    var n = dist.length;
    if (n === 0) return { order: [], root: null };
    var nodes = [], active = [], i, j;
    for (i = 0; i < n; i++) { nodes.push({ leaf: i, size: 1, items: [i], height: 0 }); active.push(i); }
    function linkage(x, y) {
      var s = 0;
      for (var p = 0; p < x.items.length; p++) for (var q = 0; q < y.items.length; q++) s += dist[x.items[p]][y.items[q]];
      return s / (x.items.length * y.items.length);
    }
    while (active.length > 1) {
      var best = Infinity, bi = 0, bj = 1;
      for (i = 0; i < active.length; i++) {
        for (j = i + 1; j < active.length; j++) {
          var d = linkage(nodes[active[i]], nodes[active[j]]);
          if (d < best) { best = d; bi = i; bj = j; }
        }
      }
      var left = nodes[active[bi]], right = nodes[active[bj]];
      nodes.push({ left: left, right: right, height: best, size: left.size + right.size, items: left.items.concat(right.items) });
      active.splice(bj, 1);
      active.splice(bi, 1);
      active.push(nodes.length - 1);
    }
    var root = nodes[active[0]];
    return { order: root.items.slice(), root: root };
  }

  // ---------------------------------------------------------------- 2D map of a distance matrix
  // Multidimensional scaling: places n items in the plane so that their distances approximate the given
  // symmetric distance matrix. It starts from classical (eigenvector) scaling and then, unless
  // options.refine is false, moves the points to minimize the squared differences between the given and the
  // drawn distances (SMACOF), which matters when the distances cannot be drawn exactly in a plane.
  // Returns { points: [[x, y]], fit, stress }: fit is the correlation between given and drawn distances
  // (1 = reproduced exactly), stress the normalized sum of squared differences (0 = exact).
  function mds(dist, options) {
    var n = dist.length, i, j, k;
    if (n === 0) return { points: [], fit: null };
    if (n === 1) return { points: [[0, 0]], fit: null };
    // double centering of the squared distances
    var sq = dist.map(function (row) { return row.map(function (d) { return d * d; }); });
    var rowMean = sq.map(function (row) { var s = 0; row.forEach(function (v) { s += v; }); return s / n; });
    var total = 0;
    rowMean.forEach(function (v) { total += v; });
    total /= n;
    var B = sq.map(function (row, a) { return row.map(function (v, b) { return -0.5 * (v - rowMean[a] - rowMean[b] + total); }); });
    function topEigen(M) { // power iteration; M is symmetric
      var v = [], it, norm;
      for (i = 0; i < n; i++) v.push(Math.sin(i * 12.9898 + 1.3) + 1.5); // fixed start, so the map is reproducible
      var value = 0;
      for (it = 0; it < 500; it++) {
        var w = new Array(n).fill(0);
        for (i = 0; i < n; i++) for (j = 0; j < n; j++) w[i] += M[i][j] * v[j];
        norm = Math.sqrt(w.reduce(function (s, x) { return s + x * x; }, 0));
        if (norm < 1e-12) return { value: 0, vector: new Array(n).fill(0) };
        var next = w.map(function (x) { return x / norm; }), change = 0, dot = 0;
        for (i = 0; i < n; i++) { dot += next[i] * v[i]; }
        if (dot < 0) next = next.map(function (x) { return -x; });
        for (i = 0; i < n; i++) change += Math.abs(next[i] - v[i]);
        v = next;
        value = 0;
        for (i = 0; i < n; i++) for (j = 0; j < n; j++) value += v[i] * M[i][j] * v[j];
        if (change < 1e-10) break;
      }
      return { value: value, vector: v };
    }
    var first = topEigen(B);
    var deflated = B.map(function (row, a) { return row.map(function (x, b) { return x - first.value * first.vector[a] * first.vector[b]; }); });
    var second = topEigen(deflated);
    var sx = Math.sqrt(Math.max(first.value, 0)), sy = Math.sqrt(Math.max(second.value, 0));
    var points = [];
    for (k = 0; k < n; k++) points.push([first.vector[k] * sx, second.vector[k] * sy]);
    function gap(a, b) { return Math.sqrt(Math.pow(points[a][0] - points[b][0], 2) + Math.pow(points[a][1] - points[b][1], 2)); }
    function rawStress() {
      var sum = 0;
      for (var a = 0; a < n; a++) for (var b = a + 1; b < n; b++) sum += Math.pow(gap(a, b) - dist[a][b], 2);
      return sum;
    }
    if (!options || options.refine !== false) {
      // a flat start cannot leave its line, so give the second axis a small fixed nudge
      if (sy < 1e-9) for (k = 0; k < n; k++) points[k][1] = 1e-3 * Math.sin(k * 7.1 + 0.5);
      var previous = rawStress();
      for (var round = 0; round < 500; round++) {
        var moved = points.map(function () { return [0, 0]; });
        for (i = 0; i < n; i++) {
          for (j = 0; j < n; j++) {
            if (i === j) continue;
            var d = gap(i, j), ratio = d > 1e-12 ? dist[i][j] / d : 0;
            moved[i][0] += ratio * (points[i][0] - points[j][0]);
            moved[i][1] += ratio * (points[i][1] - points[j][1]);
          }
        }
        points = moved.map(function (p) { return [p[0] / n, p[1] / n]; });
        var now = rawStress();
        if (previous - now < 1e-12 * Math.max(1, previous)) break;
        previous = now;
      }
    }
    // how well the plane reproduces the distances
    var given = [], drawn = [], squares = 0;
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      given.push(dist[i][j]);
      drawn.push(gap(i, j));
      squares += dist[i][j] * dist[i][j];
    }
    var stress = squares > 0 ? Math.sqrt(rawStress() / squares) : 0;
    var fit = null;
    if (given.length > 1) {
      var mg = 0, md = 0, sgd = 0, sgg = 0, sdd = 0;
      given.forEach(function (v, q) { mg += v; md += drawn[q]; });
      mg /= given.length; md /= given.length;
      given.forEach(function (v, q) { sgd += (v - mg) * (drawn[q] - md); sgg += (v - mg) * (v - mg); sdd += (drawn[q] - md) * (drawn[q] - md); });
      fit = sgg > 0 && sdd > 0 ? sgd / Math.sqrt(sgg * sdd) : null;
    }
    return { points: points, fit: fit, stress: stress };
  }

  // ---------------------------------------------------------------- network cluster quality
  // network: result of parseEdgeList. clusters: [{ name, members }].
  // Objects absent from the network are ignored (and counted). Network nodes outside every cluster
  // count as singletons for modularity.
  function clusterQuality(network, clusters) {
    var N = network.nodes.length, index = new Map(), i;
    network.nodes.forEach(function (name, id) { index.set(name, id); });
    var membership = new Int32Array(N).fill(-1), missing = 0;
    clusters.forEach(function (c, ci) {
      c.members.forEach(function (o) {
        var id = index.get(o);
        if (id === undefined) missing++; else membership[id] = ci;
      });
    });
    var K = clusters.length;
    var size = new Float64Array(K), volume = new Float64Array(K), inW = new Float64Array(K), cutW = new Float64Array(K);
    var inE = new Float64Array(K), cutE = new Float64Array(K);
    var strength = new Float64Array(N), totalW = 0, internalW = 0;
    network.edges.forEach(function (e) { strength[e.s] += e.w; strength[e.t] += e.w; totalW += e.w; });
    var unassigned = 0;
    for (i = 0; i < N; i++) {
      if (membership[i] >= 0) { size[membership[i]]++; volume[membership[i]] += strength[i]; } else unassigned++;
    }
    network.edges.forEach(function (e) {
      var ms = membership[e.s], mt = membership[e.t];
      if (ms >= 0 && ms === mt) { inW[ms] += e.w; inE[ms]++; internalW += e.w; }
      else {
        if (ms >= 0) { cutW[ms] += e.w; cutE[ms]++; }
        if (mt >= 0) { cutW[mt] += e.w; cutE[mt]++; }
      }
    });
    var totalVolume = 2 * totalW, modularity = 0, rows = [];
    for (i = 0; i < K; i++) {
      var minVol = Math.min(volume[i], totalVolume - volume[i]);
      rows.push({
        name: clusters[i].name,
        objects: clusters[i].members.length,
        inNetwork: size[i],
        internalEdges: inE[i],
        cutEdges: cutE[i],
        conductance: minVol > 0 ? cutW[i] / minVol : null,
        internalDensity: size[i] > 1 ? inE[i] / comb2(size[i]) : null,
        cutRatio: size[i] > 0 && N > size[i] ? cutE[i] / (size[i] * (N - size[i])) : null
      });
      if (totalW > 0) modularity += inW[i] / totalW - Math.pow(volume[i] / totalVolume, 2);
    }
    // singletons of unassigned nodes contribute only the negative degree term
    if (totalW > 0) for (i = 0; i < N; i++) if (membership[i] < 0) modularity -= Math.pow(strength[i] / totalVolume, 2);
    return {
      rows: rows,
      modularity: totalW > 0 ? modularity : null,
      coverage: totalW > 0 ? internalW / totalW : null,
      missingObjects: missing,
      unassignedNodes: unassigned,
      membership: membership
    };
  }

  VICTOR.core = {
    METRICS: METRICS,
    metricByCode: metricByCode,
    parseClusterFile: parseClusterFile,
    parseEdgeList: parseEdgeList,
    countObjects: countObjects,
    objectSet: objectSet,
    overlappingObjects: overlappingObjects,
    maxClusterSize: maxClusterSize,
    filterBySize: filterBySize,
    intersectionFilter: intersectionFilter,
    supersetFilter: supersetFilter,
    objectIntersections: objectIntersections,
    confusion: confusion,
    computeMetrics: computeMetrics,
    expectedMutualInformation: expectedMutualInformation,
    maximumMatch: maximumMatch,
    coverMetrics: coverMetrics,
    estimateSeconds: estimateSeconds,
    compareAll: compareAll,
    hclust: hclust,
    mds: mds,
    clusterQuality: clusterQuality
  };
})(typeof window !== "undefined" ? window : globalThis);
