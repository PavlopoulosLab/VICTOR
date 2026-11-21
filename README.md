# VICTOR: a visual analytics web application for comparing cluster sets

**VICTOR** compares the results of different clusterings of the same objects: different algorithms, or one algorithm with different parameters. It scores how similar every pair of results is and shows the scores as tables and interactive plots.

VICTOR does not run clustering itself and does not pick a "best" result. It runs entirely in your browser: there is nothing to install, and the files you load never leave your computer.

## What you can do

* **Load several cluster sets at once**, rename or remove them, and see their number of clusters, number of objects and cluster size distribution.
* **Prepare sets for comparison**
  * Drop clusters outside a size range, for example singletons.
  * **Intersection**: keep only the objects that every selected set contains.
  * **Superset**: keep all objects and give each set a singleton cluster for every object it lacks.
  * An **UpSet plot** shows which objects the selected sets share whenever they differ.
* **Compare with 27 metrics** in four families. All are similarities: higher means more alike, and 1 means identical.
  * *Counting pairs*: Adjusted Rand Index, Rand Index, Fowlkes–Mallows Index, Jaccard Index, Overlap Coefficient, Wallace Criteria 1 and 2
  * *Set overlaps / matching*: Maximum-Match, Optimal-Match Accuracy (Hungarian), F-Measure, Purity (Meila–Heckerman), Van Dongen (normalized), B-Cubed Precision, Recall and F-Score, Element-Centric Similarity
  * *Mutual information*: three Normalized Mutual Information variants, Adjusted Mutual Information, Normalized Variation of Information, Variation of Information (normalized by log n and by joint entropy), Homogeneity, Completeness
  * *Overlapping clusterings*: Omega Index, Overlapping NMI. These two also accept sets in which an object belongs to several clusters.
  * Compare every pair of the selected sets, or each set against one reference such as a gold standard.
  * Every metric has a one-line explanation next to it, and a "Recommended" preset picks six that are corrected for chance or easy to read.
* **Match clusters** between two sets: which cluster of one corresponds best to which cluster of the other, and how many objects they share.
* **Visualize** any metric in seven ways, and hide the pairs below a chosen similarity:
  * *Heatmap* with hierarchical clustering (the default), *Ranking* of the sets by their average similarity to the others, and a *Similarity map* that places similar sets close together.
  * *Pair bars*, *Sankey*, *Network* (six layouts, zoom, pan and drag) and *Circos*.
  * Sankey and circos can also show the **objects flowing between clusters**: click a cluster to follow its objects through every set.
