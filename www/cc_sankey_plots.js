function initiateSankeySlider(row){
  var span, label, br, val,
      arr = mClustCompResults[row],
      min = Math.min.apply(Math, arr),
      max = Math.max.apply(Math, arr),
      slider_div = document.getElementById("sankey_slider_div");
  min = Number((min-0.01).toFixed(2)); //floor or below
  max = Number(max.toFixed(2));
  val = min; //((max + min)/2).toFixed(2);
  slider_div.innerHTML = "";
  
  label = document.createElement('label');
  label.className = "control_label";
  label.htmlFor = "span_sliderValue";
  label.appendChild(document.createTextNode("Select Sankey Cutoff Threshold: "));
  slider_div.appendChild(label);
  
  span = document.createElement("span");
  span.setAttribute("id", "sankey_span_sliderValue");
  span.setAttribute("class", "span_sliderRange");
  span.innerText = val;
  slider_div.appendChild(span);
  
  br = document.createElement("br");
  slider_div.appendChild(br);
  
  span = document.createElement("span");
  span.setAttribute("id", "sankey_span_sliderMinValue");
  span.setAttribute("class", "span_sliderRange");
  span.innerText = min;
  slider_div.appendChild(span);
  
  sld = document.createElement("input");
  sld.className = "controls_slider";
  sld.id = "sankey_slider";
  sld.type = "range";
  sld.min = min;
  sld.max = max;
  sld.step = 0.01;
  sld.value = val;
  sld.setAttribute('oninput', 'updateEdgeThreshold(this)');
  slider_div.appendChild(sld);
  
  span = document.createElement("span");
  span.setAttribute("id", "sankey_span_sliderMaxValue");
  span.setAttribute("class", "span_sliderRange");
  span.innerText = max;
  slider_div.appendChild(span);
  
  br = document.createElement("br");
  slider_div.appendChild(br);
  br = document.createElement("br");
  slider_div.appendChild(br);
  
  return true;
}

function showSankeyWeight(d, i){
  var coordinates= d3.mouse(this),
      mouse_x = coordinates[0],
      mouse_y = coordinates[1];
  
  d3.select(this).style("stroke-opacity", 0.8);
  
  d3.select("#results_SP_svg")
    // Specify where to put label of text
    .append("text").attr({
      id: "sp_id_" + i,  // Create an id for text so we can select it later for removing on mouseout
      x: function() { return mouse_x; },
      y: function() { return mouse_y; }
    })
    .text(function() { return d.original_value.toFixed(2);})  // Value of the text
    .style("font-size", "15px")
    .style("font-weight", "bold");
  return true;
}

function hideSankeyWeight(d, i){
  d3.selectAll("path.link").style("stroke-opacity", 0.5);
  // Select text by id and then remove
  d3.select("#sp_id_" + i).remove();  // Remove text location
  return true;
}

function runSankeyData(data){
  var svg_element, svg_width_px, svg_height_px, sankey, path,
      intensityRamp = d3.scale.linear().domain([0,d3.max(data.links, function(d) {return d.value})]).range(["#b8e5fc", "#1072a3"]),
      drag = d3.behavior.drag();

  drag.origin(Object)
    .on('drag', move);

  svg_element = document.getElementById("results_SP_svg");
  svg_width_px = svg_element.width.animVal.value;
  svg_height_px = svg_element.height.animVal.value;
  
  sankey = d3.sankey()
    .nodeWidth(20)
    .nodePadding(200)
    .size([svg_width_px - 0.1 * (svg_width_px), svg_height_px - 0.1 * (svg_height_px) ]);

  path = sankey.link();

  sankey
      .nodes(data.nodes)
      .links(data.links)
      .layout(200);
  
  expData = data;
  d3.select("#results_SP_svg").append("g").attr("transform", "translate(20,20)").attr("id", "sankeyG");
  
  d3.select("#sankeyG").selectAll(".link")
      .data(data.links)
    .enter().append("path")
      .attr("class", "link")
      .attr("d", sankey.link())
      .style("stroke-width", function(d) {return d.dy})
      .style("stroke-opacity", 0.5)
      .style("fill", "none")
      .style("stroke", function(d){return intensityRamp(d.value)})
      .sort(function(a, b) { return b.dy - a.dy; })
      .on("mouseover", showSankeyWeight)
      .on("mouseout", hideSankeyWeight);

  d3.select("#sankeyG").selectAll(".node_sankey")
      .data(data.nodes)
    .enter().append("g")
      .attr("class", "node_sankey")
      .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
      .call(drag);

  d3.selectAll(".node_sankey").append("rect")
      .attr("height", function(d) { return Math.max(d.dy, 1); })
      .attr("width", 20)
      .style("fill", "#fff8ba")
      .style("stroke", "#e6ebed");

  d3.selectAll(".node_sankey").append("text")
      .attr("x", 0)
      .attr("y", function(d) { return d.dy / 2; })
      .attr("text-anchor", "start")
	    .style("font-size", "18px")
      .style("stroke", "#424040")
      .text(function(d) { return d.name; });
  
  function move(d) {
    var bar = d3.select(this);
    // Update the position of the bar by adding the drag distance in each coordinate
    d.y = Math.max(0, Math.min(svg_height_px - d.dy, d3.event.y));
    bar.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
    
    //sankey.relayout();
    d3.select("#sankeyG").selectAll(".link")
      .attr("d", sankey.link() );
     
    return true;
  }
  
  return true;
}

