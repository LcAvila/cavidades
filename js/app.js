"use strict";

(function (CF) {

  const { estado, revisaoFixa, dividir, dividirPorTamanhos, registroVazio, normalizarRegistro } = CF.estado;
  const cfg = CF.cfg;
  const persistencia = CF.persistencia;
  const telaInicial = CF.telaInicial;
  const { normalizarLayout, montarDiagrama } = CF.diagrama;
  const { montarTabela } = CF.tabela;
  const { criarOpcoesCavidades, sincronizarFormulario, atualizarSelecao, limparFormulario, temEdicaoNaoSalva, initFormulario } = CF.formulario;
  const { aplicarGrade, initGrade } = CF.cabecalho;
  const { atualizarResumo } = CF.resumo;
  const { abrirDetalhes, initModal } = CF.modal;
  const { initImpressao } = CF.impressao;
  const { initRegistros } = CF.registros;

  function el(id) { return document.getElementById(id); }

  function mostrarCarregando(texto) {
    const info = el("moldeInfo");
    if (info) info.textContent = texto || "";
  }

  function mostrarAviso(msg) {
    const aviso = el("avisoLayout");
    if (aviso) { aviso.textContent = msg; aviso.style.display = "block"; }
    const svg = el("svgDiagrama");
    if (svg) svg.style.display = "none";
  }

  function esconderAviso() {
    const aviso = el("avisoLayout");
    if (aviso) aviso.style.display = "none";
    const svg = el("svgDiagrama");
    if (svg) svg.style.display = "";
  }

  function acharMolde(moldeId) {
    return estado.moldes.find((m) => m.id === moldeId) || null;
  }

  function numeroOuNull(valor) {
    if (valor === null || valor === undefined || valor === "") return null;
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
  }

  function aplicarConfigNaGrade(dadosGrade, config) {
    const saida = Object.assign({}, dadosGrade || {});
    if (!config) return saida;

    if (config.maquina) saida.maquina = String(config.maquina).trim();
    if (config.dataEntrada) saida.dataEntrada = String(config.dataEntrada).trim();
    if (config.materiaPrima) saida.material = String(config.materiaPrima).trim();

    const total = numeroOuNull(config.cavidadesTotais);
    const ativas = numeroOuNull(config.cavidadesAtivas);
    if (total !== null) saida.cavidadesTotais = total;
    if (ativas !== null) saida.cavidadesAtivas = ativas;
    if (config.checklist) saida.checklist = config.checklist;
    return saida;
  }

  // `molde.padroes` guarda os valores padrão do molde (produto, material,
  // revisão...). Um campo salvo em branco no registro da grade não deve apagar o
  // padrão, então só valores preenchidos sobrescrevem — inclusive para a
  // impressão, que lê `estado.dadosGrade`.
  function semCamposVazios(dados) {
    const saida = {};
    Object.keys(dados || {}).forEach((campo) => {
      const valor = dados[campo];
      if (valor === undefined || valor === null) return;
      if (typeof valor === "string" && valor.trim() === "") return;
      saida[campo] = valor;
    });
    return saida;
  }

  function dadosGradeDoMolde(molde, persistido) {
    const dados = Object.assign(
      {},
      (molde && molde.padroes) || {},
      semCamposVazios(persistido)
    );
    // Revisão é regra do projeto: fixa e não editável, sobrescreve molde e grade.
    dados.revisaoNum = revisaoFixa.num;
    dados.revisaoData = revisaoFixa.data;
    return dados;
  }

  function aplicarDesenho(desenho) {
    const imagem = desenho && desenho.imagem ? cfg.urlRecurso(desenho.imagem) : "";
    const peca = el("pecaImg");
    const erro = el("pecaErro");
    if (peca) {
      if (imagem) {
        peca.style.display = "";
        peca.src = imagem;
        if (erro) erro.style.display = "none";
      } else {
        peca.style.display = "none";
        if (erro) { erro.style.display = "block"; erro.textContent = "Desenho da peça não cadastrado para este molde."; }
      }
    }
    const folhaPeca = el("folhaPecaImg");
    if (folhaPeca && imagem) folhaPeca.src = imagem;
  }

  function inicializarDados(molde, persistido, grade) {
    const persistCav = (persistido && persistido.dadosCavidades) || {};
    const dadosCavidades = {};
    molde.cavidades.map(String).forEach((id) => {
      dadosCavidades[id] = persistCav[id] ? normalizarRegistro(persistCav[id]) : registroVazio();
    });

    const dadosGrade = dadosGradeDoMolde(molde, persistido && persistido.dadosGrade);
    dadosGrade.moldeNum = molde.codigo;

    // Grades antigas podem não ter os campos de entrada; o molde fornece o total
    // e as cavidades ativamente livres dão o fallback para ativas.
    const totalCavidades = Array.isArray(molde.cavidades) ? molde.cavidades.length : 0;
    if (dadosGrade.cavidadesTotais === undefined || dadosGrade.cavidadesTotais === null || dadosGrade.cavidadesTotais === "") {
      dadosGrade.cavidadesTotais = totalCavidades;
    }
    if (dadosGrade.cavidadesAtivas === undefined || dadosGrade.cavidadesAtivas === null || dadosGrade.cavidadesAtivas === "") {
      const vedadas = Object.values(dadosCavidades).filter((registro) => registro && registro.vedado === "S").length;
      dadosGrade.cavidadesAtivas = Math.max(0, totalCavidades - vedadas);
    }

    // Máquina e data de entrada são escolhidas no modal de abertura da grade e
    // não são editáveis na tela: o valor da grade manda sobre molde/registro.
    if (grade) {
      if (grade.maquina) dadosGrade.maquina = grade.maquina;
      if (grade.dataEntrada) dadosGrade.dataEntrada = grade.dataEntrada;
    }

    return { dadosCavidades, dadosGrade };
  }

  // ---- Tela principal (grades abertas) --------------------------------------

  async function montarCards() {
    const grades = await persistencia.listarGrades();
    return grades
      .filter((g) => !(g.dadosGrade && g.dadosGrade.publicado))
      .map((g) => {
        const molde = acharMolde(g.moldeId);
        const dadosGrade = dadosGradeDoMolde(molde, g.dadosGrade);
        const total = molde ? molde.cavidades.length : (g.total || 0);
        const vedadas = g.vedadas || 0;
        return {
          id: g.id,
          moldeCodigo: molde ? molde.codigo : g.moldeId,
          moldeNome: molde ? molde.nomePeca : "(molde não cadastrado)",
          maquina: dadosGrade.maquina || "",
          material: dadosGrade.material || "",
          total: total,
          ativas: Math.max(0, total - vedadas),
          vedadas: vedadas,
          defeitos: g.defeitos || 0,
          abertaEm: g.abertaEm
        };
      });
  }

  async function renderTelaInicial() {
    telaInicial.renderizar(await montarCards());
  }

  async function voltarParaInicial() {
    if (CF.registros && CF.registros.flushAutoSalvar) CF.registros.flushAutoSalvar();
    if (temEdicaoNaoSalva() && !confirm("Há alterações não salvas no formulário. Voltar para as grades?")) {
      return;
    }
    await renderTelaInicial();
    telaInicial.mostrar();
  }

  // ---- Abrir / carregar grade ----------------------------------------------

  async function criarEAbrirGrade(moldeId, config) {
    const molde = acharMolde(moldeId);
    if (!molde) { alert("Molde não encontrado: " + moldeId); return; }
    try {
      const grade = await persistencia.criarGrade(moldeId, config);

      if (config) {
        const atual = await persistencia.carregarGrade(grade.id) || {};
        const dadosGrade = aplicarConfigNaGrade(atual.dadosGrade, config);
        await persistencia.salvarGrade(grade.id, grade.moldeId, {}, dadosGrade);
      }

      await carregarGradeInterno(grade);
    } catch (e) {
      console.error(e);
      alert("Não foi possível abrir a grade: " + (e && e.message ? e.message : e));
    }
  }

  async function abrirGrade(gradeId) {
    try {
      const grade = await persistencia.carregarGrade(gradeId);
      if (!grade) { alert("Grade não encontrada."); return; }
      await carregarGradeInterno(grade);
    } catch (e) {
      console.error(e);
      alert("Não foi possível carregar a grade: " + (e && e.message ? e.message : e));
    }
  }

  async function carregarGradeInterno(grade) {
    const token = ++estado.loadToken;
    mostrarCarregando("Carregando grade...");

    try {
      const molde = acharMolde(grade.moldeId);
      if (!molde) throw new Error("Molde não cadastrado: " + grade.moldeId);

      const layoutBruto = await cfg.carregarLayout(molde.layoutId);
      if (token !== estado.loadToken) return;

      const desenho = estado.desenhos[molde.desenhoId] || null;
      const ids = molde.cavidades.map(String);
      const modelo = normalizarLayout(layoutBruto, ids);
      const persistido = await persistencia.carregarGrade(grade.id);
      const dados = inicializarDados(molde, persistido, grade);

      estado.gradeAtual = grade;
      estado.molde = molde;
      estado.layout = layoutBruto;
      estado.modelo = modelo;
      estado.desenho = desenho;
      estado.dadosCavidades = dados.dadosCavidades;
      estado.dadosGrade = dados.dadosGrade;
      estado.selecionadas = [];

      const blocosTabela = (layoutBruto.tabela && layoutBruto.tabela.blocos) || 2;
      estado.blocosTabela = dividir(ids, blocosTabela);

      const tamImp = layoutBruto.impressao && layoutBruto.impressao.tamanhosBlocos;
      estado.blocosImpressao = tamImp ? dividirPorTamanhos(ids, tamImp) : dividir(ids, 2);

      telaInicial.esconder();
      aplicarGrade();
      criarOpcoesCavidades(ids);
      montarTabela();
      montarDiagrama(modelo, estado.formas);
      atualizarResumo();
      aplicarDesenho(desenho);
      limparFormulario();
      sincronizarFormulario();
      atualizarSelecao();
      esconderAviso();

      mostrarCarregando("Molde " + molde.codigo + " · " + ids.length + " cavidades");
    } catch (e) {
      if (token !== estado.loadToken) return;
      console.error(e);
      mostrarCarregando("");
      mostrarAviso("Não foi possível abrir a grade do molde \"" + grade.moldeId + "\": " + e.message + " — Layout indisponível ou ainda não validado.");
    }
  }

  async function publicarGrade() {
    if (!estado.gradeAtual || !estado.molde) {
      alert("Nenhuma grade aberta.");
      return;
    }
    if (CF.registros && CF.registros.flushAutoSalvar) CF.registros.flushAutoSalvar();
    await persistencia.flush();
    const codigo = estado.molde.codigo;
    // monta a folha de impressao (A4) antes de capturar o HTML
    if (CF.impressao && typeof CF.impressao.montarFolhaImpressao === "function") {
      CF.impressao.montarFolhaImpressao();
    }
    const folha = document.getElementById("folhaImpressao");
    if (!folha) {
      alert("Folha de impressao nao encontrada.");
      return;
    }
    const html = "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>Grade " + codigo + "</title></head><body>" + folha.outerHTML + "</body></html>";
    // base64 (unicode-safe)
    const bytes = new TextEncoder().encode(html);
    let binary = "";
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    const b64 = btoa(binary);

    const btn = document.getElementById("btnPublicarGrade");
    if (btn) btn.disabled = true;
    try {
      const ctx = estado.contextPath || "";
      const resp = await fetch(ctx + "/api/moldes/" + encodeURIComponent(codigo) + "/publicar-ged", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: "grade-" + codigo + ".html", fileBytes: b64 })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) {
        throw new Error(data.erro || ("HTTP " + resp.status));
      }
      // marca a grade como publicada/encerrada
      if (estado.gradeAtual && estado.gradeAtual.id) {
        const g = await persistencia.carregarGrade(estado.gradeAtual.id);
        if (g) {
          const dados = Object.assign({}, g.dadosGrade || {}, {
            publicado: true,
            dataPublicacao: new Date().toISOString().slice(0, 10)
          });
          await persistencia.salvarGrade(
            g.id,
            g.moldeId || estado.gradeAtual.moldeId,
            estado.dadosCavidades || g.dadosCavidades || {},
            dados);
        }
      }
      alert("Grade publicada no GED com sucesso.");
      await voltarParaInicial();
    } catch (e) {
      alert("Falha ao publicar: " + (e && e.message ? e.message : e));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function iniciar() {
    const body = document.body;
    estado.contextPath = body.dataset.context || "";
    estado.onDetalhes = abrirDetalhes;

    initFormulario();
    initGrade();
    initModal();
    initRegistros();
    initImpressao();
    const btnPublicar = el("btnPublicarGrade");
    if (btnPublicar) btnPublicar.addEventListener("click", publicarGrade);
    if (CF.visualizador3d && CF.visualizador3d.init) {
      CF.visualizador3d.init();
    }
    telaInicial.init({ onAbrirGrade: abrirGrade, onAbrirMolde: criarEAbrirGrade });

    const btnVoltar = el("btnVoltar");
    if (btnVoltar) btnVoltar.addEventListener("click", voltarParaInicial);

    const campoData = el("data");
    if (campoData) campoData.value = estado.hoje;

    try {
      estado.moldes = await cfg.carregarCatalogo();
      estado.maquinas = await cfg.carregarMaquinas();
      estado.formas = await cfg.carregarFormas();
      estado.desenhos = await cfg.carregarDesenhos();
    } catch (e) {
      console.error(e);
      mostrarAviso("Não foi possível carregar a configuração: " + e.message);
      mostrarCarregando("");
      telaInicial.mostrar();
      return;
    }

    try {
      const migradas = await persistencia.migrarLocalStorage();
      if (migradas) console.info("Grades migradas do localStorage para o SQLite: " + migradas);
    } catch (e) {
      console.warn("Falha ao migrar o localStorage para o SQLite: " + e.message);
    }

    await renderTelaInicial();
    telaInicial.mostrar();
  }

  CF.app = {
    abrirGrade: abrirGrade,
    criarEAbrirGrade: criarEAbrirGrade,
    voltarParaInicial: voltarParaInicial,
    montarCards: montarCards,
    renderTelaInicial: renderTelaInicial
  };

  iniciar();

})(window.CF = window.CF || {});
