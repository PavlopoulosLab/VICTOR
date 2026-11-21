/* VICTOR app: The Export image dialog shared by every plot. */
import { G } from "./config.js";
import { state } from "./state.js";
import { $ } from "./dom.js";
import { render } from "./main.js";

export var exportTarget = null; // { chartId, title }

export function exportChoice() {
  var format = document.querySelector('input[name="exportFormat"]:checked').value;
  return {
    format: format, scale: +$("exportScale").value, background: $("exportBackground").value,
    title: $("exportWithTitle").checked ? exportTarget.title : "",
    filename: ($("exportName").value.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 100)) || "victor_plot"
  };
}

export function syncExportDialog() {
  var source = G.exportSource($(exportTarget.chartId)), svgRadio = document.querySelector('input[name="exportFormat"][value="svg"]');
  svgRadio.disabled = !source || source.kind !== "svg"; // the large network is drawn as pixels
  if (svgRadio.disabled && svgRadio.checked) document.querySelector('input[name="exportFormat"][value="png"]').checked = true;
  var choice = exportChoice(), format = G.EXPORT_FORMATS[choice.format];
  $("exportExt").textContent = "." + format.ext;
  $("exportScale").disabled = !!format.vector;
  var transparent = $("exportBackground").querySelector('option[value="transparent"]');
  transparent.disabled = !format.transparent;
  if (!format.transparent && $("exportBackground").value === "transparent") $("exportBackground").value = "white";
  $("exportError").textContent = "";
  if (!source) { $("exportInfo").textContent = "There is no plot to export yet."; $("exportGo").disabled = true; return; }
  $("exportGo").disabled = false;
  var w = source.width, h = source.height + (choice.title ? G.TITLE_BAND : 0);
  var inches = function (px, dpi) { return (px / dpi).toFixed(1); }, cm = function (px, dpi) { return (px / dpi * 2.54).toFixed(1); };
  if (format.vector) {
    $("exportInfo").textContent = "Vector image, " + Math.round(w) + " \u00d7 " + Math.round(h) + " units; scales to any size without loss.";
  } else {
    var pw = Math.round(w * choice.scale), ph = Math.round(h * choice.scale), dpi = 96 * choice.scale;
    $("exportInfo").textContent = pw.toLocaleString() + " \u00d7 " + ph.toLocaleString() + " px \u00b7 " + dpi + " dpi when printed at the on-screen size, " +
      inches(w, 96) + " \u00d7 " + inches(h, 96) + " in (" + cm(w, 96) + " \u00d7 " + cm(h, 96) + " cm) \u00b7 " +
      inches(pw, 300) + " \u00d7 " + inches(ph, 300) + " in (" + cm(pw, 300) + " \u00d7 " + cm(ph, 300) + " cm) at 300 dpi" +
      (source.kind === "canvas" ? " \u00b7 this plot is drawn as pixels, so it does not get sharper above the screen's own resolution" : "") +
      (choice.format === "pdf" ? " \u00b7 the PDF holds the plot as an image" : "");
  }
}

export function openExportDialog(button) {
  var chartId = button.getAttribute("data-chart");
  if (chartId === "vizChart") {
    exportTarget = { chartId: chartId, title: $("vizTitle").textContent };
    $("exportName").value = "victor_" + state.viz.kind + "_" + state.viz.metric;
  } else {
    exportTarget = { chartId: chartId, title: button.getAttribute("data-title") };
    $("exportName").value = button.getAttribute("data-name");
  }
  syncExportDialog();
  $("exportDialog").showModal();
}

export function runExport() {
  var choice = exportChoice(), dialog = $("exportDialog"), go = $("exportGo");
  var dark = document.documentElement.getAttribute("data-theme") === "dark";
  // A white background needs the light colours: in the dark theme the plot is redrawn light for the export.
  var relight = dark && choice.background === "white";
  function finish(error) {
    if (relight) { document.documentElement.setAttribute("data-theme", "dark"); render(); }
    go.disabled = false;
    go.textContent = "Download";
    if (error) $("exportError").textContent = error; else dialog.close();
  }
  go.disabled = true;
  go.textContent = "Preparing\u2026";
  if (!relight) { G.exportImage($(exportTarget.chartId), choice, finish); return; }
  document.documentElement.setAttribute("data-theme", "light");
  render();
  var animated = exportTarget.chartId === "chartGraph" || (exportTarget.chartId === "vizChart" && state.viz.kind === "network" && state.viz.layout === "force");
  setTimeout(function () { G.exportImage($(exportTarget.chartId), choice, finish); }, animated ? 2500 : 60); // moving layouts get time to settle
}

export function initExportDialog() {
  Array.prototype.forEach.call(document.querySelectorAll(".export-btn"), function (b) {
    b.addEventListener("click", function () { openExportDialog(b); });
  });
  ["exportScale", "exportBackground", "exportWithTitle"].forEach(function (id) { $(id).addEventListener("change", syncExportDialog); });
  Array.prototype.forEach.call(document.querySelectorAll('input[name="exportFormat"]'), function (r) { r.addEventListener("change", syncExportDialog); });
  $("exportCancel").addEventListener("click", function () { $("exportDialog").close(); });
  $("exportGo").addEventListener("click", runExport);
}
