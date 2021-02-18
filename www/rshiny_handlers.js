//FUNCTIONS
function disableTabs(m){
  var i,
      navbar_li_children = document.getElementById("navBar").children;
  for (i = 2; i < (navbar_li_children.length - 2); i++){ //leaving conductance and help out
    navbar_li_children[i].style.pointerEvents = "none";
    navbar_li_children[i].style.opacity = 0.5;
  }
  return true;
}

function enableTabs(m){
  var i,
      navbar_li_children = document.getElementById("navBar").children;
  if (!m){ // when flag m is F, only enable Clustering Comparisons tab
    navbar_li_children[2].style.pointerEvents = "all";
    navbar_li_children[2].style.opacity = 1;
  }else { // when flag m is T, enable all remaining tabs
    for (i = 3; i < (navbar_li_children.length - 2); i++){
      navbar_li_children[i].style.pointerEvents = "all";
      navbar_li_children[i].style.opacity = 1;
    }
  }
  return true;
}

function shinyAlert(message){
  alert(message);
  return true;
}

function assignClusteringNames(message){
  clusteringNames = message;
  updateClusteringNamesRShiny(); //need to send it back to R, in case of multiple consecutive file uploads without removals inbetween
  return true;
}

function assignRawData(data){
  rawData = data;
  return true;
}

function assignData(data){
  inputData = data;
  updateInputDataRShiny(); //correct updating, in case of multiple consecutive file uploads
  return true;
}

function updateSelectedFiles(item){
  var parent_id = item.parentElement.id;
  if (parent_id == "fileSelection_CC") updateSelectedFilesCCRShiny();
  else if (parent_id == "fileSelection_HH") updateSelectedFilesHHRShiny();
  else if (parent_id == "fileSelection_CP") updateSelectedFilesCPRShiny(); //maria
  else if (parent_id == "fileSelection_C") updateSelectedFilesCRShiny();
  return true;
}

function removeSelected(){
  if (confirm('Are you sure you want to remove all selected files?')) {
    var i,
        c = document.getElementById("fileActions").children,
        tbl_raw = document.getElementById("showRawDataTable"),
        tbl_parsed = document.getElementById("showDataTable");
    for (i = (c.length-1); i > 4; i--){ //skipping a checkbox, its label, two action buttons and a <br/> (0 included)
      if ((i-5)%3 === 0){
        if (c[i].checked){
          //checkbox line remove
          c[i+2].remove();
          c[i+1].remove();
          c[i].remove();
          if (typeof(clusteringNames) == "object") clusteringNames = clusteringNames.filter(function(value, index, arr){ return index != (i-5)/3;}); //clusteringNames value remove
          else clusteringNames = [];
          inputData = inputData.filter(function(value, index, arr){ return index != (i-5)/3;}); //inputData value remove
          removalIndexes.push((i-5)/3+1); //+1 because this is for R
          updateClusteringNamesRShiny(); //update rshiny values
        }
      }
    }
    updateInputDataRShiny(); //update rshiny values
    //finally, update file selection in the rest of the tabs
    createFileSelection(); //mclustcomp tab update file selection
    conductanceRadio(); //conductance tab update file selection
    updateSelectedFilesCCRShiny(); //need to update because checkboxes are created anew (and are unselected)
    updateSelectedFilesHHRShiny();
    updateSelectedFilesCPRShiny(); //maria
    updateSelectedFilesCRShiny();
    updateSelectedStatFiles();
  }
  return true;
}

function renameSelected(){
  var newName, temp, i,
      c = document.getElementById("fileActions").children;
  for (i = 5; i < c.length; i++){ //skipping a checkbox, its label, two action buttons and a <br/> (0 included)
    if ((i-5)%3 === 0){ //(c[i].type == "checkbox"){
      if (c[i].checked){
        newName = prompt("Rename file: ".concat(clusteringNames[(i-5)/3]).concat(" to: "), clusteringNames[(i-5)/3]);
        if (newName !== null){
          if (newName.length > 15) temp = newName.substr(0,15).concat("..");
          else temp = newName;
          c[i+1].innerText = temp; //checkbox label change
          if (typeof(clusteringNames) == "object") clusteringNames[(i-5)/3] = newName; //clusteringNames data structure change
          else clusteringNames = newName;
          updateClusteringNamesRShiny(); // update rshiny values
        }
      }
    }
  }
  //finally, update file selection in the rest of the tabs
  createFileSelection(); //mclustcomp tab update file selection
  conductanceRadio(); //conductance tab update file selection
  updateSelectedFilesCCRShiny(); //need to update because checkboxes are created anew (and are unselected)
  updateSelectedFilesHHRShiny();
  updateSelectedFilesCPRShiny(); //maria
  updateSelectedFilesCRShiny();
  updateSelectedStatFiles();
  return true;
}

function selectAllBoxesFiles(){
  var i,
      c = document.getElementById("fileActions").children;
  for (i = 5; i < c.length; i++){ //skipping a checkbox, its label, two action buttons and a <br/> (0 included)
    if ((i-5)%3 === 0){
      if (c[0].checked){
        c[i].checked = true;
      } else {
        c[i].checked = false;
      }
    }
  }
  updateSelectedStatFiles();
  return true;
}

