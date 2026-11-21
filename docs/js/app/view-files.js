/* VICTOR app: Step 1, Load & prepare: readiness notice, table of sets, statistics, UpSet plot, inspector. */
import { C, G } from "./config.js";
import { selectedSets, setById, state } from "./state.js";
import { $, bold, el, empty, fillSelect, linkTo, setNotice, setPressed } from "./dom.js";
import { compare, refresh, uniqueName } from "./data.js";
import { render } from "./main.js";

// Notice content for a comparison that did not run: the reason, plus a button when it only waits for a go-ahead.
export function notRunParts() {
  var parts = [state.resultError + " "];
  if (state.pending) {
    var run = el("button", { class: "btn small primary", type: "button" }, "Run it anyway");
    run.addEventListener("click", function () {
      var seconds = state.pending.seconds;
      run.disabled = true;
      run.textContent = "Calculating\u2026";
      setTimeout(function () { // lets the button repaint before the page is blocked
        state.approvedSeconds = seconds;
        compare();
        render();
      }, 40);
    });
    parts.push(run);
  }
  return parts;
}

export function skippedText(r) {
  if (!r.skipped || r.skipped.length === 0) return "";
  return "Left out: " + r.skipped.map(function (s) { return s.label + " (" + s.reason + ")"; }).join("; ") + ". ";
}

export function renderFiles() {
  $("countSets").textContent = state.sets.length;
  $("filesEmpty").hidden = state.sets.length > 0;
  $("filesBody").hidden = state.sets.length === 0;
  $("sizeMin").value = state.sizeMin;
  $("sizeMax").value = state.sizeMax;
  Array.prototype.forEach.call(document.querySelectorAll('input[name="filterMode"]'), function (r) { r.checked = r.value === state.filterMode; });
  if (state.sets.length === 0) return;

  var chosen = selectedSets();
  renderReadiness(chosen);
  renderSetsTable(chosen);
  renderFileStats(chosen);
  renderSharedObjects(chosen);
  renderInspector();
}

// Says whether the selected sets can be compared and, if not, offers the fix as a button.
function renderReadiness(chosen) {
  var readiness = $("readiness");
  function setMode(mode) { return function () { state.filterMode = mode; refresh(); }; }
  function action(text, handler, cls) {
    var b = el("button", { class: cls || "btn small", type: "button" }, text);
    b.addEventListener("click", handler);
    return b;
  }
  var overlapNow = chosen.length >= 2 ? C.objectIntersections(chosen.map(function (s) { return s.filtered; })) : null;
  var mismatch = !!overlapNow && !(overlapNow.combos.length === 1 && overlapNow.combos[0].degree === chosen.length);
  if (chosen.length < 2) {
    setNotice(readiness, "", [state.sets.length < 2 ? "Load at least one more cluster set to compare." : "Tick at least two cluster sets to compare them."]);
  } else if (state.result) {
    var filterNote = state.filterMode === "intersection" ? "Only the objects shared by all sets are kept. "
      : state.filterMode === "superset" ? "Missing objects were added as singleton clusters. " : "";
    var parts = [bold("Ready to compare. "), "The " + chosen.length + " selected sets contain the same " +
      C.objectSet(chosen[0].filtered).size.toLocaleString() + " objects. ", filterNote, state.result.note ? state.result.note + " " : ""];
    var row = el("div", { class: "choices" });
    row.appendChild(linkTo("compare", "Compare them \u2192", "btn small primary"));
    if (state.filterMode !== "none") row.appendChild(action("Undo this filter", setMode("none")));
    parts.push(row);
    setNotice(readiness, state.result.note ? "warn" : "good", parts);
  } else if (mismatch && !state.pending) {
    var inAllNow = overlapNow.combos.filter(function (c) { return c.degree === chosen.length; })[0], sharedCount = inAllNow ? inAllNow.count : 0;
    var fix = el("div", { class: "choices" });
    if (sharedCount > 0) fix.appendChild(action("Keep the " + sharedCount.toLocaleString() + " shared objects", setMode("intersection"), "btn small primary"));
    fix.appendChild(action("Keep all " + overlapNow.total.toLocaleString() + " objects, adding singletons", setMode("superset"), sharedCount > 0 ? "btn small" : "btn small primary"));
    setNotice(readiness, "warn", [bold("These sets do not contain the same objects. "),
      sharedCount.toLocaleString() + " of " + overlapNow.total.toLocaleString() + " objects are in all " + chosen.length + " sets. Choose how to make them comparable:", fix]);
  } else {
    setNotice(readiness, "warn", [bold(state.pending ? "Not calculated yet. " : "Not ready to compare. ")].concat(notRunParts()));
  }
  $("dropSingletons").textContent = state.sizeMin >= 2 ? "Keep singleton clusters" : "Drop singleton clusters";
  var warnings = $("fileWarnings");
  empty(warnings);
  state.sets.forEach(function (s) {
    s.warnings.forEach(function (w) { warnings.appendChild(el("p", { class: "hint" }, s.name + ": " + w)); });
  });
}

