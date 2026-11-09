"use strict";

(function (CF) {

  const { estado } = CF.estado;
  const { criarEl } = CF.svg;
  const { geradores } = CF.layouts;
  const { clicarCavidade, clicarZona } = CF.formulario;

  function normalizarLayout(layout, cavidades) {
    if (!layout) throw new Error("Layout não cadastrado.");

    if (layout.tipo === "parametrizado") {
      const g = geradores[layout.gerador];
      if (!g) throw new Error("Gerador de layout desconhecido: " + layout.gerador);
      const m = g(layout.parametros || {}, cavidades);
      m.viewBox = layout.viewBox || m.viewBox;
      m.formaPadrao = layout.formaPadrao || (layout.parametros && layout.parametros.formaPadrao);
      return m;
    }

    return {
      viewBox: layout.viewBox,
      formaPadrao: layout.formaPadrao,
      fundo: layout.fundo || [],
      conexoes: layout.conexoes || [],
      interms: layout.interms || [],
      hubs: layout.hubs || [],
      cavidades: (layout.cavidades || []).map((c) => ({
        id: String(c.id),
        x: c.x,
        y: c.y,
        r: c.r,
        fontSize: c.fontSize,
        formaId: c.formaId || layout.formaPadrao,
        rotacao: c.rotacao,
        escala: c.escala
      }))
    };
  }

  function posicao(tag, cav) {
    if (tag === "circle" || tag === "ellipse") return { cx: cav.x, cy: cav.y };
    if (tag === "rect") return { x: cav.x, y: cav.y };
    if (tag === "text" || tag === "tspan") return { x: cav.x, y: cav.y };
    return {};
  }

  function transformacao(cav) {
    const t = "translate(" + cav.x + " " + cav.y + ")";
    const r = cav.rotacao ? " rotate(" + cav.rotacao + ")" : "";
    const s = cav.escala ? " scale(" + cav.escala + ")" : "";
    return t + r + s + " translate(" + (-cav.x) + " " + (-cav.y) + ")";
  }

  function montarDiagrama(modelo, formas) {
    const svg = document.getElementById("svgDiagrama");
    svg.innerHTML = "";
    svg.setAttribute("viewBox", modelo.viewBox || "0 0 100 100");
    estado.refs.diagrama = {};

    (modelo.fundo || []).forEach((f) => {
      svg.appendChild(criarEl(f.tag, f.attrs, f.classes));
    });

    (modelo.conexoes || []).forEach((l) => {
      svg.appendChild(criarEl(l.tag, l.attrs, l.classes));
    });

    (modelo.interms || []).forEach((im) => {
      svg.appendChild(criarEl("circle", { cx: im.x, cy: im.y, r: im.r || 18 }, ["interm-circle"]));
    });

    (modelo.hubs || []).forEach((h) => {
      const circulo = criarEl("circle", { cx: h.x, cy: h.y, r: h.r || 40 }, ["hub-circle"]);
      const texto = criarEl("text", { x: h.x, y: h.y }, ["hub-text"]);
      if (h.fontSize) texto.style.fontSize = h.fontSize + "px";
      texto.textContent = h.label == null ? "" : String(h.label);
      const aoClicar = (e) => clicarZona(h, e);
      circulo.addEventListener("click", aoClicar);
      texto.addEventListener("click", aoClicar);
      svg.appendChild(circulo);
      svg.appendChild(texto);
    });

    (modelo.cavidades || []).forEach((cav) => {
      const forma = formas[cav.formaId] || formas[modelo.formaPadrao];
      const elementos = [];

      if (forma && Array.isArray(forma.elementos)) {
        forma.elementos.forEach((spec) => {
          const attrs = Object.assign({}, posicao(spec.tag, cav), spec.attrs || {});
          if (cav.r != null && (spec.tag === "circle" || spec.tag === "ellipse")) attrs.r = cav.r;
          if (cav.rotacao || cav.escala) attrs.transform = transformacao(cav);
          const el = criarEl(spec.tag, attrs, (spec.classes || []).slice());
          el.dataset.cav = cav.id;
          el.addEventListener("click", (e) => clicarCavidade(cav.id, e));
          el.addEventListener("dblclick", () => { if (estado.onDetalhes) estado.onDetalhes(cav.id); });
          svg.appendChild(el);
          elementos.push(el);
        });
      }

      const rotulo = (forma && forma.rotulo) || {};
      const texto = criarEl("text", posicao("text", cav), (rotulo.classes || ["cav-text"]).slice());
      if (cav.fontSize) texto.style.fontSize = cav.fontSize + "px";
      texto.dataset.cav = cav.id;
      texto.textContent = cav.id;
      svg.appendChild(texto);

      estado.refs.diagrama[cav.id] = { elementos: elementos, texto: texto };
    });

    atualizarDiagrama();
  }

  function atualizarDiagrama() {
    const refs = estado.refs.diagrama || {};
    Object.keys(refs).forEach((id) => {
      const d = estado.dadosCavidades[id] || {};
      const status = d.vedado === "S" ? "status-vedado" : (d.desvio ? "status-defeito" : "status-normal");
      const ref = refs[id];
      ref.elementos.forEach((el) => {
        el.classList.remove("status-normal", "status-defeito", "status-vedado");
        el.classList.add(status);
      });
      ref.texto.classList.toggle("status-vedado-txt", d.vedado === "S");
    });
  }

  CF.diagrama = {
    normalizarLayout: normalizarLayout,
    montarDiagrama: montarDiagrama,
    atualizarDiagrama: atualizarDiagrama
  };

})(window.CF = window.CF || {});