function drawFileHandles(m){
  var checkbox, label, br, removeButton, renameButton, i,
      fileActions_div = document.getElementById("fileActions");
  fileActions_div.innerHTML = "";
  checkbox = document.createElement('input'); 
  checkbox.type = "checkbox";
  checkbox.name = "selectAll";
  checkbox.id = "selectAll";
  checkbox.className = "checkbox_check";
  checkbox.value = "selectAll";
  checkbox.setAttribute('onchange', 'selectAllBoxesFiles()');
  
  label = document.createElement('label');
  label.className = "checkbox_element";
  label.htmlFor = "selectAll";
  label.appendChild(document.createTextNode("All/None"));
  
  removeButton = document.createElement("button");
  removeButton.className = "fileControlButton";
  removeButton.id = "fileRemoveButton";
  removeButton.innerHTML = "Remove";
  removeButton.setAttribute('onclick', 'removeSelected()');
  
  renameButton = document.createElement("button");
  renameButton.className = "fileControlButton";
  renameButton.id = "fileRenameButton";
  renameButton.innerHTML = "Rename";
  renameButton.setAttribute('onclick', 'renameSelected()');
  
  br = document.createElement('br');
  
  fileActions_div.appendChild(checkbox);
  fileActions_div.appendChild(label);
  fileActions_div.appendChild(removeButton);
  fileActions_div.appendChild(renameButton);
  fileActions_div.appendChild(br);
  
  if (typeof(clusteringNames) == "object"){
    for (i = 0; i < clusteringNames.length; i++){
      checkbox = document.createElement('input'); 
      checkbox.type = "checkbox";
      checkbox.name = "checkbox".concat(i);
      checkbox.id = "checkbox".concat(i);
      checkbox.className = "checkbox_check";
      checkbox.value = i;
      checkbox.setAttribute('onchange', 'updateSelectedStatFiles()');
      
      label = document.createElement('label');
      label.className = "checkbox_element";
      label.htmlFor = i;
      if (clusteringNames[i].length > 15) temp = clusteringNames[i].substr(0,15).concat("..");
      else temp = clusteringNames[i];
      label.appendChild(document.createTextNode(temp));
      
      br = document.createElement('br');
      
      fileActions_div.appendChild(checkbox);
      fileActions_div.appendChild(label);
      fileActions_div.appendChild(br);
    }
  } else {
    checkbox = document.createElement('input'); 
      checkbox.type = "checkbox";
      checkbox.name = "checkboxX";
      checkbox.id = "checkboxX";
      checkbox.className = "checkbox_check";
      checkbox.value = "X";
      checkbox.setAttribute('onchange', 'updateSelectedStatFiles()');
      
      label = document.createElement('label');
      label.className = "checkbox_element";
      label.htmlFor = "X";
      if (clusteringNames.length > 15) temp = clusteringNames.substr(0,15).concat("..");
      else temp = clusteringNames;
      label.appendChild(document.createTextNode(temp));
      
      br = document.createElement('br');
      
      fileActions_div.appendChild(checkbox);
      fileActions_div.appendChild(label);
      fileActions_div.appendChild(br);
  }
  return true;
}

function resetRemovalIndexes(m){
  removalIndexes = [];
  updateInputDataRShiny();
  return true;
}

function selectAllBoxes(item){
  var i,
      parent_id = item.parentElement.id;
      c = document.getElementById(parent_id).children;
  if (parent_id == "fileSelection_CC"){
    for (i = 3; i < c.length; i++){ //skipping a checkbox, its label and a <br/> (0 included)
      if ((i-3)%3 === 0){
        if (c[0].checked){
          c[i].checked = true;
        } else {
          c[i].checked = false;
        }
      }
    }
    updateSelectedFilesCCRShiny();
  } else{
    for (i = 6; i < c.length; i++){ //skipping two rows: a selectbox, its label and a <br/> AND a checkbox, its label and a <br/> (0 included)
      if ((i-6)%3 === 0){
        if (c[3].checked){
          c[i].checked = true;
        } else {
          c[i].checked = false;
        }
      }
    }
    updateSelectedFilesHHRShiny();
    updateSelectedFilesCPRShiny(); //maria
  }
  return true;
}