function d3_sankey_plots(data){
  var width = "65vw",
      height = "70vh",
      results_SP_div = document.getElementById("results_SP");
  results_SP_div.innerHTML = "";
  
  svg = d3.select("#results_SP").append("svg")
      .attr("id", "results_SP_svg")
      .attr("width", width)
      .attr("height", height);
      
  runSankeyData(data);
  
  return true;  
}

d3.sankey = function() {
  var sankey = {},
      nodeWidth = 24,
      nodePadding = 8,
      size = [1, 1],
      nodes = [],
      links = [];

  sankey.nodeWidth = function(_) {
    if (!arguments.length) return nodeWidth;
    nodeWidth = +_;
    return sankey;
  };

  sankey.nodePadding = function(_) {
    if (!arguments.length) return nodePadding;
    nodePadding = +_;
    return sankey;
  };

  sankey.nodes = function(_) {
    if (!arguments.length) return nodes;
    nodes = _;
    return sankey;
  };

  sankey.links = function(_) {
    if (!arguments.length) return links;
    links = _;
    return sankey;
  };

  sankey.size = function(_) {
    if (!arguments.length) return size;
    size = _;
    return sankey;
  };

  sankey.layout = function(iterations) {
    computeNodeLinks();
    computeNodeValues();
    computeNodeBreadths();
    computeNodeDepths(iterations);
    computeLinkDepths();
    return sankey;
  };

  sankey.relayout = function() {
    computeLinkDepths();
    return sankey;
  };

  sankey.link = function() {
    var curvature = .5;

    function link(d) {
      console.log(d);
      var x0 = d.source.x + d.source.dx,
          x1 = d.target.x,
          xi = d3.interpolateNumber(x0, x1),
          x2 = xi(curvature),
          x3 = xi(1 - curvature),
          y0 = d.source.y + d.sy + d.dy / 2,
          y1 = d.target.y + d.ty + d.dy / 2;
      console.log("M" + x0 + "," + y0
           + "C" + x2 + "," + y0
           + " " + x3 + "," + y1
           + " " + x1 + "," + y1) ;
      return "M" + x0 + "," + y0
           + "C" + x2 + "," + y0
           + " " + x3 + "," + y1
           + " " + x1 + "," + y1;
    }

    link.curvature = function(_) {
      if (!arguments.length) return curvature;
      curvature = +_;
      return link;
    };

    return link;
  };

  // Populate the sourceLinks and targetLinks for each node.
  // Also, if the source and target are not objects, assume they are indices.
  function computeNodeLinks() {
    nodes.forEach(function(node) {
      node.sourceLinks = [];
      node.targetLinks = [];
    });
    links.forEach(function(link) {
      var source = link.source,
          target = link.target;
      if (typeof source === "number") source = link.source = nodes[link.source];
      if (typeof target === "number") target = link.target = nodes[link.target];
      source.sourceLinks.push(link);
      target.targetLinks.push(link);
    });
    //console.log("computeNodeLinks() execution:");
    //console.log(links);
  }

  // Compute the value (size) of each node by summing the associated links.
  function computeNodeValues() {
    nodes.forEach(function(node) {
      node.value = Math.max(
        d3.sum(node.sourceLinks, value),
        d3.sum(node.targetLinks, value)
      );
    });
  }

  // Iteratively assign the breadth (x-position) for each node.
  // Nodes are assigned the maximum breadth of incoming neighbors plus one;
  // nodes with no incoming links are assigned breadth zero, while
  // nodes with no outgoing links are assigned the maximum breadth.
  function computeNodeBreadths() {
    var remainingNodes = nodes,
        nextNodes,
        x = 0;

    while (remainingNodes.length) {
      nextNodes = [];
      remainingNodes.forEach(function(node) {
        node.x = x;
        node.dx = nodeWidth;
        node.sourceLinks.forEach(function(link) {
          nextNodes.push(link.target);
        });
      });
      remainingNodes = nextNodes;
      ++x;
    }

    //
    moveSinksRight(x);
    scaleNodeBreadths((size[0] - nodeWidth) / (x - 1));
  }

  function moveSourcesRight() {
    nodes.forEach(function(node) {
      if (!node.targetLinks.length) {
        node.x = d3.min(node.sourceLinks, function(d) { return d.target.x; }) - 1;
      }
    });
  }

  function moveSinksRight(x) {
    nodes.forEach(function(node) {
      if (!node.sourceLinks.length) {
        node.x = x - 1;
      }
    });
  }

  function scaleNodeBreadths(kx) {
    nodes.forEach(function(node) {
      node.x *= kx;
    });
  }

  function computeNodeDepths(iterations) {
    var nodesByBreadth = d3.nest()
        .key(function(d) { return d.x; })
        .sortKeys(d3.ascending)
        .entries(nodes)
        .map(function(d) { return d.values; });

    //
    initializeNodeDepth();
    resolveCollisions();
    for (var alpha = 1; iterations > 0; --iterations) {
      relaxRightToLeft(alpha *= .99);
      resolveCollisions();
      relaxLeftToRight(alpha);
      resolveCollisions();
    }

    function initializeNodeDepth() {
      var ky = d3.min(nodesByBreadth, function(nodes) {
        return (size[1] - (nodes.length - 1) * nodePadding) / d3.sum(nodes, value);
      });

      nodesByBreadth.forEach(function(nodes) {
        nodes.forEach(function(node, i) {
          node.y = i;
          node.dy = node.value * ky;
        });
      });

      links.forEach(function(link) {
        link.dy = link.value * ky;
      });
    }

    function relaxLeftToRight(alpha) {
      nodesByBreadth.forEach(function(nodes, breadth) {
        nodes.forEach(function(node) {
          if (node.targetLinks.length) {
            var y = d3.sum(node.targetLinks, weightedSource) / d3.sum(node.targetLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });

      function weightedSource(link) {
        return center(link.source) * link.value;
      }
    }

    function relaxRightToLeft(alpha) {
      nodesByBreadth.slice().reverse().forEach(function(nodes) {
        nodes.forEach(function(node) {
          if (node.sourceLinks.length) {
            var y = d3.sum(node.sourceLinks, weightedTarget) / d3.sum(node.sourceLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });

      function weightedTarget(link) {
        return center(link.target) * link.value;
      }
    }

    function resolveCollisions() {
      nodesByBreadth.forEach(function(nodes) {
        var node,
            dy,
            y0 = 0,
            n = nodes.length,
            i;

        // Push any overlapping nodes down.
        nodes.sort(ascendingDepth);
        for (i = 0; i < n; ++i) {
          node = nodes[i];
          dy = y0 - node.y;
          if (dy > 0) node.y += dy;
          y0 = node.y + node.dy + nodePadding;
        }

        // If the bottommost node goes outside the bounds, push it back up.
        dy = y0 - nodePadding - size[1];
        if (dy > 0) {
          y0 = node.y -= dy;

          // Push any overlapping nodes back up.
          for (i = n - 2; i >= 0; --i) {
            node = nodes[i];
            dy = node.y + node.dy + nodePadding - y0;
            if (dy > 0) node.y -= dy;
            y0 = node.y;
          }
        }
      });
    }

    function ascendingDepth(a, b) {
      return a.y - b.y;
    }
  }

  function computeLinkDepths() {
    nodes.forEach(function(node) {
      node.sourceLinks.sort(ascendingTargetDepth);
      node.targetLinks.sort(ascendingSourceDepth);
    });
    nodes.forEach(function(node) {
      var sy = 0, ty = 0;
      node.sourceLinks.forEach(function(link) {
        link.sy = sy;
        sy += link.dy;
      });
      node.targetLinks.forEach(function(link) {
        link.ty = ty;
        ty += link.dy;
      });
    });

    function ascendingSourceDepth(a, b) {
      return a.source.y - b.source.y;
    }

    function ascendingTargetDepth(a, b) {
      return a.target.y - b.target.y;
    }
  }

  function center(node) {
    return node.y + node.dy / 2;
  }

  function value(link) {
    return link.value;
  }

  return sankey;
};
