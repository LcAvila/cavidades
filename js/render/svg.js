"use strict";

(function (CF) {

  const NS = "http://www.w3.org/2000/svg";

  const TAGS_PERMITIDAS = new Set([
    "rect", "circle", "ellipse", "line", "polyline", "polygon", "path", "g", "text", "tspan"
  ]);

  const ATTRS_PERMITIDAS = new Set([
    "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
    "width", "height", "d", "points", "transform", "text-anchor",
    "dominant-baseline", "font-size", "font-weight", "fill", "stroke",
    "stroke-width", "opacity"
  ]);

  function criarEl(tag, attrs, classes) {
    if (!TAGS_PERMITIDAS.has(tag)) {
      throw new Error("Elemento SVG não permitido: " + tag);
    }
    const el = document.createElementNS(NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        if (!ATTRS_PERMITIDAS.has(k)) return;
        if (attrs[k] == null) return;
        el.setAttribute(k, String(attrs[k]));
      });
    }
    if (classes) {
      classes.forEach((c) => { if (c) el.classList.add(c); });
    }
    return el;
  }

  function criarTexto(attrs, classes, texto) {
    const el = criarEl("text", attrs, classes);
    el.textContent = texto == null ? "" : String(texto);
    return el;
  }

  CF.svg = {
    criarEl: criarEl,
    criarTexto: criarTexto
  };

})(window.CF = window.CF || {});
