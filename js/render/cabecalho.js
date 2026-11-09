"use strict";

(function (CF) {

  const { estado } = CF.estado;
  const { persistirAtual } = CF.persistencia;

  function aplicarGrade() {
    // Todos os `[data-field]` são preenchidos (inclusive os fixos, como a
    // revisão, que não têm a classe `.editable`).
    document.querySelectorAll("[data-field]").forEach((el) => {
      const campo = el.dataset.field;
      const valor = campo === "moldeNum"
        ? (estado.molde ? estado.molde.codigo : "")
        : (estado.dadosGrade[campo] !== undefined ? estado.dadosGrade[campo] : "");
      el.textContent = valor;
    });
  }

  function coletarGrade() {
    document.querySelectorAll(".editable[data-field]").forEach((el) => {
      const campo = el.dataset.field;
      if (campo === "moldeNum") return;
      estado.dadosGrade[campo] = el.textContent.trim();
    });
  }

  function initGrade() {
    document.querySelectorAll(".editable[data-field]").forEach((el) => {
      el.addEventListener("blur", () => { coletarGrade(); persistirAtual(); });
      el.addEventListener("keydown", (k) => {
        if (k.key === "Enter") { k.preventDefault(); el.blur(); }
      });
    });
  }

  CF.cabecalho = {
    aplicarGrade: aplicarGrade,
    coletarGrade: coletarGrade,
    initGrade: initGrade
  };

})(window.CF = window.CF || {});
