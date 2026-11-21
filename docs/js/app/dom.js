/* VICTOR app: Small DOM and CSV helpers shared by every view. */
import { G } from "./config.js";
import { showTab } from "./main.js";

export function $(id) { return document.getElementById(id); }

export function el(tag, attrs, text) {
  var node = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function (k) {
    if (k === "class") node.className = attrs[k]; else node.setAttribute(k, attrs[k]);
  });
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

export function empty(node) { while (node.firstChild) node.removeChild(node.firstChild); }

export function setNotice(node, kind, parts) {
  node.className = "notice" + (kind ? " " + kind : "");
  empty(node);
  parts.forEach(function (p) { node.appendChild(typeof p === "string" ? document.createTextNode(p) : p); });
}

export function bold(text) { return el("b", null, text); }

// Names come from user files. A text cell that starts with = + - @ would run as a formula in a spreadsheet,
// so it gets a leading apostrophe. Numbers are written as they are.
export function csvCell(v) {
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(v)) v = "'" + v;
  v = String(v);
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

export function downloadCsv(rows, filename) {
  var blob = new Blob([rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n") + "\n"], { type: "text/csv" });
  var url = URL.createObjectURL(blob);
  G.download(url, filename);
  setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
}

export function linkTo(tab, text, cls) {
  var b = el("button", { class: cls || "btn link", type: "button" }, text);
  b.addEventListener("click", function () { showTab(tab); });
  return b;
}

export function fillSelect(select, options, value) {
  empty(select);
  options.forEach(function (o) {
    var opt = el("option", { value: o[0] }, o[1]);
    if (String(o[0]) === String(value)) opt.selected = true;
    select.appendChild(opt);
  });
}

export function setPressed(group, key, value) {
  Array.prototype.forEach.call(group.querySelectorAll("button"), function (b) {
    b.setAttribute("aria-pressed", b.getAttribute("data-" + key) === value ? "true" : "false");
  });
}
