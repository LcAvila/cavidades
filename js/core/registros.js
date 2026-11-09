"use strict";

(function (CF) {

  const { estado, compararId } = CF.estado;
  const { persistirAtual } = CF.persistencia;
  const { atualizarTabela } = CF.tabela;
  const { atualizarDiagrama } = CF.diagrama;
  const { atualizarResumo } = CF.resumo;
  const { sincronizarFormulario, atualizarSelecao, limparFormulario, lerFormulario } = CF.formulario;
  const { coletarGrade } = CF.cabecalho;

  const AUTO_SAVE_ATRASO_MS = 350;
  let timerAutoSalvar = null;
  let pacoteAutoSalvar = null;

  function atualizarTudo() {
    atualizarTabela();
    atualizarDiagrama();
    atualizarResumo();
  }

  function definirStatusAutoSave(tipo, mensagem) {
    const status = document.getElementById("autoSaveStatus");
    const texto = document.getElementById("autoSaveMensagem");
    if (status) {
      status.classList.remove("is-saving", "is-ok", "is-waiting", "is-error");
      if (tipo) status.classList.add("is-" + tipo);
    }
    if (texto && mensagem) texto.textContent = mensagem;
  }

  function cancelarAutoSalvar() {
    if (timerAutoSalvar) window.clearTimeout(timerAutoSalvar);
    timerAutoSalvar = null;
    pacoteAutoSalvar = null;
  }

  function aplicarAutoSalvar(alvo, reg) {
    cancelarAutoSalvar();
    alvo.forEach((id) => {
      estado.dadosCavidades[id] = {
        desvio: reg.desvio,
        data: reg.data,
        vedado: reg.vedado,
        observacao: reg.observacao,
        controlador: reg.controlador
      };
    });
    coletarGrade();
    persistirAtual();
    atualizarTudo();
    sincronizarFormulario();
    atualizarSelecao();
    const agora = new Date();
    const hora = String(agora.getHours()).padStart(2, "0") + ":" + String(agora.getMinutes()).padStart(2, "0");
    definirStatusAutoSave("ok", "Alterações salvas automaticamente · " + hora);
  }

  function agendarAutoSalvar() {
    const alvo = estado.selecionadas.slice();
    if (!alvo.length) {
      cancelarAutoSalvar();
      definirStatusAutoSave("waiting", "Selecione uma ou mais cavidades.");
      return;
    }
    const reg = lerFormulario();
    if (!reg.desvio) {
      cancelarAutoSalvar();
      definirStatusAutoSave("waiting", "Digite um desvio/defeito para salvar automaticamente.");
      return;
    }
    pacoteAutoSalvar = { alvo: alvo, reg: Object.assign({}, reg) };
    if (timerAutoSalvar) window.clearTimeout(timerAutoSalvar);
    definirStatusAutoSave("saving", "Salvando alterações automaticamente...");
    timerAutoSalvar = window.setTimeout(() => {
      if (!pacoteAutoSalvar) return;
      aplicarAutoSalvar(pacoteAutoSalvar.alvo, pacoteAutoSalvar.reg);
    }, AUTO_SAVE_ATRASO_MS);
  }

  function flushAutoSalvar() {
    if (!timerAutoSalvar || !pacoteAutoSalvar) return;
    const pacote = pacoteAutoSalvar;
    aplicarAutoSalvar(pacote.alvo, pacote.reg);
  }

  function excluir() {
    cancelarAutoSalvar();
    if (estado.selecionadas.length === 0) {
      alert("Selecione ao menos uma cavidade.");
      return;
    }
    const alvo = estado.selecionadas.slice();
    const msg = alvo.length === 1
      ? ("Apagar o registro da cavidade " + alvo[0] + "?")
      : ("Apagar os registros das " + alvo.length + " cavidades selecionadas?");
    if (!confirm(msg)) return;

    alvo.forEach((id) => {
      estado.dadosCavidades[id] = { desvio: "", data: "", vedado: "N", observacao: "", controlador: "" };
    });
    persistirAtual();
    estado.selecionadas = [];
    limparFormulario();
    sincronizarFormulario();
    atualizarSelecao();
    atualizarTudo();
    definirStatusAutoSave("waiting", "Registro apagado. Selecione cavidades para preencher.");
  }

  function initRegistros() {
    const btnExcluir = document.getElementById("btnExcluir");
    if (btnExcluir) btnExcluir.addEventListener("click", excluir);

    const autoSaveTriggers = [
      "desvio",
      "observacao",
      "data",
      "controlador"
    ];
    autoSaveTriggers.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", agendarAutoSalvar);
        el.addEventListener("change", agendarAutoSalvar);
        el.addEventListener("blur", flushAutoSalvar);
      }
    });

    document.querySelectorAll('input[name="vedado"]').forEach((radio) => {
      radio.addEventListener("change", agendarAutoSalvar);
    });

    definirStatusAutoSave("waiting", "Selecione uma ou mais cavidades.");
  }

  CF.registros = {
    agendarAutoSalvar: agendarAutoSalvar,
    flushAutoSalvar: flushAutoSalvar,
    cancelarAutoSalvar: cancelarAutoSalvar,
    excluir: excluir,
    initRegistros: initRegistros
  };

})(window.CF = window.CF || {});