function createFileSelection(m){
  var checkbox, label, br, temp, i,
      fileSelection_CC_div = document.getElementById("fileSelection_CC");
  fileSelection_CC_div.innerHTML = "";
  checkbox = document.createElement('input'); 
  checkbox.type = "checkbox";
  checkbox.name = "selectAllCC";
  checkbox.id = "selectAllCC";
  checkbox.className = "checkbox_check";
  checkbox.value = "selectAllCC";
  checkbox.setAttribute('onchange', 'selectAllBoxes(this)');
  
  label = document.createElement('label');
  label.className = "checkbox_element";
  label.htmlFor = "selectAllCC";
  label.appendChild(document.createTextNode("All/None"));
  
  br = document.createElement('br');
  
  fileSelection_CC_div.appendChild(checkbox);
  fileSelection_CC_div.appendChild(label);
  fileSelection_CC_div.appendChild(br);
  
  if (typeof(clusteringNames) == "object"){
    for (i = 0; i < clusteringNames.length; i++){
      checkbox = document.createElement('input'); 
      checkbox.type = "checkbox";
      checkbox.name = "checkboxCC".concat(i);
      checkbox.id = "checkboxCC".concat(i);
      checkbox.className = "checkbox_check";
      checkbox.value = i;
      checkbox.setAttribute('onchange', 'updateSelectedFiles(this)');
      
      label = document.createElement('label');
      label.className = "checkbox_element";
      label.htmlFor = i;
      if (clusteringNames[i].length > 15) temp = clusteringNames[i].substr(0,15).concat("..");
      else temp = clusteringNames[i];
      label.appendChild(document.createTextNode(temp));
      
      br = document.createElement('br');
      
      fileSelection_CC_div.appendChild(checkbox);
      fileSelection_CC_div.appendChild(label);
      fileSelection_CC_div.appendChild(br);
    }
  } else {
    checkbox = document.createElement('input'); 
      checkbox.type = "checkbox";
      checkbox.name = "checkboxXCC";
      checkbox.id = "checkboxXCC";
      checkbox.className = "checkbox_check";
      checkbox.value = "XCC";
      checkbox.setAttribute('onchange', 'updateSelectedFiles(this)');
      
      label = document.createElement('label');
      label.className = "checkbox_element";
      label.htmlFor = "XCC";
      if (clusteringNames.length > 15) temp = clusteringNames.substr(0,15).concat("..");
      else temp = clusteringNames;
      label.appendChild(document.createTextNode(temp));
      
      br = document.createElement('br');
      
      fileSelection_CC_div.appendChild(checkbox);
      fileSelection_CC_div.appendChild(label);
      fileSelection_CC_div.appendChild(br);
  }
  return true;
}

function assignMetrics(message){
  metrics = message;
  return true;
}

function assignClusteringComboNames(message){
  clusteringComboNames = message;
  return true;
}

function assignChosenClusterings(message){
  var i;
  chosenClusterings = [];
  for (i = 0; i < message.length; i++){
    chosenClusterings.push(clusteringNames[message[i]-1]); //-1 because counter from R
  }
  return true;
}

function updateControls(item){
  if (item.id == "metricSelection0") initiateHistogramSlider(item.selectedIndex); //maria
  else if (item.id == "metricSelection1") updateChosenMetric_HH(item.options[item.selectedIndex].text);
  else if (item.id == "metricSelection2") initiateSankeySlider(item.selectedIndex);
  else if (item.id == "metricSelection3") initiateNetworkSlider(item.selectedIndex);
  else if (item.id == "metricSelection4"){
    initiateCircosSlider(item.selectedIndex); //for slider
    updateChosenMetric_CP(item.options[item.selectedIndex].text);  //for circos plot //maria
  }
  return true;
}

function conductanceRadio(m){
  var radiobox, label, br, i, temp,
      results_C_div = document.getElementById("fileSelection_C");
      
  results_C_div.innerHTML = "";
  if (typeof(clusteringNames) == "object"){
    for (i = 0; i < clusteringNames.length; i++){
      radiobox = document.createElement('input'); 
      radiobox.type = "radio";
      radiobox.name = "radiobox_group";
      radiobox.id = "radiobox".concat(i);
      radiobox.className = "radiobox";
      radiobox.value = i;
      radiobox.setAttribute('onchange', 'updateSelectedFiles(this)');
      if (i===0) radiobox.checked = true;
      
      label = document.createElement('label');
      label.className = "radiobox_element";
      label.htmlFor = i;
      if (clusteringNames[i].length > 15) temp = clusteringNames[i].substr(0,15).concat("..");
      else temp = clusteringNames[i];
      label.appendChild(document.createTextNode(temp));
      
      br = document.createElement('br');
      
      results_C_div.appendChild(radiobox);
      results_C_div.appendChild(label);
      results_C_div.appendChild(br);
    }
  } else {
      radiobox = document.createElement('input'); 
      radiobox.type = "radio";
      radiobox.name = "radiobox_group";
      radiobox.id = "radioboxX";
      radiobox.className = "radiobox";
      radiobox.value = "X";
      radiobox.setAttribute('onchange', 'updateSelectedFiles(this)');
      radiobox.checked = true;
      
      label = document.createElement('label');
      label.className = "radiobox_element";
      label.htmlFor = "X";
      if (clusteringNames.length > 15) temp = clusteringNames.substr(0,15).concat("..");
      else temp = clusteringNames;
      label.appendChild(document.createTextNode(temp));
      
      br = document.createElement('br');
      
      results_C_div.appendChild(radiobox);
      results_C_div.appendChild(label);
      results_C_div.appendChild(br);
  }
  updateSelectedFilesCRShiny();
  return true;
}

