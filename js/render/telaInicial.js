"use strict";

(function (CF) {

  const { estado, compararId } = CF.estado;

  let onAbrirGrade = null;
  let onAbrirMolde = null;

  function init(opts) {
    const o = opts || {};
    onAbrirGrade = o.onAbrirGrade || null;
    onAbrirMolde = o.onAbrirMolde || null;

    const btnAbrir = document.getElementById("btnAbrirGrade");
    if (btnAbrir) btnAbrir.addEventListener("click", abrirModal);

    const btnCadastrar = document.getElementById("btnCadastrarMolde");
    if (btnCadastrar) btnCadastrar.addEventListener("click", abrirModalCadastro);

    const cadInput = document.getElementById("cadArquivoCad");
    if (cadInput) cadInput.addEventListener("change", () => {
      const nome = cadInput.files && cadInput.files[0] ? cadInput.files[0].name : "Selecionar arquivo STL";
      const el = document.getElementById("cadArquivoCadNome");
      if (el) el.textContent = nome;
    });
    const imgInput = document.getElementById("cadImagem");
    if (imgInput) imgInput.addEventListener("change", () => {
      const nome = imgInput.files && imgInput.files[0] ? imgInput.files[0].name : "Selecionar imagem";
      const el = document.getElementById("cadImagemNome");
      if (el) el.textContent = nome;
    });

    const btnCancelarCad = document.getElementById("btnCancelarCadMolde");
    if (btnCancelarCad) btnCancelarCad.addEventListener("click", fecharModalCadastro);
    const btnConfirmarCad = document.getElementById("btnConfirmarCadMolde");
    if (btnConfirmarCad) btnConfirmarCad.addEventListener("click", confirmarCadastro);
    const overlayCad = document.getElementById("modalCadastrarMolde");
    if (overlayCad) overlayCad.addEventListener("click", (e) => { if (e.target.id === "modalCadastrarMolde") fecharModalCadastro(); });

    const btnCancelar = document.getElementById("btnCancelarAbrir");
    if (btnCancelar) btnCancelar.addEventListener("click", fecharModal);

    const btnConfirmar = document.getElementById("btnConfirmarAbrir");
    if (btnConfirmar) btnConfirmar.addEventListener("click", confirmarAbrir);

    registrarCombobox("molde", {
      rootId: "comboMolde",
      buscaId: "selMoldeBusca",
      listaId: "listaComboMoldes",
      toggleId: "toggleComboMolde",
      hiddenId: "selMolde",
      rotuloVazio: "Digite para filtrar ou escolher um molde",
      mensagemVazia: "Nenhum molde cadastrado",
      onChange: onMoldeSelecionado
    });

    registrarCombobox("maquina", {
      rootId: "comboMaquina",
      buscaId: "selMaquinaBusca",
      listaId: "listaComboMaquinas",
      toggleId: "toggleComboMaquina",
      hiddenId: "selMaquina",
      rotuloVazio: "Digite para filtrar ou escolher uma máquina",
      mensagemVazia: "Nenhuma máquina cadastrada",
      onChange: onMaquinaSelecionada
    });

    const cavidadesTotal = document.getElementById("cavidadesTotal");
    if (cavidadesTotal) cavidadesTotal.addEventListener("input", function () {
      validarCavidades(false);
      limparErro();
    });

    const cavidadesAtivas = document.getElementById("cavidadesAtivas");
    if (cavidadesAtivas) cavidadesAtivas.addEventListener("input", function () {
      validarCavidades(false);
      limparErro();
    });

    const materiaPrima = document.getElementById("materiaPrima");
    if (materiaPrima) materiaPrima.addEventListener("input", limparErro);

    const overlay = document.getElementById("modalAbrirGrade");
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target.id === "modalAbrirGrade") fecharModal();
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") fecharModal();
    });
  }

  function onMoldeSelecionado(valor) {
    preencherDadosMolde(valor);
  }

  function onMaquinaSelecionada() {
    limparErro();
  }

  function mostrar() {
    const ti = document.getElementById("telaInicial");
    const tg = document.getElementById("telaGrade");
    if (ti) ti.style.display = "block";
    if (tg) tg.style.display = "none";
    window.scrollTo(0, 0);
  }

  function esconder() {
    const ti = document.getElementById("telaInicial");
    const tg = document.getElementById("telaGrade");
    if (ti) ti.style.display = "none";
    if (tg) tg.style.display = "";
  }

  function renderizar(cards) {
    const cont = document.getElementById("listaGrades");
    const vazio = document.getElementById("gradesVazio");
    const contador = document.getElementById("gradesContador");
    if (!cont) return;

    cont.innerHTML = "";
    const lista = cards || [];
    if (contador) {
      contador.textContent = lista.length === 1
        ? "1 grade ativa"
        : lista.length + " grades ativas";
      contador.classList.toggle("zero", lista.length === 0);
    }
    if (!lista.length) {
      if (vazio) vazio.style.display = "block";
      return;
    }
    if (vazio) vazio.style.display = "none";
    lista.forEach((c) => cont.appendChild(cardEl(c)));
  }

  function cardEl(c) {
    const card = document.createElement("article");
    card.className = "grade-card";
    card.dataset.id = c.id;
    card.setAttribute("tabindex", "0");

    const top = document.createElement("div");
    top.className = "gc-top";

    const molde = document.createElement("span");
    molde.className = "gc-molde";
    molde.textContent = "Molde " + c.moldeCodigo;

    const comDefeito = (c.defeitos || 0) > 0 || (c.vedadas || 0) > 0;
    if (comDefeito) card.classList.add("com-defeito");

    const status = document.createElement("span");
    status.className = "gc-status" + (comDefeito ? " com-defeito" : "");
    status.textContent = comDefeito ? "Com ocorrências" : "Ativa";

    top.appendChild(molde);
    top.appendChild(status);
    card.appendChild(top);

    const nome = document.createElement("div");
    nome.className = "gc-nome";
    nome.textContent = c.moldeNome || "";
    card.appendChild(nome);

    const chips = document.createElement("div");
    chips.className = "gc-chips";
    chips.appendChild(chipEl(c.maquina || "Máquina não informada", false));
    chips.appendChild(chipEl("Material: " + (c.material || "—"), true));
    card.appendChild(chips);

    const stats = document.createElement("div");
    stats.className = "gc-stats";
    stats.appendChild(statEl(c.ativas, "Ativas", ""));
    stats.appendChild(statEl(c.defeitos || 0, "Defeitos", "gc-def"));
    stats.appendChild(statEl(c.vedadas, "Vedadas", "gc-ved"));
    card.appendChild(stats);

    const abrir = document.createElement("div");
    abrir.className = "gc-abrir";

    const aberta = document.createElement("span");
    aberta.className = "gc-aberta";
    aberta.textContent = formatarData(c.abertaEm);
    abrir.appendChild(aberta);

    const acaoTxt = document.createElement("span");
    acaoTxt.textContent = "Abrir grade";
    const seta = document.createElement("span");
    seta.className = "gc-seta";
    seta.textContent = "›";
    acaoTxt.appendChild(seta);
    abrir.appendChild(acaoTxt);
    card.appendChild(abrir);

    const acao = () => { if (onAbrirGrade) onAbrirGrade(c.id); };
    card.addEventListener("click", acao);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); acao(); }
    });

    return card;
  }

  function chipEl(texto, muted) {
    const span = document.createElement("span");
    span.className = "gc-chip" + (muted ? " gc-chip-muted" : "");
    span.textContent = texto;
    return span;
  }

  function formatarData(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    try {
      return "Aberta em " + d.toLocaleDateString("pt-BR") + " · " +
        d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "Aberta em " + d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear();
    }
  }

  function statEl(valor, rotulo, classe) {
    const div = document.createElement("div");
    div.className = "gc-stat " + (classe || "");
    const num = document.createElement("span");
    num.className = "num";
    num.textContent = valor;
    const lbl = document.createElement("span");
    lbl.className = "lbl";
    lbl.textContent = rotulo;
    div.appendChild(num);
    div.appendChild(lbl);
    return div;
  }

  function hojeISO() {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mes + "-" + dia;
  }

  function acharDocumentoMolde(moldeId) {
    return (estado.moldes || []).find((m) => m.id === moldeId) || null;
  }

  function preencherDadosMolde(moldeId) {
    const totalEl = document.getElementById("cavidadesTotal");
    const activeEl = document.getElementById("cavidadesAtivas");
    const materialEl = document.getElementById("materiaPrima");
    if (!totalEl || !activeEl || !materialEl) return;

    const molde = moldeId ? acharDocumentoMolde(moldeId) : null;
    const list = molde && Array.isArray(molde.cavidades) ? molde.cavidades : [];
    const total = list.length;

    totalEl.value = total ? String(total) : "";
    activeEl.value = total ? String(total) : "";
    activeEl.max = total ? String(total) : "";
    materialEl.value = molde && molde.padroes && molde.padroes.material
      ? String(molde.padroes.material)
      : "";
    totalEl.removeAttribute("aria-invalid");
    activeEl.removeAttribute("aria-invalid");
    materialEl.removeAttribute("aria-invalid");
  }

  function lerDadosMolde() {
    const totalRaw = String((document.getElementById("cavidadesTotal") || {}).value || "").trim();
    const activeRaw = String((document.getElementById("cavidadesAtivas") || {}).value || "").trim();
    const material = String((document.getElementById("materiaPrima") || {}).value || "").trim();
    const total = /^\d+$/.test(totalRaw) ? parseInt(totalRaw, 10) : NaN;
    const ativas = /^\d+$/.test(activeRaw) ? parseInt(activeRaw, 10) : NaN;
    return { total, ativas, material: material };
  }

  function validarDadosMolde(mostrarErroAoFalhar) {
    const dados = lerDadosMolde();
    const totalEl = document.getElementById("cavidadesTotal");
    const activeEl = document.getElementById("cavidadesAtivas");
    const materialEl = document.getElementById("materiaPrima");
    [totalEl, activeEl, materialEl].forEach((el) => { if (el) el.setAttribute("aria-invalid", "true"); });

    let msg = "";
    if (!Number.isFinite(dados.total) || dados.total < 1) {
      msg = "Informe a quantidade total de cavidades no molde.";
    } else if (!Number.isFinite(dados.ativas) || dados.ativas < 0) {
      msg = "Informe a quantidade de cavidades ativas.";
    } else if (dados.ativas > dados.total) {
      msg = "As cavidades ativas não podem ser maiores que o total do molde.";
    } else if (!dados.material) {
      msg = "Informe a matéria-prima da grade.";
    }

    if (msg) {
      if (mostrarErroAoFalhar) mostrarErro(msg);
      return null;
    }
    if (totalEl) totalEl.removeAttribute("aria-invalid");
    if (activeEl) activeEl.removeAttribute("aria-invalid");
    if (materialEl) materialEl.removeAttribute("aria-invalid");
    return dados;
  }

  // Compatibilidade com a validação incremental dos campos numéricos.
  function validarCavidades(mostrarErroAoFalhar) {
    return !!validarDadosMolde(mostrarErroAoFalhar);
  }

  function abrirModal() {
    const overlay = document.getElementById("modalAbrirGrade");
    const buscaMolde = document.getElementById("selMoldeBusca");
    const buscaMaquina = document.getElementById("selMaquinaBusca");
    const dataAbertura = document.getElementById("dataAbertura");
    if (!overlay || !buscaMolde || !buscaMaquina || !dataAbertura) return;

    // --- Moldes cadastrados ---
    definirCombobox("molde",
      (estado.moldes || [])
        .slice()
        .sort((a, b) => compararId(a.codigo, b.codigo))
        .map((m) => ({
          valor: m.id,
          texto: "Molde " + m.codigo + " — " + (m.nomePeca || "") +
            " (" + (m.cavidades || []).length + " cav.)"
        })));

    // --- Máquinas cadastradas ---
    const maquinas = (CF.cfg && CF.cfg.listarMaquinas) ? CF.cfg.listarMaquinas() : [];
    definirCombobox("maquina", maquinas.map((nome) => ({ valor: nome, texto: nome })));

    // --- Dados de entrada do molde (totais, ativas e matéria-prima) ---
    preencherDadosMolde("");

    // --- Data: sempre a data de hoje, editável ---
    const hoje = hojeISO();
    dataAbertura.value = hoje;

    // --- Check-list de validação ---
    montarChecklist();

    // --- Controlador: preenche com o usuário logado ---
    preencherControladorLogado();

    limparErro();
    atualizarBotaoConfirmar();
    overlay.classList.add("active");
    buscaMolde.focus();
  }

  async function preencherControladorLogado() {
    const ctx = (document.body && document.body.dataset && document.body.dataset.context) || "/CustomFusionWeb";
    try {
      const resp = await fetch(ctx + "/api/usuario-atual");
      const dados = await resp.json().catch(() => ({}));
      const campo = document.getElementById("clControlador");
      if (!campo) return;
      const nome = dados && dados.nome ? String(dados.nome) : (dados && dados.login ? String(dados.login) : "");
      if (nome) {
        campo.value = nome;
      }
    } catch (e) {
      // Silencioso: se não houver backend, o campo continua editável manualmente
    }
  }

  const comboboxes = {};

  function normalizarBusca(valor) {
    return String(valor || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function registrarCombobox(nome, config) {
    const root = document.getElementById(config.rootId);
    const busca = document.getElementById(config.buscaId);
    const lista = document.getElementById(config.listaId);
    const toggle = document.getElementById(config.toggleId);
    const hidden = document.getElementById(config.hiddenId);
    if (!root || !busca || !lista || !toggle || !hidden) return;

    const combo = {
      nome: nome,
      root: root,
      busca: busca,
      lista: lista,
      toggle: toggle,
      hidden: hidden,
      itens: [],
      filtrados: [],
      ativo: -1,
      onChange: config.onChange || null,
      rotuloVazio: config.rotuloVazio,
      mensagemVazia: config.mensagemVazia
    };
    comboboxes[nome] = combo;

    busca.addEventListener("input", function () {
      combo.hidden.value = "";
      combo.root.classList.remove("is-invalid");
      filtrarCombobox(nome, busca.value);
      abrirCombobox(nome);

      const exato = acharItemExato(nome, busca.value);
      if (exato) {
        combo.hidden.value = exato.valor;
        if (combo.onChange) combo.onChange(exato.valor, exato, true);
      } else {
        atualizarBotaoConfirmar();
      }
    });

    busca.addEventListener("focus", function () {
      filtrarCombobox(nome, busca.value);
      abrirCombobox(nome);
    });

    busca.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        abrirCombobox(nome);
        moverItemAtivo(nome, e.key === "ArrowDown" ? 1 : -1);
      } else if (e.key === "Enter" && combo.ativo >= 0) {
        e.preventDefault();
        selecionarCombobox(nome, combo.ativo);
      } else if (e.key === "Escape") {
        fecharCombobox(nome);
      } else if (e.key === "Tab") {
        fecharCombobox(nome);
      }
    });

    toggle.addEventListener("click", function () {
      if (toggle.disabled) return;
      const aberto = !lista.hidden;
      if (aberto) {
        fecharCombobox(nome);
      } else {
        filtrarCombobox(nome, busca.value);
        abrirCombobox(nome);
        busca.focus();
      }
    });

    lista.addEventListener("click", function (e) {
      const item = e.target.closest(".combo-item");
      if (!item) return;
      selecionarCombobox(nome, Number(item.dataset.index));
    });

    document.addEventListener("pointerdown", function (e) {
      if (!root.contains(e.target)) fecharCombobox(nome);
    });
  }

  function definirCombobox(nome, opcoes) {
    const combo = comboboxes[nome];
    if (!combo) return;

    combo.itens = (opcoes || []).slice();
    combo.filtrados = combo.itens.slice();
    combo.ativo = -1;
    combo.busca.value = "";
    combo.hidden.value = "";
    combo.hidden.dataset.count = String(combo.itens.length);
    combo.root.classList.toggle("is-disabled", combo.itens.length === 0);
    combo.root.classList.remove("is-invalid");
    combo.busca.disabled = combo.itens.length === 0;
    combo.toggle.disabled = combo.itens.length === 0;
    combo.busca.placeholder = combo.itens.length ? combo.rotuloVazio : combo.mensagemVazia;
    fecharCombobox(nome);
    renderizarCombobox(nome);
  }

  function filtrarCombobox(nome, consulta) {
    const combo = comboboxes[nome];
    if (!combo) return;
    const busca = normalizarBusca(consulta);
    combo.filtrados = !busca
      ? combo.itens.slice()
      : combo.itens.filter((item) => normalizarBusca(item.texto).includes(busca));
    combo.ativo = -1;
    renderizarCombobox(nome);
  }

  function acharItemExato(nome, consulta) {
    const combo = comboboxes[nome];
    if (!combo) return null;
    const busca = normalizarBusca(consulta);
    if (!busca) return null;
    return combo.itens.find((item) => {
      return normalizarBusca(item.texto) === busca || normalizarBusca(item.valor) === busca;
    }) || null;
  }

  function selecionarValorCombobox(nome, valor) {
    const combo = comboboxes[nome];
    if (!combo) return false;
    const alvo = normalizarBusca(valor);
    const item = combo.itens.find((entry) => {
      return normalizarBusca(entry.valor) === alvo || normalizarBusca(entry.texto) === alvo;
    });
    if (!item) return false;
    combo.busca.value = item.texto;
    combo.hidden.value = item.valor;
    combo.root.classList.remove("is-invalid");
    return true;
  }

  function renderizarCombobox(nome) {
    const combo = comboboxes[nome];
    if (!combo) return;
    const lista = combo.lista;
    lista.innerHTML = "";

    if (!combo.filtrados.length) {
      const vazio = document.createElement("div");
      vazio.className = "combo-empty";
      vazio.textContent = combo.busca.value.trim()
        ? "Nenhum resultado para \"" + combo.busca.value.trim() + "\""
        : combo.mensagemVazia;
      lista.appendChild(vazio);
      return;
    }

    combo.filtrados.forEach((item, index) => {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "combo-item" + (index === combo.ativo ? " active" : "");
      botao.setAttribute("role", "option");
      botao.dataset.index = String(index);
      botao.textContent = item.texto;
      lista.appendChild(botao);
    });
  }

  function abrirCombobox(nome) {
    const combo = comboboxes[nome];
    if (!combo || combo.busca.disabled) return;
    combo.lista.hidden = false;
    combo.busca.setAttribute("aria-expanded", "true");
  }

  function fecharCombobox(nome) {
    const combo = comboboxes[nome];
    if (!combo) return;
    combo.lista.hidden = true;
    combo.ativo = -1;
    combo.busca.setAttribute("aria-expanded", "false");
    renderizarCombobox(nome);
  }

  function moverItemAtivo(nome, direcao) {
    const combo = comboboxes[nome];
    if (!combo || !combo.filtrados.length) return;
    combo.ativo = (combo.ativo + direcao + combo.filtrados.length) % combo.filtrados.length;
    renderizarCombobox(nome);
    const ativo = combo.lista.querySelector(".combo-item.active");
    if (ativo) ativo.scrollIntoView({ block: "nearest" });
  }

  function selecionarCombobox(nome, index) {
    const combo = comboboxes[nome];
    if (!combo) return;
    const item = combo.filtrados[index];
    if (!item) return;
    combo.busca.value = item.texto;
    combo.hidden.value = item.valor;
    combo.root.classList.remove("is-invalid");
    fecharCombobox(nome);
    if (combo.onChange) combo.onChange(item.valor, item, false);
    atualizarBotaoConfirmar();
  }

  function marcarComboErro(nome, invalido) {
    const combo = comboboxes[nome];
    if (combo) combo.root.classList.toggle("is-invalid", !!invalido);
  }

  function limparCombosErro() {
    Object.keys(comboboxes).forEach((nome) => marcarComboErro(nome, false));
  }

  function atualizarBotaoConfirmar() {
    const btn = document.getElementById("btnConfirmarAbrir");
    const selMolde = document.getElementById("selMolde");
    if (btn) btn.disabled = !selMolde || !selMolde.value;
    limparErro();
  }

  function mostrarErro(msg) {
    const erro = document.getElementById("abrirGradeErro");
    if (!erro) return;
    erro.textContent = msg;
    erro.style.display = "block";
  }

  function limparErro() {
    const erro = document.getElementById("abrirGradeErro");
    if (erro) {
      erro.textContent = "";
      erro.style.display = "none";
    }
    limparCombosErro();
  }

  const PONTOS_CHECKLIST = [
    "REBARBAS",
    "MANCHAS",
    "OUTROS ASPECTOS VISUAIS",
    "DIMENSIONAL",
    "ESTANQUEIDADE",
    "FUROS ANTIASFIXIANTES DESOBSTRUÍDOS"
  ];

  function montarChecklist() {
    const tabela = document.getElementById("clTabela");
    if (!tabela) return;
    tabela.innerHTML = "";
    const cab = document.createElement("div");
    cab.className = "cl-linha cl-cab";
    cab.innerHTML = '<span class="cl-ponto">PONTO VERIFICÁVEL</span>' +
      '<span class="cl-op">C</span><span class="cl-op">NC</span><span class="cl-op">NA</span>';
    tabela.appendChild(cab);
    PONTOS_CHECKLIST.forEach((ponto, idx) => {
      const linha = document.createElement("div");
      linha.className = "cl-linha";
      linha.innerHTML = '<span class="cl-ponto">' + ponto + '</span>' +
        '<label class="cl-op"><input type="radio" name="cl_' + idx + '" value="C"></label>' +
        '<label class="cl-op"><input type="radio" name="cl_' + idx + '" value="NC"></label>' +
        '<label class="cl-op"><input type="radio" name="cl_' + idx + '" value="NA"></label>';
      tabela.appendChild(linha);
    });
  }

  function coletarChecklist() {
    const pontos = {};
    PONTOS_CHECKLIST.forEach((ponto, idx) => {
      const sel = document.querySelector('input[name="cl_' + idx + '"]:checked');
      pontos[ponto] = sel ? sel.value : "";
    });
    return {
      situacao: (document.getElementById("clSituacao") || {}).value || "",
      pontos: pontos,
      controlador: (document.getElementById("clControlador") || {}).value || "",
      observacoes: (document.getElementById("clObservacoes") || {}).value || "",
      status: (document.getElementById("clStatus") || {}).value || ""
    };
  }

  function confirmarAbrir() {
    const selMolde = document.getElementById("selMolde");
    const selMaquina = document.getElementById("selMaquina");
    const buscaMolde = document.getElementById("selMoldeBusca");
    const buscaMaquina = document.getElementById("selMaquinaBusca");
    const dataAbertura = document.getElementById("dataAbertura");
    if (!selMolde || !selMaquina || !dataAbertura) return;

    const moldeId = selMolde.value;
    if (!moldeId) {
      marcarComboErro("molde", true);
      mostrarErro("Selecione o molde para abrir a grade.");
      if (buscaMolde) buscaMolde.focus();
      return;
    }
    marcarComboErro("molde", false);

    const maquina = selMaquina.value;
    const temMaquinas = Number(selMaquina.dataset.count || 0) > 0;
    if (temMaquinas && !maquina) {
      marcarComboErro("maquina", true);
      mostrarErro("Selecione a máquina utilizada neste molde.");
      if (buscaMaquina) buscaMaquina.focus();
      return;
    }
    marcarComboErro("maquina", false);

    const dadosMolde = validarDadosMolde(true);
    if (!dadosMolde) {
      const focusTarget = document.getElementById("cavidadesTotal") || document.getElementById("materiaPrima");
      if (focusTarget) focusTarget.focus();
      return;
    }

    const data = dataAbertura.value || hojeISO();

    fecharModal();
    if (onAbrirMolde) {
      onAbrirMolde(moldeId, {
        maquina: maquina,
        dataEntrada: data,
        cavidadesTotais: dadosMolde.total,
        cavidadesAtivas: dadosMolde.ativas,
        materiaPrima: dadosMolde.material,
        checklist: coletarChecklist()
      });
    }
  }

  function fecharModal() {
    const overlay = document.getElementById("modalAbrirGrade");
    if (overlay) overlay.classList.remove("active");
  }

  function abrirModalCadastro() {
    const overlay = document.getElementById("modalCadastrarMolde");
    if (!overlay) return;
    const err = document.getElementById("cadMoldeErro");
    if (err) { err.textContent = ""; err.style.display = "none"; }
    overlay.classList.add("active");
  }

  function fecharModalCadastro() {
    const overlay = document.getElementById("modalCadastrarMolde");
    if (overlay) overlay.classList.remove("active");
  }

  async function confirmarCadastro() {
    const err = document.getElementById("cadMoldeErro");
    const codigo = (document.getElementById("cadCodigo") || {}).value || "";
    const nomePeca = (document.getElementById("cadNomePeca") || {}).value || "";
    const familia = (document.getElementById("cadFamilia") || {}).value || "";
    const cavidades = parseInt((document.getElementById("cadCavidades") || {}).value || "0", 10);
    const material = (document.getElementById("cadMaterial") || {}).value || "";
    const maquina = (document.getElementById("cadMaquina") || {}).value || "";
    const cadFile = (document.getElementById("cadArquivoCad") || {}).files || [];
    const imgFile = (document.getElementById("cadImagem") || {}).files || [];

    if (!codigo.trim()) { mostrarErroCad("Informe o codigo do molde."); return; }
    if (!nomePeca.trim()) { mostrarErroCad("Informe o nome da peca."); return; }
    if (!cavidades || cavidades < 1) { mostrarErroCad("Informe a quantidade de cavidades."); return; }

    const fd = new FormData();
    fd.append("codigo", codigo.trim());
    fd.append("nomePeca", nomePeca.trim());
    fd.append("familia", familia.trim());
    fd.append("cavidades", String(cavidades));
    fd.append("material", material.trim());
    fd.append("maquina", maquina.trim());
    if (cadFile.length) fd.append("cadFile", cadFile[0]);
    if (imgFile.length) fd.append("imagem", imgFile[0]);

    const btn = document.getElementById("btnConfirmarCadMolde");
    if (btn) btn.disabled = true;
    try {
      const ctx = (document.body && document.body.dataset && document.body.dataset.context) || "/CustomFusionWeb";
      const resp = await fetch(ctx + "/api/moldes/cadastrar", { method: "POST", body: fd });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) {
        throw new Error(data.erro || ("HTTP " + resp.status));
      }
      fecharModalCadastro();
      resetarFormularioCadastro();

      try {
        if (!CF.cfg || !CF.cfg.recarregarCatalogo) {
          throw new Error("Rotina de recarga do catálogo não disponível.");
        }
        await CF.cfg.recarregarCatalogo();
        if (CF.cfg.recarregarMaquinas) await CF.cfg.recarregarMaquinas();
        if (CF.app && typeof CF.app.renderTelaInicial === "function") {
          await CF.app.renderTelaInicial();
        }
        alert("Molde " + codigo + " cadastrado e disponível em + ABRIR GRADE.");
      } catch (refreshError) {
        console.error("Molde cadastrado, mas o catálogo não foi recarregado:", refreshError);
        alert("Molde " + codigo + " cadastrado. Recarregue a página para atualizar a lista de moldes.");
      }
    } catch (e) {
      mostrarErroCad("Falha ao cadastrar: " + (e && e.message ? e.message : e));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function resetarFormularioCadastro() {
    const textoIds = ["cadCodigo", "cadNomePeca", "cadFamilia", "cadMaterial", "cadMaquina"];
    textoIds.forEach((id) => {
      const campo = document.getElementById(id);
      if (campo) campo.value = "";
    });

    const cavidades = document.getElementById("cadCavidades");
    if (cavidades) cavidades.value = "16";

    const cadFile = document.getElementById("cadArquivoCad");
    if (cadFile) cadFile.value = "";
    const imgFile = document.getElementById("cadImagem");
    if (imgFile) imgFile.value = "";

    const cadNome = document.getElementById("cadArquivoCadNome");
    if (cadNome) cadNome.textContent = "Selecionar arquivo STL";
    const imgNome = document.getElementById("cadImagemNome");
    if (imgNome) imgNome.textContent = "Selecionar imagem";

    const erro = document.getElementById("cadMoldeErro");
    if (erro) { erro.textContent = ""; erro.style.display = "none"; }
  }

  function mostrarErroCad(msg) {
    const err = document.getElementById("cadMoldeErro");
    if (!err) return;
    err.textContent = msg;
    err.style.display = "block";
  }

  CF.telaInicial = {
    init: init,
    mostrar: mostrar,
    esconder: esconder,
    renderizar: renderizar,
    abrirModal: abrirModal,
    fecharModal: fecharModal
  };

})(window.CF = window.CF || {});
