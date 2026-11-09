"use strict";

(function (CF) {

  const { estado, compararId } = CF.estado;

  function criarOpcoesCavidades(cavidades) {
    const select = document.getElementById("cavidade");
    if (!select) return;
    select.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "Selecione a cavidade";
    select.appendChild(ph);
    cavidades.forEach((id) => {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = "Cavidade " + id;
      select.appendChild(o);
    });

    const lbl = document.getElementById("lblCavidade");
    if (lbl) {
      lbl.textContent = ehSequencial(cavidades) ? ("Cavidade (1 a " + cavidades.length + ")") : "Cavidade";
    }
  }

  function ehSequencial(ids) {
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i]) !== String(i + 1)) return false;
    }
    return true;
  }

  function flushRegistroPendente() {
    if (CF.registros && CF.registros.flushAutoSalvar) CF.registros.flushAutoSalvar();
  }

  async function clicarCavidade(id, ev) {
    await preencherControladorLogado();
    flushRegistroPendente();
    id = String(id);
    const aditivo = ev && (ev.ctrlKey || ev.metaKey);
    if (aditivo) {
      const i = estado.selecionadas.indexOf(id);
      if (i >= 0) estado.selecionadas.splice(i, 1);
      else estado.selecionadas.push(id);
    } else {
      estado.selecionadas = [id];
    }
    sincronizarFormulario();
    atualizarSelecao();
  }

  async function clicarZona(hub, ev) {
    await preencherControladorLogado();
    flushRegistroPendente();
    const ids = (hub.cavidades || []).map(String);
    const aditivo = ev && (ev.ctrlKey || ev.metaKey);
    if (aditivo) {
      ids.forEach((id) => { if (estado.selecionadas.indexOf(id) < 0) estado.selecionadas.push(id); });
    } else {
      estado.selecionadas = ids.slice();
    }
    sincronizarFormulario();
    atualizarSelecao();
  }

  function atualizarSelecao() {
    const marcados = new Set(estado.selecionadas.map(String));
    document.querySelectorAll("[data-cav]").forEach((el) => {
      const ativo = marcados.has(String(el.dataset.cav));
      el.classList.toggle("cav-selecionada", ativo);
      el.classList.toggle("cav-selecionada-svg", ativo);
    });
  }

  function atualizarObsField() {
    const v = (document.getElementById("desvio").value || "").trim();
    document.getElementById("obsField").style.display = (v === "OUTRO" || v === "REB.") ? "block" : "none";
  }

  function sincronizarFormulario() {
    const info = document.getElementById("selecaoInfo");
    const select = document.getElementById("cavidade");

    if (estado.selecionadas.length === 0) {
      select.value = "";
      info.textContent = "Nenhuma cavidade selecionada.";
      return;
    }

    if (estado.selecionadas.length === 1) {
      const id = String(estado.selecionadas[0]);
      select.value = id;
      const d = estado.dadosCavidades[id] || { desvio: "", data: "", vedado: "N", observacao: "", controlador: "" };
      document.getElementById("desvio").value = d.desvio || "";
      document.getElementById("observacao").value = d.observacao || "";
      document.getElementById("data").value = d.data || estado.hoje;
      document.getElementById("controlador").value = d.controlador || "";
      atualizarObsField();
      document.querySelectorAll('input[name="vedado"]').forEach((r) => { r.checked = (r.value === (d.vedado || "N")); });
      info.textContent = "Cavidade " + id + " selecionada.";
    } else {
      select.value = "";
      const lista = estado.selecionadas.slice().sort(compararId);
      info.innerHTML = "";
      const strong = document.createElement("strong");
      strong.textContent = lista.length + " cavidades selecionadas";
      info.appendChild(strong);
      info.appendChild(document.createTextNode(" (" + lista.join(", ") + "). O registro será aplicado a todas as selecionadas e salvo automaticamente."));
    }
  }

  function limparFormulario() {
    document.getElementById("desvio").value = "";
    document.getElementById("observacao").value = "";
    document.getElementById("data").value = estado.hoje;
    document.getElementById("controlador").value = "";
    document.getElementById("obsField").style.display = "none";
    const r = document.querySelector('input[name="vedado"][value="N"]');
    if (r) r.checked = true;
  }

  function lerFormulario() {
    const r = document.querySelector('input[name="vedado"]:checked');
    return {
      desvio: (document.getElementById("desvio").value || "").trim(),
      data: document.getElementById("data").value || estado.hoje,
      vedado: r ? r.value : "N",
      observacao: document.getElementById("observacao").value || "",
      controlador: document.getElementById("controlador").value || ""
    };
  }

  function temEdicaoNaoSalva() {
    if (estado.selecionadas.length !== 1) return false;
    const id = String(estado.selecionadas[0]);
    const d = estado.dadosCavidades[id] || { desvio: "", data: "", vedado: "N", observacao: "", controlador: "" };
    const atual = lerFormulario();
    return atual.desvio !== (d.desvio || "")
      || atual.observacao !== (d.observacao || "")
      || atual.controlador !== (d.controlador || "")
      || atual.vedado !== (d.vedado || "N")
      || atual.data !== (d.data || estado.hoje);
  }

  function initFormulario() {
    const select = document.getElementById("cavidade");
    if (select) {
      select.addEventListener("change", function () {
        flushRegistroPendente();
        estado.selecionadas = this.value ? [String(this.value)] : [];
        sincronizarFormulario();
        atualizarSelecao();
      });
    }
    const desvio = document.getElementById("desvio");
    if (desvio) desvio.addEventListener("input", atualizarObsField);
  }

  async function preencherControladorLogado() {
    try {
      const ctx = (document.body && document.body.dataset && document.body.dataset.context) || "/CustomFusionWeb";
      const resp = await fetch(ctx + "/api/usuario-atual");
      const dados = await resp.json().catch(() => ({}));
      const campo = document.getElementById("controlador");
      if (!campo) return;
      const nome = dados && dados.nome ? String(dados.nome) : (dados && dados.login ? String(dados.login) : "");
      if (nome) {
        campo.value = nome;
      }
    } catch (e) {
      // Silencioso: se não houver backend, o campo continua editável manualmente
    }
  }

  CF.formulario = {
    criarOpcoesCavidades: criarOpcoesCavidades,
    clicarCavidade: clicarCavidade,
    clicarZona: clicarZona,
    atualizarSelecao: atualizarSelecao,
    atualizarObsField: atualizarObsField,
    sincronizarFormulario: sincronizarFormulario,
    limparFormulario: limparFormulario,
    lerFormulario: lerFormulario,
    temEdicaoNaoSalva: temEdicaoNaoSalva,
    initFormulario: initFormulario
  };

})(window.CF = window.CF || {});
