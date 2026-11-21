/* Sets the colour theme before the page is drawn. Light is the default; the choice made with the switch is remembered. */
(function () {
  "use strict";
  var theme = "light";
  try {
    var saved = window.localStorage.getItem("victor-theme");
    if (saved === "dark" || saved === "light") theme = saved;
  } catch (e) { /* storage can be unavailable (private mode, file://); the default applies */ }
  document.documentElement.setAttribute("data-theme", theme);
})();
