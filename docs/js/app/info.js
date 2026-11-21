/* VICTOR app: The "i" buttons that explain a metric on hover, focus or tap. */
import { C, METRIC_HINTS, global } from "./config.js";
import { el, empty } from "./dom.js";

export var infoTip = null, infoOwner = null;

export function hideInfo() {
  if (infoTip) infoTip.style.display = "none";
  if (infoOwner) { infoOwner.setAttribute("aria-expanded", "false"); infoOwner = null; }
}

export function showInfo(button, code) {
  var def = C.metricByCode(code);
  if (!infoTip) {
    infoTip = el("div", { class: "tooltip info-tip", role: "tooltip", id: "metricInfoTip" });
    document.body.appendChild(infoTip);
  }
  empty(infoTip);
  infoTip.appendChild(el("b", null, def.label));
  infoTip.appendChild(document.createTextNode(METRIC_HINTS[code] || ""));
  if (!def.symmetric) infoTip.appendChild(el("div", null, "Asymmetric: in \"A vs B\", A is the first set."));
  if (def.cover) infoTip.appendChild(el("div", null, "Also works when an object is in several clusters."));
  infoTip.style.display = "block";
  var rect = button.getBoundingClientRect(), w = infoTip.offsetWidth, h = infoTip.offsetHeight;
  var left = Math.max(8, Math.min(rect.left + rect.width / 2 - w / 2, global.innerWidth - w - 8));
  var top = rect.bottom + 8;
  if (top + h > global.innerHeight - 8) top = Math.max(8, rect.top - h - 8);
  infoTip.style.left = left + "px";
  infoTip.style.top = top + "px";
  infoOwner = button;
  button.setAttribute("aria-expanded", "true");
}

// A small "i" button that explains a metric on hover, keyboard focus or tap.
export function infoButton(code) {
  var b = el("button", { class: "info", type: "button", "aria-label": "What is " + C.metricByCode(code).label + "?",
    "aria-expanded": "false", "aria-describedby": "metricInfoTip" }, "i");
  b.addEventListener("mouseenter", function () { showInfo(b, code); });
  b.addEventListener("mouseleave", hideInfo);
  b.addEventListener("focus", function () { showInfo(b, code); });
  b.addEventListener("blur", hideInfo);
  b.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (infoOwner === b && e.detail === 0) hideInfo(); else showInfo(b, code);
  });
  return b;
}
document.addEventListener("keydown", function (e) { if (e.key === "Escape") hideInfo(); });
document.addEventListener("click", function (e) { if (infoOwner && e.target !== infoOwner) hideInfo(); });
global.addEventListener("scroll", hideInfo, { passive: true, capture: true });
