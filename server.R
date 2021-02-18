server <- function(input, output, session) {
  
  source("global.R")
  
  session$sendCustomMessage("handler_disableTabs", T) # disable most tab panels until files are uploaded/analyzed
  
  output$banner <- renderUI({
    tags$img(src = "VICTOR_banner.jpg", style="width:40%")
  })
  
  output$landing_page <- renderText({ 
    "<div><p>
      <b class=\"heavy\">VICTOR</b> is the first fully interactive and dependency-free visual analytics web application which allows the comparison and visualization of various clustering outputs. 
      </br></br>
      With <b>VICTOR</b> one can:</br>
       &bull; Handle multiple clustering results simultaneously</br>
       &bull; Apply thresholds on the cluster sizes </br>
       &bull; Compare different clustering results using ten different comparison metrics. </br>
       &bull; Visualize clustering comparisons using interactive heatmaps, bar plots, networks, sankey and circos plots</br>
       &bull; Apply thresholds on the clustering comparison metrics</br>
       &bull; Calculate the cluster representation on a given network</br>
       &bull; Export publication-ready figures</br>
    </p></div>"
    })
  
  # observe and reactive events ####
  observeEvent(input$inFiles,{
    inFiles <- input$inFiles
    # updateData() # old, now updating from checkboxes
    for(i in 1:length(inFiles[[1]])){
      tryCatch({
        if (length(clusteringNames) == 0 || is.na(match(inFiles$name[[i]], clusteringNames))){
          if (inFiles$size[[i]] < 1000000){ # clustering file size must be under 1MB
            clusteringData <- as.matrix(read.delim(text = readLines(inFiles$datapath[[i]], warn = FALSE), header = F)) # reading through text to avoid missing EOF
            if (ncol(clusteringData) == 2){ # need exactly 2 columns: cluster name \t comma separated nodes
              edgelist <- matrix("", nrow = 0, ncol = 2)
              colnames(edgelist) <- c("Cluster_Name", "Object_Name")
              cluster_names <- as.matrix(clusteringData[, 1])
              cluster_names <- cluster_names[order(cluster_names) ,] # alpharethmetic sort
              for (j in 1:nrow(clusteringData)){
                nodes <- strsplit(clusteringData[j, 2], ",") # list
                if (length(nodes[[1]]) > max_cluster_items) max_cluster_items <<- length(nodes[[1]]) # updating value for max value of range slider
                for (k in 1:length(nodes[[1]])){
                  edgelist <- rbind(edgelist, c(clusteringData[j, 1], nodes[[1]][k]))
                }
              }
              edgelist <- as.matrix(edgelist[order(edgelist[, 2]) ,]) # alpharethmetic sort
              for (j in 1:nrow(edgelist)){
                edgelist[j, 1] <- match(edgelist[j, 1], cluster_names)
              }
              parsedData[[length(parsedData)+1]] <<- edgelist # push at the end of the list
              rawData[[length(rawData)+1]] <<- clusteringData # unparsed
              filtered_parsedData[[length(filtered_parsedData)+1]] <<- edgelist # push at the end of the list
              filtered_rawData[[length(filtered_rawData)+1]] <<- clusteringData # unparsed
              clusteringNames <<- c(clusteringNames, inFiles$name[[i]]) # push filename at the end of the matrix
              # print(parsedData[[length(parsedData)]]) # debug
            } else session$sendCustomMessage("handler_alert", paste(inFiles$name[[i]], " needs to contain 2 columns. Column 1 = Cluster Names, Column 2: Comma-separated Object Names."))
          } else session$sendCustomMessage("handler_alert", paste(inFiles$name[[i]], ". File exceeds 1MB and is discarded."))
        } else session$sendCustomMessage("handler_alert", paste(inFiles$name[[i]], ". A file with that name already exists."))
      }, warning = function(w) {
        print(paste("Warning:  ", w))
      }, error = function(e) {
        print(paste("Error in Uploaded file :  ", inFiles$name[[i]], ". ", e))
        session$sendCustomMessage("handler_alert", paste("Error in Uploaded file :  ", inFiles$name[[i]]))
      }, finally = {})
    }
    # print(parsedData) # debug
    # print(clusteringNames) # debug
    # saveRDS(parsedData, "parsedData") # debug
    updateSliderInput(session, "filterSlider",
                      max = max_cluster_items,
                      value = c(1,max_cluster_items)
    )
    session$sendCustomMessage("handler_sendClusteringNames", clusteringNames) # communicate global variable clusteringNames to JS
    session$sendCustomMessage("handler_sendRawData", filtered_rawData)
    session$sendCustomMessage("handler_sendData", filtered_parsedData) # send data to JS, and there, create data structures and Show Data panel (+ radio button to select file to show data)
    session$sendCustomMessage("handler_drawFileHandles", T) # fill div with file rename and remove actions
    session$sendCustomMessage("handler_enableTabs", F) # enable clustering comparison tab panel
    session$sendCustomMessage("handler_createFileSelection", T) # creates the fileSelection Box in the clustering comparison tab panel
    session$sendCustomMessage("handler_conductanceRadio", T)# creates the fileSelection Box in the conductance comparison tab panel
    return(T)
  })

  observeEvent(input$filterDataButton,{ # cuts via slider thresholds and appends mutual exclusive singleton objects
    selectedFiles <- input$js_selectedStatFiles
    if (!identical(selectedFiles, NULL)){
      # 1. cut clusters outside the slider range participation thresholds
      trimClusters(selectedFiles)
      if (length(selectedFiles) > 1){
        filterOption <- input$filterOption # radio button for intersect vs superset
        if (filterOption == "intersection")
          # 2a. keep same objects only
          keepIntersection(selectedFiles)
        else
          # 2b. add mutually exclusive singletons for mclustcomp
          addMutuallyExclusiveSingletons(selectedFiles) # of selected Clusters # also parsing filtered data
      }
    }
    # saveRDS(filtered_rawData, "filtered_rawData.rds")
    # saveRDS(filtered_parsedData, "filtered_parsedData.rds")
    # saveRDS(rawData, "rawData.rds")
    # saveRDS(parsedData, "parsedData.rds")
    # 3. send session data
    session$sendCustomMessage("handler_sendRawData", filtered_rawData)
    session$sendCustomMessage("handler_sendData", filtered_parsedData) # send data to JS, and there, create data structures and Show Data panel (+ radio button to select file to show data)
    session$sendCustomMessage("handler_updateShinyBarPlots", T) # updating r barplots real time
    session$sendCustomMessage("handler_updateShinyHist_Data", T) # updating r histograms and tables
    return(T)
  })
  
  observeEvent(input$executeCC,{ # executing mClustComp library
    # updateData() # updating "clusteringNames" and "parsedData" values from JavaScript (after deletions and/or renames) # old, now updating from checkboxes
    metrics <- input$metrics
    types <- ""
    # print(metrics) # debug
    selectedFilesCC <- input$js_selectedFilesCC
    # print(selectedFilesCC) # debug
    numFiles <- length(selectedFilesCC)
    errorFlag <<- F # resetting
    emptyFileFlag <- F
    if (length(metrics) > 0 && numFiles > 1){
      session$sendCustomMessage("handler_startLoader", 1)
      d3heatmap_input <<- matrix(0, nrow = length(metrics), ncol = 0)
      mclustcompResults <<- matrix(0, nrow = length(metrics), ncol = 0)
      for (i in 1:numFiles){
        for(j in 1:numFiles){
          if (!errorFlag && !emptyFileFlag){
            x <- as.numeric(filtered_parsedData[[selectedFilesCC[i]]][, 1])
            y <- as.numeric(filtered_parsedData[[selectedFilesCC[j]]][, 1])
            if (identical(x, character(0)) || identical(y, character(0))){
              emptyFileFlag <- T
              break
            }
            tryCatch({
              temp <- mclustcomp(x, y, types = metrics)
              if (!is.na(match("nvi", temp$types))) temp[temp$types=="nvi", ]$scores <- 1 - temp[temp$types=="nvi", ]$scores # inverting nvi in [0, 1]
              # saveRDS(temp, "temp.rds")
            }, warning = function(w) {
              print(paste("Warning:  ", w))
            }, error = function(e) {
              print(paste("Error :  ", e))
              errorFlag <<- T
              session$sendCustomMessage("handler_alert", paste("Make sure all compared clusterings have the same number of objects. Clustering ", clusteringNames[selectedFilesCC[i]], 
                                                               " has ", length(x) ," elements, while Clustering ", clusteringNames[selectedFilesCC[j]], " has ", length(y), " elements.", sep = ""))
            }, finally = {
              if (!errorFlag && !emptyFileFlag){
                # results for d3heatmaps in R, all against all
                d3heatmap_input <<- cbind(d3heatmap_input, as.numeric(temp[, 2]))
                colnames(d3heatmap_input)[ncol(d3heatmap_input)] <<- paste(clusteringNames[selectedFilesCC[i]], 
                                                                           " vs ", clusteringNames[selectedFilesCC[j]], sep="")
                # results for javascript, only when j > i to avoid duplicates and self-metrics
                if (i < j){
                  mclustcompResults <<- cbind(mclustcompResults, as.numeric(temp[, 2]))
                  colnames(mclustcompResults)[ncol(mclustcompResults)] <<- paste(clusteringNames[selectedFilesCC[i]], 
                                                                                 " vs ", clusteringNames[selectedFilesCC[j]], sep="")
                }
              }
            })
          }
        }
      }
      if (!errorFlag){
        if (!emptyFileFlag){
          clusteringNamesHeatmap <<- clusteringNames[selectedFilesCC]
          rownames(d3heatmap_input) <<- temp[, 1]
          # print(d3heatmap_input) # debug
          rownames(mclustcompResults) <<- temp[, 1]
          types <- as.character(temp$types)
          session$sendCustomMessage("handler_sendMetrics", types)
          session$sendCustomMessage("handler_sendChosenClusteringsIndexes", selectedFilesCC)
          session$sendCustomMessage("handler_sendClusteringComboNames", colnames(mclustcompResults))
          session$sendCustomMessage("handler_drawmclustcompResults", mclustcompResults)
          session$sendCustomMessage("handler_enableTabs", T) # enable rest tab panels
          session$sendCustomMessage("handler_initiateHistogramControls", T) # histogram tab, slider # maria 
          session$sendCustomMessage("handler_initiateNetworkControls", T) # interactive networks tab, slider, colorpickers
          session$sendCustomMessage("handler_initiateSankeyPlotControls", T) # sankey plots tab, slider, colorpickers
          session$sendCustomMessage("handler_initiateCircosPlotControls", T) # circos plots tab,slider #maria
		  updateTabsetPanel(session, "ccTabs",
                            selected = "Explore Metric Results"
          )
		} else session$sendCustomMessage("handler_alert", "Empty set in chosen files.")
      }
      session$sendCustomMessage("handler_finishLoader", 1)
    } else session$sendCustomMessage("handler_alert", "Choose at least 1 metric and 2 files to compare.")
    return(T)
  })
  
  observeEvent(input$executeMCM,{
    if (input$dataSelectionMCM1 != "" && input$dataSelectionMCM2 != ""){
      index1 <- match(input$dataSelectionMCM1, clusteringNames)
      index2 <- match(input$dataSelectionMCM2, clusteringNames)
      result <- confusionMatrix(index1, index2)
      resultTable <- maximumMatch(result$confmat, result$nk, result$nl)
      colnames(resultTable) <- c("File 1", "File 2", "Overlap")
      output$MCM_table <- DT::renderDataTable(as.data.frame(resultTable), server = FALSE, # renderTable({resultTable})
                                              extensions = 'Buttons',
                                              options = list(
                                                pageLength = 5,
                                                "dom" = 'T<"clear">lBfrtip',
                                                buttons = list('copy', 'csv', 'excel', 'pdf', 'print')
                                              ))
        
    } else session$sendCustomMessage("handler_alert", "Choose 2 clustering files to compare.")
    return(T)
  })
  
  observeEvent(input$executeCP,{ # executing Metric Histograms # maria
    cp_metric <- input$js_cp_metric
    selectedFilesCP <- input$js_selectedFilesCP
    # print(selectedFilesCP) # debug
    selectedFiles <- clusteringNamesHeatmap[selectedFilesCP]
    if (length(selectedFiles) > 1){
      input_parsed <- parseHeatMapInput(d3heatmap_input, cp_metric, selectedFiles) # empty third argument, parses the whole data of mclustcomp
      session$sendCustomMessage("handler_executeCP", input_parsed)
    } else session$sendCustomMessage("handler_alert", "Please choose two or more files.")
    return(T)
  })
  
  observeEvent(input$executeMH,{ # executing Metric Histograms
    session$sendCustomMessage("handler_executeMH", T)
    return(T)
  })
  
  observeEvent(input$executeHH,{ # executing Hierarchical Heatmaps on button click
    output$heatmap <- renderD3heatmap({ # renderD3heatmap
      hh_metric <- input$js_hh_metric
      # print(hh_metric) # debug
      selectedFilesHH <- input$js_selectedFilesHH
      # print(selectedFilesHH) # debug
      selectedFiles <- clusteringNamesHeatmap[selectedFilesHH]
      if (length(selectedFiles) > 1){
        d3heatmap_input_parsed <- parseHeatMapInput(d3heatmap_input, hh_metric, selectedFiles)
        # print(d3heatmap_input_parsed) # debug
        d3heatmap(d3heatmap_input_parsed, dendrogram ='both', colors = "YlOrRd")
      } else session$sendCustomMessage("handler_alert", "Choose at least 1 metric and 2 files to compare.")
      # session$sendCustomMessage("handler_executeHH", T)
    })
    return(T)
  })
  
  observeEvent(input$executeSP,{ # executing Sankey Plots
    session$sendCustomMessage("handler_executeSP", T)
    return(T)
  })
  
  observeEvent(input$executeIN,{ # executing Interactive Networks
    session$sendCustomMessage("handler_executeIN", T)
    return(T)
  })
  
  # on edgelist file upload, call to validate the network is performed
  observeEvent(input$edgelistFile,{
    edgelistFile <- input$edgelistFile
    tryCatch({
      network_file_table <<- read.delim(edgelistFile$datapath[[1]], header = F) # 1st conductance arg, global variable
      if (nrow(network_file_table) > 20000) {
        network_file_table <<- ""
        session$sendCustomMessage("handler_alert", "Network must have less than 20000 edges.")
      }
    }, warning = function(w) {
      print(paste("Warning:  ", w))
    }, error = function(e) {
      print(paste("Error :  ", e))
      network_file_table <<- ""
      session$sendCustomMessage("handler_alert", paste("Error :  ", e))
    }, finally = {})
    if (!validateEdgelist()) reset("edgelistFile")
    else {
      updateTabsetPanel(session, "cTabs",
                        selected = "Network"
      )
    }
    return(T)
  })
  
  observeEvent(input$executeC,{ # executing Conductance
    if (network_file_table[[1]][1] != ""){ # this means the edgelist has passed the validation test
      # print(network_file_table) # debug
      selectedFilesC <- input$js_selectedFilesC
      if (!identical(selectedFilesC, NULL)){
        session$sendCustomMessage("handler_startLoader", 7) # 8th tab, counting 0
        # print(selectedFilesC) # debug
        selectedFile <- clusteringNames[selectedFilesC]
        index <- match(selectedFile, clusteringNames)
        dataTypeOption <- input$condDataType # radio button for raw vs filtered data
        if (dataTypeOption == "raw") annotation_file_list <- split(rawData[[index]], rep(1:ncol(rawData[[index]]), each = nrow(rawData[[index]])))
        else annotation_file_list <- split(filtered_rawData[[index]], rep(1:ncol(filtered_rawData[[index]]), each = nrow(filtered_rawData[[index]])))
        network_file_matrix <- as.matrix(network_file_table) # network_file_matrix <- as.matrix(network_file_table)
        tryCatch({
          runConductance(network_file_matrix, network_file_table, annotation_file_list)
        }, warning = function(w) {
          print(paste("Warning:  ", w))
        }, error = function(e) {
          session$sendCustomMessage("handler_alert", paste("Error :  ", e, "All objects contained in the clustering file must be present in the network."))
        }, finally = {})
        updateTabsetPanel(session, "cTabs",
                          selected = "Conductance Histogram"
        )
      }
      session$sendCustomMessage("handler_finishLoader", 7)
    } else session$sendCustomMessage("handler_alert", "Please upload an edgelist file.")
    return(T)
  })
  
  observeEvent(input$selectLayout,{
    if (input$selectLayout != "-"){
      in_slider_value <<- input$js_in_slider_value
      in_chosenClusterings <<- input$js_in_chosenClusterings
      in_result <<- input$js_in_result
      if (!identical(is.na(in_result), logical(0))){
        edgelist <- parseEdgelist(in_slider_value, in_chosenClusterings, in_result)
        if (nrow(edgelist) >= 2){
          graph <- createGraph(edgelist)
          nodes <- V(graph)$name
          weights <- E(graph)$weight
          applyLayout(graph, nodes, weights)
        } else session$sendCustomMessage("handler_alert", "Too few edges to form a graph.")
      } else session$sendCustomMessage("handler_alert", "Please, >>Execute a network first.")
    }
    reset("selectLayout")
    return(T)
  })
  
  observe({input$js_counterFlag
    
    updateData()
    
    updateSelectInput(session, "filteredDataSelection",
                      choices = clusteringNames, selected = input$filteredDataSelection
    )
    observeEvent(input$filteredDataSelection,{
      index <- match(input$filteredDataSelection, clusteringNames)
      if (!is.na(index)){
        printData <- cbind(filtered_rawData[[index]], lengths(strsplit(as.character(filtered_rawData[[index]][,2]), ",")))
        colnames(printData) <- c("Cluster", "Objects", "#Objects")
        output$filteredDataTable <- DT::renderDataTable(printData, server = FALSE,
                                                        extensions = 'Buttons',
                                                        options = list(
                                                          pageLength = 5,
                                                          "dom" = 'T<"clear">lBfrtip',
                                                          buttons = list('copy', 'csv', 'excel', 'pdf', 'print')
                                                        ))
      } else {
        printData <- matrix("", nrow = 0, ncol = 3)
        colnames(printData) <- c("Cluster", "Objects", "#Objects")
        output$filteredDataTable <- DT::renderDataTable(printData, server = FALSE,
                                                extensions = 'Buttons',
                                                options = list(
                                                  pageLength = 5,
                                                  "dom" = 'T<"clear">lBfrtip',
                                                  buttons = list('copy', 'csv', 'excel', 'pdf', 'print')
                                                ))
      }
    })
    
    updateSelectInput(session, "dataSelection",
                      choices = clusteringNames, selected = input$dataSelection
    )
    observeEvent(input$dataSelection,{
      index <- match(input$dataSelection, clusteringNames)
      if (!is.na(index)){
        printData <- cbind(rawData[[index]], lengths(strsplit(as.character(rawData[[index]][,2]), ",")))
        colnames(printData) <- c("Cluster", "Objects", "#Objects")
        output$dataTable <- DT::renderDataTable(printData, server = FALSE,
                                                extensions = 'Buttons',
                                                options = list(
                                                  pageLength = 5,
                                                  "dom" = 'T<"clear">lBfrtip',
                                                  buttons = list('copy', 'csv', 'excel', 'pdf', 'print')
                                                ))
      } else {
        printData <- matrix("", nrow = 0, ncol = 3)
        colnames(printData) <- c("Cluster", "Objects", "#Objects")
        output$dataTable <- DT::renderDataTable(printData, server = FALSE,
                                                extensions = 'Buttons',
                                                options = list(
                                                  pageLength = 5,
                                                  "dom" = 'T<"clear">lBfrtip',
                                                  buttons = list('copy', 'csv', 'excel', 'pdf', 'print')
                                                ))
      }
    })
    
    updateSelectInput(session, "filteredDataSelectionHist",
                      choices = clusteringNames, selected = input$filteredDataSelectionHist
    )
    observeEvent(input$filteredDataSelectionHist,{
      index <- match(input$filteredDataSelectionHist, clusteringNames)
      if (!is.na(index)){
        if (!identical(filtered_parsedData[[index]][, 1], character(0))){
          viewData <- table(filtered_parsedData[[index]][, 1])
          pre_filteredTable <- table(parsedData[[index]][, 1])
          breaks <- seq(0, max(pre_filteredTable)+5, by = 5)
          y_lim_top <- max(table(viewData)) + 10/100 * max(table(viewData))
          output$histFilteredPlot <- renderPlot({h <- hist(viewData,
                                                           main="Object Participation in Filtered Data Clusters",
                                                           xlab="#Objects", ylab="#Clusters",
                                                           ylim=c(0, y_lim_top),
                                                           col="cornflowerblue",
                                                           breaks = breaks)
          text(h$mids, h$counts, labels=h$counts, adj=c(0.5, -0.5))})
        } else {
          output$histFilteredPlot <- renderPlot({hist(0, main="Empty", xlab="-")})
        }
      } else output$histFilteredPlot <- renderPlot({hist(0, main="Empty", xlab="-")})
    })
    
    updateSelectInput(session, "dataSelectionHist",
                      choices = clusteringNames, selected = input$dataSelectionHist
    )
    observeEvent(input$dataSelectionHist,{
      index <- match(input$dataSelectionHist, clusteringNames)
      if (!is.na(index)){
        viewData <- table(parsedData[[index]][, 1])
        breaks <- seq(0, max(viewData)+5, by = 5)
        y_lim_top <- max(table(viewData)) + 10/100 * max(table(viewData))
        output$histPlot <- renderPlot({h <- hist(viewData, 
                                                 main="Object Participation in Input File Clusters",
                                                 xlab="#Objects", ylab="#Clusters",
                                                 ylim=c(0, y_lim_top),
                                                 col="cornflowerblue",
                                                 breaks = breaks)
        text(h$mids, h$counts, labels=h$counts, adj=c(0.5, -0.5))})
      } else output$histPlot <- renderPlot({hist(0, main="Empty", xlab="-")})
    })
    
    updateSelectInput(session, "dataSelectionMCM1",
                      choices = clusteringNames
    )
    
    updateSelectInput(session, "dataSelectionMCM2",
                      choices = clusteringNames
    )
    
  })
  
  observeEvent(input$js_selectedFilesC,{
    if (network_file_table[[1]][1] != ""){
      construct_visNetwork()
    }
  })
  
  observeEvent(input$edgelistFile,{
    # 1
    construct_visNetwork()
    # 2
    if (network_file_table != "") {
      if (ncol(network_file_table) == 2) colnames(network_file_table) <- c("Source", "Target")
      else colnames(network_file_table) <- c("Source", "Target", "Weight")
      output$condDataTable <- DT::renderDataTable(as.matrix(network_file_table), server = FALSE,
                                                  extensions = 'Buttons',
                                                  options = list(
                                                    pageLength = 5,
                                                    "dom" = 'T<"clear">lBfrtip',
                                                    buttons = list('copy', 'csv', 'excel', 'pdf', 'print')
                                                  ))
    } else session$sendCustomMessage("handler_alert", paste("Invalid input network."))
  })
  
  selectedStatFiles <- eventReactive(input$js_checkBoxCounterFlag, { # input$js_checkBoxCounterFlag always increasing by one to start event for updating data, from rename, remove and onchange checkbox events
    input$js_selectedStatFiles
  })
  
  output$clusterPlot <- renderPlot({
    if (length(selectedStatFiles()) > 0){
      num_clusters <- NULL
      coul <- brewer.pal(12, "Set3") # may have more elements than available colors
      for (i in 1: length(selectedStatFiles())){
        num_clusters <- c(num_clusters, nrow(rawData[[selectedStatFiles()[i]]]))
      }
      clustNames <- clusteringNames[selectedStatFiles()]
      clustNames[nchar(clustNames) > 15] <- paste(substr(clustNames[nchar(clustNames) > 15], 0, 15), "...", sep="")
      barplot(num_clusters, names.arg = clustNames, col = coul, las = 1, main = "Number of Clusters") # las = 2 to rotate x axis labels
    }
  })
  
  output$nodePlot <- renderPlot({
    if (length(selectedStatFiles()) > 0){
      num_nodes <- NULL
      coul <- suppressWarnings(brewer.pal(12, "Set3")) # may have more elements than available colors
      for (i in 1: length(selectedStatFiles())){
        num_nodes <- c(num_nodes, nrow(parsedData[[selectedStatFiles()[i]]]))
      }
      clustNames <- clusteringNames[selectedStatFiles()]
      clustNames[nchar(clustNames) > 15] <- paste(substr(clustNames[nchar(clustNames) > 15], 0, 15), "...", sep="")
      barplot(num_nodes, names.arg = clustNames, col = coul, las = 1, main = "Number of Objects")
    }
  })
  
  output$filteredClusterPlot <- renderPlot({
    if (length(selectedStatFiles()) > 0){
      num_clusters <- NULL
      coul <- brewer.pal(12, "Set3") # may have more elements than available colors
      for (i in 1: length(selectedStatFiles())){
        num_clusters <- c(num_clusters, nrow(filtered_rawData[[selectedStatFiles()[i]]]))
      }
      clustNames <- clusteringNames[selectedStatFiles()]
      clustNames[nchar(clustNames) > 15] <- paste(substr(clustNames[nchar(clustNames) > 15], 0, 15), "...", sep="")
      barplot(num_clusters, names.arg = clustNames, col = coul, las = 1, main = "Number of Clusters")
    }
  })
  
  output$filteredNodePlot <- renderPlot({
    if (length(selectedStatFiles()) > 0){
      num_nodes <- NULL
      coul <- suppressWarnings(brewer.pal(12, "Set3")) # may have more elements than available colors
      for (i in 1: length(selectedStatFiles())){
        num_nodes <- c(num_nodes, nrow(filtered_parsedData[[selectedStatFiles()[i]]]))
      }
      clustNames <- clusteringNames[selectedStatFiles()]
      clustNames[nchar(clustNames) > 15] <- paste(substr(clustNames[nchar(clustNames) > 15], 0, 15), "...", sep="")
      barplot(num_nodes, names.arg = clustNames, col = coul, las = 1, main = "Number of Objects")
    }
  })
  
  # functions ####
  mapper <- function(inArr, min, max){
    outArr <- inArr
    inArr_min <- min(inArr)
    inArr_max <- max(inArr)
    if (inArr_max - inArr_min != 0){
      for (i in 0:length(inArr)){
        outArr[i] <- (inArr[i] - inArr_min) * (max - min) / (inArr_max - inArr_min) + min;
      }
    } else outArr[] <- 0.3;
    return(outArr);
  }
  
  construct_visNetwork <- function(){
    set.seed(123)
    # create network view with fruchterman
    if (network_file_table != ""){
      tryCatch({
        graph <- createGraph(as.matrix(network_file_table))
        # nodes <- V(graph)$name # old
        # apply_layout_with_fr_cond(graph, nodes, as.matrix(network_file_table)) # old viz.js
        data <- toVisNetworkData(graph)
        nodes <- data$nodes
        #if (!identical(input$js_selectedFilesC, NULL)){ # clustering file uploaded and exists
        if (length(clusteringNames) > 0){ # clustering file uploaded and exists
          colnames(filtered_parsedData[[input$js_selectedFilesC]]) <- c("color", "id")
          nodes <- merge(nodes, filtered_parsedData[[input$js_selectedFilesC]], all.x = T)
          nodes$color <- colors[as.numeric(nodes$color) %% length(colors) + 1]
        }
        edges <- data$edges
        edges$weight <- mapper(edges$weight, 0.5, 5) # for better width visualization
        colnames(edges)[3] <- "width"
        output$network <- renderVisNetwork({
          #visIgraph(graph) 
          visNetwork(nodes = nodes, edges = edges) %>%
            visIgraphLayout(layout = "layout_with_kk") %>% # layout_in_circle # layout_with_fr # layout_with_kk
            visInteraction(navigationButtons = TRUE, hover = TRUE)
        })
      }, warning = function(w) {
        print(paste("Warning:  ", w))
      }, error = function(e) {
        print(paste("Error :  ", e))
        session$sendCustomMessage("handler_alert", paste("Can't create network."))
      }, finally = {})
    }
  }
  
  validateEdgelist <- function(){
    valid <- T
    if (network_file_table[[1]][1] != ""){ # not an empty file
      if (ncol(network_file_table) < 2){ # network_file_table, global variable
        valid <- F
        network_file_table <<- ""
        session$sendCustomMessage("handler_alert", "Network must have 2 (unweighted) or 3 (weighted) columns.")
      } else if (ncol(network_file_table) > 3){
        network_file_table <<- network_file_table[, 1:3]
        session$sendCustomMessage("handler_debugger", "Removing extra columns from edgelist (3 remain).")
      }
    }
    if ( network_file_table != "" && (sum(network_file_table == "") > 0 || sum(is.na(network_file_table)) > 0) ){
      valid <- F
      network_file_table <<- ""
      session$sendCustomMessage("handler_alert", "Network must not contain empty or NA values.")
    }
    if (network_file_table != "" && ncol(network_file_table) == 3){
      if (!is.numeric(network_file_table[[3]])){
        valid <- F
        network_file_table <<- ""
        session$sendCustomMessage("handler_alert", "Network weights (3rd column) must be numeric.")
      }
    }
    # print(network_file_table) # debug
    return(valid)
  }
  
  parseData <- function(data){
    parsed_data <- list()
    for (i in 1:length(data)){
      edgelist <- matrix("", nrow = 0, ncol = 2)
      cluster_names <- as.matrix(data[[i]][, 1])
      if (nrow(data[[i]]) > 0){
        for (j in 1:nrow(data[[i]])){
          nodes <- strsplit(data[[i]][j, 2], ",") # list
          if (length(nodes[[1]]) > max_cluster_items) max_cluster_items <<- length(nodes[[1]]) # updating value for max value of range slider
          for (k in 1:length(nodes[[1]])){
            edgelist <- rbind(edgelist, c(data[[i]][j, 1], nodes[[1]][k]))
          }
        }
        edgelist <- as.matrix(edgelist[order(edgelist[, 2]) ,]) # alpharethmetic sort
        for (j in 1:nrow(edgelist)){
          edgelist[j, 1] <- match(edgelist[j, 1], cluster_names)
        }
      }
      parsed_data[[length(parsed_data)+1]] <- edgelist
    }
    return(parsed_data)
  }
  
  trimClusters <- function(selectedFiles){
    for (i in 1:length(selectedFiles)){
      filtered_rawData[[selectedFiles[i]]] <<- matrix("", nrow = 0, ncol = 2) # resetting corresponding matrix in list
      for (j in 1:nrow(rawData[[selectedFiles[i]]])){
        split <- strsplit(rawData[[selectedFiles[i]]][j, 2], ",")
        if (length(split[[1]]) >= input$filterSlider[1] && length(split[[1]]) <= input$filterSlider[2])
          filtered_rawData[[selectedFiles[i]]] <<- rbind(filtered_rawData[[selectedFiles[i]]], rawData[[selectedFiles[i]]][j, ])
      }
    }
    filtered_parsedData <<- parseData(filtered_rawData)
    # saveRDS(filtered_parsedData, "filtered_parsedData.rds")
    return(T)
  }
  
  keepIntersection  <- function(selectedFiles){
    table_participation <- table(do.call(rbind, filtered_parsedData)[,2])
    commonNodes <- names(table_participation[table_participation == length(selectedFiles)]) # keep only nodes that exist in all files
    if (!identical(commonNodes, character(0))){
      for (i in 1:(length(selectedFiles))){
        temp_filtered_rawData <- matrix("", nrow = 0, ncol = 2)
        counter <- 1
        if (nrow(filtered_rawData[[i]]) != 0){
          for (j in 1:nrow(filtered_rawData[[i]])){
            temp <- filtered_rawData[[i]][j, 2]
            temp <- strsplit(temp, ",")
            temp <- temp[[1]][which(temp[[1]] %in% commonNodes)] # keep only nodes that exist in commonNodes
            if (!identical(temp, character(0))){
              temp_filtered_rawData <- rbind(temp_filtered_rawData, c(paste("Cluster", counter, sep=""), paste(temp, collapse=",")))
              counter <- counter + 1
            }
          }
        }
        filtered_rawData[[i]] <<- temp_filtered_rawData
      }
      filtered_parsedData <<- parseData(filtered_rawData)
    } else session$sendCustomMessage("handler_alert", "No common objects found in remaining clusters.")
    # saveRDS(filtered_parsedData, "filtered_parsedData.rds")
    return(T)
  }
  
  addMutuallyExclusiveSingletons <- function(selectedFiles){
    # 1. find all unique mutual exclusive Object names
    mutualExclusiveNodes <- matrix ("", nrow = 1, ncol = 0)
    for (i in 1:(length(selectedFiles-1))){
      for (j in (i+1):length(selectedFiles)){
        indexes <- which(filtered_parsedData[[selectedFiles[i]]][, 2] %in% filtered_parsedData[[selectedFiles[j]]][, 2])
        if (!identical(indexes, integer(0))) mutualExclusiveNodes <- c(mutualExclusiveNodes, filtered_parsedData[[selectedFiles[i]]][-indexes ,2])
        else mutualExclusiveNodes <- c(mutualExclusiveNodes, filtered_parsedData[[selectedFiles[i]]][ ,2])
        indexes <- which(filtered_parsedData[[selectedFiles[j]]][, 2] %in% filtered_parsedData[[selectedFiles[i]]][, 2])
        if (!identical(indexes, integer(0))) mutualExclusiveNodes <- c(mutualExclusiveNodes, filtered_parsedData[[selectedFiles[j]]][-indexes ,2])
        else mutualExclusiveNodes <- c(mutualExclusiveNodes, filtered_parsedData[[selectedFiles[j]]][ ,2])
      }
    }
    mutualExclusiveNodes <- unique(mutualExclusiveNodes)
    # 2. append mutual exclusive Object names to files without them
    if (length(mutualExclusiveNodes) > 0){
      for (i in 1:length(mutualExclusiveNodes)){
        for (j in 1:length(selectedFiles)){
          if (is.na(match(mutualExclusiveNodes[i], filtered_parsedData[[selectedFiles[j]]][ ,2])))
            filtered_rawData[[selectedFiles[j]]] <<- rbind(filtered_rawData[[selectedFiles[j]]], c(paste("DummyCluster_", i, sep = ""), mutualExclusiveNodes[i]))
        }
      }
    }
    filtered_parsedData <<- parseData(filtered_rawData)
    return(T)
  }
  
  updateData <- function(){ # updates values from JavaScript -> clusteringNames and parsedData
    if (!identical(input$js_clustering_names, NULL)) clusteringNames <<- input$js_clustering_names
    else clusteringNames <<- matrix("", nrow = 0, ncol = 0) # need this, in case user removes all current files
    if (!identical(input$js_removalIndexes, NULL)){
      js_removalIndexes <- input$js_removalIndexes
      for (i in 1:length(js_removalIndexes)){
        parsedData <<- parsedData[-js_removalIndexes[i]] # removing i-th datastructre from list, the order is important
        rawData <<- rawData[-js_removalIndexes[i]]
        filtered_parsedData <<- filtered_parsedData[-js_removalIndexes[i]]
        filtered_rawData <<- filtered_rawData[-js_removalIndexes[i]]
      }
      session$sendCustomMessage("handler_resetRemovalIndexes", T)
    }
    return(T)
  }
  
  parseHeatMapInput <- function(data, metric, selectedFiles){
    if (identical(selectedFiles, NULL)) selectedFiles <- clusteringNamesHeatmap # for circos plots
    parsed_data <- matrix(0, nrow = length(selectedFiles), ncol = length(selectedFiles))
    rownames(parsed_data) <- selectedFiles
    colnames(parsed_data) <- selectedFiles
    row <- match(metric, rownames(d3heatmap_input))
    j <- 1
    k <- 1
    for (i in 1:ncol(d3heatmap_input)){
      if (!identical(colnames(d3heatmap_input)[i], NULL)){
        split <- strsplit(colnames(d3heatmap_input)[i], " vs ")
        if (!is.na(match(split[[1]][1], selectedFiles)) && !is.na(match(split[[1]][2], selectedFiles))){
          parsed_data[j, k] <- d3heatmap_input[row, i]
          k <- k + 1
        }
        if (k > length(selectedFiles)){
          j <-  j + 1 # incrementing j
          k <- 1 # resetting k
        }
      } else{
        session$sendCustomMessage("handler_alert", "Empty set generated from clustering comparisons. Try again after executing valid clustering comparisons.")
        break
      }
    }
    return(parsed_data)
  }
  
  apply_layout_as_tree <- function(sub_graph, sub_nodes){
    layout <- layout_as_tree(sub_graph, root = numeric(), circular = FALSE,
                             rootlevel = numeric(), mode = "all", flip.y = TRUE)
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_in_circle <- function(sub_graph, sub_nodes){
    layout <- layout_in_circle(sub_graph, order = V(sub_graph))
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_on_grid <- function(sub_graph, sub_nodes){
    layout <- layout_on_grid(sub_graph, width = 0, height = 0, dim = 2)
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_randomly <- function(sub_graph, sub_nodes){
    layout <- layout_randomly(sub_graph, dim = 2)
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_with_dh <- function(sub_graph, sub_nodes){
    layout <- layout_with_dh(sub_graph, coords = NULL, maxiter = 10, fineiter = max(10, log2(vcount(sub_graph))), cool.fact = 0.75, weight.node.dist = 1,
                             weight.border = 0, weight.edge.lengths = edge_density(sub_graph)/10,
                             weight.edge.crossings = 1 - sqrt(edge_density(sub_graph)),
                             weight.node.edge.dist = 0.2 * (1 - edge_density(sub_graph)))
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_with_drl <- function(sub_graph, sub_nodes){
    if (count_components(sub_graph) != 1) session$sendCustomMessage("handler_alert", "DrL cannot execute with disconnected nodes.")
    layout <- layout_with_drl(sub_graph, use.seed = FALSE,
                              seed = matrix(runif(vcount(sub_graph) * 2), ncol = 2),
                              options = drl_defaults$default, weights = E(sub_graph)$weight,
                              fixed = NULL, dim = 2)
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_with_fr <- function(sub_graph, sub_nodes){
    layout <- layout_with_fr(sub_graph, coords = NULL, dim = 2, niter = 500,
                             start.temp = sqrt(vcount(sub_graph)), grid = c("auto", "grid", "nogrid"),
                             weights = NULL, minx = NULL, maxx = NULL, miny = NULL,
                             maxy = NULL, minz = NULL, maxz = NULL)
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_with_fr_cond <- function(sub_graph, sub_nodes, edgelist){
    layout <- layout_with_fr(sub_graph, coords = NULL, dim = 2, niter = 500,
                             start.temp = sqrt(vcount(sub_graph)), grid = c("auto", "grid", "nogrid"),
                             weights = NULL, minx = NULL, maxx = NULL, miny = NULL,
                             maxy = NULL, minz = NULL, maxz = NULL)
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_executeC", list(nodes_layout, edgelist)) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_with_gem <- function(sub_graph, sub_nodes){
    layout <- layout_with_gem(sub_graph, coords = NULL, maxiter = 40 * vcount(sub_graph)^2,
                              temp.max = vcount(sub_graph), temp.min = 1/10,
                              temp.init = sqrt(vcount(sub_graph)))
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_with_graphopt <- function(sub_graph, sub_nodes){
    layout <- layout_with_graphopt(sub_graph, start = NULL, niter = 500,
                                   charge = 0.001, mass = 30, spring.length = 0,
                                   spring.constant = 1, max.sa.movement = 5)
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_with_kk <- function(sub_graph, sub_nodes, sub_weights){
    layout <- layout_with_kk(sub_graph, dim = 2, weights = sub_weights)
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_with_lgl <- function(sub_graph, sub_nodes){
    layout <- layout_with_lgl(sub_graph, maxiter = 150, maxdelta = vcount(sub_graph),
                              coolexp = 1.5, root = NULL)
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_with_mds <- function(sub_graph, sub_nodes){
    layout <- layout_with_mds(sub_graph, dist = NULL, dim = 2, options = arpack_defaults)
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_with_sugiyama <- function(sub_graph, sub_nodes){
    layout <- layout_with_sugiyama(sub_graph, layers = NULL, hgap = 1, vgap = 1,
                                   maxiter = 100, weights = NULL, attributes = c("default", "all", "none"))$layout
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  applyLayout <- function(sub_graph, sub_nodes, sub_weights){
    set.seed(123)
    if (input$selectLayout == "Reingold-Tilford"){
      done <- apply_layout_as_tree(sub_graph, sub_nodes)
    } else if (input$selectLayout == "Circle"){
      done <- apply_layout_in_circle(sub_graph, sub_nodes)
    } else if (input$selectLayout == "Grid"){
      done <- apply_layout_on_grid(sub_graph, sub_nodes)
    } else if (input$selectLayout == "Random"){
      done <- apply_layout_randomly(sub_graph, sub_nodes)
    } else if (input$selectLayout == "Davidson-Harel"){
      done <- apply_layout_with_dh(sub_graph, sub_nodes)
    } 
    # else if (input$selectLayout == "DrL"){
    #   done <- apply_layout_with_drl(sub_graph, sub_nodes)
    # } 
    else if (input$selectLayout == "Fruchterman-Reingold"){
      done <- apply_layout_with_fr(sub_graph, sub_nodes)
    } else if (input$selectLayout == "GEM"){
      done <- apply_layout_with_gem(sub_graph, sub_nodes)
    } else if (input$selectLayout == "Graphopt"){
      done <- apply_layout_with_graphopt(sub_graph, sub_nodes)
    } 
    # else if (input$selectLayout == "Kamada-Kawai"){
    #   done <- apply_layout_with_kk(sub_graph, sub_nodes, sub_weights)
    # } 
    # else if (input$selectLayout == "Large Graph Layout"){
    #   done <- apply_layout_with_lgl(sub_graph, sub_nodes)
    # } 
    else if (input$selectLayout == "Multidimensional Scaling"){
      done <- apply_layout_with_mds(sub_graph, sub_nodes)
    } else if (input$selectLayout == "Sugiyama"){
      done <- apply_layout_with_sugiyama(sub_graph, sub_nodes)
    }
    return(TRUE)
  }
  
  parseEdgelist <- function(threshold, names, data){
    index <- 1
    edgelist <- matrix("", nrow = 0, ncol = 3)
    for (i in 1:(length(names)-1)){
      for (j in (i+1): length(names)){
        if (threshold < data[index]) edgelist <- rbind(edgelist, c(names[i], names[j], data[index]))
        index <- index + 1
      }
    }
    return(edgelist)
  }
  
  createGraph <- function(edgelist) {
    graph <- graph_from_edgelist(edgelist[, 1:2], directed = FALSE)
    if (ncol(edgelist) == 3) E(graph)$weight <- as.double(edgelist[, 3])
    else E(graph)$weight <- rep(1, nrow(edgelist))
    # remove loops and multiple edges, simplify sum aggregates same edges
    graph <- simplify(graph, remove.multiple = TRUE, remove.loops = TRUE, edge.attr.comb = list(weight = "sum"))
    return(graph)
  }
  
  # Confusion Matrix Functions ----
  get.confusion <- function(x, y, ux, uy) {
    .Call('_mclustcomp_getconfusion', PACKAGE = 'mclustcomp', x, y, ux, uy) # call to c++ from mclustcomp package
  }
  
  get.commsize <- function(x, ux) {
    .Call('_mclustcomp_getcommsize', PACKAGE = 'mclustcomp', x, ux) # call to c++ from mclustcomp package
  }
  
  confusionMatrix <- function(index1, index2){
    c1 <- filtered_parsedData[[index1]]
    c2 <- filtered_parsedData[[index2]]
    x <- as.numeric(c1[, 1])
    y <- as.numeric(c2[, 1])
    ux = unique(x)
    uy = unique(y)
    confmat = get.confusion(x, y, ux, uy)
    rownames(confmat) <- rawData[[index1]][ux, 1] # ux
    colnames(confmat) <- rawData[[index2]][uy, 1] # uy
    scx = get.commsize(x, ux)
    scy = get.commsize(y, uy)
    nk = length(scx)
    nl = length(scy)
    return(list(confmat = confmat, nk = nk, nl = nl))
  }
  
  maximumMatch <- function(confmat, nk, nl){ # recursive
    minsize = min(nk, nl)
    indexes <- which(confmat == max(confmat), arr.ind=TRUE)[1,]
    if (minsize > 1 && max(confmat) > 0){
      return(rbind(c(rownames(confmat)[indexes[1]], colnames(confmat)[indexes[2]], max(confmat)), maximumMatch(confmat[-indexes[1], -indexes[2], drop = F], nk-1, nl-1)))
    }
    else return(c(rownames(confmat)[indexes[1]], colnames(confmat)[indexes[2]], max(confmat)))
  }
  
  #----------------return_nodes_and_feature_name_given_row_from_feature_file-----------
  return_nodes_and_feature_name_given_row_from_feature_file <- function(row){
    m <- (str_split(row, "\t", simplify = TRUE))
    fnodes <- as.list(m[,2])    
    feature <- as.list(m[,1]) #oles oi grammes ths prwths sthlhs
    tempList2 <- list("fnodes"=fnodes,"feature"=feature)
    return(tempList2)
  }
  
  #---------------returns_vectorS---------------
  returns_vectorS <-function(G,n){
    x <- list()
    n <- (str_split(n, ",", simplify = TRUE)[1,]) # n= pinakas me 1-1 nodes tou panw n
    for (t in n){  #gyros1: a1, a2, a4 / gyros2: a3, a5 /gyros3: a2, a3 
      Ps <- t
      x[[paste0("", t)]] <- Ps
      
      mx <- matrix(unlist(x))
      S<-list(mx)
      if (!(is.null(S))){
        vectorS<-unlist(S)
      }
    }
    return (vectorS)
  }
  
  #---------------returns_vectorT---------------
  returns_vectorT <-function(G,vectorS,nnmatrix, network_file_matrix){
    y <- list()
    T<-NULL
    for (sn in nnmatrix[,1]){
      if (!(sn %in% vectorS)){ #an den einai ola sto S, o,ti perisseyei mpainei sto T
        Ps2 <- sn  
        y[[paste0("", sn)]] <- Ps2
        my <- matrix(unlist(y))
        node_degrees2 <- as.list(degree(G,v=my[,1]))
        ndeg2<-as.numeric(paste(unlist(node_degrees2))) 
        my<-cbind(my, ndeg2)
        T<-list(my[,1])
      }
    }
    if (!(is.null(T))){
      vectorT<-unlist(T)
      return (vectorT)
    }else{
      return (NULL)
    }
  }
  
  #---------------boundary---------------
  boundary <- function(G,vectorS,vectorT){
    epair<-0
    for(n1 in vectorS){
      for (i in 1:length(neighbors(G,n1))){
        u<-(neighbors(G,n1)[[i]])
        if (u$name %in% vectorT){
          n2<-u$name
          lista<- list(n1,n2)
          sub<-induced_subgraph(G,unlist(lista)) 
          epair<- epair+ as.numeric(E(sub)$weight)
        }
      }
    }
    return (epair)
  }
  
  #---------------main---------------
  runConductance <- function(network_file_matrix, network_file_table, annotation_file_list){
    if(ncol(network_file_matrix)==3){
      weights_matrix<-network_file_matrix[,3]
    }else{
      weights_matrix<-matrix(1, nrow = nrow(network_file_matrix), ncol = 1) 
      network_file_matrix<-cbind(network_file_matrix,weights_matrix)
    }
    
    G <- graph_from_data_frame(network_file_table, directed = FALSE)%>%
      set_edge_attr( "weight", value= weights_matrix)
    
    rows <- paste(as.matrix(annotation_file_list[[1]]), as.matrix(annotation_file_list[[2]]), sep="\t")
    
    netnodes <- (network_file_matrix)
    nnlist <- as.list(netnodes[,1:2])
    nnmatrix<-as.matrix(unique(nnlist))
    
    c2<-""
    c3<-NULL
    
    for (row in rows){
      f2 <- return_nodes_and_feature_name_given_row_from_feature_file(row) #pairnei 1-1 tis grammes
      fnodes <- f2$fnodes #an to nodes to kanw show mesa se for tote ta deixnei ola osa exei mesa kai oxi mono to teleytaio
      feature <- f2$feature #to idio kai edw
      for (n in fnodes){ #n = node,node....
        vectorS<- returns_vectorS(G,n)
        vectorT<- returns_vectorT (G,vectorS,nnmatrix, network_file_matrix)
        
        Ssum<-0
        for(s in vectorS){
          indexs<-which(as.matrix(netnodes[,1:2])  == s, arr.ind = TRUE) # indexs<-which(netnodes == s, arr.ind = TRUE)
          Ssum<-Ssum+sum(as.numeric(netnodes[indexs[,1],3]))
        }
        
        if (!(is.null(vectorT))){
          Tsum<-0
          for(t in vectorT){
            indext<-which(as.matrix(netnodes[,1:2]) == t, arr.ind = TRUE) # indext<-which(netnodes == t, arr.ind = TRUE)
            Tsum<-Tsum+sum(as.numeric(netnodes[indext[,1],3]))
          }
          bound<-boundary(G,vectorS,vectorT)
          conductance<-bound/min(Ssum,Tsum)
          c1<-toString(conductance)
          c2<-paste(c2,c1,sep="-")
          c3<-as.list(as.numeric(strsplit(c2, "-")[[1]]))
          # show(conductance)
          
        }else{
          conductance<-0
          # show(conductance)
        }
      }
    }
    
    if(!(is.null(c3))){ #conductance!=0
      if(c3[[2]]==1){ #conductance=1
        c4<-as.list(as.numeric(c3)+0.1)
        v_c4<-unlist(c4)
        v_c3<-unlist(c3)

        # hist(v_c3[c(2:length(v_c3))],
        #      main="Histogram of Conductance",
        #      xlab="Conductance",
        #      ylab="Number of samples in Range",
        #      xlim=c(0,1),
        #      breaks=c(v_c3[c(2)],v_c4[c(2)]),
        #      col = "orange") #number of samples...=number clusters

        output$histConductance <- renderPlot({h <- hist(v_c3[c(2:length(v_c3))],
                                                        main="Histogram of Conductance",
                                                        xlab="Conductance", ylab="# samples in Range",
                                                        col="cornflowerblue",
                                                        breaks = c(0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1))
        text(h$mids, h$counts, labels=h$counts, adj=c(0.5, -0.5))})

      }else{ #conductance = (0,1)
        v_c3<-unlist(c3)
        # hist(v_c3[c(2:length(v_c3))],main="Histogram of Conductance",xlab="Conductance",ylab="Number of samples in Range",xlim=c(0,1) ,col = "orange") #number of samples...=number clusters
        output$histConductance <- renderPlot({h <- hist(v_c3[c(2:length(v_c3))],
                                                        main="Histogram of Conductance",
                                                        xlab="Conductance", ylab="# samples in Range",
                                                        col="cornflowerblue",
                                                        breaks = c(0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1))
        text(h$mids, h$counts, labels=h$counts, adj=c(0.5, -0.5))})
      }

    } else{ #conductance=0
      #hist(conductance,main="Histogram of Conductance",xlab="Conductance",ylab="Number of samples in Range",xlim=c(0,1),breaks=c(0,0.1),col = "orange") #number of samples...=number clusters

      output$histConductance <- renderPlot({h <- hist(conductance,
                                                      main="Histogram of Conductance",
                                                      xlab="Conductance", ylab="# samples in Range",
                                                      ylim=c(0, 1),
                                                      col="cornflowerblue",
                                                      breaks = c(0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1))
      text(h$mids, h$counts, labels=h$counts, adj=c(0.5, -0.5))})
    }
  }
  
}
