//GLOBAL STATIC VARIABLES
var rawData,
    inputData,
    clusteringNames,
    removalIndexes = [], //indexes to send to R for data removal from the list, the order these are registered is crucial for the correct removal
    counterFlag = 0, // to update Rshiny UI correctly
    checkBoxCounterFlag = 0, // to update Rshiny UI correctly
    metrics,
    chosenClusterings,
    clusteringComboNames,
    mClustCompResults,
    in_slider_value,
    in_chosenMetric,
    in_chosenClusterings,
    in_result,
    in_links = [],
    visNetwork;
  
//FUNCTIONS
function updateEdgeThreshold(item){
  var span_sliderValue = item.parentElement.getElementsByTagName("span")[0];
  span_sliderValue.innerText = item.value;
  return true; 
}

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById("footer").innerHTML='<object type="text/html" data="footer.html" id="footer" class="footer"></object>';
  document.getElementById("help_file").innerHTML='<object type="text/html" data="help_pages/help_file.html" id="help_file" class="help_div"></object>';
    document.getElementById("help_metric").innerHTML='<object type="text/html" data="help_pages/help_metric.html" id="help_metric" class="help_div"></object>';
  document.getElementById("help_examples").innerHTML='<object type="text/html" data="help_pages/help_examples.html" id="help_examples" class="help_div"></object>';
  document.getElementById("help_clusterings").innerHTML='<object type="text/html" data="help_pages/help_clusterings.html" id="help_clusterings" class="help_div"></object>';
  document.getElementById("help_barplots").innerHTML='<object type="text/html" data="help_pages/help_barplots.html" id="help_barplots" class="help_div"></object>';
    document.getElementById("help_heatmaps").innerHTML='<object type="text/html" data="help_pages/help_heatmaps.html" id="help_heatmaps" class="help_div"></object>';
  document.getElementById("help_sankey").innerHTML='<object type="text/html" data="help_pages/help_sankey.html" id="help_sankey" class="help_div"></object>';
  document.getElementById("help_networks").innerHTML='<object type="text/html" data="help_pages/help_networks.html" id="help_networks" class="help_div"></object>';
    document.getElementById("help_circosplots").innerHTML='<object type="text/html" data="help_pages/help_circosplots.html" id="help_circosplots" class="help_div"></object>';
    document.getElementById("help_conductance").innerHTML='<object type="text/html" data="help_pages/help_conductance.html" id="help_conductance" class="help_div"></object>';
  document.getElementById("help_about").innerHTML='<object type="text/html" data="help_pages/help_about.html" id="help_about" class="help_div"></object>';
  return(true);
});