function createSelectionComponents(){
  var optionsList, option, checkbox, label, br, i, j, temp, metricSelection1_item, metricSelection4_item,
      div_array = [],
      results_MH_div = document.getElementById("fileSelection_MH"),
      results_HH_div = document.getElementById("fileSelection_HH"),
      results_SP_div = document.getElementById("fileSelection_SP"),
      results_IN_div = document.getElementById("fileSelection_IN"),
      results_CP_div = document.getElementById("fileSelection_CP");
      
  results_MH_div.innerHTML = results_HH_div.innerHTML = results_SP_div.innerHTML = results_IN_div.innerHTML = results_CP_div.innerHTML = ""; //resetting divs
  div_array.push(results_MH_div, results_HH_div, results_SP_div, results_IN_div, results_CP_div);
  for (i = 0; i < div_array.length; i++){
    optionsList = document.createElement('select');
    optionsList.setAttribute('class', 'optionsBox');
    optionsList.setAttribute('id', 'metricSelection'.concat(i));
    optionsList.setAttribute('onchange', 'updateControls(this)');
    if (typeof(metrics) == "object"){
      for (j = 0; j < metrics.length; j++){
        option = document.createElement("option");
        option.value = metrics[j]; //placeholder option
        option.text = metrics[j];
        optionsList.appendChild(option);
      }
    } else{
      option = document.createElement("option");
      option.value = metrics; //placeholder option
      option.text = metrics;
      optionsList.appendChild(option);
    }
    label = document.createElement('label');
    label.className = "checkbox_element";
    label.htmlFor = 'metricSelection'.concat(i);
    label.appendChild(document.createTextNode("Select Metric: "));
    
    br = document.createElement('br');
    
    div_array[i].appendChild(label);
    div_array[i].appendChild(optionsList);
    div_array[i].appendChild(br);
    
    //checkboxes
    checkbox = document.createElement('input'); 
    checkbox.type = "checkbox";
    checkbox.name = "selectAll".concat(i);
    checkbox.id = "selectAll".concat(i);
    checkbox.className = "checkbox_check";
    checkbox.value = "selectAllCC";
    checkbox.setAttribute('onchange', 'selectAllBoxes(this)');
    
    label = document.createElement('label');
    label.className = "checkbox_element";
    label.htmlFor = "selectAll".concat(i);
    label.appendChild(document.createTextNode("All/None"));
    
    br = document.createElement('br');
    
    div_array[i].appendChild(checkbox);
    div_array[i].appendChild(label);
    div_array[i].appendChild(br);
    
    for (j = 0; j < chosenClusterings.length; j++){
      checkbox = document.createElement('input'); 
      checkbox.type = "checkbox";
      checkbox.name = "checkbox".concat(i).concat(j);
      checkbox.id = "checkbox".concat(i).concat(j);
      checkbox.className = "checkbox_check";
      checkbox.value = j;
      checkbox.setAttribute('onchange', 'updateSelectedFiles(this)');
      
      label = document.createElement('label');
      label.className = "checkbox_element";
      label.htmlFor = j;
      if (chosenClusterings[j].length > 15) temp = chosenClusterings[j].substr(0,15).concat("..");
      else temp = chosenClusterings[j];
      label.appendChild(document.createTextNode(temp));
      
      br = document.createElement('br');
      
      div_array[i].appendChild(checkbox);
      div_array[i].appendChild(label);
      div_array[i].appendChild(br);
    }
  }
  metricSelection1_item = document.getElementById("metricSelection1");
  metricSelection4_item = document.getElementById("metricSelection4");
  updateChosenMetric_HH(metricSelection1_item.options[metricSelection1_item.selectedIndex].text); // defining default first metric value needed for R hierarchical heatmaps
  updateChosenMetric_CP(metricSelection4_item.options[metricSelection4_item.selectedIndex].text);
  return true;
}

function insertGradientCanvas(div){
  var canvas, ctx, grd;
  
  canvas = document.createElement("canvas");
  canvas.id = "CC_canvas";
  canvas.width = 330;
  canvas.height = 30;
  ctx = canvas.getContext("2d");
  grd = ctx.createLinearGradient(0, 0, 330, 0);
  grd.addColorStop(0, "rgb(255, 223, 158)");
  grd.addColorStop(1, "rgb(255, 56, 56)");
  
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 330, 30);
  
  ctx.fillStyle = "black";
  ctx.font = "18px Arial";
  ctx.fillText("low", 3, 20);
  ctx.fillStyle = "white";
  ctx.fillText("high", 295, 20);
  
  div.appendChild(canvas);
  
  return true;
}

function rowColorGradient(arr){
  var r_pace, g_pace, b_pace, currentColor, colorsOnly, sorted_arr,
      colorsLength = arr.length,
      startColor = "rgb(255, 223, 158)",
      endColor = "rgb(255, 56, 56)",
      colorArr = [],
      mappedColors = [];
  r_pace = Math.floor((255 - 255)/colorsLength);
  g_pace = Math.floor((56 - 223)/colorsLength);
  b_pace = Math.floor((56 - 158)/colorsLength);
  colorsOnly = startColor.substring(startColor.indexOf('(') + 1, startColor.lastIndexOf(')')).split(/,\s*/);
  colorsOnly[0] = Number(colorsOnly[0]);
  colorsOnly[1] = Number(colorsOnly[1]);
  colorsOnly[2] = Number(colorsOnly[2]);
  //creating gradient colors depending on length of items
  for (i = 0; i < colorsLength; i++){
    currentColor = "rgb(".concat(colorsOnly[0]).concat(", ").concat(colorsOnly[1]).concat(", ").concat(colorsOnly[2]).concat(")");
    colorArr.push(currentColor);
    colorsOnly[0] = colorsOnly[0] + r_pace;
    colorsOnly[1] = colorsOnly[1] + g_pace;
    colorsOnly[2] = colorsOnly[2] + b_pace;
  }
  //sorting input row values numerically
  sorted_arr = [...arr];
  sorted_arr.sort((a, b) => a - b);
  //mapping colors to values
  for (i = 0; i < colorsLength; i++) mappedColors.push(colorArr[sorted_arr.indexOf(arr[i])]);
  return mappedColors;
}

