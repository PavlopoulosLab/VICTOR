# Additional cluster set comparison metrics and network cluster quality measures.
# These complement the metrics offered by the mclustcomp library.
# All functions here are pure (no Shiny or session state) so they can be tested on their own.

# Metric codes calculated here instead of by mclustcomp
extraMetricTypes <- c("ami", "homogeneity", "completeness",
                      "bcubed_p", "bcubed_r", "bcubed_f",
                      "vdm_norm", "vi_norm")

# Entropy (natural log) of a vector of cluster sizes
entropyOfCounts <- function(counts){
  p <- counts[counts > 0] / sum(counts)
  return(-sum(p * log(p)))
}

# Mutual Information (natural log) from a confusion matrix
mutualInformation <- function(confmat){
  n <- sum(confmat)
  expected <- outer(rowSums(confmat), colSums(confmat)) / n
  nz <- confmat > 0
  return(sum(confmat[nz] / n * log(confmat[nz] / expected[nz])))
}

# Expected Mutual Information of two random cluster sets with the given cluster sizes
# (hypergeometric model, Vinh et al. 2010). Clusters of equal size give equal terms,
# so the sum runs over the unique cluster sizes, weighted by how often they occur.
expectedMutualInformation <- function(a, b, n){
  sa <- table(a)
  sb <- table(b)
  ua <- as.numeric(names(sa))
  ub <- as.numeric(names(sb))
  ca <- as.numeric(sa)
  cb <- as.numeric(sb)
  emi <- 0
  for (i in seq_along(ua)){
    for (j in seq_along(ub)){
      ai <- ua[i]
      bj <- ub[j]
      lo <- max(1, ai + bj - n)
      hi <- min(ai, bj)
      if (lo <= hi){
        nij <- lo:hi
        logp <- lgamma(ai + 1) + lgamma(bj + 1) + lgamma(n - ai + 1) + lgamma(n - bj + 1) -
          lgamma(n + 1) - lgamma(nij + 1) - lgamma(ai - nij + 1) - lgamma(bj - nij + 1) -
          lgamma(n - ai - bj + nij + 1)
        term <- nij / n * log(n * nij / (ai * bj)) * exp(logp)
        emi <- emi + ca[i] * cb[j] * sum(term)
      }
    }
  }
  return(emi)
}

# Adjusted Mutual Information, normalized by the arithmetic mean of the entropies.
# 1 = identical cluster sets, ~0 = agreement expected by chance (can be slightly negative).
adjustedMutualInformation <- function(confmat){
  n <- sum(confmat)
  a <- rowSums(confmat)
  b <- colSums(confmat)
  k <- length(a)
  l <- length(b)
  if ((k == 1 && l == 1) || (k == n && l == n)) return(1) # both trivial and identical
  mi <- mutualInformation(confmat)
  emi <- expectedMutualInformation(a, b, n)
  denominator <- (entropyOfCounts(a) + entropyOfCounts(b)) / 2 - emi
  if (abs(denominator) < 1e-12) return(0)
  return((mi - emi) / denominator)
}

# Calculates the metrics of extraMetricTypes. x, y: cluster labels of the same objects, co-sorted.
# For the asymmetric metrics, x (first cluster set) is treated as the reference.
extraMetrics <- function(x, y, types){
  confmat <- unclass(table(x, y))
  n <- sum(confmat)
  a <- rowSums(confmat)
  b <- colSums(confmat)
  ha <- entropyOfCounts(a)
  hb <- entropyOfCounts(b)
  mi <- mutualInformation(confmat)
  # B-Cubed precision and recall
  bcubed_p <- sum(sweep(confmat^2, 2, b, "/")) / n
  bcubed_r <- sum(sweep(confmat^2, 1, a, "/")) / n
  scores <- numeric(length(types))
  for (i in seq_along(types)){
    type <- types[i]
    if (type == "ami"){
      scores[i] <- adjustedMutualInformation(confmat)
    } else if (type == "homogeneity"){ # every cluster of y lies inside one cluster of x
      if (ha > 0) scores[i] <- mi / ha
      else scores[i] <- 1
    } else if (type == "completeness"){ # every cluster of x lies inside one cluster of y
      if (hb > 0) scores[i] <- mi / hb
      else scores[i] <- 1
    } else if (type == "bcubed_p"){
      scores[i] <- bcubed_p
    } else if (type == "bcubed_r"){
      scores[i] <- bcubed_r
    } else if (type == "bcubed_f"){
      scores[i] <- 2 * bcubed_p * bcubed_r / (bcubed_p + bcubed_r)
    } else if (type == "vdm_norm"){ # Van Dongen distance divided by 2n, inverted to a similarity
      vdm <- 2 * n - sum(apply(confmat, 1, max)) - sum(apply(confmat, 2, max))
      scores[i] <- 1 - vdm / (2 * n)
    } else if (type == "vi_norm"){ # Variation of Information divided by log(n), inverted to a similarity
      if (n > 1) scores[i] <- 1 - max(ha + hb - 2 * mi, 0) / log(n)
      else scores[i] <- 1
    } else stop(paste("Unknown metric:", type))
  }
  return(scores)
}

