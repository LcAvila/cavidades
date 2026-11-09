"use strict";

(function (CF) {

  function radialZonas(parametros, cavidades) {
    const p = parametros || {};
    const ids = (cavidades || []).map(String);
    const posicoes = p.posicoes || [];
    const interms = p.interms || [];
    const hub = p.hub || { x: 0, y: 0 };

    const modelo = {
      viewBox: p.viewBox || null,
      fundo: [],
      conexoes: [],
      interms: [],
      hubs: [],
      cavidades: []
    };

    if (p.moldura) {
      modelo.fundo.push({
        tag: "rect",
        attrs: { x: p.moldura.x, y: p.moldura.y, width: p.moldura.width, height: p.moldura.height },
        classes: ["moldura-rect"]
      });
    }

    (p.zonas || []).forEach((z) => {
      const hx = (z.offX || 0) + hub.x;
      const hy = (z.offY || 0) + hub.y;
      const inicio = z.inicioIndice || 0;

      const idsZona = [];
      for (let i = 0; i < posicoes.length; i++) {
        const idx = inicio + i;
        if (idx < ids.length) idsZona.push(ids[idx]);
      }

      interms.forEach((im) => {
        const mx = (z.offX || 0) + im.x;
        const my = (z.offY || 0) + im.y;
        modelo.conexoes.push({
          tag: "line",
          attrs: { x1: hx, y1: hy, x2: mx, y2: my },
          classes: ["linha-conexao"]
        });
        (im.cavs || []).forEach((ci) => {
          const cpt = posicoes[ci];
          if (!cpt) return;
          modelo.conexoes.push({
            tag: "line",
            attrs: { x1: mx, y1: my, x2: (z.offX || 0) + cpt.x, y2: (z.offY || 0) + cpt.y },
            classes: ["linha-conexao"]
          });
        });
      });

      interms.forEach((im) => {
        modelo.interms.push({ x: (z.offX || 0) + im.x, y: (z.offY || 0) + im.y });
      });

      modelo.hubs.push({ x: hx, y: hy, label: z.label, cavidades: idsZona.slice() });

      posicoes.forEach((pt, idx) => {
        const id = idsZona[idx];
        if (id == null) return;
        modelo.cavidades.push({
          id: id,
          x: (z.offX || 0) + pt.x,
          y: (z.offY || 0) + pt.y,
          formaId: z.formaId || p.formaPadrao
        });
      });
    });

    if (!modelo.viewBox) modelo.viewBox = "0 0 1300 1350";
    return modelo;
  }

  CF.layouts = {
    geradores: { "radial-zonas": radialZonas },
    radialZonas: radialZonas
  };

})(window.CF = window.CF || {});