function createCanvasSpectralRange_HH(){
  var canvas, ctx, i,
      //spectralColors = ["#9E0142", "#D53E4F", "#F46D43", "#FDAE61", "#FEE08B", "#FFFFBF", "#E6F598", "#ABDDA4", "#66C2A5", "#3288BD", "#5E4FA2"],
      spectralColors = ["#FFFFCC", "#FFEDA0", "#FED976", "#FEB24C", "#FD8D3C", "#FC4E2A", "#E31A1C", "#BD0026", "#800026"],
      results_HH_div = document.getElementById("results_HH");
  results_HH_div.innerHTML = "";
  
  canvas = document.createElement("canvas");
  canvas.id = "HH_canvas";
  canvas.width = 330;
  canvas.height = 30;
  ctx = canvas.getContext("2d");
  
  for (i = 0; i < spectralColors.length; i++){
    ctx.beginPath();
    ctx.rect(30 * i, 0, 30, 30);
    ctx.fillStyle = spectralColors[i];
    ctx.fill();
  }
  ctx.fillStyle = "black";
  ctx.font = "18px Arial";
  ctx.fillText("low", 3, 20);
  ctx.fillStyle = "white";
  ctx.fillText("high", 232, 20);
  
  results_HH_div.appendChild(canvas);
  
  return true;
}

function drawmclustcompResults(message){
  mClustCompResults = message;
  var tbdy, th, tr, td, i, j, colorArr,
      canvas_gradient_div = document.getElementById("canvas_gradient"),
      results_CC_div = document.getElementById("results_CC"), //results_CC_div.innerHTML = metrics.concat(chosenClusterings).concat(mClustCompResults);
      tbl = document.createElement('table');
  canvas_gradient_div.innerHTML = "";
  results_CC_div.innerHTML = "";
  tbl.id = "showmClustCompTable";
  tbl.className = "dataTable";
  tbdy = document.createElement('tbody');
  
  tr = document.createElement('tr');
  th = document.createElement('th');
  tr.appendChild(th); //empty first cell
  if (typeof(clusteringComboNames) == "object"){ //multiple comparisons
    insertGradientCanvas(canvas_gradient_div);
    for (i = 0; i < clusteringComboNames.length; i++){
      th = document.createElement('th');
      th.innerHTML = clusteringComboNames[i];
      tr.appendChild(th);
    }
  } else{ //1 comparison
    th = document.createElement('th');
    th.innerHTML = clusteringComboNames;
    tr.appendChild(th);
  }    
  tbdy.appendChild(tr);
  
  for (i = 0; i < mClustCompResults.length; i++){
    tr = document.createElement('tr');
    td = document.createElement('td');
    td.className = "bold";
    if (typeof(metrics) == "object") td.innerHTML = metrics[i];
    else td.innerHTML = metrics;
    tr.appendChild(td);
    if (typeof(clusteringComboNames) == "object"){ //multiple comparisons
      colorArr = rowColorGradient(mClustCompResults[i]);
      for (j = 0; j < clusteringComboNames.length; j++){
        td = document.createElement('td');
        td.innerHTML = Number(mClustCompResults[i][j]).toFixed(3); //number format
        td.style.backgroundColor = colorArr[j];
        tr.appendChild(td);
      }
    } else{ //1 comparison
      td = document.createElement('td');
      td.innerHTML = Number(mClustCompResults[i][0]).toFixed(3); //number format
      tr.appendChild(td);
    }
    tbdy.appendChild(tr);
  }
  tbl.appendChild(tbdy);
  results_CC_div.appendChild(tbl);
  
  createSelectionComponents(); // create selection components for the rest of tabs
  createCanvasSpectralRange_HH();
  return true;
}

function replaceKeys(data, keyArr){
  for(i = 0; i < data.length; i++){
    Object.defineProperty(data , keyArr[i], Object.getOwnPropertyDescriptor(data, i));
    delete data[i];
  }
  return data;
}

function mapper(inArr, min, max){
  let outArr = [],
      inArr_min = Math.min.apply(Math, inArr),
      inArr_max = Math.max.apply(Math, inArr);
  for (var i = 0; i < inArr.length; i++){
    if (inArr_max - inArr_min !== 0)
      outArr.push((Number(inArr[i]) - inArr_min) * (max - min) / (inArr_max - inArr_min) + min);
    else outArr.push(0.3);
  }
  return(outArr);
}

