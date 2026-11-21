# VICTOR: A Visual Analytics Web Application for Clustering Comparison

**VICTOR** is a web-based tool designed to facilitate the analysis and comparison of multiple clustering results in a user-friendly, interactive environment.

## Key Features

* **Handle Multiple Clustering Results**
  Load and manage several clustering outputs simultaneously for side-by-side analysis.

* **Threshold Filters**
  Apply size-based thresholds to focus on clusters of interest.

* **Comparison Metrics**
  Compare cluster sets using **27 different metrics** in four families:

  * Counting pairs: Adjusted Rand Index, Rand Index, Fowlkes–Mallows Index, Jaccard Index, Overlap Coefficient, Wallace Criteria 1 and 2
  * Set overlaps / matching: Maximum-Match, Optimal-Match Accuracy (Hungarian), F-Measure, Purity (Meila–Heckerman), Van Dongen (normalized), B-Cubed Precision, Recall and F-Score, Element-Centric Similarity
  * Mutual information: three Normalized Mutual Information variants, Adjusted Mutual Information, Normalized Variation of Information, Variation of Information (normalized by log n and by joint entropy), Homogeneity, Completeness
  * Overlapping clusterings: Omega Index, Overlapping NMI

* **Interactive Visualizations**

  * Heatmaps
  * Bar plots
  * Network graphs
  * Sankey diagrams
  * Circos plots

* **Metric Thresholds**
  Filter cluster comparisons by setting thresholds on any of the computed metrics.

* **Network Representation**
  Calculate how well clusters are separated on a given network: conductance, internal density and cut ratio per cluster, plus modularity and coverage.

* **Export Options**
  Download every plot as SVG or PNG and every table as CSV.

## Installation & Usage

VICTOR is a static web application. All calculations run in the browser, so there is nothing to install and no data leaves your computer.

```bash
# Clone the repository
git clone https://github.com/PavlopoulosLab/VICTOR.git

# Serve the docs folder with any static web server, for example
cd VICTOR/docs
python3 -m http.server 8000
```

Then open http://localhost:8000. The `docs/` folder can also be published as it is with GitHub Pages (Settings → Pages → deploy from the `/docs` folder of the main branch).

* `docs/js/core.js`: parsing, filters, the 27 metrics, cluster matching and network quality measures (no dependencies)
* `docs/js/charts.js`: plots, drawn with the bundled d3 v5
* `docs/js/app.js`: user interface
* `docs/test/test.html`: self-checks of the calculations; open it in a browser to run them

### Previous R/Shiny version

The original R/Shiny application described in the publication is still in the repository root (`ui.R`, `server.R`, `global.R`, `metrics.R`, `www/`). It needs R with the packages shiny, shinyjs, shinythemes, shinyWidgets, mclustcomp, igraph, d3heatmap, RColorBrewer, stringr, DT and visNetwork, and is started with `shiny::runApp()`.

## Publication

**Karatzas E., Gkonta M., Hotova J., Baltoumas FA., Kontou PI., Bobotsis CJ., Bagos PG., Pavlopoulos GA.**

*“VICTOR: A visual analytics web application for comparing cluster sets.”* **Computers in Biology and Medicine**, 8 June 2021, Article 104557.
DOI: [10.1016/j.compbiomed.2021.104557](https://doi.org/10.1016/j.compbiomed.2021.104557)
PMID: [34139436](https://pubmed.ncbi.nlm.nih.gov/34139436/)

