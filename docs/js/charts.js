/*
 * VICTOR charts: d3 (v5) renderers. Every SVG is styled with attributes only (no CSS classes),
 * so a chart can be exported as a standalone SVG or PNG.
 */
(function (global) {
  "use strict";

  var VICTOR = global.VICTOR = global.VICTOR || {};
  var d3 = global.d35; // d3 v5 bundle, exported under the name d35
  var FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  // ---------------------------------------------------------------- theme
  function isDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  function theme() {
    var dark = isDark();
    return dark ? {
      dark: true, surface: "#1a1a19", text: "#f0efec", muted: "#c3c2b7", grid: "#383835", neutral: "#5b5a55",
      series: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"],
      seqLow: "#16345c", seqHigh: "#b7d3f6"
    } : {
      dark: false, surface: "#fcfcfb", text: "#0b0b0b", muted: "#52514e", grid: "#e4e3df", neutral: "#b9b8b2",
      series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
      seqLow: "#cde2fb", seqHigh: "#0d366b"
    };
  }

  // one-hue sequential scale over [lo, hi]
  function sequential(lo, hi) {
    var t = theme(), interp = d3.interpolateRgb(t.seqLow, t.seqHigh);
    if (!(hi > lo)) return function () { return interp(0.6); };
    return function (v) { return interp(Math.max(0, Math.min(1, (v - lo) / (hi - lo)))); };
  }

  function readableOn(color) {
    var c = d3.rgb(color), lum = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
    return lum > 0.55 ? "#0b0b0b" : "#ffffff";
  }

  // ---------------------------------------------------------------- helpers
  function fmt(v) { return v === null || v === undefined || !isFinite(v) ? "n/a" : Number(v).toFixed(3); }
  // middle ellipsis keeps both ends of a name, which is where names usually differ
  function clip(s, n) {
    s = String(s);
    if (s.length <= n) return s;
    var head = Math.ceil((n - 1) / 2), tail = Math.floor((n - 1) / 2);
    return s.slice(0, head) + "\u2026" + (tail > 0 ? s.slice(s.length - tail) : "");
  }
  function textWidth(s, px) { return String(s).length * (px || 12) * 0.56; }
  function chartWidth(el, fallback) { return Math.max(260, el.clientWidth || fallback || 720); }
  function narrow(W) { return W < 480; }

  function clear(el, key) {
    if (el.__cy) { el.__cy.destroy(); el.__cy = null; }
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function emptyState(el, message) {
    var p = document.createElement("p");
    p.className = "chart-empty";
    p.textContent = message;
    el.appendChild(p);
  }

  function svgRoot(el, width, height, label) {
    return d3.select(el).append("svg")
      .attr("xmlns", "http://www.w3.org/2000/svg")
      .attr("width", width).attr("height", height)
      .attr("viewBox", "0 0 " + width + " " + height)
      .attr("role", "img").attr("aria-label", label || "chart")
      .attr("font-family", FONT).attr("font-size", 12);
  }

  // tooltip: title plus [label, value] rows, built with textContent (file names are user input)
  var tipEl = null;
  function showTip(event, title, rows) {
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.className = "tooltip";
      document.body.appendChild(tipEl);
    }
    while (tipEl.firstChild) tipEl.removeChild(tipEl.firstChild);
    var h = document.createElement("div");
    h.className = "tooltip-title";
    h.textContent = title;
    tipEl.appendChild(h);
    (rows || []).forEach(function (r) {
      var row = document.createElement("div"), k = document.createElement("span"), v = document.createElement("b");
      row.className = "tooltip-row";
      k.textContent = r[0];
      v.textContent = r[1];
      row.appendChild(k);
      row.appendChild(v);
      tipEl.appendChild(row);
    });
    tipEl.style.display = "block";
    var pad = 14, w = tipEl.offsetWidth, hgt = tipEl.offsetHeight;
    var x = event.clientX + pad, y = event.clientY + pad;
    if (x + w > global.innerWidth - 8) x = event.clientX - w - pad;
    if (y + hgt > global.innerHeight - 8) y = event.clientY - hgt - pad;
    tipEl.style.left = Math.max(4, x) + "px";
    tipEl.style.top = Math.max(4, y) + "px";
  }
  function hideTip() { if (tipEl) tipEl.style.display = "none"; }
  // touch screens send no mouseleave when the finger moves on, so a tap outside a chart closes the tooltip
  document.addEventListener("touchstart", function (e) {
    if (!e.target.closest || !e.target.closest(".chart")) hideTip();
  }, { passive: true });
  global.addEventListener("scroll", hideTip, { passive: true });

  // attaches hover behaviour to every node of a selection; content(d) returns [title, rows]
  function hover(selection, content, onEnter, onLeave) {
    selection.each(function (d) {
      var node = this;
      node.addEventListener("mousemove", function (e) { var c = content(d); showTip(e, c[0], c[1]); });
      node.addEventListener("mouseenter", function () { if (onEnter) onEnter.call(node, d); });
      node.addEventListener("mouseleave", function () { hideTip(); if (onLeave) onLeave.call(node, d); });
    });
  }

  // bar with a rounded data end, anchored flat on the baseline
  function hBarPath(x0, y, w, h, r) {
    r = Math.min(r, Math.abs(w), h / 2);
    if (w >= 0) return "M" + x0 + "," + y + "h" + (w - r) + "a" + r + "," + r + " 0 0 1 " + r + "," + r + "v" + (h - 2 * r) +
      "a" + r + "," + r + " 0 0 1 " + (-r) + "," + r + "h" + (-(w - r)) + "z";
    return "M" + x0 + "," + y + "h" + (w + r) + "a" + r + "," + r + " 0 0 0 " + (-r) + "," + r + "v" + (h - 2 * r) +
      "a" + r + "," + r + " 0 0 0 " + r + "," + r + "h" + (-(w + r)) + "z";
  }
  function vBarPath(x, y0, w, h, r) { // grows upwards from y0
    r = Math.min(r, h, w / 2);
    return "M" + x + "," + y0 + "v" + (-(h - r)) + "a" + r + "," + r + " 0 0 1 " + r + "," + (-r) + "h" + (w - 2 * r) +
      "a" + r + "," + r + " 0 0 1 " + r + "," + r + "v" + (h - r) + "z";
  }

  function legend(svg, items, x, y, t) {
    var g = svg.append("g").attr("transform", "translate(" + x + "," + y + ")"), offset = 0;
    items.forEach(function (it) {
      g.append("rect").attr("x", offset).attr("y", -9).attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", it.color);
      g.append("text").attr("x", offset + 15).attr("y", 0).attr("fill", t.muted).text(it.label);
      offset += 15 + textWidth(it.label) + 18;
    });
  }

  function colorBar(svg, x, y, w, lo, hi, t, label) {
    var id = "grad" + Math.random().toString(36).slice(2), defs = svg.append("defs");
    var grad = defs.append("linearGradient").attr("id", id);
    grad.append("stop").attr("offset", "0%").attr("stop-color", t.seqLow);
    grad.append("stop").attr("offset", "100%").attr("stop-color", t.seqHigh);
    svg.append("rect").attr("x", x).attr("y", y).attr("width", w).attr("height", 10).attr("rx", 2).attr("fill", "url(#" + id + ")");
    svg.append("text").attr("x", x).attr("y", y + 24).attr("fill", t.muted).text(fmt(lo));
    svg.append("text").attr("x", x + w).attr("y", y + 24).attr("fill", t.muted).attr("text-anchor", "end").text(fmt(hi));
    if (label && w >= 150) svg.append("text").attr("x", x + w / 2).attr("y", y + 24).attr("fill", t.muted).attr("text-anchor", "middle").text(label);
  }

  // ---------------------------------------------------------------- grouped columns (file statistics)
  // categories: [names], series: [{ name, values }]
  function columns(el, categories, series, opts) {
    clear(el);
    opts = opts || {};
    var t = theme();
    if (categories.length === 0) return emptyState(el, "No cluster sets selected.");
    var W = chartWidth(el, 520), m = { top: 44, right: 12, bottom: 64, left: 48 }, H = 294;
    var svg = svgRoot(el, W, H, opts.label);
    var x0 = d3.scaleBand().domain(d3.range(categories.length)).range([m.left, W - m.right]).paddingInner(0.3).paddingOuter(0.15);
    var x1 = d3.scaleBand().domain(d3.range(series.length)).range([0, x0.bandwidth()]);
    var maxV = d3.max(series, function (s) { return d3.max(s.values); }) || 1;
    var y = d3.scaleLinear().domain([0, maxV]).nice(4).range([H - m.bottom, m.top]);
    y.ticks(4).forEach(function (tick) {
      svg.append("line").attr("x1", m.left).attr("x2", W - m.right).attr("y1", y(tick)).attr("y2", y(tick)).attr("stroke", t.grid);
      svg.append("text").attr("x", m.left - 8).attr("y", y(tick) + 4).attr("text-anchor", "end").attr("fill", t.muted).text(tick);
    });
    var barW = Math.min(44, x1.bandwidth() - 2), showValues = categories.length * series.length <= 24;
    series.forEach(function (s, si) {
      var g = svg.append("g");
      var bars = g.selectAll("path").data(s.values).enter().append("path")
        .attr("d", function (v, i) {
          return vBarPath(x0(i) + x1(si) + (x1.bandwidth() - barW) / 2, y(0), barW, Math.max(0, y(0) - y(v)), 4);
        })
        .attr("fill", t.series[si]);
      bars.each(function (v, i) {
        this.addEventListener("mousemove", function (e) { showTip(e, categories[i], [[s.name, String(v)]]); });
        this.addEventListener("mouseleave", hideTip);
      });
      if (showValues) {
        g.selectAll("text").data(s.values).enter().append("text")
          .attr("x", function (v, i) { return x0(i) + x1(si) + x1.bandwidth() / 2; })
          .attr("y", function (v) { return y(v) - 5; })
          .attr("text-anchor", "middle").attr("fill", t.muted).attr("font-size", 11).text(function (v) { return v; });
      }
    });
    var maxChars = Math.max(6, Math.floor(x0.step() / 6.5)), rotate = categories.some(function (c) { return c.length > maxChars; });
    categories.forEach(function (c, i) {
      var cx = x0(i) + x0.bandwidth() / 2, text = svg.append("text").attr("fill", t.text).text(clip(c, rotate ? 16 : maxChars));
      if (rotate) text.attr("transform", "translate(" + cx + "," + (H - m.bottom + 14) + ") rotate(-35)").attr("text-anchor", "end");
      else text.attr("x", cx).attr("y", H - m.bottom + 18).attr("text-anchor", "middle");
      text.append("title").text(c);
    });
    svg.append("line").attr("x1", m.left).attr("x2", W - m.right).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", t.neutral);
    if (series.length > 1) legend(svg, series.map(function (s, i) { return { label: s.name, color: t.series[i] }; }), m.left, 14, t);
  }

  // ---------------------------------------------------------------- histogram
  // values: numbers. opts: { xLabel, yLabel, domain: [lo, hi], bins, integer }
  function histogram(el, values, opts) {
    clear(el);
    opts = opts || {};
    var t = theme();
    if (values.length === 0) return emptyState(el, opts.empty || "Nothing to show.");
    var W = chartWidth(el, 520), m = { top: 22, right: 12, bottom: 46, left: 48 }, H = 260;
    var svg = svgRoot(el, W, H, opts.label);
    var domain = opts.domain || [d3.min(values), d3.max(values)], thresholds;
    if (opts.integer) {
      var span = domain[1] - domain[0] + 1, step = Math.max(1, Math.ceil(span / 30));
      domain = [domain[0] - 0.5, domain[0] - 0.5 + Math.ceil(span / step) * step];
      thresholds = d3.range(domain[0], domain[1], step);
    } else {
      var nb = opts.bins || 10;
      thresholds = d3.range(nb).map(function (i) { return domain[0] + i * (domain[1] - domain[0]) / nb; });
    }
    var x = d3.scaleLinear().domain(domain).range([m.left, W - m.right]);
    var bins = d3.histogram().domain(domain).thresholds(thresholds)(values);
    var y = d3.scaleLinear().domain([0, d3.max(bins, function (b) { return b.length; }) || 1]).nice(4).range([H - m.bottom, m.top]);
    y.ticks(4).filter(function (v) { return v === Math.floor(v); }).forEach(function (tick) {
      svg.append("line").attr("x1", m.left).attr("x2", W - m.right).attr("y1", y(tick)).attr("y2", y(tick)).attr("stroke", t.grid);
      svg.append("text").attr("x", m.left - 8).attr("y", y(tick) + 4).attr("text-anchor", "end").attr("fill", t.muted).text(tick);
    });
    function binLabel(b) {
      if (opts.integer) {
        var lo = Math.ceil(b.x0), hi = Math.floor(b.x1 - 1e-9);
        return lo === hi ? String(lo) : lo + "–" + hi;
      }
      return b.x0.toFixed(2) + "–" + b.x1.toFixed(2);
    }
    var bars = svg.append("g").selectAll("path").data(bins).enter().append("path")
      .attr("d", function (b) {
        var w = Math.max(1, x(b.x1) - x(b.x0) - 2);
        return b.length ? vBarPath(x(b.x0) + 1, y(0), w, y(0) - y(b.length), Math.min(4, w / 2)) : "";
      })
      .attr("fill", t.series[0]);
    hover(bars, function (b) { return [(opts.xLabel || "Value") + ": " + binLabel(b), [[opts.yLabel || "Count", String(b.length)]]]; });
    if (bins.length <= 30) {
      svg.append("g").selectAll("text").data(bins.filter(function (b) { return b.length > 0; })).enter().append("text")
        .attr("x", function (b) { return (x(b.x0) + x(b.x1)) / 2; }).attr("y", function (b) { return y(b.length) - 5; })
        .attr("text-anchor", "middle").attr("fill", t.muted).attr("font-size", 11).text(function (b) { return b.length; });
    }
    var ticks = opts.integer ? x.ticks(8).filter(function (v) { return v === Math.floor(v) && v >= domain[0] + 0.5; }) : x.ticks(10);
    ticks.forEach(function (tick) {
      svg.append("text").attr("x", x(tick)).attr("y", H - m.bottom + 16).attr("text-anchor", "middle").attr("fill", t.muted)
        .text(opts.integer ? tick : tick.toFixed(1));
    });
    svg.append("line").attr("x1", m.left).attr("x2", W - m.right).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", t.neutral);
    if (opts.xLabel) svg.append("text").attr("x", (m.left + W - m.right) / 2).attr("y", H - 8).attr("text-anchor", "middle").attr("fill", t.muted).text(opts.xLabel);
    if (opts.yLabel) svg.append("text").attr("x", m.left - 36).attr("y", 12).attr("fill", t.muted).text(opts.yLabel);
  }

  // ---------------------------------------------------------------- UpSet plot (objects shared between sets)
  // names: [set names], data: result of core.objectIntersections. Shows at most opts.maxColumns combinations.
  function upset(el, names, data, opts) {
    clear(el);
    opts = opts || {};
    var t = theme(), n = names.length;
    if (n < 2 || data.combos.length === 0) return emptyState(el, "Select at least two cluster sets.");
    var combos = data.combos.slice(0, opts.maxColumns || 40);
    var W = chartWidth(el), small = narrow(W);
    var labelChars = small ? 12 : 24, labelW = Math.min(small ? 96 : 190, d3.max(names, function (s) { return textWidth(clip(s, labelChars)); }) + 12);
    var sizeW = small ? 54 : 120, colW = small ? 22 : 28, rowH = 26, barH = small ? 120 : 170, top = 26;
    var gridX = labelW + sizeW + 18, width = Math.max(W, gridX + combos.length * colW + 12), height = top + barH + 14 + n * rowH + 30;
    var svg = svgRoot(el, width, height, opts.label);
    var y = d3.scaleLinear().domain([0, d3.max(combos, function (c) { return c.count; })]).nice(4).range([top + barH, top]);
    var xs = d3.scaleLinear().domain([0, d3.max(data.sizes)]).range([0, sizeW]);
    var rowY = function (i) { return top + barH + 14 + i * rowH + rowH / 2; };
    y.ticks(4).filter(function (v) { return v === Math.floor(v); }).forEach(function (tick) {
      svg.append("line").attr("x1", gridX).attr("x2", gridX + combos.length * colW).attr("y1", y(tick)).attr("y2", y(tick)).attr("stroke", t.grid);
      svg.append("text").attr("x", gridX - 6).attr("y", y(tick) + 4).attr("text-anchor", "end").attr("fill", t.muted).attr("font-size", 11).text(tick);
    });
    svg.append("text").attr("x", small ? 4 : gridX).attr("y", 12).attr("fill", t.muted).text("Objects found in exactly these sets");
    // set rows: name, size bar, zebra stripe
    names.forEach(function (name, i) {
      if (i % 2 === 0) svg.append("rect").attr("x", 0).attr("y", rowY(i) - rowH / 2).attr("width", width).attr("height", rowH).attr("fill", t.grid).attr("fill-opacity", 0.35);
      svg.append("text").attr("x", labelW - 6).attr("y", rowY(i) + 4).attr("text-anchor", "end").attr("fill", t.text)
        .text(clip(name, labelChars)).append("title").text(name);
      var bar = svg.append("path").attr("d", hBarPath(labelW, rowY(i) - 7, Math.max(1, xs(data.sizes[i])), 14, 3)).attr("fill", t.muted);
      hover(bar, function () { return [name, [["Objects", data.sizes[i].toLocaleString()]]]; });
      if (!small) svg.append("text").attr("x", labelW + xs(data.sizes[i]) + 5).attr("y", rowY(i) + 4).attr("fill", t.muted).attr("font-size", 11).text(data.sizes[i].toLocaleString());
    });
    svg.append("text").attr("x", labelW).attr("y", rowY(n - 1) + rowH / 2 + 16).attr("fill", t.muted).attr("font-size", 11).text("Set size");
    // one column per combination
    var cols = svg.append("g").selectAll("g").data(combos).enter().append("g")
      .attr("transform", function (d, k) { return "translate(" + (gridX + k * colW) + ",0)"; });
    cols.append("rect").attr("x", 0).attr("y", top).attr("width", colW).attr("height", height - top - 30).attr("fill", "transparent");
    cols.append("path").attr("d", function (d) { return vBarPath(3, y(0), colW - 6, Math.max(1, y(0) - y(d.count)), 3); }).attr("fill", t.series[0]);
    cols.append("text").attr("x", colW / 2).attr("y", function (d) { return y(d.count) - 4; }).attr("text-anchor", "middle")
      .attr("fill", t.muted).attr("font-size", small ? 9 : 11).text(function (d) { return d.count.toLocaleString(); });
    cols.each(function (d) {
      var g = d3.select(this), on = [];
      d.members.forEach(function (m, i) { if (m) on.push(i); });
      if (on.length > 1) g.append("line").attr("x1", colW / 2).attr("x2", colW / 2).attr("y1", rowY(on[0])).attr("y2", rowY(on[on.length - 1])).attr("stroke", t.text).attr("stroke-width", 2);
      d.members.forEach(function (m, i) {
        g.append("circle").attr("cx", colW / 2).attr("cy", rowY(i)).attr("r", small ? 5 : 6).attr("fill", m ? t.text : t.grid);
      });
    });
    hover(cols, function (d) {
      var inSets = names.filter(function (name, i) { return d.members[i]; });
      return [d.count.toLocaleString() + " object" + (d.count === 1 ? "" : "s"), [[d.degree === n ? "In all sets" : "Only in", inSets.join(", ")]]];
    });
  }

  // ---------------------------------------------------------------- horizontal bars (pairwise similarities)
  // items: [{ label, value }]
  function bars(el, items, opts) {
    clear(el);
    opts = opts || {};
    var t = theme();
    if (items.length === 0) return emptyState(el, opts.empty || "No pairs at or above the threshold.");
    items = items.slice().sort(function (a, b) { return b.value - a.value; });
    var ranged = items[0].min !== undefined; // items carry a min-max range, drawn as a thin line over the bar
    // on phones the label sits on its own line above the bar
    var W = chartWidth(el), stacked = narrow(W), rowH = stacked ? 46 : 28, barY = stacked ? 21 : 5, barH = 18;
    var labelW = stacked ? 4 : Math.min(W * 0.45, d3.max(items, function (d) { return textWidth(clip(d.label, 48)); }) + 16);
    var labelChars = stacked ? Math.floor((W - 12) / 6.8) : 48;
    var m = { top: 8, right: 58, bottom: 40, left: labelW }, H = m.top + m.bottom + items.length * rowH;
    var svg = svgRoot(el, W, H, opts.label);
    var lo = Math.min(0, d3.min(items, function (d) { return ranged ? d.min : d.value; }));
    var hi = Math.max(d3.max(items, function (d) { return ranged ? d.max : d.value; }), 1e-9);
    var x = d3.scaleLinear().domain([lo, hi]).nice(5).range([m.left, W - m.right]);
    x.ticks(stacked ? 3 : 5).forEach(function (tick) {
      svg.append("line").attr("x1", x(tick)).attr("x2", x(tick)).attr("y1", m.top).attr("y2", H - m.bottom).attr("stroke", t.grid);
      svg.append("text").attr("x", x(tick)).attr("y", H - m.bottom + 16).attr("text-anchor", "middle").attr("fill", t.muted).text(tick);
    });
    var rows = svg.append("g").selectAll("g").data(items).enter().append("g")
      .attr("transform", function (d, i) { return "translate(0," + (m.top + i * rowH) + ")"; });
    rows.append("rect").attr("x", 0).attr("width", W).attr("height", rowH).attr("fill", "transparent");
    rows.append("path").attr("d", function (d) { return hBarPath(x(0), barY, x(d.value) - x(0), barH, 4); }).attr("fill", t.series[0]);
    rows.append("text").attr("x", stacked ? 4 : m.left - 8).attr("y", stacked ? 14 : rowH / 2 + 4).attr("text-anchor", stacked ? "start" : "end")
      .attr("fill", t.text).attr("paint-order", "stroke").attr("stroke", t.surface).attr("stroke-width", stacked ? 3 : 0)
      .text(function (d) { return clip(d.label, labelChars); });
    if (ranged) {
      rows.append("line").attr("x1", function (d) { return x(d.min); }).attr("x2", function (d) { return x(d.max); })
        .attr("y1", barY + barH / 2).attr("y2", barY + barH / 2).attr("stroke", t.text).attr("stroke-width", 1.5);
      ["min", "max"].forEach(function (end) {
        rows.append("line").attr("x1", function (d) { return x(d[end]); }).attr("x2", function (d) { return x(d[end]); })
          .attr("y1", barY + 3).attr("y2", barY + barH - 3).attr("stroke", t.text).attr("stroke-width", 1.5);
      });
    }
    rows.append("text").attr("x", function (d) { return Math.max(x(ranged ? d.max : d.value), x(0)) + 6; }).attr("y", barY + barH / 2 + 4).attr("fill", t.muted)
      .text(function (d) { return fmt(d.value); });
    hover(rows, function (d) { return [d.label, d.rows || [[opts.metric || "Similarity", fmt(d.value)]]]; });
    svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", m.top).attr("y2", H - m.bottom).attr("stroke", t.neutral);
    if (opts.metric) svg.append("text").attr("x", (m.left + W - m.right) / 2).attr("y", H - 6).attr("text-anchor", "middle").attr("fill", t.muted).text(opts.metric);
  }

  // ---------------------------------------------------------------- similarity map (2D embedding)
  // names: [n], points: [[x, y]] from core.mds; closer points are more similar cluster sets.
  function map(el, names, points, opts) {
    clear(el);
    opts = opts || {};
    var t = theme(), n = names.length;
    if (n < 3) return emptyState(el, "A map needs at least three cluster sets.");
    var W = chartWidth(el), H = Math.max(360, Math.min(600, W * 0.6)), pad = narrow(W) ? 46 : 80;
    var svg = svgRoot(el, W, H, opts.label);
    var xs = points.map(function (p) { return p[0]; }), ys = points.map(function (p) { return p[1]; });
    var span = Math.max(d3.max(xs) - d3.min(xs), d3.max(ys) - d3.min(ys), 1e-9);
    var scale = Math.min((W - 2 * pad) / span, (H - 2 * pad) / span); // one scale for both axes: distances stay comparable
    var cx = (d3.max(xs) + d3.min(xs)) / 2, cy = (d3.max(ys) + d3.min(ys)) / 2;
    var px = function (p) { return W / 2 + (p[0] - cx) * scale; }, py = function (p) { return H / 2 + (p[1] - cy) * scale; };
    svg.append("rect").attr("x", 1).attr("y", 1).attr("width", W - 2).attr("height", H - 2).attr("rx", 8).attr("fill", "none").attr("stroke", t.grid);
    // the strongest link of every set, as orientation
    if (opts.matrix) {
      var drawn = {};
      names.forEach(function (name, i) {
        var best = -1, bestValue = -Infinity;
        names.forEach(function (other, j) { if (j !== i && opts.matrix[i][j] > bestValue) { bestValue = opts.matrix[i][j]; best = j; } });
        var key = Math.min(i, best) + "|" + Math.max(i, best);
        if (best < 0 || drawn[key]) return;
        drawn[key] = true;
        svg.append("line").attr("x1", px(points[i])).attr("y1", py(points[i])).attr("x2", px(points[best])).attr("y2", py(points[best]))
          .attr("stroke", t.neutral).attr("stroke-width", 1.5).attr("stroke-dasharray", "4 4");
      });
    }
    var g = svg.append("g").selectAll("g").data(names).enter().append("g")
      .attr("transform", function (d, i) { return "translate(" + px(points[i]) + "," + py(points[i]) + ")"; });
    g.append("circle").attr("r", 16).attr("fill", "transparent");
    g.append("circle").attr("r", 7).attr("fill", t.series[0]).attr("stroke", t.surface).attr("stroke-width", 2);
    g.append("text").attr("y", -12).attr("text-anchor", "middle").attr("fill", t.text).attr("font-size", 12)
      .attr("paint-order", "stroke").attr("stroke", t.surface).attr("stroke-width", 3)
      .text(function (d) { return clip(d, narrow(W) ? 12 : 24); });
    hover(g, function (d) {
      var i = names.indexOf(d), rows = [];
      if (opts.matrix) {
        names.map(function (other, j) { return { other: other, v: j === i ? null : opts.matrix[i][j] }; })
          .filter(function (o) { return o.v !== null; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 4)
          .forEach(function (o) { rows.push([o.other, fmt(o.v)]); });
      }
      return [d + (rows.length ? ": most similar to" : ""), rows];
    });
    svg.append("text").attr("x", 12).attr("y", H - 12).attr("fill", t.muted).attr("font-size", 11)
      .text("Closer points are more similar. Dashed lines join each set to its most similar one.");
  }

  // ---------------------------------------------------------------- hierarchical heatmap
  // names: [n], matrix: n x n (row = first set of the pair), opts: { threshold, metric }
  function heatmap(el, names, matrix, opts) {
    clear(el);
    opts = opts || {};
    var t = theme(), n = names.length, i, j;
    if (n < 2) return emptyState(el, "Select at least two cluster sets.");
    var dist = [];
    for (i = 0; i < n; i++) { dist.push([]); for (j = 0; j < n; j++) dist[i].push(i === j ? 0 : 1 - (matrix[i][j] + matrix[j][i]) / 2); }
    var tree = VICTOR.core.hclust(dist), order = tree.order;
    var off = [];
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) if (i !== j) off.push(matrix[i][j]);
    var lo = d3.min(off), hi = d3.max(off), color = sequential(lo, hi);
    var W = chartWidth(el), dendro = narrow(W) ? 36 : 56, rowChars = narrow(W) ? 12 : 28;
    var labelW = Math.min(200, d3.max(names, function (s) { return textWidth(clip(s, rowChars)); }) + 14);
    var cell = Math.max(22, Math.min(72, Math.floor((W - dendro - labelW - 8) / n)));
    var gridW = cell * n, bottom = Math.min(150, labelW * 0.75 + 20) + 46, H = dendro + gridW + bottom;
    var svg = svgRoot(el, Math.max(W, dendro + gridW + labelW + 8), H, opts.label);
    var pos = {};
    order.forEach(function (leaf, k) { pos[leaf] = k; });
    var g = svg.append("g").attr("transform", "translate(" + dendro + "," + dendro + ")");
    var cells = [];
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) cells.push({ r: order[i], c: order[j], ri: i, ci: j });
    var showText = cell >= 38;
    var cg = g.selectAll("g").data(cells).enter().append("g")
      .attr("transform", function (d) { return "translate(" + d.ci * cell + "," + d.ri * cell + ")"; });
    cg.append("rect").attr("x", 1).attr("y", 1).attr("width", cell - 2).attr("height", cell - 2).attr("rx", 3)
      .attr("fill", function (d) {
        if (d.r === d.c) return t.grid;
        if (opts.threshold !== undefined && matrix[d.r][d.c] < opts.threshold) return t.surface;
        return color(matrix[d.r][d.c]);
      })
      .attr("stroke", function (d) { return d.r !== d.c && opts.threshold !== undefined && matrix[d.r][d.c] < opts.threshold ? t.grid : "none"; });
    if (showText) {
      cg.filter(function (d) { return d.r !== d.c && !(opts.threshold !== undefined && matrix[d.r][d.c] < opts.threshold); })
        .append("text").attr("x", cell / 2).attr("y", cell / 2 + 4).attr("text-anchor", "middle").attr("font-size", 11)
        .attr("fill", function (d) { return readableOn(color(matrix[d.r][d.c])); })
        .text(function (d) { return matrix[d.r][d.c].toFixed(2); });
    }
    hover(cg.filter(function (d) { return d.r !== d.c; }), function (d) {
      return [names[d.r] + " vs " + names[d.c], [[opts.metric || "Similarity", fmt(matrix[d.r][d.c])]]];
    });
    // labels
    order.forEach(function (leaf, k) {
      svg.append("text").attr("x", dendro + gridW + 8).attr("y", dendro + k * cell + cell / 2 + 4).attr("fill", t.text)
        .text(clip(names[leaf], rowChars)).append("title").text(names[leaf]);
      svg.append("text").attr("transform", "translate(" + (dendro + k * cell + cell / 2 + 4) + "," + (dendro + gridW + 12) + ") rotate(-40)")
        .attr("text-anchor", "end").attr("fill", t.text).text(clip(names[leaf], narrow(W) ? 12 : 22)).append("title").text(names[leaf]);
    });
    // dendrograms (same tree on both axes)
    var maxH = tree.root.height || 1;
    function place(node) {
      if (node.leaf !== undefined) { node.p = pos[node.leaf] * cell + cell / 2; node.h = 0; return; }
      place(node.left); place(node.right);
      node.p = (node.left.p + node.right.p) / 2;
      node.h = node.height / maxH * (dendro - 10);
    }
    place(tree.root);
    var topPath = "", leftPath = "";
    (function walk(node) {
      if (node.leaf !== undefined) return;
      [node.left, node.right].forEach(function (child) {
        topPath += "M" + (dendro + child.p) + "," + (dendro - 2 - child.h) + "V" + (dendro - 2 - node.h) + "H" + (dendro + node.p);
        leftPath += "M" + (dendro - 2 - child.h) + "," + (dendro + child.p) + "H" + (dendro - 2 - node.h) + "V" + (dendro + node.p);
        walk(child);
      });
    })(tree.root);
    svg.append("path").attr("d", topPath).attr("fill", "none").attr("stroke", t.neutral).attr("stroke-width", 1.2);
    svg.append("path").attr("d", leftPath).attr("fill", "none").attr("stroke", t.neutral).attr("stroke-width", 1.2);
    colorBar(svg, dendro, H - 34, Math.min(220, gridW), lo, hi, t, "low to high");
  }

  // ---------------------------------------------------------------- sankey
  // Layout adapted from the d3 sankey plugin by Mike Bostock (BSD 3-Clause licence).
  function sankeyLayout(nodes, links, size, nodeWidth, nodePadding, iterations) {
    nodes.forEach(function (node) { node.sourceLinks = []; node.targetLinks = []; });
    links.forEach(function (link) {
      link.source = nodes[link.source];
      link.target = nodes[link.target];
      link.source.sourceLinks.push(link);
      link.target.targetLinks.push(link);
    });
    function value(link) { return link.value; }
    function center(node) { return node.y + node.dy / 2; }
    nodes.forEach(function (node) { node.value = Math.max(d3.sum(node.sourceLinks, value), d3.sum(node.targetLinks, value)); });
    // breadths
    var remaining = nodes.filter(function (n) { return n.sourceLinks.length + n.targetLinks.length > 0; }), x = 0, next;
    var used = remaining.slice();
    while (remaining.length) {
      next = [];
      remaining.forEach(function (node) {
        node.x = x;
        node.dx = nodeWidth;
        node.sourceLinks.forEach(function (link) { if (next.indexOf(link.target) < 0) next.push(link.target); });
      });
      remaining = next;
      ++x;
    }
    used.forEach(function (node) { if (!node.sourceLinks.length) node.x = x - 1; });
    var kx = x > 1 ? (size[0] - nodeWidth) / (x - 1) : 0;
    used.forEach(function (node) { node.x *= kx; });
    // depths
    var byBreadth = d3.nest().key(function (d) { return d.x; }).sortKeys(function (a, b) { return a - b; }).entries(used)
      .map(function (d) { return d.values; });
    var ky = d3.min(byBreadth, function (col) { return (size[1] - (col.length - 1) * nodePadding) / d3.sum(col, value); });
    byBreadth.forEach(function (col) { col.forEach(function (node, i) { node.y = i; node.dy = node.value * ky; }); });
    links.forEach(function (link) { link.dy = link.value * ky; });
    function resolveCollisions() {
      byBreadth.forEach(function (col) {
        var node, dy, y0 = 0, i;
        col.sort(function (a, b) { return a.y - b.y; });
        for (i = 0; i < col.length; ++i) {
          node = col[i];
          dy = y0 - node.y;
          if (dy > 0) node.y += dy;
          y0 = node.y + node.dy + nodePadding;
        }
        dy = y0 - nodePadding - size[1];
        if (dy > 0) {
          y0 = node.y -= dy;
          for (i = col.length - 2; i >= 0; --i) {
            node = col[i];
            dy = node.y + node.dy + nodePadding - y0;
            if (dy > 0) node.y -= dy;
            y0 = node.y;
          }
        }
      });
    }
    resolveCollisions();
    for (var alpha = 1; iterations > 0; --iterations) {
      alpha *= 0.99;
      byBreadth.slice().reverse().forEach(function (col) {
        col.forEach(function (node) {
          if (node.sourceLinks.length) {
            var yv = d3.sum(node.sourceLinks, function (l) { return center(l.target) * l.value; }) / d3.sum(node.sourceLinks, value);
            node.y += (yv - center(node)) * alpha;
          }
        });
      });
      resolveCollisions();
      byBreadth.forEach(function (col) {
        col.forEach(function (node) {
          if (node.targetLinks.length) {
            var yv = d3.sum(node.targetLinks, function (l) { return center(l.source) * l.value; }) / d3.sum(node.targetLinks, value);
            node.y += (yv - center(node)) * alpha;
          }
        });
      });
      resolveCollisions();
    }
    used.forEach(function (node) {
      node.sourceLinks.sort(function (a, b) { return a.target.y - b.target.y; });
      node.targetLinks.sort(function (a, b) { return a.source.y - b.source.y; });
    });
    used.forEach(function (node) {
      var sy = 0, ty = 0;
      node.sourceLinks.forEach(function (link) { link.sy = sy; sy += link.dy; });
      node.targetLinks.forEach(function (link) { link.ty = ty; ty += link.dy; });
    });
    return used;
  }

  // relative thickness in [0.1, 1], as in the original VICTOR
  function relativeWeights(pairs) {
    var lo = d3.min(pairs, function (p) { return p.value; }), hi = d3.max(pairs, function (p) { return p.value; });
    return pairs.map(function (p) { return hi > lo ? 0.1 + 0.9 * (p.value - lo) / (hi - lo) : 0.5; });
  }

  // pairs: [{ i, j, value }] with i < j
  function sankey(el, names, pairs, opts) {
    clear(el);
    opts = opts || {};
    var t = theme();
    if (pairs.length === 0) return emptyState(el, "No pairs at or above the threshold.");
    var W = chartWidth(el), H = Math.max(360, Math.min(620, 140 + names.length * 60)), m = { top: 16, right: narrow(W) ? 84 : 150, bottom: 16, left: 12 };
    var svg = svgRoot(el, W, H, opts.label);
    var weights = relativeWeights(pairs);
    var nodes = names.map(function (name) { return { name: name }; });
    var links = pairs.map(function (p, k) { return { source: p.i, target: p.j, value: weights[k], original: p.value }; });
    var used = sankeyLayout(nodes, links, [W - m.left - m.right, H - m.top - m.bottom], 16, 22, 60);
    var color = sequential(d3.min(pairs, function (p) { return p.value; }), d3.max(pairs, function (p) { return p.value; }));
    var g = svg.append("g").attr("transform", "translate(" + m.left + "," + m.top + ")");
    function linkPath(d) {
      var x0 = d.source.x + d.source.dx, x1 = d.target.x, xi = d3.interpolateNumber(x0, x1), x2 = xi(0.5), x3 = xi(0.5),
          y0 = d.source.y + d.sy + d.dy / 2, y1 = d.target.y + d.ty + d.dy / 2;
      return "M" + x0 + "," + y0 + "C" + x2 + "," + y0 + " " + x3 + "," + y1 + " " + x1 + "," + y1;
    }
    var paths = g.append("g").selectAll("path").data(links.slice().sort(function (a, b) { return b.dy - a.dy; })).enter().append("path")
      .attr("d", linkPath).attr("fill", "none").attr("stroke", function (d) { return color(d.original); })
      .attr("stroke-width", function (d) { return Math.max(1.5, d.dy); }).attr("stroke-opacity", 0.6);
    hover(paths, function (d) { return [d.source.name + " vs " + d.target.name, [[opts.metric || "Similarity", fmt(d.original)]]]; },
      function () { this.setAttribute("stroke-opacity", 0.95); }, function () { this.setAttribute("stroke-opacity", 0.6); });
    var ng = g.append("g").selectAll("g").data(used).enter().append("g")
      .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });
    ng.append("rect").attr("width", 16).attr("height", function (d) { return Math.max(d.dy, 2); }).attr("rx", 3).attr("fill", t.muted);
    ng.append("text").attr("x", 22).attr("y", function (d) { return Math.max(d.dy, 2) / 2 + 4; }).attr("fill", t.text)
      .text(function (d) { return clip(d.name, narrow(W) ? 11 : 20); }).append("title").text(function (d) { return d.name; });
  }

  // ---------------------------------------------------------------- networks (Cytoscape.js)
  // Both network views are drawn with Cytoscape.js: zoom with the wheel or a pinch, drag the background to pan,
  // drag nodes to move them, and switch between layouts.
  var NETWORK_LAYOUTS = {
    force: "Force-directed", concentric: "Concentric", circle: "Circle", grid: "Grid", breadthfirst: "Tree (breadth-first)", random: "Random"
  };

  function cyLayout(name, extra) {
    var common = { animate: false, fit: true, padding: 36 };
    var byName = {
      force: { name: "cose", nodeRepulsion: function () { return 400000; }, idealEdgeLength: function () { return 70; }, nodeOverlap: 24,
        gravity: 0.6, numIter: 1500, randomize: true },
      concentric: { name: "concentric", minNodeSpacing: 26, concentric: function (node) { return node.data("weight") || node.degree(); },
        levelWidth: function (nodes) { return Math.max(1, nodes.maxDegree() / 4); } },
      circle: { name: "circle" }, grid: { name: "grid" }, breadthfirst: { name: "breadthfirst", spacingFactor: 1.1 }, random: { name: "random" }
    };
    return Object.assign({}, common, byName[name] || byName.force, extra || {});
  }

  // A sized box for a Cytoscape drawing inside a chart container
  function cyBox(el, height) {
    var box = document.createElement("div");
    box.className = "cy-box";
    box.style.height = height + "px";
    el.appendChild(box);
    return box;
  }

  // Tooltips on hover and tap; content(element) returns [title, rows] or null
  function cyTooltips(cy, content) {
    cy.on("mouseover tap", "node, edge", function (evt) {
      var c = content(evt.target);
      if (!c) return;
      var rect = cy.container().getBoundingClientRect(), at = evt.renderedPosition || evt.target.renderedMidpoint && evt.target.renderedMidpoint() || { x: 0, y: 0 };
      showTip({ clientX: rect.left + at.x, clientY: rect.top + at.y }, c[0], c[1]);
    });
    cy.on("mouseout", "node, edge", hideTip);
    cy.on("pan zoom drag", hideTip);
    cy.on("tap", function (evt) { if (evt.target === cy) hideTip(); });
  }

  function startCy(el, box, elements, style, layout) {
    var cy = global.cytoscape({ container: box, elements: elements, style: style, layout: layout, minZoom: 0.1, maxZoom: 6, wheelSensitivity: 0.25 });
    el.__cy = cy;
    settleZoom(cy);
    return cy;
  }

  // A small network would otherwise be blown up to fill the box; nodes are never shown larger than drawn
  function settleZoom(cy) {
    cy.fit(undefined, 36);
    if (cy.zoom() > 1.6) { cy.zoom(1.6); cy.center(); }
  }

  // Fits the drawing of a chart container back into view
  function fitNetwork(el) { if (el.__cy) settleZoom(el.__cy); }

  // Network of cluster sets. pairs: [{ i, j, value }], opts: { layout, metric }
  function network(el, names, pairs, opts) {
    clear(el);
    opts = opts || {};
    var t = theme();
    if (names.length === 0) return emptyState(el, "Select at least two cluster sets.");
    var W = chartWidth(el), H = narrow(W) ? Math.round(W * 1.1) : Math.max(440, Math.min(640, W * 0.6));
    var weights = pairs.length ? relativeWeights(pairs) : [], strength = names.map(function () { return 0; });
    pairs.forEach(function (p) { strength[p.i] += p.value; strength[p.j] += p.value; });
    var elements = names.map(function (name, i) { return { data: { id: "s" + i, label: clip(name, narrow(W) ? 14 : 28), full: name, weight: strength[i] } }; });
    pairs.forEach(function (p, k) {
      elements.push({ data: { id: "e" + k, source: "s" + p.i, target: "s" + p.j, value: p.value, rel: weights[k], first: names[p.i], second: names[p.j] } });
    });
    var style = [
      { selector: "node", style: { "background-color": t.surface, "border-color": t.text, "border-width": 2, width: 24, height: 24,
        label: "data(label)", color: t.text, "font-size": 12, "text-margin-y": -6, "text-outline-color": t.surface, "text-outline-width": 2 } },
      { selector: "edge", style: { width: "mapData(rel, 0, 1, 1.5, 11)", "line-color": t.series[0], opacity: 0.55, "curve-style": "straight" } },
      { selector: "node:selected", style: { "border-color": t.series[0], "border-width": 4 } },
      { selector: "edge:selected", style: { opacity: 1 } }
    ];
    var layout = cyLayout(opts.layout, { idealEdgeLength: function (edge) { return 170 - 110 * edge.data("rel"); } });
    var cy = startCy(el, cyBox(el, H), elements, style, layout);
    cyTooltips(cy, function (target) {
      if (target.isEdge()) return [target.data("first") + " vs " + target.data("second"), [[opts.metric || "Similarity", fmt(target.data("value"))]]];
      return [target.data("full"), [["Sum of shown similarities", fmt(target.data("weight"))]]];
    });
  }

  // ---------------------------------------------------------------- circos (chord diagram)
  function chord(el, names, pairs, opts) {
    clear(el);
    opts = opts || {};
    var t = theme(), n = names.length;
    var positive = pairs.filter(function (p) { return p.value > 0; });
    if (positive.length === 0) return emptyState(el, "No pairs at or above the threshold.");
    var W = chartWidth(el), size = Math.min(W, 640), labelChars = narrow(W) ? 9 : 22;
    var labelPad = Math.min(size * 0.26, d3.max(names, function (s) { return textWidth(clip(s, labelChars)); }) + 14);
    var outer = size / 2 - labelPad, inner = outer - 14;
    var svg = svgRoot(el, W, size + (narrow(W) ? 40 : 0), opts.label);
    var matrix = d3.range(n).map(function () { return new Array(n).fill(0); });
    positive.forEach(function (p) { matrix[p.i][p.j] = p.value; matrix[p.j][p.i] = p.value; });
    var chords = d3.chord().padAngle(0.05).sortSubgroups(d3.descending)(matrix);
    var color = sequential(d3.min(positive, function (p) { return p.value; }), d3.max(positive, function (p) { return p.value; }));
    var g = svg.append("g").attr("transform", "translate(" + W / 2 + "," + size / 2 + ")");
    var ribbon = d3.ribbon().radius(inner - 2), arc = d3.arc().innerRadius(inner).outerRadius(outer);
    var ribbons = g.append("g").selectAll("path").data(chords).enter().append("path")
      .attr("d", ribbon).attr("fill", function (d) { return color(matrix[d.source.index][d.target.index]); })
      .attr("fill-opacity", 0.78).attr("stroke", t.surface).attr("stroke-width", 1);
    hover(ribbons, function (d) {
      return [names[d.source.index] + " vs " + names[d.target.index], [[opts.metric || "Similarity", fmt(matrix[d.source.index][d.target.index])]]];
    }, function () { this.setAttribute("fill-opacity", 1); }, function () { this.setAttribute("fill-opacity", 0.78); });
    var groups = g.append("g").selectAll("g").data(chords.groups.filter(function (d) { return d.value > 0; })).enter().append("g");
    var arcs = groups.append("path").attr("d", arc).attr("fill", t.muted).attr("stroke", t.surface).attr("stroke-width", 1);
    hover(arcs, function (d) { return [names[d.index], [["Sum of shown similarities", fmt(d.value)]]]; },
      function (d) { ribbons.attr("fill-opacity", function (r) { return r.source.index === d.index || r.target.index === d.index ? 0.95 : 0.12; }); },
      function () { ribbons.attr("fill-opacity", 0.78); });
    groups.append("text")
      .each(function (d) { d.angle = (d.startAngle + d.endAngle) / 2; })
      .attr("dy", "0.35em").attr("fill", t.text)
      .attr("transform", function (d) {
        return "rotate(" + (d.angle * 180 / Math.PI - 90) + ") translate(" + (outer + 8) + ")" + (d.angle > Math.PI ? " rotate(180)" : "");
      })
      .attr("text-anchor", function (d) { return d.angle > Math.PI ? "end" : "start"; })
      .text(function (d) { return clip(names[d.index], labelChars); });
    colorBar(svg, 12, size - 34 + (narrow(W) ? 40 : 0), narrow(W) ? 110 : 160, d3.min(positive, function (p) { return p.value; }), d3.max(positive, function (p) { return p.value; }), t, "low to high");
  }

  // ---------------------------------------------------------------- network coloured by cluster
  // net: parsed edge list, quality: result of core.clusterQuality, clusters: [{ name, members }], opts: { layout }
  // Layout "clusters" places every cluster as its own patch; the others are Cytoscape layouts.
  // Returns legend items [{ label, color }].
  function graph(el, net, quality, clusters, opts) {
    clear(el);
    opts = opts || {};
    var t = theme(), N = net.nodes.length;
    if (N > 3000) { emptyState(el, "The network has " + N + " nodes; the drawing is skipped above 3000 nodes. The table and histogram still cover all of it. Use Open in NORMA below to view the network."); return []; }
    // the 8 largest clusters get a colour, the rest share a neutral one
    var ranked = quality.rows.map(function (r, i) { return { i: i, size: r.inNetwork }; })
      .filter(function (r) { return r.size > 0; }).sort(function (a, b) { return b.size - a.size; });
    var colorOf = {}, legendItems = [];
    ranked.slice(0, 8).forEach(function (r, k) { colorOf[r.i] = t.series[k]; legendItems.push({ label: clusters[r.i].name + " (" + r.size + ")", color: t.series[k] }); });
    if (ranked.length > 8 || quality.unassignedNodes > 0) legendItems.push({ label: "Other clusters / unassigned", color: t.neutral });
    var W = chartWidth(el), H = Math.max(380, Math.min(580, W * 0.75));
    var size = N > 600 ? 7 : N > 150 ? 11 : 18, showLabels = N <= 60;
    var maxW = d3.max(net.edges, function (e) { return e.w; }) || 1;
    var elements = net.nodes.map(function (name, i) {
      var c = quality.membership[i];
      return { data: { id: "n" + i, label: showLabels ? clip(name, 12) : "", full: name, cluster: c, clusterName: c >= 0 ? clusters[c].name : "none", color: colorOf[c] || t.neutral } };
    });
    net.edges.forEach(function (e, k) { elements.push({ data: { id: "e" + k, source: "n" + e.s, target: "n" + e.t, w: e.w, rel: e.w / maxW } }); });
    var style = [
      { selector: "node", style: { "background-color": "data(color)", "border-color": t.surface, "border-width": 1.5, width: size, height: size,
        label: "data(label)", color: t.text, "font-size": 10, "text-margin-y": -4, "text-outline-color": t.surface, "text-outline-width": 2 } },
      { selector: "edge", style: { width: "mapData(rel, 0, 1, 0.8, 3)", "line-color": t.neutral, opacity: 0.55, "curve-style": N > 400 ? "haystack" : "straight" } },
      { selector: "node:selected", style: { "border-color": t.text, "border-width": 3 } }
    ];
    var layoutName = opts.layout || (N > 500 ? "clusters" : "force"), layout;
    if (layoutName === "clusters") {
      // every cluster is a spiral patch; the patches sit on a ring, largest first
      var groups = {}, order = [];
      quality.membership.forEach(function (c, i) { var key = c >= 0 ? c : -1; if (!groups[key]) { groups[key] = []; order.push(key); } groups[key].push(i); });
      order.sort(function (a, b) { return groups[b].length - groups[a].length; });
      var radii = order.map(function (key) { return size * 0.9 * Math.sqrt(groups[key].length) + size; }), ring = 0;
      radii.forEach(function (r) { ring += 2 * r + size; });
      ring = Math.max(ring / (2 * Math.PI), d3.max(radii) + size);
      var position = {}, angle = 0;
      order.forEach(function (key, k) {
        var half = (2 * radii[k] + size) / (2 * ring * 2 * Math.PI) * 2 * Math.PI;
        angle += half;
        var cx = ring * Math.cos(angle), cy0 = ring * Math.sin(angle);
        groups[key].forEach(function (i, m) {
          var rr = size * 0.9 * Math.sqrt(m + 0.5), a = m * 2.399963; // golden-angle spiral
          position["n" + i] = { x: cx + rr * Math.cos(a), y: cy0 + rr * Math.sin(a) };
        });
        angle += half;
      });
      layout = { name: "preset", positions: function (node) { return position[node.id()]; }, fit: true, padding: 24 };
    } else {
      layout = cyLayout(layoutName, { padding: 24, idealEdgeLength: function () { return N > 300 ? 30 : 50; }, nodeRepulsion: function () { return N > 300 ? 20000 : 90000; },
        numIter: N > 800 ? 300 : 1000 });
    }
    var cy = startCy(el, cyBox(el, H), elements, style, layout);
    cyTooltips(cy, function (target) {
      if (target.isEdge()) return null;
      return [target.data("full"), [["Cluster", target.data("clusterName")], ["Neighbours", String(target.degree())]]];
    });
    return legendItems;
  }

  // ---------------------------------------------------------------- export
  function download(href, filename) {
    var a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  var EXPORT_FORMATS = {
    png: { mime: "image/png", ext: "png", transparent: true },
    svg: { mime: "image/svg+xml", ext: "svg", transparent: true, vector: true },
    pdf: { mime: "application/pdf", ext: "pdf", transparent: false },
    jpeg: { mime: "image/jpeg", ext: "jpg", transparent: false },
    webp: { mime: "image/webp", ext: "webp", transparent: true }
  };
  var TITLE_BAND = 34; // height in px added above the plot for its title

  // The plot inside a chart container: { kind: "svg" | "canvas", node, width, height } in CSS pixels, or null.
  function exportSource(el) {
    if (el.__cy) return { kind: "cy", cy: el.__cy, width: el.__cy.width(), height: el.__cy.height() };
    var svg = el.querySelector("svg");
    if (svg) return { kind: "svg", node: svg, width: +svg.getAttribute("width"), height: +svg.getAttribute("height") };
    var canvas = el.querySelector("canvas");
    if (canvas) return { kind: "canvas", node: canvas, width: parseFloat(canvas.style.width) || canvas.width, height: parseFloat(canvas.style.height) || canvas.height };
    return null;
  }

  function backgroundColor(choice) {
    return choice === "transparent" ? null : choice === "white" ? "#ffffff" : theme().surface;
  }

  // Standalone SVG text of a plot, with an optional title band and background.
  function svgMarkup(source, opts) {
    var t = theme(), NS = "http://www.w3.org/2000/svg", band = opts.title ? TITLE_BAND : 0;
    var w = source.width, h = source.height + band;
    var root = document.createElementNS(NS, "svg");
    root.setAttribute("xmlns", NS);
    root.setAttribute("width", w);
    root.setAttribute("height", h);
    root.setAttribute("viewBox", "0 0 " + w + " " + h);
    root.setAttribute("font-family", FONT);
    root.setAttribute("font-size", "12");
    var bg = backgroundColor(opts.background);
    if (bg) {
      var rect = document.createElementNS(NS, "rect");
      rect.setAttribute("width", w);
      rect.setAttribute("height", h);
      rect.setAttribute("fill", bg);
      root.appendChild(rect);
    }
    if (opts.title) {
      var text = document.createElementNS(NS, "text");
      text.setAttribute("x", 8);
      text.setAttribute("y", 22);
      text.setAttribute("font-size", "15");
      text.setAttribute("font-weight", "600");
      text.setAttribute("fill", t.text);
      text.textContent = opts.title;
      root.appendChild(text);
    }
    var g = document.createElementNS(NS, "g");
    g.setAttribute("transform", "translate(0," + band + ")");
    Array.prototype.forEach.call(source.node.childNodes, function (child) { g.appendChild(child.cloneNode(true)); });
    root.appendChild(g);
    return new XMLSerializer().serializeToString(root);
  }

  // A one-page PDF that shows a JPEG image at the given size in points.
  function pdfFromJpeg(jpeg, pxW, pxH, ptW, ptH) {
    var enc = new TextEncoder(), parts = [], offsets = [], length = 0;
    function push(x) { var bytes = typeof x === "string" ? enc.encode(x) : x; parts.push(bytes); length += bytes.length; }
    function object(n, write) { offsets[n] = length; push(n + " 0 obj\n"); write(); push("\nendobj\n"); }
    var content = "q " + ptW.toFixed(2) + " 0 0 " + ptH.toFixed(2) + " 0 0 cm /Im0 Do Q";
    push("%PDF-1.4\n");
    object(1, function () { push("<< /Type /Catalog /Pages 2 0 R >>"); });
    object(2, function () { push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"); });
    object(3, function () {
      push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + ptW.toFixed(2) + " " + ptH.toFixed(2) + "] " +
        "/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");
    });
    object(4, function () {
      push("<< /Type /XObject /Subtype /Image /Width " + pxW + " /Height " + pxH + " /ColorSpace /DeviceRGB /BitsPerComponent 8 " +
        "/Filter /DCTDecode /Length " + jpeg.length + " >>\nstream\n");
      push(jpeg);
      push("\nendstream");
    });
    object(5, function () { push("<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream"); });
    var xref = length, table = "xref\n0 6\n0000000000 65535 f \n";
    for (var n = 1; n <= 5; n++) table += ("0000000000" + offsets[n]).slice(-10) + " 00000 n \n";
    push(table + "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
    return new Blob(parts, { type: "application/pdf" });
  }

  function saveBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    download(url, filename);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  // Draws the plot on a new canvas at `scale` times its on-screen size; calls done(canvas).
  function rasterize(source, opts, done, fail) {
    var band = opts.title ? TITLE_BAND : 0, w = source.width, h = source.height + band, scale = opts.scale || 1;
    var canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    var ctx = canvas.getContext("2d");
    if (source.kind === "svg") {
      var img = new Image();
      img.onload = function () { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); done(canvas); };
      img.onerror = function () { fail("The browser could not draw the plot as an image."); };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgMarkup(source, opts));
      return;
    }
    var bg = backgroundColor(opts.background);
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (opts.title) {
      ctx.fillStyle = theme().text;
      ctx.font = "600 " + 15 * scale + "px " + FONT;
      ctx.fillText(opts.title, 8 * scale, 22 * scale);
    }
    ctx.imageSmoothingQuality = "high";
    if (source.kind === "cy") { // Cytoscape redraws itself at the requested resolution, so the image stays sharp
      var shot = new Image();
      shot.onload = function () { ctx.drawImage(shot, 0, band * scale, w * scale, source.height * scale); done(canvas); };
      shot.onerror = function () { fail("The browser could not draw the network as an image."); };
      shot.src = source.cy.png({ scale: scale, full: false });
      return;
    }
    ctx.drawImage(source.node, 0, band * scale, w * scale, source.height * scale);
    done(canvas);
  }

  // opts: { format, scale, background: "theme" | "white" | "transparent", title, filename (no extension) }
  // done(error) is called when the download has started or failed.
  function exportImage(el, opts, done) {
    done = done || function () {};
    var source = exportSource(el), format = EXPORT_FORMATS[opts.format];
    if (!source) return done("There is no plot to export.");
    if (!format) return done("Unknown format.");
    opts = Object.assign({}, opts);
    if (!format.transparent && opts.background === "transparent") opts.background = "white";
    var filename = opts.filename + "." + format.ext;
    if (format.vector) {
      if (source.kind !== "svg") return done("This plot is drawn as pixels and has no vector version.");
      saveBlob(new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + svgMarkup(source, opts)], { type: format.mime }), filename);
      return done(null);
    }
    rasterize(source, opts, function (canvas) {
      var mime = opts.format === "pdf" ? "image/jpeg" : format.mime;
      canvas.toBlob(function (blob) {
        if (!blob || (opts.format === "webp" && blob.type !== "image/webp")) return done("This browser cannot write " + opts.format.toUpperCase() + " images.");
        if (opts.format !== "pdf") { saveBlob(blob, filename); return done(null); }
        blob.arrayBuffer().then(function (buffer) {
          var band = opts.title ? TITLE_BAND : 0;
          saveBlob(pdfFromJpeg(new Uint8Array(buffer), canvas.width, canvas.height, source.width * 0.75, (source.height + band) * 0.75), filename);
          done(null);
        });
      }, mime, 0.95);
    }, done);
  }

  VICTOR.charts = {
    theme: theme, sequential: sequential, readableOn: readableOn, fmt: fmt,
    columns: columns, histogram: histogram, bars: bars, upset: upset, map: map, heatmap: heatmap, sankey: sankey,
    network: network, chord: chord, graph: graph, fitNetwork: fitNetwork, NETWORK_LAYOUTS: NETWORK_LAYOUTS,
    exportImage: exportImage, exportSource: exportSource, EXPORT_FORMATS: EXPORT_FORMATS, TITLE_BAND: TITLE_BAND, download: download
  };
})(window);
