function updateBarPlots(){
  checkBoxCounterFlag++;
  Shiny.setInputValue("js_checkBoxCounterFlag", checkBoxCounterFlag);
  return true;
}

function updateHist_Data(){
  counterFlag++;
  Shiny.setInputValue("js_counterFlag", counterFlag);
  return true;
}

function updateSelectedStatFiles(){
  var selectedStatFiles = [],
      c = document.getElementById("fileActions").children;
  for (i = 5; i < c.length; i++){ //skipping a checkbox, its label, two buttons and a <br/> (0 included)
    if ((i-5)%3 === 0){
      if (c[i].checked) selectedStatFiles.push((i-5)/3+1); //push indexes of clusterings, +1 because it is for R
    }
  }
  Shiny.setInputValue("js_selectedStatFiles", selectedStatFiles);
  updateBarPlots();
  return true;
}

function updateClusteringNamesRShiny(){
  //console.log(clusteringNames);
  Shiny.setInputValue("js_clustering_names", clusteringNames);
  return true;
}

function updateInputDataRShiny(){
  //console.log(removalIndexes);
  //console.log(inputData);
  Shiny.setInputValue("js_removalIndexes", removalIndexes);
  return true;
}

function updateSelectedFilesCCRShiny(){
  var selectedFilesCC = [],
      c = document.getElementById("fileSelection_CC").children;
  for (i = 3; i < c.length; i++){ //skipping a checkbox, its label and a <br/> (0 included)
    if ((i-3)%3 === 0){
      if (c[i].checked) selectedFilesCC.push((i-3)/3+1); //push indexes of clusterings, +1 because it is for R
    }
  }
  Shiny.setInputValue("js_selectedFilesCC", selectedFilesCC);
  return true;
}

function updateSelectedFilesHHRShiny(){
  var selectedFilesHH = [],
      c = document.getElementById("fileSelection_HH").children;
  for (i = 6; i < c.length; i++){ //skipping a checkbox, its label and a <br/> (0 included)
    if ((i-6)%3 === 0){
      if (c[i].checked) selectedFilesHH.push((i-6)/3+1); //push indexes of clusterings, +1 because it is for R
    }
  }
  Shiny.setInputValue("js_selectedFilesHH", selectedFilesHH);
  return true;
}

//maria
function updateSelectedFilesCPRShiny(){
  var selectedFilesCP = [],
      c = document.getElementById("fileSelection_CP").children;
  for (i = 6; i < c.length; i++){ //skipping a metric selection, its label, br, checkbox, its label and a <br/> (0 included)
    if ((i-6)%3 === 0){
      if (c[i].checked) selectedFilesCP.push((i-6)/3+1); //push indexes of clusterings, +1 because it is for R
    }
  }
  Shiny.setInputValue("js_selectedFilesCP", selectedFilesCP);
  return true;
}

function updateSelectedFilesCRShiny(){
  var selectedFileC,
      c = document.getElementById("fileSelection_C").children;
  for (i = 0; i < c.length; i++){
    if (i%3 === 0){
      if (c[i].checked){
        selectedFileC = i/3+1; //index of clustering file, +1 because it is for R
        break;
      } 
    }
  }
  //console.log(selectedFileC);
  Shiny.setInputValue("js_selectedFilesC", selectedFileC);
  return true;
}

function updateSliderValue_IN(){
  Shiny.setInputValue("js_in_slider_value", in_slider_value);
  return true;
}

function updateChosenClusterings_IN(){
  Shiny.setInputValue("js_in_chosenClusterings", in_chosenClusterings);
  return true;
}

function updateResult_IN(){
  Shiny.setInputValue("js_in_result", in_result);
  return true;
}

function updateChosenMetric_HH(metric){
  Shiny.setInputValue("js_hh_metric", metric);
  return true;
}

function updateChosenMetric_CP(metric){
  Shiny.setInputValue("js_cp_metric", metric);
  return true;
}