* **Check cluster quality on networks**: load one or several networks and get conductance, internal density and cut ratio per cluster, plus modularity and coverage per cluster set. A grid scores every cluster set on every network, with tick boxes for what to include.
* **Open in NORMA**: send the network and the clusters of every loaded set to [NORMA](https://normaviz.org) as annotations, with each node drawn as a pie chart of the clusters it belongs to. The data passes directly between the two pages in your browser.
* **Export** every plot as PNG, SVG, PDF, JPEG or WebP at up to six times the on-screen resolution, and every table as CSV.

* **Use it from other programs** through links, `postMessage` or JavaScript; see [API](#api).

The interface starts on a home page, guides through three numbered steps (Load & prepare, Compare, Plots), has a light and a dark theme and works on phones.

## What's new (01/2027)

This version replaces the R/Shiny application of the 2021 publication with one that runs entirely in the browser. Compared with it:

| | 2021 version | This version |
|---|---|---|
| Technology | R/Shiny on a server | Static page; nothing installed, nothing uploaded |
| Comparison metrics | 10 | 27, including chance-corrected ones and two for overlapping clusters |
| Help choosing metrics | None | One-line explanation per metric, "Recommended" preset |
| Which pairs | Every pair | Every pair, or each set against a reference |
| Sets with different objects | Manual filters | Detected automatically, with the fix offered as one click and an UpSet plot of what the sets share |
| Plots | Bar plot, heatmap, Sankey, network, circos | Plus ranking and similarity map; cluster-level Sankey and circos that follow objects; interactive networks with six layouts |
| Networks | One network, conductance | Several networks; conductance, internal density, cut ratio, modularity, coverage; sets-by-networks grid |
| Export | Figures | PNG, SVG, PDF, JPEG or WebP at up to 6×, CSV for every table |
| Other tools | None | Open in NORMA with pie-chart nodes; API by link, `postMessage` and JavaScript |
| Limits | 1 MB per file, 20,000 edges | 50 MB per file; half a million objects compare in well under a second |
| Devices | Desktop | Desktop and phone, light and dark theme |

The same list is in the application under Help.

## File formats

**Cluster set.** A text file with one cluster per line and two tab-separated columns: the cluster name, then its members separated by commas. No header.

```
cluster1	F18,F22,F28,F32
cluster2	F05,F10,F14
cluster3	F06,F11
```

**Network.** An edge list with two columns (source, target) or three (plus a numeric weight), separated by tabs or spaces. The network is treated as undirected.

```
N1	N10	0.8
N2	N11	0.3
```

Example files are in [`docs/examples`](docs/examples) and can be loaded from the Examples list inside the application:

* Seven cluster sets of 50 objects, and three sets that need filtering (from the publication)
* Four algorithms on a yeast protein interaction network (first case study of the publication)
* Gene expression clusters in four myocardial infarction datasets (third case study of the publication)
* Synthetic sets that each show one behaviour: a noise ladder, finer and finer clusters, unrelated random clusterings, and overlapping clusters

## Running it

VICTOR is a static web application. Serve the `docs` folder with any web server (the interface is loaded as JavaScript modules, which browsers do not run from a file opened straight from disk):

```bash
git clone https://github.com/PavlopoulosLab/VICTOR.git
cd VICTOR/docs
python3 -m http.server 8000
```

Then open http://localhost:8000.

To publish it, enable GitHub Pages for the repository (Settings → Pages → deploy from the `/docs` folder of the `main` branch).

## API

Other programs can hand their cluster sets and networks to VICTOR and read the results back. The API tab inside the application documents it and has a panel to try it.

* **Link**: `index.html#json=<base64url JSON>` opens VICTOR with the data in the link.
* **postMessage**: a page that opens or embeds VICTOR sends `{"type": "victor:load", "payload": …}` to show data, or `victor:compute` to get every metric value (and the network quality numbers) back as JSON.
* **JavaScript**: `VICTOR.api.load(payload)`, `.results()`, `.quality()`, `.link(payload)`.

```json
{
  "clusterSets": [
    {"name": "Louvain", "clusters": {"c1": ["a", "b"], "c2": ["c", "d"]}},
    {"name": "MCL", "clusters": {"k1": ["a"], "k2": ["b", "c", "d"]}}
  ],
  "networks": [{"name": "PPI", "edges": [{"source": "a", "target": "b"}, {"source": "c", "target": "d"}]}],
  "metrics": ["adjrand", "ami"]
}
```

VICTOR has no server, so there is no REST endpoint: all three routes pass the data to the page in the browser.

## Size limits

The 20 basic metrics and the Adjusted Mutual Information grow with the number of objects, not the number of clusters: one pair of sets with 500,000 objects takes about a quarter of a second. Three metrics are costlier (Optimal-Match Accuracy, Omega Index, Overlapping NMI); when the loaded sets are too large for one of them, it is left out with a notice and the others are still calculated. Comparisons expected to take more than a few seconds ask for confirmation first. Files above 50 MB are refused.

## Privacy and security

* All calculations happen in the browser. The page makes no network requests after it has loaded, and a content security policy enforces this.
* No third-party scripts, cookies or analytics. The only stored value is the chosen colour theme.
* Names read from files are always treated as text, and exported CSV cells that could run as spreadsheet formulas are neutralized.

## Code

* [`docs/js/core.js`](docs/js/core.js): parsing, filters, the 27 metrics, cluster matching and network quality measures. No dependencies.
* [`docs/js/charts.js`](docs/js/charts.js): the plots and the image export. Charts are drawn with d3 v5 and the two network views with Cytoscape.js 3.30.2 (MIT licence); both libraries are bundled in `docs/lib`, so nothing is loaded from other sites.
* [`docs/js/app/`](docs/js/app): the user interface, as ES modules:
  * `main.js` (entry point, tabs, render), `events.js` (event wiring), `state.js`, `config.js` (constants, metric explanations, examples), `dom.js` (helpers)
  * `data.js` (loading, filters, comparison, networks)
  * `view-files.js`, `view-compare.js`, `view-plots.js`, `view-quality.js` (one per screen)
  * `info.js` (metric explanations), `export-dialog.js` (image export), `norma.js` (NORMA export), `api.js` (links, postMessage and `VICTOR.api`)
* [`docs/test/test.html`](docs/test/test.html): self-checks of the calculations. Open it in a browser to run them.

### Previous R/Shiny version

The original R/Shiny application described in the publication is still in the repository root (`ui.R`, `server.R`, `global.R`, `metrics.R`, `www/`). It needs R with the packages shiny, shinyjs, shinythemes, shinyWidgets, mclustcomp, igraph, d3heatmap, RColorBrewer, stringr, DT and visNetwork, and is started with `shiny::runApp()`. The additions in `metrics.R` have not been tested. New development happens in the browser version.

## Publication

Karatzas E., Gkonta M., Hotova J., Baltoumas F.A., Kontou P.I., Bobotsis C.J., Bagos P.G., Pavlopoulos G.A.
*VICTOR: A visual analytics web application for comparing cluster sets.* **Computers in Biology and Medicine** 135 (2021) 104557.
DOI: [10.1016/j.compbiomed.2021.104557](https://doi.org/10.1016/j.compbiomed.2021.104557) · PMID: [34139436](https://pubmed.ncbi.nlm.nih.gov/34139436/)

The published article describes the original application with ten metrics. The browser version adds the other metrics, the network quality measures beyond conductance, the UpSet plot and the export options.

## Licence

GNU Affero General Public License v3.0. See [LICENSE](LICENSE).