function subSetData(metricSelectioBox, c){
  var data, row, chosenMetric, i,
      rechosenClusterings = [],
      result = [];
  //chosen metric
  chosenMetric = metricSelectioBox.selectedOptions[0].text; //only one option active
  //chosen clusterings
  for (i = 6; i < c.length; i++){ //skipping two rows: a selectbox, its label and a <br/> AND a checkbox, its label and a <br/> (0 included)
    if ((i-6)%3 === 0){
      if (c[i].checked) {
        rechosenClusterings.push(chosenClusterings[(i-6)/3]);
      }
    }
  }
  if (rechosenClusterings.length >= 2){
    //subset cc data
    row = metrics.indexOf(chosenMetric);
    data = mClustCompResults[row];
    if (typeof(clusteringComboNames) == "object"){ //else 1 item value only
      for (i = clusteringComboNames.length-1; i > -1; i--){ //parse all column names to check if chosen for subset
        strsplt = clusteringComboNames[i].split(" vs ");
        if (rechosenClusterings.indexOf(strsplt[0]) == -1 || rechosenClusterings.indexOf(strsplt[1]) == -1) //if clustering file of combo was not chosen
          data = data.filter(function(value, index, arr){ return index != i;}); //filter out that column
      }
    } 
  } else alert("Please choose two or more Clusterings.");
  result.push(rechosenClusterings);
  result.push(data);
  return result;
}

function executeMH(m){
 var data, count = 0,
      histogram_data = [],
      slider = document.getElementById("histogram_slider"),
      metricSelectioBox = document.getElementById("metricSelection0"),
      c = document.getElementById("fileSelection_MH").children;
      results_div = document.getElementById("results_MH");
  data = subSetData(metricSelectioBox, c);
  if (data !== undefined){
    //Insert code from here ###
    mh_slider_value = Number(slider.value);
    for(i = 0; i < (data[0].length)-1; i++){
      for(j = 1; j < data[0].length; j++){
          if(i < j) {
              if (data[1][count] >= mh_slider_value){
                histogram_data.push({'files': data[0][i] + ' vs ' + data[0][j],'value':data[1][count].toFixed(2)});
                //count++;
          }
          count++;
        }
       
      }
    }
    //Until here ###
  }
  //console.log(histogram_data) //debug
  histogram(histogram_data);
  return true;
}

function executeHH(m){
  var data,
      metricSelectioBox = document.getElementById("metricSelection1"),
      c = document.getElementById("fileSelection_HH").children;
      results_div = document.getElementById("results_HH");
  data = subSetData(metricSelectioBox, c);
  if (data !== undefined){
    //Insert code from here ###
    
    
    //Until here ###
  }
  return true;
}

function executeSP(m){
  var subSetResult, mappedSubSetResult, sp_slider_value, i, j,
      index = 0,
      sankey_data = [],
      nodes = [],
      links = [],
      slider = document.getElementById("sankey_slider"),
      metricSelectioBox = document.getElementById("metricSelection2"),
      c = document.getElementById("fileSelection_SP").children;
      //results_div = document.getElementById("results_SP");
  subSetResult = subSetData(metricSelectioBox, c);
  if (subSetResult[1] !== undefined){
    sp_slider_value = Number(slider.value);
    for (i = 0; i < subSetResult[0].length; i++){
      nodes.push({"name": subSetResult[0][i]});
    }
    mappedSubSetResult = mapper(subSetResult[1], 0.1, 1);
    for (i = 0; i < (subSetResult[0].length-1); i++){
      for (j = (i+1); j < subSetResult[0].length; j++){
        if (subSetResult[1][index] >= sp_slider_value){
          links.push({"source": i, "target": j, "value": mappedSubSetResult[index], "original_value": subSetResult[1][index]});
        }
        index++;
      }
    }
    if (links.length > 0){
      sankey_data = {nodes, links};
      d3_sankey_plots(sankey_data); // executing d3 library
    } else alert("No links for these data.");
  }
  return true;
}

function executeIN(m){
  var subSetResult, mappedSubSetResult, i, j,
      index = 0,
      network_data = [],
      nodes = [],
      links = [],
      slider = document.getElementById("network_slider"),
      metricSelectioBox = document.getElementById("metricSelection3"),
      c = document.getElementById("fileSelection_IN").children,
      //results_div = document.getElementById("results_IN"),
      results_IN_Layout_div = document.getElementById("results_IN_Layout");
  results_IN_Layout_div.innerHTML = "";
  subSetResult = subSetData(metricSelectioBox, c);
  if (subSetResult[1] !== undefined){
    in_chosenClusterings = subSetResult[0];
    updateChosenClusterings_IN(); //updating R chosen files to later apply network layouts
    in_result = subSetResult[1];
    updateResult_IN(); //updating R chosen files to later apply network layouts
    in_slider_value = Number(slider.value);
    updateSliderValue_IN();
    mappedSubSetResult = mapper(subSetResult[1], 0.1, 1);
    for (i = 0; i < subSetResult[0].length; i++){
      nodes.push({"name": subSetResult[0][i]});
    }
    for (i = 0; i < (subSetResult[0].length-1); i++){
      for (j = (i+1); j < subSetResult[0].length; j++){
        if (subSetResult[1][index] >= in_slider_value){
          //links.push({"source": subSetResult[0][i], "target": subSetResult[0][j], "weight": subSetResult[1][index]});
          links.push({"source": nodes[i], "target": nodes[j], "weight": mappedSubSetResult[index], "original_weight": subSetResult[1][index]}); //correct format for current d3 library example
        }
        index++;
      }
    }
    in_links = links;
    network_data.push(nodes, links);
    network_data = replaceKeys(network_data, ["nodes", "links"]);
    d3_network(network_data); // executing d3 library
  }
  return true;
}