// The loaded cluster sets: include, rename, remove.
function renderSetsTable(chosen) {
  var tbody = $("setsTable").querySelector("tbody");
  empty(tbody);
  state.sets.forEach(function (s) {
    var tr = el("tr"), td;
    td = el("td");
    var cb = el("input", { type: "checkbox", "aria-label": "Include " + s.name });
    cb.checked = s.selected;
    cb.addEventListener("change", function () { s.selected = cb.checked; refresh(); });
    td.appendChild(cb);
    tr.appendChild(td);
    td = el("td");
    var input = el("input", { type: "text", "aria-label": "Name of cluster set" });
    input.value = s.name;
    input.addEventListener("change", function () {
      var v = input.value.trim().slice(0, 120);
      s.name = v ? uniqueName(v, s.id) : s.name;
      refresh();
    });
    td.appendChild(input);
    if (s.overlapping > 0) {
      td.appendChild(document.createTextNode(" "));
      var badge = el("span", { class: "badge warn", title: "Objects that belong to more than one cluster. Only the Omega Index and the Overlapping NMI can compare such sets." },
        s.overlapping + " overlapping object" + (s.overlapping > 1 ? "s" : ""));
      td.appendChild(badge);
    }
    tr.appendChild(td);
    tr.appendChild(el("td", { class: "num" }, s.raw.length));
    tr.appendChild(el("td", { class: "num" }, C.countObjects(s.raw)));
    tr.appendChild(el("td", { class: "num" }, s.selected ? s.filtered.length : "–"));
    tr.appendChild(el("td", { class: "num" }, s.selected ? C.countObjects(s.filtered) : "–"));
    td = el("td", { class: "num" });
    var rm = el("button", { class: "btn small", "aria-label": "Remove " + s.name }, "Remove");
    rm.addEventListener("click", function () {
      state.sets = state.sets.filter(function (x) { return x !== s; });
      if (state.sets.length === 0) { state.sizeMaxTouched = false; state.sizeMin = 1; state.filterMode = "none"; state.approvedSeconds = 0; }
      refresh();
    });
    td.appendChild(rm);
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
  $("selectAll").checked = chosen.length === state.sets.length;
  $("selectAll").indeterminate = chosen.length > 0 && chosen.length < state.sets.length;
}

// Clusters and objects per selected set, as loaded and after filters.
function renderFileStats(chosen) {
  var names = chosen.map(function (s) { return s.name; });
  G.columns($("chartClusters"), names, [
    { name: "As loaded", values: chosen.map(function (s) { return s.raw.length; }) },
    { name: "After filters", values: chosen.map(function (s) { return s.filtered.length; }) }
  ], { label: "Number of clusters per cluster set" });
  G.columns($("chartObjects"), names, [
    { name: "As loaded", values: chosen.map(function (s) { return C.countObjects(s.raw); }) },
    { name: "After filters", values: chosen.map(function (s) { return C.countObjects(s.filtered); }) }
  ], { label: "Number of objects per cluster set" });
}

// UpSet plot of the objects: only useful when the selected sets differ in what they contain.
function renderSharedObjects(chosen) {
  var names = chosen.map(function (s) { return s.name; });
  var shared = chosen.length >= 2 ? C.objectIntersections(chosen.map(function (s) { return s.raw; })) : null;
  var differ = !!shared && !(shared.combos.length === 1 && shared.combos[0].degree === chosen.length);
  $("upsetCard").hidden = !differ;
  if (differ) {
    var inAll = shared.combos.filter(function (c) { return c.degree === chosen.length; })[0];
    $("upsetNote").textContent = (inAll ? inAll.count.toLocaleString() : "0") + " of " + shared.total.toLocaleString() + " objects are in every set, as loaded." +
      (shared.combos.length > 40 ? " Showing the 40 largest of " + shared.combos.length + " combinations." : "");
    G.upset($("chartUpset"), names, shared, { label: "UpSet plot of the objects shared between cluster sets", maxColumns: 40 });
  }
}

// Cluster size distribution and cluster list of one set.
function renderInspector() {
  fillSelect($("inspectSet"), state.sets.map(function (s) { return [s.id, s.name]; }), state.inspectId);
  setPressed($("inspectStage"), "stage", state.inspectStage);
  var set = setById(state.inspectId), clusters = set ? (state.inspectStage === "raw" ? set.raw : set.filtered) : [];
  G.histogram($("chartSizes"), clusters.map(function (c) { return c.members.length; }), {
    integer: true, xLabel: "Objects per cluster", yLabel: "Clusters", label: "Distribution of cluster sizes",
    empty: "No clusters left after filtering."
  });
  var body = $("inspectTable").querySelector("tbody");
  empty(body);
  clusters.slice(0, 500).forEach(function (c) {
    var tr = el("tr");
    tr.appendChild(el("td", null, c.name));
    tr.appendChild(el("td", { class: "num" }, c.members.length));
    tr.appendChild(el("td", { class: "members" }, c.members.join(", ")));
    body.appendChild(tr);
  });
  if (clusters.length > 500) {
    var more = el("tr");
    more.appendChild(el("td", { colspan: 3, class: "members" }, "Showing the first 500 of " + clusters.length + " clusters."));
    body.appendChild(more);
  }
}
