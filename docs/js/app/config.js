/* VICTOR app: Constants: limits, metric presets and explanations, bundled examples, labels. */
export var global = window;
export var VICTOR = window.VICTOR, C = VICTOR.core, G = VICTOR.charts;

export var MAX_FILE_BYTES = 50 * 1024 * 1024;

export var CONFIRM_ABOVE_SECONDS = 4; // estimated calculation time above which the user is asked before the page is blocked

export var CROWDED_ABOVE_SETS = 15;   // Sankey, circos and network plots get hard to read beyond this many sets

export var ORIGINAL_TEN = ["adjrand", "fmi", "jaccard", "overlap", "wallace1", "wallace2", "mmm", "nmi1", "nmi2", "nvi"];

// corrected for chance (ARI, AMI) or easy to explain (Jaccard, B-Cubed F, best matching, NMI)
export var RECOMMENDED = ["adjrand", "jaccard", "match_opt", "bcubed_f", "nmi2", "ami"];

// one-line, plain-language explanation of every metric
export var METRIC_HINTS = {
  adjrand: "Agreement on which pairs of objects are together, corrected for chance. About 0 for unrelated sets. A good default.",
  rand: "Share of object pairs the two sets agree on. Rises towards 1 with many clusters, so prefer the adjusted version.",
  fmi: "Geometric mean of the two Wallace criteria: how often a pair grouped in one set is grouped in the other.",
  jaccard: "Pairs grouped together in both sets, out of pairs grouped together in at least one.",
  overlap: "Pairs grouped together in both sets, out of the grouped pairs of the set that has fewer.",
  wallace1: "Chance that a pair grouped together in the first set is also together in the second.",
  wallace2: "Chance that a pair grouped together in the second set is also together in the first.",
  mmm: "Clusters are paired off by largest overlap, greedily; the share of objects in matched clusters.",
  match_opt: "Share of objects that fall in matching clusters under the best possible one-to-one pairing of clusters.",
  f: "Each cluster of the first set takes its best F-score against the second set; averaged by cluster size.",
  mhm: "Purity: each cluster of the first set counts its largest overlap with a cluster of the second.",
  vdm_norm: "Van Dongen distance turned into a similarity: how much the best overlaps cover both sets.",
  bcubed_p: "Per object: how much of its cluster in the second set also shares its cluster in the first.",
  bcubed_r: "Per object: how much of its cluster in the first set also shares its cluster in the second.",
  bcubed_f: "Balance of B-Cubed precision and recall, averaged over objects. Easy to interpret and symmetric.",
  ecs: "Per object: objects sharing both of its clusters, divided by the larger of the two clusters.",
  nmi1: "Shared information between the sets, scaled by the geometric mean of their entropies.",
  nmi2: "Shared information between the sets, scaled by the average of their entropies. Also known as V-Measure.",
  nmi_max: "Shared information scaled by the larger entropy: the strictest version of NMI.",
  ami: "Shared information corrected for chance. About 0 for unrelated sets, however many clusters they have.",
  nvi: "How much of each set is left unexplained by the other, turned into a similarity.",
  vi_norm: "Variation of Information scaled by its maximum for this many objects, turned into a similarity.",
  vi_joint: "Variation of Information scaled by the joint entropy, turned into a similarity. 0 for independent sets.",
  homogeneity: "1 when every cluster of the second set lies inside a single cluster of the first.",
  completeness: "1 when every cluster of the first set lies inside a single cluster of the second.",
  omega: "Adjusted Rand Index extended to overlapping clusters: do pairs share the same number of clusters in both sets?",
  onmi: "Mutual information for overlapping clusters: each cluster is explained by its best match in the other set."
};

// Bundled examples. `metrics` are ticked in addition to the current selection when the example is loaded.
export var EXAMPLES = [
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

export var VIZ_TITLES = { heatmap: "Hierarchical heatmap", ranking: "Average similarity of each set", map: "Similarity map", bar: "Bar plot of pairs",
  sankey: "Sankey plot", network: "Network of cluster sets", circos: "Circos plot" };
export var MAX_PAIR_BARS = 30; // a bar per pair stops being readable beyond this; the heatmap shows all pairs
// plots that show the selected pairs (and so follow "Hide below"); the others always use every pair
export var PAIR_PLOTS = { bar: true, sankey: true, network: true, circos: true, heatmap: true };

export var VIZ_NOTES = {
  bar: "One bar per pair of cluster sets, sorted from most to least similar.",
  ranking: "One bar per cluster set: its average similarity to all the others, with a line from its lowest to its highest value. Sets at the top agree most with the rest.",
  map: "Every cluster set is a point; the closer two points, the more similar the sets.",
  heatmap: "Rows and columns are ordered by hierarchical clustering, so similar sets sit together.",
  sankey: "Band thickness is relative to the other pairs shown.",
  network: "Thicker edges join more similar sets. Drag a node to move it.",
  circos: "Ribbons join pairs of sets and are shaded by similarity."
};

export var QUALITY_COLUMNS = [
  { key: "name", label: "Cluster" },
  { key: "objects", label: "Objects", num: true },
  { key: "inNetwork", label: "In network", num: true },
  { key: "internalEdges", label: "Internal edges", num: true },
  { key: "cutEdges", label: "Cut edges", num: true },
  { key: "conductance", label: "Conductance", num: true, dec: true },
  { key: "internalDensity", label: "Internal density", num: true, dec: true },
  { key: "cutRatio", label: "Cut ratio", num: true, dec: true }
];

export var GRID_MEASURES = {
  modularity: { label: "Modularity", best: "max", hint: "Higher is better: more edge weight inside clusters than expected at random." },
  coverage: { label: "Coverage", best: "max", hint: "Higher is better: the share of edge weight that lies inside clusters." },
  medianConductance: { label: "Median conductance", best: "min", hint: "Lower is better: the typical cluster has few edges leaving it." },
  found: { label: "Objects found", best: "max", hint: "Share of the set's objects that are nodes of the network. Low values mean the set and the network do not belong together." }
};

// NORMA accepts a network with groups from another page through window.postMessage, so nothing passes a server.
export var NORMA_URL = "https://normaviz.org/norma.html", NORMA_ORIGIN = "https://normaviz.org";