function executeCP(message){
  var subSetResult, cp_slider_value, i, j,
  mappedSubSetResult = [],
  chorddata = [],
  original_value = [],
  slider = document.getElementById("circos_slider"),
  metricSelectioBox = document.getElementById("metricSelection4"),
  c = document.getElementById("fileSelection_CP").children;
  subSetResult = subSetData(metricSelectioBox, c);
  if (subSetResult[1] !== undefined){
    cp_slider_value = Number(slider.value);
    for(i = 0 ; i < message.length; i++){
      mappedSubSetResult[i]= mapper(message[i], 0.1, 1);
      chorddata[i] = [];
      for(j = 0 ; j < message.length; j++){
        chorddata[i][j] = 0;
        if(message[i][j] >= cp_slider_value) {
          if(i != j){
             if(cp_slider_value < 0) {chorddata[i][j] = mappedSubSetResult[i][j];}else chorddata[i][j] = message[i][j];
             if(i <= j && message[i][j] != 0) original_value.push(message[i][j]);
          }
        }
       
      }
    }
    chordDiagram(chorddata, subSetResult[0], original_value );
  }
  return true;
}

function executeC(data){ //data -> network edgelist
  //console.log(data);
  var node_labels = [],
      pre_nodes = [],
      pre_edges = [],
      nodes, edges, data, options, temp, i,
      nodeColorPicker = document.getElementById("nodeColorPicker"),
      edgeColorPicker = document.getElementById("edgeColorPicker"),
      results_condNetwork_Layout_div = document.getElementById("results_condNetwork_Layout");
  results_condNetwork_Layout_div.innerHTML = "";
      
  for (i = 0; i < data[0].length; i++){
    node_labels.push(data[0][i][0]);
    temp = data[0][i][0];
    if (data[0][i][0].length > 4) temp = data[0][i][0].substring(0, 4).concat("...");
    pre_nodes.push({ id: (i+1), label: temp, title: data[0][i][0], x: data[0][i][1]*100, y: data[0][i][2]*100 });
  }
  nodes = new vis.DataSet(pre_nodes);
  for (i = 0; i < data[1].length; i++){
    pre_edges.push({ from: (node_labels.indexOf(data[1][i][0]) + 1), to: (node_labels.indexOf(data[1][i][1]) + 1), width: Number(data[1][i][2])*10, label: String(Number(data[1][i][2]).toFixed(2)) });
  }
  edges = new vis.DataSet(pre_edges);
  // create a network
  data = {
    nodes: nodes,
    edges: edges,
  };
  options = {
    nodes:{
      borderWidth: 2,
      borderWidthSelected: 3,
      color: {
        border: '#424040',
        background: '#e8bbac',
        highlight: {
          border: '#424040',
          background: '#fcfa83'
        }
      },
      font: {
        size: 18
      },
      shape: 'circle'
    },
    edges:{
      color: {
        color: '#4ECDEB',
        highlight:'#fcfa83'
      },
      font: {
          size: 5
      },
      chosen: {
          label: function (values, id, selected, hovering) {
              values.size = 15;
          }
      },
      smooth: {
        enabled: false
      },
      width: 2
    },
    physics:{
      enabled: false
    }
  };
  visNetwork = new vis.Network(results_condNetwork_Layout_div, data, options);
  
  return true;
}

function initiateHistogramControls(m){
   var slider_div,
      controls_MH_div = document.getElementById("controls_MH");
  controls_MH_div.innerHTML = "";
  slider_div = document.createElement('div');
  slider_div.id = "histogram_slider_div";
  controls_MH_div.appendChild(slider_div);
  initiateHistogramSlider(0); // 0 = first metric
  return true;
}

function initiateNetworkControls(m){
  var slider_div,
      controls_IN_div = document.getElementById("controls_IN");
  controls_IN_div.innerHTML = "";
  slider_div = document.createElement('div');
  slider_div.id = "network_slider_div";
  controls_IN_div.appendChild(slider_div);
  initiateNetworkSlider(0); // 0 = first metric
  initiateNetworkColorPicker();
  return true;
}

function layout(data){
  var node_labels = [],
      pre_nodes = [],
      pre_edges = [],
      nodes, edges, data, options, temp, i,
      results_IN_Layout_div = document.getElementById("results_IN_Layout");
  for (i = 0; i < data.length; i++){
    node_labels.push(data[i][0]);
    temp = data[i][0];
    if (data[i][0].length > 4) temp = data[i][0].substring(0, 4).concat("...");
    pre_nodes.push({ id: (i+1), label: temp, title: data[i][0], x: data[i][1]*100, y: data[i][2]*100 });
  }
  nodes = new vis.DataSet(pre_nodes);
  for (i = 0; i < in_links.length; i++){
    pre_edges.push({ from: (node_labels.indexOf(in_links[i]["source"].name) + 1), to: (node_labels.indexOf(in_links[i]["target"].name) + 1), width: in_links[i]["weight"]*10, label: String(in_links[i]["original_weight"].toFixed(2)) });
  }
  edges = new vis.DataSet(pre_edges);
  // create a network
  data = {
    nodes: nodes,
    edges: edges,
  };
  options = {
    nodes:{
      borderWidth: 2,
      borderWidthSelected: 3,
      color: {
        border: '#424040',
        background: nodeColorPicker.value,
        highlight: {
          border: '#424040',
          background: '#fcfa83'
        }
      },
      font: {
        size: 18
      },
      shape: 'circle'
    },
    edges:{
      color: {
        color: edgeColorPicker.value,
        highlight:'#fcfa83'
      },
      font: {
          size: 5
      },
      chosen: {
          label: function (values, id, selected, hovering) {
              values.size = 15;
          }
      },
      smooth: {
        enabled: false
      },
      width: 2
    },
    physics:{
      enabled: false
    }
  };
  visNetwork = new vis.Network(results_IN_Layout_div, data, options);
  //dynamically change: visNetwork.setOptions(extra_options)
  
  return true;
}

