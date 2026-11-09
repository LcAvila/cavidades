"use strict";

(function (CF) {

  const { estado, br } = CF.estado;
  const { sincronizarFormulario, atualizarSelecao } = CF.formulario;
  const registros = CF.registros;

  function abrirDetalhes(id) {
    id = String(id);
    const d = estado.dadosCavidades[id] || {};
    document.getElementById("modalCavNum").textContent = "#" + id;

    const cont = document.getElementById("modalConteudo");
    cont.innerHTML = "";

    if (d.desvio) {
      linha(cont, "Desvio", d.desvio);
      linha(cont, "Vedado", d.vedado === "S" ? "Sim" : "Não");
      linha(cont, "Data", br(d.data));
      linha(cont, "Controlador", d.controlador || "");
      linha(cont, "Observações", d.observacao || "");
    } else {
      const div = document.createElement("div");
      div.className = "det-linha";
      div.textContent = "Nenhum registro para esta cavidade.";
      cont.appendChild(div);
    }

    const overlay = document.getElementById("modalOverlay");
    overlay.dataset.cav = id;
    overlay.classList.add("active");
  }

  function linha(cont, label, valor) {
    const div = document.createElement("div");
    div.className = "det-linha";
    const span = document.createElement("span");
    span.className = "det-label";
    span.textContent = label + ":";
    div.appendChild(span);
    div.appendChild(document.createTextNode(valor == null ? "" : String(valor)));
    cont.appendChild(div);
  }

  function fecharModal() {
    document.getElementById("modalOverlay").classList.remove("active");
  }

  function initModal() {
    document.getElementById("modalFechar").addEventListener("click", fecharModal);
    document.getElementById("modalOverlay").addEventListener("click", (e) => {
      if (e.target.id === "modalOverlay") fecharModal();
    });
    document.getElementById("modalEditar").addEventListener("click", () => {
      const n = String(document.getElementById("modalOverlay").dataset.cav);
      fecharModal();
      estado.selecionadas = [n];
      sincronizarFormulario();
      atualizarSelecao();
    });
    document.getElementById("modalExcluir").addEventListener("click", () => {
      const n = String(document.getElementById("modalOverlay").dataset.cav);
      fecharModal();
      estado.selecionadas = [n];
      registros.excluir();
    });
  }

  CF.modal = {
    abrirDetalhes: abrirDetalhes,
    fecharModal: fecharModal,
    initModal: initModal
  };

})(window.CF = window.CF || {});