# Drop-in replacement of the mclustcomp call: returns a data frame with columns types and scores.
# mclustcomp metrics come first (in the order mclustcomp returns them), then the extra metrics.
compareClusterSets <- function(x, y, types){
  if (length(x) != length(y)) stop("Cluster sets do not contain the same number of objects.")
  builtinTypes <- types[!(types %in% extraMetricTypes)]
  extraTypes <- types[types %in% extraMetricTypes]
  resultTypes <- character(0)
  resultScores <- numeric(0)
  if (length(builtinTypes) > 0){
    temp <- mclustcomp(x, y, types = builtinTypes)
    builtinNames <- as.character(temp$types)
    builtinScores <- as.numeric(temp$scores)
    builtinScores[builtinNames == "nvi"] <- 1 - builtinScores[builtinNames == "nvi"] # inverting nvi in [0, 1]
    resultTypes <- builtinNames
    resultScores <- builtinScores
  }
  if (length(extraTypes) > 0){
    resultTypes <- c(resultTypes, extraTypes)
    resultScores <- c(resultScores, extraMetrics(x, y, extraTypes))
  }
  return(data.frame(types = resultTypes, scores = resultScores, stringsAsFactors = FALSE))
}

# Quality measures of the clusters of one cluster set on a network.
# graph: undirected igraph object with vertex names and edge weights
# clusterNames: character vector, clusterMembers: list of character vectors (object names per cluster)
# Objects that are absent from the network are ignored and counted in the result.
clusterQuality <- function(graph, clusterNames, clusterMembers){
  vertexNames <- V(graph)$name
  N <- length(vertexNames)
  w <- E(graph)$weight
  edgeEnds <- ends(graph, E(graph), names = FALSE)
  membership <- rep(NA_integer_, N)
  missingObjects <- 0
  for (i in seq_along(clusterMembers)){
    idx <- match(trimws(clusterMembers[[i]]), vertexNames)
    missingObjects <- missingObjects + sum(is.na(idx))
    membership[idx[!is.na(idx)]] <- i
  }
  m1 <- membership[edgeEnds[, 1]]
  m2 <- membership[edgeEnds[, 2]]
  internal <- !is.na(m1) & !is.na(m2) & m1 == m2
  nodeStrength <- igraph::strength(graph, weights = w)
  totalVolume <- 2 * sum(w)

  numClusters <- length(clusterMembers)
  objects <- integer(numClusters)
  internalEdges <- integer(numClusters)
  cutEdges <- integer(numClusters)
  conductance <- rep(NA_real_, numClusters)
  internalDensity <- rep(NA_real_, numClusters)
  cutRatio <- rep(NA_real_, numClusters)
  for (i in seq_len(numClusters)){
    members <- which(!is.na(membership) & membership == i)
    ns <- length(members)
    inCluster1 <- !is.na(m1) & m1 == i
    inCluster2 <- !is.na(m2) & m2 == i
    insideEdges <- inCluster1 & inCluster2
    boundaryEdges <- xor(inCluster1, inCluster2)
    volume <- sum(nodeStrength[members])
    cutWeight <- sum(w[boundaryEdges])
    objects[i] <- ns
    internalEdges[i] <- sum(insideEdges)
    cutEdges[i] <- sum(boundaryEdges)
    if (min(volume, totalVolume - volume) > 0) conductance[i] <- cutWeight / min(volume, totalVolume - volume)
    if (ns > 1) internalDensity[i] <- internalEdges[i] / (ns * (ns - 1) / 2)
    if (ns > 0 && N > ns) cutRatio[i] <- cutEdges[i] / (ns * (N - ns))
  }

  # network-level measures; vertices outside every cluster count as singletons
  fullMembership <- membership
  unassigned <- which(is.na(fullMembership))
  fullMembership[unassigned] <- numClusters + seq_along(unassigned)
  fullMembership <- as.integer(factor(fullMembership))
  networkModularity <- igraph::modularity(graph, fullMembership, weights = w)
  coverage <- NA
  if (sum(w) > 0) coverage <- sum(w[internal]) / sum(w)

  qualityTable <- data.frame(Cluster = clusterNames,
                             Objects = objects,
                             InternalEdges = internalEdges,
                             CutEdges = cutEdges,
                             Conductance = round(conductance, 4),
                             InternalDensity = round(internalDensity, 4),
                             CutRatio = round(cutRatio, 4),
                             stringsAsFactors = FALSE)
  colnames(qualityTable) <- c("Cluster", "#Objects in Network", "#Internal Edges", "#Cut Edges",
                              "Conductance", "Internal Density", "Cut Ratio")
  return(list(table = qualityTable, modularity = networkModularity, coverage = coverage,
              missingObjects = missingObjects, unassignedVertices = length(unassigned)))
}