function initiateSankeyPlotControls(m){
  var slider_div,
      controls_SP_div = document.getElementById("controls_SP");
  controls_SP_div.innerHTML = "";
  slider_div = document.createElement('div');
  slider_div.id = "sankey_slider_div";
  controls_SP_div.appendChild(slider_div);
  initiateSankeySlider(0); // 0 = first metric
  //initiateSankeyColorPicker(); //TODO make or remove (from cc_sankey_plots.js as well)
  return true;
}

function initiateCircosPlotControls(m){
   var slider_div,
      controls_CP_div = document.getElementById("controls_CP");
  controls_CP_div.innerHTML = "";
  slider_div = document.createElement('div');
  slider_div.id = "circos_slider_div";
  controls_CP_div.appendChild(slider_div);
  initiateCircosSlider(0); // 0 = first metric
  
  return true;
}

function updateShinyBarPlots(m){
  updateBarPlots();
  return true;
}

function updateShinyHist_Data(m){
  updateHist_Data();
  return true;
}

function shinyConsoleLog(message){
  console.log(message);
  return true;
}

function startLoader(m){
  var array_el = ["", "results_CC", "", "", "", "", "", "histConductance", ""],
      array_load = ["", "cc_loader", "", "", "", "", "", "cond_loader", ""],
      element = document.getElementById(array_el[m]),
      loader = document.getElementById(array_load[m]);
  element.style.opacity = 0.5;
  loader.style.display = "inline-block";
  return true;
}

function finishLoader(m){
  var array_el = ["", "results_CC", "", "", "", "", "", "histConductance", ""],
      array_load = ["", "cc_loader", "", "", "", "", "", "cond_loader", ""],
      element = document.getElementById(array_el[m]),
      loader = document.getElementById(array_load[m]);
  element.style.opacity = 1;
  loader.style.display = "none";
  return true;
}

//HANDLERS
Shiny.addCustomMessageHandler("handler_disableTabs", disableTabs);
Shiny.addCustomMessageHandler("handler_enableTabs", enableTabs);
Shiny.addCustomMessageHandler("handler_alert", shinyAlert);
Shiny.addCustomMessageHandler("handler_debugger", shinyConsoleLog);
Shiny.addCustomMessageHandler("handler_sendClusteringNames", assignClusteringNames);
Shiny.addCustomMessageHandler("handler_sendRawData", assignRawData);
Shiny.addCustomMessageHandler("handler_sendData", assignData);
Shiny.addCustomMessageHandler("handler_conductanceRadio", conductanceRadio);
Shiny.addCustomMessageHandler("handler_drawFileHandles", drawFileHandles);
Shiny.addCustomMessageHandler("handler_resetRemovalIndexes", resetRemovalIndexes);
Shiny.addCustomMessageHandler("handler_createFileSelection", createFileSelection);
Shiny.addCustomMessageHandler("handler_sendMetrics", assignMetrics);
Shiny.addCustomMessageHandler("handler_sendClusteringComboNames", assignClusteringComboNames);
Shiny.addCustomMessageHandler("handler_sendChosenClusteringsIndexes", assignChosenClusterings);
Shiny.addCustomMessageHandler("handler_drawmclustcompResults", drawmclustcompResults);
Shiny.addCustomMessageHandler("handler_executeMH", executeMH);
Shiny.addCustomMessageHandler("handler_executeHH", executeHH);
Shiny.addCustomMessageHandler("handler_executeSP", executeSP);
Shiny.addCustomMessageHandler("handler_executeIN", executeIN);
Shiny.addCustomMessageHandler("handler_executeCP", executeCP);
Shiny.addCustomMessageHandler("handler_executeC", executeC);
Shiny.addCustomMessageHandler("handler_initiateHistogramControls", initiateHistogramControls); //maria
Shiny.addCustomMessageHandler("handler_initiateNetworkControls", initiateNetworkControls);
Shiny.addCustomMessageHandler("handler_initiateSankeyPlotControls", initiateSankeyPlotControls);
Shiny.addCustomMessageHandler("handler_initiateCircosPlotControls", initiateCircosPlotControls); //maria
Shiny.addCustomMessageHandler("handler_layout", layout);
Shiny.addCustomMessageHandler("handler_updateShinyBarPlots", updateShinyBarPlots);
Shiny.addCustomMessageHandler("handler_updateShinyHist_Data", updateShinyHist_Data);
Shiny.addCustomMessageHandler("handler_startLoader", startLoader);
Shiny.addCustomMessageHandler("handler_finishLoader", finishLoader);
