"use strict";

(function (CF) {

  const estado = {
    contextPath: "",
    hoje: new Date().toISOString().split("T")[0],
    moldes: [],
    maquinas: [],
    formas: {},
    desenhos: {},
    molde: null,
    gradeAtual: null,
    layout: null,
    modelo: null,
    desenho: null,
    dadosCavidades: {},
    dadosGrade: {},
    selecionadas: [],
    blocosTabela: [],
    blocosImpressao: [],
    loadToken: 0,
    onDetalhes: null,
    refs: { diagrama: {}, tabela: {} }
  };

  // Revisão de todas as grades do projeto: valor fixo e não editável em tela.
  // Fonte única — `app.js` força estes campos e `index.jsp` só precisa exibir.
  const revisaoFixa = { num: "07", data: "02/01/2027" };

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function br(v) {
    if (!v) return "";
    const p = String(v).split("-");
    return p.length === 3 ? (p[2] + "/" + p[1] + "/" + p[0]) : String(v);
  }

  function compararId(a, b) {
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  }

  function dividir(lista, nBlocos) {
    const out = [];
    const total = lista.length;
    const n = Math.max(1, nBlocos | 0);
    const base = Math.floor(total / n);
    const resto = total % n;
    let i = 0;
    for (let k = 0; k < n; k++) {
      const tam = base + (k < resto ? 1 : 0);
      out.push(lista.slice(i, i + tam));
      i += tam;
    }
    return out;
  }

  function dividirPorTamanhos(lista, tamanhos) {
    const out = [];
    let i = 0;
    (tamanhos || []).forEach((t) => {
      const tam = Math.max(0, t | 0);
      out.push(lista.slice(i, i + tam));
      i += tam;
    });
    if (i < lista.length) out.push(lista.slice(i));
    return out;
  }

  function registroVazio() {
    return { desvio: "", data: "", vedado: "N", observacao: "", controlador: "" };
  }

  function normalizarRegistro(r) {
    const base = registroVazio();
    if (!r || typeof r !== "object") return base;
    return {
      desvio: r.desvio != null ? String(r.desvio) : "",
      data: r.data != null ? String(r.data) : "",
      vedado: r.vedado === "S" ? "S" : "N",
      observacao: r.observacao != null ? String(r.observacao) : "",
      controlador: r.controlador != null ? String(r.controlador) : ""
    };
  }

  CF.estado = {
    estado: estado,
    revisaoFixa: revisaoFixa,
    esc: esc,
    br: br,
    compararId: compararId,
    dividir: dividir,
    dividirPorTamanhos: dividirPorTamanhos,
    registroVazio: registroVazio,
    normalizarRegistro: normalizarRegistro
  };

})(window.CF = window.CF || {});
