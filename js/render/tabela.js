"use strict";

(function (CF) {

  const { estado, br } = CF.estado;
  const { clicarCavidade } = CF.formulario;

  function montarTabela() {
    const tb = document.getElementById("tbodyCavidades");
    tb.innerHTML = "";
    estado.refs.tabela = {};

    const blocos = estado.blocosTabela || [];
    const linhas = blocos.reduce((m, b) => Math.max(m, b.length), 0);

    for (let i = 0; i < linhas; i++) {
      const tr = document.createElement("tr");
      blocos.forEach((bloco) => {
        const id = bloco[i];
        if (id == null) {
          for (let k = 0; k < 5; k++) tr.appendChild(document.createElement("td"));
          return;
        }
        celulasDaCavidade(id).forEach((td) => tr.appendChild(td));
      });
      tb.appendChild(tr);
    }
  }

  function celulasDaCavidade(id) {
    const tdN = document.createElement("td");
    tdN.className = "cav-num";
    tdN.dataset.cav = id;
    tdN.textContent = id;

    const tdD = document.createElement("td");
    tdD.className = "desvio-cell";
    tdD.dataset.cav = id;

    const tdData = document.createElement("td");
    tdData.className = "data-cell";
    tdData.dataset.cav = id;

    const tdV = document.createElement("td");
    tdV.dataset.cav = id;

    const tdC = document.createElement("td");
    tdC.dataset.cav = id;

    estado.refs.tabela[id] = { num: tdN, desvio: tdD, data: tdData, vedado: tdV, controlador: tdC };
    preencherCelulas(id);

    const tds = [tdN, tdD, tdData, tdV, tdC];
    tds.forEach((td) => {
      td.addEventListener("click", (e) => clicarCavidade(id, e));
      td.addEventListener("dblclick", () => { if (estado.onDetalhes) estado.onDetalhes(id); });
    });
    return tds;
  }

  function preencherCelulas(id) {
    const ref = estado.refs.tabela[id];
    if (!ref) return;
    const d = estado.dadosCavidades[id] || {};

    ref.desvio.innerHTML = "";
    if (d.desvio) {
      const span = document.createElement("span");
      span.className = "cav-defeito";
      span.textContent = d.desvio;
      span.style.background = d.vedado === "S" ? "#d32f2f" : "#f2b01e";
      span.style.color = d.vedado === "S" ? "#fff" : "#34404a";
      ref.desvio.appendChild(span);
    }
    ref.desvio.title = d.observacao || "";

    ref.data.textContent = br(d.data);

    ref.vedado.innerHTML = "";
    const strong = document.createElement("strong");
    strong.style.color = d.vedado === "S" ? "#d32f2f" : "#a66d00";
    strong.textContent = d.vedado === "S" ? "S" : "N";
    ref.vedado.appendChild(strong);

    ref.controlador.textContent = d.controlador || "";

    const statusClasse = d.vedado === "S" ? "cav-vedada-cel" : (d.desvio ? "cav-com-def-cel" : "");
    [ref.num, ref.desvio, ref.data, ref.vedado, ref.controlador].forEach((td) => {
      td.classList.remove("cav-vedada-cel", "cav-com-def-cel");
      if (statusClasse) td.classList.add(statusClasse);
    });
  }

  function atualizarTabela() {
    Object.keys(estado.refs.tabela || {}).forEach(preencherCelulas);
  }

  CF.tabela = {
    montarTabela: montarTabela,
    atualizarTabela: atualizarTabela
  };

})(window.CF = window.CF || {});
