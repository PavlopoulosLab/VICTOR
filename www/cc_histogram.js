function initiateHistogramSlider(row){
 var span, label, br, val,
      arr = mClustCompResults[row],
      min = Math.min.apply(Math, arr),
      max = Math.max.apply(Math, arr),
      slider_div = document.getElementById("histogram_slider_div");
  min = Number((min-0.01).toFixed(2)); //floor or below
  max = Number(max.toFixed(2));
  val = min;//((max + min)/2).toFixed(2);
  slider_div.innerHTML = "";
  
  label = document.createElement('label');
  label.className = "control_label";
  label.htmlFor = "span_sliderValue";
  label.appendChild(document.createTextNode("Select Barplot  Cutoff Threshold: "));
  slider_div.appendChild(label);
  
  span = document.createElement("span");
  span.setAttribute("id", "histogram_span_sliderValue");
  span.setAttribute("class", "span_sliderRange");
  span.innerText = val;
  slider_div.appendChild(span);
  
  br = document.createElement("br");
  slider_div.appendChild(br);
  
  span = document.createElement("span");
  span.setAttribute("id", "histogram_span_sliderMinValue");
  span.setAttribute("class", "span_sliderRange");
  span.innerText = min;
  slider_div.appendChild(span);
  
  sld = document.createElement("input");
  sld.className = "controls_slider";
  sld.id = "histogram_slider";
  sld.type = "range";
  sld.min = min;
  sld.max = max;
  sld.step = 0.01;
  sld.value = val;
  sld.setAttribute('oninput', 'updateEdgeThreshold(this)');
  slider_div.appendChild(sld);
  
  span = document.createElement("span");
  span.setAttribute("id", "histogram_span_sliderMaxValue");
  span.setAttribute("class", "span_sliderRange");
  span.innerText = max;
  slider_div.appendChild(span);
  
  br = document.createElement("br");
  slider_div.appendChild(br);
  br = document.createElement("br");
  slider_div.appendChild(br);
  
  return true;
}

function histogram(data){
  results_CP_div = document.getElementById("results_MH");
  results_CP_div.innerHTML = "";
  
 var margin = {top: 20, right: 10, bottom: 100, left:50},
    width = 700 - margin.right - margin.left,
    height = 500 - margin.top - margin.bottom;

var svg = d3.select("#results_MH")
    .append("svg")
      .attr ({
        "width": width + margin.right + margin.left,
        "height": height + margin.top + margin.bottom
      })
    .append("g")
      .attr("transform","translate(" + margin.left + "," + margin.right + ")");


// defining  x and y scales
var xScale = d3.scale.ordinal()
    .rangeRoundBands([0,width], 0.2, 0.2);

var yScale = d3.scale.linear()
    .range([height, 0]);

// defining x axis and y axis
var xAxis = d3.svg.axis()
    .scale(xScale)
    .orient("bottom");

var yAxis = d3.svg.axis()
    .scale(yScale)
    .orient("left");


  data.forEach(function(d) {
    d.files = d.files;
    d.value = +d.value;       
     
  });

  // sort the values to show at which date the cash collection was the highest
  data.sort(function(a,b) {
    return b.value - a.value;
  });

  // Specify the domains of the x and y scales
  xScale.domain(data.map(function(d) { return d.files; }) );
  yScale.domain([d3.min(data, function(d) { return d.value; }) - (d3.max(data, function(d) { return d.value; })*0.1), d3.max(data, function(d) { return d.value; } ) ]); 

  svg.selectAll('rect')
    .data(data)
    .enter()
    .append('rect')
    .attr("height", 0)
    .attr("y", height)
    .transition().duration(3000)
    .delay( function(d,i) { return i * 200; })

    .attr({
      "x": function(d) { return xScale(d.files); },
      "y": function(d) { return yScale(d.value); },
      "width": xScale.rangeBand(),
      "height": function(d) { return height - yScale(d.value); }
    })
    .style("fill", function(d,i) { return 'rgb(20, 20, ' + ((i * 30) + 100) + ')'});


        svg.selectAll('text')
            .data(data)
            .enter()
            .append('text')



            .text(function(d){
                return d.value;
            })
            .attr({
                "x": function(d){ return xScale(d.files) +  xScale.rangeBand()/2; },
                "y": function(d){ return yScale(d.value)+ 12; },
                "font-family": 'sans-serif',
                "font-size": '13px',
                "font-weight": 'bold',
                "fill": 'white',
                "text-anchor": 'middle'
            });

    // Drawing x axis and positioning the label
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis)
        .selectAll("text")
        .attr("dx", "-.8em")
        .attr("dy", ".25em")
        .attr("transform", "rotate(-60)" )
        .style("text-anchor", "end")
        .attr("font-size", "10px"); 


    // Drawing  y Axis and positioning the label
    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height/2)
        .attr("dy", "-2em")
        .style("text-anchor", "middle")
      //  .text("Amount Dispensed");

  
  
  return(true)
}