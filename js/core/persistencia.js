"use strict";

(function (CF) {

  const { estado } = CF.estado;

  const CHAVE_GRADES = "customfusion.grades";
  const PREFIXO_GRADE = "customfusion.grade.";
  const PREFIXO_REGISTROS = "customfusion.registros.";
  const CHAVE_LEGADA = "cavidades168";
  const CHAVE_MIGRACAO = "customfusion.sqlite.migrado.v1";
  const ATRASO_SALVAMENTO = 250;

  let cacheGrades = null;
  let timerSalvamento = null;
  let pacotePendente = null;
  let filaSalvamento = Promise.resolve();

  function disponivel() {
    try {
      const k = "__cf_teste__";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  function lerJson(chave) {
    try {
      const raw = window.localStorage.getItem(chave);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  async function api(caminho, opcoes) {
    const cfg = Object.assign({
      headers: { "Content-Type": "application/json" }
    }, opcoes || {});
    const resp = await fetch(estado.contextPath + "/api" + caminho, cfg);
    const corpo = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const erro = new Error(corpo && corpo.erro ? corpo.erro : ("HTTP " + resp.status));
      erro.status = resp.status;
      throw erro;
    }
    return corpo;
  }

  function invalidarCache() {
    cacheGrades = null;
  }

  // ---- Grades ---------------------------------------------------------------

  async function listarGrades() {
    if (cacheGrades) return cacheGrades.slice();
    const dados = await api("/grades");
    cacheGrades = Array.isArray(dados.grades) ? dados.grades : [];
    return cacheGrades.slice();
  }

  async function acharGrade(gradeId) {
    const lista = await listarGrades();
    return lista.find((g) => g.id === gradeId) || null;
  }

  async function criarGrade(moldeId, config) {
    const cfg = config || {};
    const grade = await api("/grades", {
      method: "POST",
      body: JSON.stringify({
        moldeId: moldeId,
        maquina: cfg.maquina || "",
        dataEntrada: cfg.dataEntrada || ""
      })
    });
    invalidarCache();
    return grade;
  }

  async function removerGrade(gradeId) {
    await api("/grades/" + encodeURIComponent(gradeId), { method: "DELETE" });
    invalidarCache();
  }

  async function carregarGrade(gradeId) {
    if (!gradeId) return null;
    try {
      return await api("/grades/" + encodeURIComponent(gradeId));
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  async function salvarGrade(gradeId, moldeId, dadosCavidades, dadosGrade) {
    await api("/grades/" + encodeURIComponent(gradeId), {
      method: "PUT",
      keepalive: true,
      body: JSON.stringify({
        moldeId: moldeId,
        dadosCavidades: dadosCavidades || {},
        dadosGrade: dadosGrade || {}
      })
    });
    invalidarCache();
  }

  // Salva em segundo plano, agrupando edições próximas (blur, salvar, etc.).
  function persistirAtual() {
    if (!estado.gradeAtual) return;
    pacotePendente = {
      gradeId: estado.gradeAtual.id,
      moldeId: estado.gradeAtual.moldeId,
      dadosCavidades: estado.dadosCavidades,
      dadosGrade: estado.dadosGrade
    };
    if (timerSalvamento) return;
    timerSalvamento = window.setTimeout(descarregarPendente, ATRASO_SALVAMENTO);
  }

  function descarregarPendente() {
    if (timerSalvamento) {
      window.clearTimeout(timerSalvamento);
      timerSalvamento = null;
    }
    const pacote = pacotePendente;
    pacotePendente = null;
    if (!pacote) return filaSalvamento;
    filaSalvamento = filaSalvamento
      .then(() => salvarGrade(pacote.gradeId, pacote.moldeId, pacote.dadosCavidades, pacote.dadosGrade))
      .catch((e) => console.error("Falha ao salvar a grade no SQLite: " + e.message));
    return filaSalvamento;
  }

  async function flush() {
    descarregarPendente();
    await filaSalvamento;
  }

  // ---- Migração única do localStorage --------------------------------------

  async function migrarLocalStorage() {
    if (!disponivel()) return 0;
    if (window.localStorage.getItem(CHAVE_MIGRACAO) === "1") return 0;

    const grades = [];
    const lista = lerJson(CHAVE_GRADES);
    const temGrades = Array.isArray(lista) && lista.length > 0;

    if (temGrades) {
      lista.forEach((g) => {
        const pacote = lerJson(PREFIXO_GRADE + g.id);
        if (!pacote) return;
        grades.push({
          id: g.id,
          moldeId: g.moldeId || pacote.moldeId,
          abertaEm: g.abertaEm,
          dadosCavidades: pacote.dadosCavidades || {},
          dadosGrade: pacote.dadosGrade || {}
        });
      });
    } else {
      // Formato anterior às grades múltiplas: um pacote por molde.
      for (let i = 0; i < window.localStorage.length; i++) {
        const chave = window.localStorage.key(i);
        if (!chave || chave.indexOf(PREFIXO_REGISTROS) !== 0) continue;
        const pacote = lerJson(chave);
        if (!pacote) continue;
        grades.push({
          moldeId: chave.substring(PREFIXO_REGISTROS.length),
          dadosCavidades: pacote.dadosCavidades || {},
          dadosGrade: pacote.dadosGrade || {}
        });
      }

      const legado = lerJson(CHAVE_LEGADA);
      if (legado && !grades.some((g) => g.moldeId === "molde-168")) {
        grades.push({
          moldeId: "molde-168",
          dadosCavidades: legado.dadosCavidades || {},
          dadosGrade: legado.dadosGrade || {}
        });
      }
    }

    let importadas = 0;
    if (grades.length) {
      const resultado = await api("/grades/importar", {
        method: "POST",
        body: JSON.stringify({ grades: grades })
      });
      importadas = resultado.importadas || 0;
    }

    window.localStorage.setItem(CHAVE_MIGRACAO, "1");
    invalidarCache();
    return importadas;
  }

  async function migrarParaGrades() {
    return migrarLocalStorage();
  }

  function existeLegado() {
    return disponivel() && (window.localStorage.getItem(CHAVE_GRADES) != null
      || window.localStorage.getItem(CHAVE_LEGADA) != null);
  }

  function legadoJaMigrado() {
    return disponivel() && window.localStorage.getItem(CHAVE_MIGRACAO) === "1";
  }

  async function migrarLegado(moldeIdDestino) {
    const existentes = new Set();
    const lista = lerJson(CHAVE_GRADES);
    if (Array.isArray(lista)) lista.forEach((g) => existentes.add(g.moldeId));
    const legado = lerJson(CHAVE_LEGADA);
    const destino = moldeIdDestino || "molde-168";
    if (!legado || existentes.has(destino)) return false;
    await api("/grades/importar", {
      method: "POST",
      body: JSON.stringify({
        grades: [{
          moldeId: destino,
          dadosCavidades: legado.dadosCavidades || {},
          dadosGrade: legado.dadosGrade || {}
        }]
      })
    });
    window.localStorage.setItem(CHAVE_MIGRACAO, "1");
    invalidarCache();
    return true;
  }

  CF.persistencia = {
    listarGrades: listarGrades,
    acharGrade: acharGrade,
    criarGrade: criarGrade,
    removerGrade: removerGrade,
    carregarGrade: carregarGrade,
    salvarGrade: salvarGrade,
    persistirAtual: persistirAtual,
    flush: flush,
    migrarLocalStorage: migrarLocalStorage,
    migrarParaGrades: migrarParaGrades,
    existeLegado: existeLegado,
    legadoJaMigrado: legadoJaMigrado,
    migrarLegado: migrarLegado
  };

})(window.CF = window.CF || {});
