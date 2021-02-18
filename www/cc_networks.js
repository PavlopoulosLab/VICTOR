function initiateNetworkSlider(row){
  var span, label, br, val,
      arr = mClustCompResults[row],
      min = Math.min.apply(Math, arr),
      max = Math.max.apply(Math, arr),
      slider_div = document.getElementById("network_slider_div");
  min = Number((min-0.01).toFixed(2)); //floor or below
  max = Number(max.toFixed(2));
  val = min; //((max + min)/2).toFixed(2);
  slider_div.innerHTML = "";
  
  label = document.createElement('label');
  label.className = "control_label";
  label.htmlFor = "span_sliderValue";
  label.appendChild(document.createTextNode("Select Edge Cutoff Threshold: "));
  slider_div.appendChild(label);
  
  span = document.createElement("span");
  span.setAttribute("id", "network_span_sliderValue");
  span.setAttribute("class", "span_sliderRange");
  span.innerText = val;
  slider_div.appendChild(span);
  
  br = document.createElement("br");
  slider_div.appendChild(br);
  
  span = document.createElement("span");
  span.setAttribute("id", "network_span_sliderMinValue");
  span.setAttribute("class", "span_sliderRange");
  span.innerText = min;
  slider_div.appendChild(span);
  
  sld = document.createElement("input");
  sld.className = "controls_slider";
  sld.id = "network_slider";
  sld.type = "range";
  sld.min = min;
  sld.max = max;
  sld.step = 0.01;
  sld.value = val;
  sld.setAttribute('oninput', 'updateEdgeThreshold(this)');
  slider_div.appendChild(sld);
  
  span = document.createElement("span");
  span.setAttribute("id", "network_span_sliderMaxValue");
  span.setAttribute("class", "span_sliderRange");
  span.innerText = max;
  slider_div.appendChild(span);
  
  br = document.createElement("br");
  slider_div.appendChild(br);
  br = document.createElement("br");
  slider_div.appendChild(br);
  
  return true;
}

function updateNodeColor(item){
  var extra_options, i,
      nodes = document.getElementById("results_IN").getElementsByTagName("circle");
      //labels = document.getElementById("results_IN").getElementsByTagName("text");
  for (i = 0; i < nodes.length; i++){
    nodes[i].style.fill = item.value;
    //labels[i].style.stroke = "#424040";
  }
  //for viz.js
  if (visNetwork !== undefined){
    extra_options = {
      nodes:{
        color: {
          background: item.value,
        }
      }
    };
    visNetwork.setOptions(extra_options);
  }
  return true;
}

function updateEdgeColor(item){
  var extra_options, i,
      edges = document.getElementById("results_IN").getElementsByTagName("line");
  for (i = 0; i < edges.length; i++){
    edges[i].style.stroke = item.value;
  }
  //for viz.js
  if (visNetwork !== undefined){
    extra_options = {
      edges:{
        color: {
          color: item.value,
        }
      }
    };
    visNetwork.setOptions(extra_options);
  }
  return true;
}

function initiateNetworkColorPicker(){
  var colorPicker, label, br,
      controls_IN_div = document.getElementById("controls_IN");
  
  label = document.createElement('label');
  label.className = "control_label";
  label.htmlFor = "nodeColorPicker";
  label.appendChild(document.createTextNode("Node Color "));
  controls_IN_div.appendChild(label);
  
  colorPicker = document.createElement("input");
  colorPicker.id = "nodeColorPicker";
  colorPicker.className = "colorPicker";
  colorPicker.type = "color";
  colorPicker.value = "#e8bbac";
  colorPicker.setAttribute('onchange', 'updateNodeColor(this)');
  controls_IN_div.appendChild(colorPicker);
  
  br = document.createElement("br");
  controls_IN_div.appendChild(br);
  
  label = document.createElement('label');
  label.className = "control_label";
  label.htmlFor = "edgeColorPicker";
  label.appendChild(document.createTextNode("Edge Color "));
  controls_IN_div.appendChild(label);
  
  colorPicker = document.createElement("input");
  colorPicker.id = "edgeColorPicker";
  colorPicker.className = "colorPicker";
  colorPicker.type = "color";
  colorPicker.value = "#4ECDEB";
  colorPicker.setAttribute('onchange', 'updateEdgeColor(this)');
  controls_IN_div.appendChild(colorPicker);
  
  br = document.createElement("br");
  controls_IN_div.appendChild(br);
  br = document.createElement("br");
  controls_IN_div.appendChild(br);
  
  return true;
}

function showNetworkWeight(d, i){
  var coordinates= d3.mouse(this),
      mouse_x = coordinates[0],
      mouse_y = coordinates[1];
  
  d3.select("#results_IN_svg")
    // Specify where to put label of text
    .append("text").attr({
      id: "net_id_" + i,  // Create an id for text so we can select it later for removing on mouseout
      x: function() { return mouse_x - 7; },
      y: function() { return mouse_y - 12; }
    })
    .text(function() { return d.original_weight.toFixed(2);})  // Value of the text
    .style("font-size", "15px")
    .style("font-weight", "bold");
  return true;
}

function hideNetworkWeight(d, i){
  // Select text by id and then remove
  d3.select("#net_id_" + i).remove();  // Remove text location
  return true;
}

function runNetworkData(data, force, svg) {
  var node, link,
      nodeColorPicker = document.getElementById("nodeColorPicker");
  
  force
      .nodes(data.nodes)
      .links(data.links)
      .on("tick", updateNetwork)
      .start();

  link = svg.selectAll(".link")
      .data(data.links)
      .enter().append("line")
      .attr("class", "link")
      .on("mouseover", showNetworkWeight)
      .on("mouseout", hideNetworkWeight)
      .style("stroke", edgeColorPicker.value)
      .style("stroke-width", function(d) { return d.weight * 10; });

  node = svg.selectAll(".node")
      .data(data.nodes)
      .enter().append("g")
      .attr("class", "node")
      .call(force.drag);

  node.append("circle")
      .attr("r","15")
      .style("fill", nodeColorPicker.value)
      .style("stroke", "#424040")
      .style("stroke-width", "3px");

  node.append("text")
      .attr("dx", 25)
      .attr("dy", ".35em")
      .text(function(d) { return d.name })
      .style("font-size", "18px")
      .style("stroke", "#424040");

  function updateNetwork() {
    link.attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });
  
    node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
  }
  
  return true;
}

function d3_network(data){
  var svg_element, svg_width_px, svg_height_px, svg, force,
      width = "65vw",
      height = "70vh",
      results_IN_div = document.getElementById("results_IN");
  results_IN_div.innerHTML = "";
  
  svg = d3.select("#results_IN").append("svg")
      .attr("id", "results_IN_svg")
      .attr("width", width)
      .attr("height", height);
			
  svg_element = document.getElementById("results_IN_svg");
  svg_width_px = svg_element.width.animVal.value;
  svg_height_px = svg_element.height.animVal.value;
  
  force = d3.layout.force()
      .gravity(0.02)
      .distance((svg_width_px + svg_height_px)/16)
      .charge(-100)
      .size([svg_width_px, svg_height_px]);
  
  runNetworkData(data, force, svg);
  
  return true;
}
