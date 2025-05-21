# VICTOR: A Visual Analytics Web Application for Clustering Comparison

**VICTOR** is a web-based tool designed to facilitate the analysis and comparison of multiple clustering results in a user-friendly, interactive environment.

## Key Features

* **Handle Multiple Clustering Results**
  Load and manage several clustering outputs simultaneously for side-by-side analysis.

* **Threshold Filters**
  Apply size-based thresholds to focus on clusters of interest.

* **Comparison Metrics**
  Compare cluster sets using **10 different metrics**:

  * Adjusted Rand Index (ARI)
  * Normalized Mutual Information (NMI)
  * Fowlkes–Mallows Index (FMI)
  * Jaccard Index
  * Variation of Information (VI)
  * ... *and more.*

* **Interactive Visualizations**

  * Heatmaps
  * Bar plots
  * Network graphs
  * Sankey diagrams
  * Circos plots

* **Metric Thresholds**
  Filter cluster comparisons by setting thresholds on any of the computed metrics.

* **Network Representation**
  Calculate and visualize how clusters map onto a given network.

* **Export Options**
  Generate and download publication-ready figures in high-resolution formats.

## Installation & Usage

```bash
# Clone the repository
git clone https://github.com/your-username/victor.git

# Navigate to the project directory
cd victor

# Install dependencies
npm install  # or pip install -r requirements.txt

# Start the application
npm start    # or python app.py
```

*Visit the [Demo Page](https://your-demo-url.com) for an interactive walkthrough.*

## Publication

**Karatzas E., Gkonta M., Hotova J., Baltoumas FA., Kontou PI., Bobotsis CJ., Bagos PG., Pavlopoulos GA.**

*“VICTOR: A visual analytics web application for comparing cluster sets.”* **Computers in Biology and Medicine**, 8 June 2021, Article 104557.
DOI: [10.1016/j.compbiomed.2021.104557](https://doi.org/10.1016/j.compbiomed.2021.104557)
PMID: [34139436](https://pubmed.ncbi.nlm.nih.gov/34139436/)

