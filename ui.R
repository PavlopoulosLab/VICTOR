ui <- fluidPage(
  
  useShinyjs(),
  tags$head(tags$link(rel = "stylesheet", type = "text/css", href = "cc.css")),
  tags$head(tags$script(src = "cc.js")),
  tags$head(tags$script(src = "rshiny_handlers.js")),
  tags$head(tags$script(src = "update_rshiny_values.js")),
  tags$head(tags$script(src = "cc_histogram.js")), # maria
  tags$head(tags$script(src = "vis-network.min.js")),
  tags$head(tags$script(src = "https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.5/d3.min.js")),
  tags$head(tags$script(src = "cc_networks.js")),
  tags$head(tags$script(src = "cc_sankey_plots.js")),
  tags$head(tags$script(src = "http://labratrevenge.com/d3-tip/javascripts/d3.tip.v0.6.3.js")), # needed to color the rects in d3heatmaps R
  tags$head(tags$script(src = "cc_chord_diagram.js")),
  tags$head(tags$script(src ="d3v5.js")), # renamed to d35 for function calling to avoid conflict with d3/3.5.5/d3.min.js
  theme = shinythemes::shinytheme("cerulean"),
  # shinythemes::themeSelector(),
  uiOutput("banner"),
  navbarPage("", id = "navBar", selected = "Home",
    tabPanel("Home", htmlOutput("landing_page")),
    tabPanel("File Handling",
      sidebarLayout(
        sidebarPanel(
          fileInput("inFiles", "Upload Multiple Clustering Files (each < 1MB)", accept = c(".tsv", ".txt"), multiple = TRUE),
          div(id='fileActions', class='box'),
          sliderInput("filterSlider", label = h4("Cluster Object Cutoff Range"), min = 1,
                      max = 2, value = c(1, 2), step = 1),
          radioButtons("filterOption", "Filter by object intersection or by creating singleton clusters for exclusive objects:",
                       choices = c("Intersection" = "intersection",
                                   "Superset" = "superset"),
                       selected = "intersection", inline = TRUE, width = NULL, choiceNames = NULL, choiceValues = NULL),
          actionButton("filterDataButton", icon("angle-double-right"), label = "Filter", class ="executeButton")
        ),
        mainPanel(
          tabsetPanel(id = "fileHandlingTabs",
            tabPanel("Raw Files",
              tabsetPanel(
                tabPanel("File Stats", plotOutput("clusterPlot"), plotOutput('nodePlot')),
                tabPanel("Participation Histogram", 
                         selectInput('dataSelectionHist', 'Select File:', ""),
                         plotOutput("histPlot")),
                tabPanel("Data", 
                         selectInput('dataSelection', 'Select File:', ""),
                         dataTableOutput("dataTable"))
                                        # div(id='showRawData', class='panelDiv'))
                # tabPanel("Parsed Data", div(id='showData', class='panelDiv'))
              )
            ),
            tabPanel("Filtered Files",
               tabsetPanel(
                 tabPanel("File Stats", plotOutput("filteredClusterPlot"), plotOutput('filteredNodePlot')),
                 tabPanel("Participation Histogram", 
                          selectInput('filteredDataSelectionHist', 'Select File:', ""),
                          plotOutput("histFilteredPlot")),
                 tabPanel("Data", 
                          selectInput('filteredDataSelection', 'Select File:', ""),
                          dataTableOutput("filteredDataTable"))
               )
            )
          )
        )
      )
    ),
    tabPanel("Compare Clusterings",
      sidebarLayout(
        sidebarPanel(
          selectInput("metrics", "Choose Metrics to Calculate:", # metrics selection
            c("Adjusted Rand Index" = "adjrand",
              #"Chi-Squared Coefficient" = "chisq",
              "Fowlkes-Mallows index" = "fmi",
              "Jaccard Index" = "jaccard",
              #"Mirkin Metric" = "mirkin",
              "Overlap Coefficient" = "overlap",
              #"Partition Difference" = "pd",
              #"Rand Index" = "rand",
              #"Sorensen-Dice Coefficient" = "sdc",
              #"Simple Matching Coefficient" = "smc",
              #"Tanimoto index" = "tanimoto",
              #"Tversky index" = "tversky",
              "Wallace Criterion Type 1" = "wallace1",
              "Wallace Criterion Type 2" = "wallace2",
              #"F-Measure" = "f",
              #"Meila-Heckerman Measure" = "mhm",
              "Maximum-Match Measure" = "mmm",
              #"Van Dongen Measure" = "vdm",
              #"Joint Entropy" = "jent",
              #"Mutual Information" = "mi",
              "Normalized Mutual Information by Strehl Ghosh" = "nmi1",
              "Normalized Mutual Information by Fred and Jain" = "nmi2",
              #"Normalized Mutual Informatio by Danon" = "nmi3",
              "Normalized Variation of Information" = "nvi"
              #"Variation of Information" = "vi"
              ), multiple = TRUE, selectize = TRUE),
          actionButton("executeCC", icon("angle-double-right"), label = "Execute", class ="executeButton"),
          div(id='fileSelection_CC', class='leftPanel') # for checkbox file selection
        ),
        mainPanel(
          tabsetPanel(id = "ccTabs", tabPanel("Explore Metric Results",
                                              div(id="cc_loader", class="loader"),
                                              div(id='canvas_gradient', class='rightPanel'), 
                                              div(id='results_CC', class='rightPanel')),
                      tabPanel("Maximum Cluster Match",
                               selectInput('dataSelectionMCM1', 'Select File 1:', ""),
                               selectInput('dataSelectionMCM2', 'Select File 2:', ""),
                               actionButton("executeMCM", icon("angle-double-right"), label = "Execute MCM", class ="executeButton"),
                               dataTableOutput("MCM_table"))
          )
        )
      )
    ),
    tabPanel("Metric Barplots",
      sidebarLayout(
        sidebarPanel( # add checkbox groups here: named_files and metrics selections
          div(id='controls_MH', class='leftPanel'), # maria
          actionButton("executeMH", icon("angle-double-right"), label = "Execute", class ="executeButton"),
          div(id='fileSelection_MH', class='leftPanel') # for checkbox file selection
        ),
        mainPanel(
          tabsetPanel(id = "mhTabs", tabPanel("Explore Metric Barplots", div(id='results_MH', class='rightPanel')))
        )
      )
    ),
    tabPanel("Hierarchical Heatmaps",
      sidebarLayout(
        sidebarPanel( # add checkbox groups here: named_files and metrics selections
          actionButton("executeHH", icon("angle-double-right"), label = "Execute", class ="executeButton"),
          div(id='fileSelection_HH', class='leftPanel') # for checkbox file selection
        ),
        mainPanel(
          tabsetPanel(id = "hhTabs", tabPanel("Explore Hierarchical Heatmaps",
                                              div(id='results_HH', class='rightPanel'),
                                              d3heatmapOutput("heatmap")
                                              ))
        )
      )
    ),
    tabPanel("Sankey Plots",
      sidebarLayout(
        sidebarPanel( # add checkbox groups here: named_files and metrics selections
          div(id='controls_SP', class='leftPanel'),
          actionButton("executeSP", icon("angle-double-right"), label = "Execute", class ="executeButton"),
          div(id='fileSelection_SP', class='leftPanel') # for checkbox file selection
        ),
        mainPanel(
          tabsetPanel(id = "spTabs", tabPanel("Explore Sankey Plots", div(id='results_SP', class='rightPanel')))
        )
      )
    ),
    tabPanel("Interactive Networks",
      sidebarLayout(
        sidebarPanel( # add checkbox groups here: named_files and metrics selections
          div(id='controls_IN', class='leftPanel'),
          actionButton("executeIN", icon("angle-double-right"), label = "Execute", class ="executeButton"),
          div(id='fileSelection_IN', class='leftPanel') # for checkbox file selection
        ),
        mainPanel(
          tabsetPanel(id = "inTabs", 
                      tabPanel("Explore Interactive Network", div(id='results_IN', class='rightPanel')),
                      tabPanel("Apply Layouts to Network", 
                               selectInput("selectLayout", "Choose layout algorithm to draw the network:", c("-", "Reingold-Tilford", "Circle", "Grid", "Random", "Davidson-Harel",  
                                                                                                           "Fruchterman-Reingold", "GEM", "Graphopt", "Multidimensional Scaling", "Sugiyama")),
                               div(id='results_IN_Layout', class='rightPanel')))
        )
      )
    ),
    tabPanel("Circos Plots",
             sidebarLayout(
               sidebarPanel( # add checkbox groups here: named_files and metrics selections
                 div(id='controls_CP', class='leftPanel'), # maria
                 actionButton("executeCP", icon("angle-double-right"), label = "Execute", class ="executeButton"),
                 div(id='fileSelection_CP', class='leftPanel') # for checkbox file selection
               ),
               mainPanel(
                 tabsetPanel(id = "cpTabs", tabPanel("Explore Circos Plots", div(id='results_CP', class='rightPanel')))
               )
             )
    ),
    tabPanel("Conductance",
      sidebarLayout(
        sidebarPanel( # add checkbox groups here: named_files and metrics selections
          fileInput("edgelistFile", "Upload an Edgelist (< 20000 edges):", accept = c(".tsv", ".txt")),
          radioButtons("condDataType", "Choose raw or filtered clustering data to calculate Conductance:",
                       choices = c("Raw" = "raw",
                                   "Filtered" = "filtered"),
                       selected = "raw", inline = TRUE, width = NULL, choiceNames = NULL, choiceValues = NULL),
          actionButton("executeC", icon("angle-double-right"), label = "Execute", class ="executeButton"),
          div(id='fileSelection_C', class='leftPanel') # for checkbox file selection
        ),
        mainPanel(
          div(id="cond_loader", class="loader"),
          tabsetPanel(id = "cTabs", 
                      tabPanel("Network",
                               #div(id='results_condNetwork_Layout', class='rightPanel'),
                               visNetworkOutput("network", height = "70vh"),
                               dataTableOutput("condDataTable")),
                               
                      tabPanel("Conductance Histogram", plotOutput("histConductance"))
                      )
        )
      )
    ),
    tabPanel("Help", tabsetPanel(id = "hTabs", 
                                 tabPanel("The File Handling Tab", div(id='help_file')),
                                 tabPanel("Metrics", div(id='help_metric')),
                                 tabPanel("Examples", div(id='help_examples')),
                                 tabPanel("The Compare Clusterings Tab", div(id='help_clusterings')),
                                 tabPanel("The Metric Barplots Tab", div(id='help_barplots')),
                                 tabPanel("The Hierarchical Heatmaps Tab", div(id='help_heatmaps')),
                                 tabPanel("The Sankey Plots Tab", div(id='help_sankey')),
                                 tabPanel("The Interactive Networks Tab", div(id='help_networks')),
                                 tabPanel("The Circos Plots Tab", div(id='help_circosplots')),
                                 tabPanel("The Conductance Tab",div(id='help_conductance')),
                                 tabPanel("About", div(id='help_about'))
                      )
    )
  ),
  div(id='footer')
)
