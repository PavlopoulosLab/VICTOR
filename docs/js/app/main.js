/* VICTOR app: Entry point: tabs, the top-level render and start-up. */
import { VICTOR, global } from "./config.js";
import { state } from "./state.js";
import { $ } from "./dom.js";
import { refresh } from "./data.js";
import { hideInfo } from "./info.js";
import { renderFiles } from "./view-files.js";
import { renderCompare, renderMetricList } from "./view-compare.js";
import { renderVisualize } from "./view-plots.js";
import { renderQuality } from "./view-quality.js";
import { normaData, normaPayload } from "./norma.js";
import { initApi, initApiPanel } from "./api.js";
import { initEvents } from "./events.js";

export var currentTab = "home";

export function showTab(tab) {
  hideInfo();
  currentTab = tab;
  Array.prototype.forEach.call($("tabs").querySelectorAll("button"), function (b) {
    b.setAttribute("aria-selected", b.getAttribute("data-tab") === tab ? "true" : "false");
  });
  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (s) { s.classList.toggle("active", s.id === "tab-" + tab); });
  render();
  global.scrollTo(0, 0);
}

// Charts measure their container, so only the visible tab is drawn.
export function render() {
  $("countSets").textContent = state.sets.length;
  Array.prototype.forEach.call($("tabs").querySelectorAll("button"), function (b) {
    var tab = b.getAttribute("data-tab");
    b.classList.toggle("done", tab === "files" && !!state.result);
    b.classList.toggle("waiting", (tab === "compare" || tab === "visualize") && !state.result);
  });
  if (currentTab === "files") renderFiles();
  else if (currentTab === "compare") renderCompare();
  else if (currentTab === "visualize") renderVisualize();
  else if (currentTab === "quality") renderQuality();
}

// Starts the application: wires the events, then draws the first state.
function start() {
  initEvents();
  renderMetricList();
  refresh();
  initApiPanel();
  initApi(); // last: a link or another page may load data straight away
}

VICTOR.state = state; // exposed for debugging and tests
VICTOR.normaPayload = function () { var data = normaData(); return data ? normaPayload(data) : null; };
VICTOR.showTab = showTab;
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
