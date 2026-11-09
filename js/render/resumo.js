"use strict";

(function (CF) {

  const { estado } = CF.estado;

  function atualizarResumo() {
    const ids = estado.molde ? estado.molde.cavidades.map(String) : [];
    let def = 0;
    let ved = 0;
    ids.forEach((id) => {
      const d = estado.dadosCavidades[id] || {};
      if (d.vedado === "S") ved++;
      else if (d.desvio) def++;
    });
    const total = ids.length;
    definir("resTotal", total);
    definir("resOk", total - def - ved);
    definir("resDef", def);
    definir("resVed", ved);
  }

  function definir(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
  }

  CF.resumo = {
    atualizarResumo: atualizarResumo
  };

})(window.CF = window.CF || {});
