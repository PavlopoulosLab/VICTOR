function initiateCircosSlider(row){
 var span, label, br, val,
      arr = mClustCompResults[row],
      min = Math.min.apply(Math, arr),
      max = Math.max.apply(Math, arr),
      slider_div = document.getElementById("circos_slider_div");
  min = Number((min-0.01).toFixed(2)); //floor or below
  max = Number(max.toFixed(2));
  val = min; //((max + min)/2).toFixed(2);
  slider_div.innerHTML = "";
  
  label = document.createElement('label');
  label.className = "control_label";
  label.htmlFor = "span_sliderValue";
  label.appendChild(document.createTextNode("Select Circos Plot  Cutoff Threshold: "));
  slider_div.appendChild(label);
  
  span = document.createElement("span");
  span.setAttribute("id", "circos_span_sliderValue");
  span.setAttribute("class", "span_sliderRange");
  span.innerText = val;
  slider_div.appendChild(span);
  
  br = document.createElement("br");
  slider_div.appendChild(br);
  
  span = document.createElement("span");
  span.setAttribute("id", "circos_span_sliderMinValue");
  span.setAttribute("class", "span_sliderRange");
  span.innerText = min;
  slider_div.appendChild(span);
  
  sld = document.createElement("input");
  sld.className = "controls_slider";
  sld.id = "circos_slider";
  sld.type = "range";
  sld.min = min;
  sld.max = max;
  sld.step = 0.01;
  sld.value = val;
  sld.setAttribute('oninput', 'updateEdgeThreshold(this)');
  slider_div.appendChild(sld);
  
  span = document.createElement("span");
  span.setAttribute("id", "circos_span_sliderMaxValue");
  span.setAttribute("class", "span_sliderRange");
  span.innerText = max;
  slider_div.appendChild(span);
  
  br = document.createElement("br");
  slider_div.appendChild(br);
  br = document.createElement("br");
  slider_div.appendChild(br);
  
  return true;
}

function chordDiagram(data,data2,data3){
  
  results_CP_div = document.getElementById("results_CP");
  results_CP_div.innerHTML = "";
  var d = data;

  var margin      = {top: 10, right: 10, bottom: 10, left: 10},
    width       = Math.min(600, results_CP_div.clientWidth); //600 - margin.left - margin.right,
    height      = width; //600 - margin.top  - margin.bottom,
    innerRadius = Math.min(width, height) * 0.35, //35% of smallest measurement
    outerRadius = innerRadius * 1.1; //110% of innerradius

var svg = d35.select("#results_CP").append("svg")
    .attr("id", "results_CP_svg")
    .attr("width",  width  ) //+ margin.left + margin.right)
    .attr("height", height ) // + margin.top  + margin.bottom)
    .append("g")
    //.attr("transform", "translate(" + margin.left + "," + margin.top + ")")
    .append("g")
    .attr("class", "chordgraph")
    .attr("transform", "translate(" + width/2 + "," + height/2 + ")");
   

var firstColumn = data2       
        
    var color = d35.scaleOrdinal(d35.schemeCategory10)
  
    //d3 chord generator
    var chord = d35.chord()
        .padAngle(0.01)
        .sortSubgroups(d35.descending);
  
    //apply the matrix
    var chords = chord(data);
    for(i=0; i< chords.length; i++){
        Object.assign(chords[i]['source'],{'original_value' : data3[i]})
      
    }
  
    //each ribbon generator
    var ribbon = d35.ribbon()
        .radius(innerRadius);
  
    //outer rim arc
    var arc = d35.arc()
        .innerRadius(innerRadius)
        .outerRadius(innerRadius + 20);

    //add each of the groupings for outer rim arcs
   var chords_groups_new = [], firstColumn_new = [];
   for(i = 0; i < chords.groups.length; i++){
     if(chords['groups'][i].value > 0) {
       chords_groups_new.push(chords['groups'][i])
        firstColumn_new.push(firstColumn[i])
     }
   }
    
     var group = svg.append("g")
        .selectAll("g")
        .data(chords_groups_new)//(chords_groups_new)
        .enter()
        .append("g");
 
    //add each outer rim arc path
    group.append("path")
        .attr("class", "arcPath")
        .attr("fill", function(d){ return (d.index+1) ? color(d.index): "#ccc"; })
        .attr("stroke", function(d){ return color(d.index); })
        .attr("d", arc)
        .style("cursor", "pointer")
       .on("mouseover", function(d, i){
            ribbons.classed("fade", function(d){
                return d.source.index != i && d.target.index != i;
            });
          });   
          
//create tooltip     
   var tooltip = d3.select("#results_CP")
    .append("div")
      .style("opacity", 0)
      .attr("class", "tooltip")
      .style("background-color", "white")
      .style("border", "solid")
      .style("border-width", "2px")
      .style("border-radius", "5px")
      .style("padding", "5px")
      .style("color", "black");

  // Three function that change the tooltip when user hover / move / leave a cell
  var mouseover = function(d, i) {
      var ribbonPaths = d35.selectAll(".ribbonPath")._groups[0];
      for (j=0; j < ribbonPaths.length; j++){
        if (ribbonPaths[j].className.baseVal != "ribbonPath fade") {
          if (d.source.index == chords[j].source.index && d.target.index == chords[j].target.index){
            tooltip
            .style("opacity", 1)
            .html(d.source.original_value);
          }
        }
      }
      
  };
  var mousemove = function(d) {
    tooltip
      .style("left", (d35.event.layerX+10) + "px")
      .style("top", (d35.event.layerY-10) + "px");
  };
  var mouseleave = function(d) {
    tooltip
      .style("opacity", 0)
      .html("");
  };
        
    //add each ribbon
    var ribbons = svg.append("g")
      .attr("fill-opacity", 0.67)
      .selectAll(".arcPath")
      .data(chords)
      .enter()
      .append("path")
      .attr("d", ribbon)
      .attr("class", "ribbonPath")
      .attr("fill", function(d){ return color(d.target.index); })
      .attr("stroke", function(d){ return d35.rgb(color(d.target.index)).darker(); })
      .on("mouseover", mouseover)
      .on("mousemove", mousemove)
      .on("mouseleave", mouseleave);
      
    
    //add the text labels
    group.append("text")
      .each(function(d){ return d.angle = (d.startAngle + d.endAngle) /2; })
      .attr("dy", ".35em")
      .attr("class", "text")
      .style("pointer-events","none")
      .attr("text-anchor", function(d) { return d.angle > Math.PI ? "end" : "start"; })
      .attr("transform", function(d,i){
 //rotate each label around the circle           
          return "rotate(" + (d.angle * 180 / Math.PI - 90) + ")" + 
                 "translate(" + (outerRadius + 10) + ")" +
                 (d.angle > Math.PI ? "rotate(180)" : "");

      })
      .text(function(d,i){
        
          //set the text content
          return firstColumn_new[i];
        
      })
      .style("font-family","sans-serif")
      .style("font-size","10px");
  

}