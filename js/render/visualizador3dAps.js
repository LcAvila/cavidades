"use strict";

/*
 * Visualizador 3D via Autodesk Platform Services (APS).
 *
 * O modelo STL é enviado/traduzido pelo backend (SVF2) e aberto aqui com o
 * Viewer oficial. A medição usa a extensão Autodesk.Measure (snap nativo em
 * vértice/aresta/face) com unidades mm/cm.
 *
 * Este arquivo é carregado apenas quando o APS está configurado; o viewer
 * Three.js continua disponível como fallback em visualizador3d.js.
 */
(function (CF) {

  var VERSAO_VIEWER = "7.100.0";
  var AMBIENTE = "AutodeskProduction2";
  var API = "streamingV2";
  var MAX_TENTATIVAS = 120;

  // A extensão Measure só suporta distância e ângulo em modelos 3D.
  // Área e arco são exclusivos de modelos 2D (PDF/DWF) no APS 7.100.
  var TIPOS = {
    distancia: 1, // MEASUREMENT_DISTANCE
    angulo: 2     // MEASUREMENT_ANGLE
  };

  var MODOS = {
    distancia: "distance",
    angulo: "angle"
  };

  var viewer = null;
  var extensao = null;
  var aberto = false;
  var sdk = null;
  var inicializacao = null;
  var infoAtual = null;
  var unidade = "mm";
  var precisao = 2;
  var modo = "distancia";
  var tentativas = 0;
  var sessao = 0;
  var listaAtual = [];

  // ============================================================ utilidades
  function el(id) {
    return document.getElementById(id);
  }

  function getContextPath() {
    var bodyCtx = document.body && document.body.dataset && document.body.dataset.context;
    return bodyCtx != null ? bodyCtx : "/CustomFusionWeb";
  }

  function urlApi(caminho) {
    var ctx = getContextPath();
    var limpo = String(caminho || "").replace(/^\/+/, "");
    return (ctx ? ctx + "/" : "/") + limpo;
  }

  function jsonGet(caminho, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", urlApi(caminho), true);
      xhr.setRequestHeader("Accept", "application/json");
      xhr.timeout = timeoutMs || 20000;

      xhr.onload = function () {
        var dados = {};
        try {
          dados = JSON.parse(xhr.responseText || "{}");
        } catch (e) {
          dados = {};
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(dados);
        } else {
          reject(new Error(dados.erro || dados.mensagem || ("HTTP " + xhr.status)));
        }
      };
      xhr.onerror = function () {
        reject(new Error("Falha de rede ao chamar o backend."));
      };
      xhr.ontimeout = function () {
        reject(new Error("Tempo esgotado ao chamar o backend."));
      };
      xhr.send();
    });
  }

  function esperar(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  /**
   * As medições do APS já vêm formatadas com a unidade corrente
   * (ex.: "12.34 mm", "45.00°"). Só normalizamos o separador decimal
   * para vírgula, respeitando pt-BR.
   */
  function textoDaMedida(item) {
    var texto = "";
    if (item.text && String(item.text).trim()) {
      texto = String(item.text).trim();
    } else if (item.type === "Angle" && item.angle) {
      texto = String(item.angle);
    } else if (item.distance) {
      texto = String(item.distance);
    }

    if (!texto) return "—";
    return texto.indexOf(",") >= 0 ? texto : texto.replace(/(\d)\.(\d)/, "$1,$2");
  }

  function etiquetaDaMedida(item) {
    return item.type === "Angle" ? "ÂNG" : "DIST";
  }

  // ============================================================ SDK / viewer
  function carregarSdk() {
    if (window.Autodesk && window.Autodesk.Viewing) {
      return Promise.resolve();
    }
    if (sdk) return sdk;

    sdk = new Promise(function (resolve, reject) {
      var base = "https://developer.api.autodesk.com/modelderivative/v2/viewers/"
        + VERSAO_VIEWER + "/";

      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = base + "style.min.css";
      document.head.appendChild(link);

      var script = document.createElement("script");
      script.src = base + "viewer3D.min.js";
      script.async = true;
      script.onload = function () {
        if (window.Autodesk && window.Autodesk.Viewing) {
          resolve();
        } else {
          reject(new Error("SDK do APS carregou sem Autodesk.Viewing."));
        }
      };
      script.onerror = function () {
        sdk = null;
        reject(new Error("Não foi possível carregar o SDK do APS (verifique a internet)."));
      };
      document.head.appendChild(script);
    });

    return sdk;
  }

  function inicializarAps() {
    if (inicializacao) return inicializacao;

    inicializacao = carregarSdk().then(function () {
      return new Promise(function (resolve, reject) {
        var concluido = false;
        var limite = setTimeout(function () {
          if (!concluido) {
            inicializacao = null;
            reject(new Error("Tempo esgotado ao inicializar o APS."));
          }
        }, 45000);

        function falhar(erro) {
          if (concluido) return;
          concluido = true;
          clearTimeout(limite);
          inicializacao = null;
          reject(erro);
        }

        try {
          window.Autodesk.Viewing.Initializer({
            env: AMBIENTE,
            api: API,
            getAccessToken: function (onTokenReady) {
              jsonGet("api/aps/token", 20000).then(function (dados) {
                if (!dados.accessToken) {
                  falhar(new Error(dados.erro || "Token do APS indisponível."));
                  return;
                }
                onTokenReady(dados.accessToken, dados.expiresIn || 1800);
              }).catch(falhar);
            }
          }, function () {
            if (concluido) return;
            concluido = true;
            clearTimeout(limite);
            resolve();
          });
        } catch (e) {
          falhar(e);
        }
      });
    });

    return inicializacao;
  }

  function garantirViewer() {
    if (viewer) return viewer;

    var container = el("m3dApsViewer");
    if (!container) throw new Error("Container do viewer APS não encontrado.");

    viewer = new window.Autodesk.Viewing.GuiViewer3D(container, {
      extensions: []
    });

    var codigo = viewer.start();
    if (codigo > 0) {
      throw new Error("Falha ao iniciar o WebGL do APS (código " + codigo + ").");
    }
    return viewer;
  }

  // ============================================================ carregamento
  function prepararModelo(arquivo, minhaSessao) {
    tentativas = 0;

    function cancelado() {
      return !aberto || sessao !== minhaSessao;
    }

    function passo() {
      tentativas += 1;
      return jsonGet("api/aps/modelo?arquivo=" + encodeURIComponent(arquivo), 120000)
        .then(function (dados) {
          if (cancelado()) throw new Error("cancelado");
          if (!dados.configurado) {
            throw new Error(dados.mensagem || "APS não configurado no servidor.");
          }
          if (dados.status === "ready" && dados.urn) {
            return dados.urn;
          }
          if (dados.status === "error") {
            throw new Error(dados.mensagem || dados.erro || "A tradução do modelo falhou.");
          }
          if (tentativas >= MAX_TENTATIVAS) {
            throw new Error("Tempo esgotado aguardando a tradução do modelo.");
          }
          mostrarOverlay(
            "Preparando modelo no APS",
            dados.mensagem || "Traduzindo o STL para SVF2...",
            dados.progresso
          );
          return esperar(2500).then(passo);
        });
    }

    return passo();
  }

  function carregarDocumento(urn, minhaSessao) {
    return new Promise(function (resolve, reject) {
      var v = garantirViewer();

      function cancelado() {
        return !aberto || sessao !== minhaSessao;
      }

      window.Autodesk.Viewing.Document.load(
        "urn:" + urn,
        function (doc) {
          if (cancelado()) {
            resolve();
            return;
          }
          var viewable = doc.getRoot().getDefaultGeometry();
          if (!viewable) {
            reject(new Error("O modelo não possui geometria 3D."));
            return;
          }

          v.loadDocumentNode(doc, viewable).then(function () {
            if (cancelado()) {
              resolve();
              return;
            }
            v.resize();
            v.fitToView(true);
            configurarMedicao().then(resolve).catch(function () {
              atualizarStatus("Modelo aberto, mas a medição não pôde ser ativada.", "erro");
              resolve();
            });
          }).catch(reject);
        },
        function (codigo, mensagem) {
          reject(new Error("Falha ao carregar o documento (" + codigo + "): " + mensagem));
        }
      );
    });
  }

  // ============================================================ medição
  function configurarMedicao() {
    if (extensao) {
      ativarModo(modo);
      aplicarUnidade();
      return Promise.resolve(extensao);
    }

    return viewer.loadExtension("Autodesk.Measure").then(function (ext) {
      extensao = ext;

      var eventos = window.Autodesk.Viewing.MeasureCommon.Events;
      viewer.addEventListener(eventos.MEASUREMENT_COMPLETED_EVENT, aoConcluirMedida);
      viewer.addEventListener(eventos.MEASUREMENT_CHANGED_EVENT, aoTrocarTipo);
      viewer.addEventListener(eventos.FINISHED_CALIBRATION, aoConcluirCalibracao);

      ativarModo(modo);
      aplicarUnidade();
      return ext;
    });
  }

  function aplicarUnidade() {
    precisao = unidade === "mm" ? 2 : 3;

    var precisaoTexto = el("m3dApsPrecisao");
    if (precisaoTexto) {
      precisaoTexto.textContent = unidade === "mm" ? "0,01 mm" : "0,001 cm";
    }

    if (extensao) {
      try {
        extensao.setUnits(unidade);
        extensao.setPrecision(precisao);
      } catch (e) {
        // Mantém a UI consistente mesmo se a extensão ainda não estiver pronta.
      }
    }

    atualizarLista();
  }

  function ativarModo(nome) {
    if (!TIPOS[nome]) return;
    modo = nome;

    if (!extensao) {
      atualizarStatus("Aguarde o modelo terminar de carregar.", "erro");
      return;
    }

    try {
      // activate("distance"|"angle") já seleciona a ferramenta correta.
      extensao.activate(MODOS[nome]);
    } catch (e) {
      atualizarStatus("Falha ao ativar a medição: " + e.message, "erro");
      return;
    }

    marcarModo();
    atualizarStatus(mensagemDoModo(nome), "ativo");
    atualizarLista();
  }

  function mensagemDoModo(nome) {
    if (nome === "angulo") {
      return "Clique em três pontos para medir o ângulo.";
    }
    return "Clique em dois pontos (vértice, aresta ou face) para medir a distância.";
  }

  function aoConcluirMedida() {
    atualizarLista();
    atualizarStatus("Medição concluída.", "ativo");
  }

  function aoTrocarTipo(evt) {
    var tipo = evt && evt.data && evt.data.type;
    if (!tipo) return;

    for (var nome in TIPOS) {
      if (TIPOS[nome] === tipo) {
        modo = nome;
        marcarModo();
        break;
      }
    }
  }

  function aoConcluirCalibracao(evt) {
    var unidades = evt && evt.units;
    if (unidades === "mm" || unidades === "cm") {
      unidade = unidades;
      marcarUnidade();
    }
    atualizarStatus("Escala calibrada. As medições foram recalculadas.", "ativo");
    ativarModo(modo || "distancia");
  }

  function nomeDaMedida(item) {
    return item.type === "Angle" ? "Ângulo" : "Distância";
  }

  function atualizarLista() {
    var lista = listaAtual;
    if (extensao && extensao.activeStatus) {
      try {
        lista = listaAtual = extensao.getMeasurementList(unidade, precisao) || [];
      } catch (e) {
        lista = listaAtual;
      }
    }

    var caixa = el("m3dApsLista");
    var contador = el("m3dApsContagem");
    var limpar = el("btnM3dApsLimpar");

    if (contador) contador.textContent = String(lista.length);
    if (limpar) limpar.disabled = lista.length === 0;
    if (!caixa) return;

    if (!lista.length) {
      caixa.innerHTML =
        '<div class="m3d-measure-empty">' +
        '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5">' +
        '<path d="M3 17.5 17.5 3M4.5 15.5l2 2M8 12l2 2M11.5 8.5l2 2M15 5l2 2"></path>' +
        '<path d="M15.5 15.5h5v5"></path>' +
        "</svg>" +
        "<strong>Nenhuma medição</strong>" +
        "<span>Escolha uma ferramenta e clique na peça.</span>" +
        "</div>";
      return;
    }

    var html = "";
    for (var i = 0; i < lista.length; i++) {
      var item = lista[i];
      html += '<div class="m3d-medida-item">';
      html += '<div class="m3d-medida-top">';
      html += '<span class="m3d-medida-tag">' + etiquetaDaMedida(item) + "</span>";
      html += '<span class="m3d-medida-nome">' + nomeDaMedida(item) + " " + (i + 1) + "</span>";
      html += "</div>";
      html += '<div class="m3d-medida-valor">' + textoDaMedida(item) + "</div>";
      html += '<div class="m3d-medida-sub">Snap APS · ' + unidade + "</div>";
      html += "</div>";
    }
    caixa.innerHTML = html;
  }

  function limparMedicoes() {
    if (!extensao) return;
    try {
      extensao.deleteMeasurements();
    } catch (e) {
      atualizarStatus("Falha ao limpar as medições: " + e.message, "erro");
      return;
    }
    listaAtual = [];
    atualizarLista();
    atualizarStatus("Medições removidas.", "ativo");
  }

  function calibrar() {
    if (!extensao) {
      atualizarStatus("Aguarde o modelo terminar de carregar.", "erro");
      return;
    }
    try {
      // "calibrate" ativa a ferramenta de calibração (2 cliques + medida real).
      extensao.activate("calibrate");
      marcarModo(true);
      atualizarStatus("Clique em dois pontos e informe a medida real para calibrar.", "ativo");
    } catch (e) {
      atualizarStatus("Falha ao abrir a calibração: " + e.message, "erro");
    }
  }

  /** Encerra medição ou calibração sem fechar o modal. */
  function encerrarMedicao() {
    if (!extensao) return;
    try {
      if (extensao.mode === "calibrate") {
        extensao.enableCalibrationTool(false);
      }
    } catch (e) {
      // ferramenta já inativa
    }
    try {
      extensao.deactivate();
    } catch (e) {
      // extensão já inativa
    }
    marcarModo(true);
  }

  function ajustar() {
    if (viewer) {
      viewer.fitToView(true);
    }
  }

  // ============================================================ UI
  function marcarModo(limpar) {
    document.querySelectorAll(".m3d-aps-mode-btn").forEach(function (btn) {
      var ativo = !limpar && btn.getAttribute("data-aps-mode") === modo;
      btn.classList.toggle("ativo", ativo);
      btn.setAttribute("aria-pressed", ativo ? "true" : "false");
    });
  }

  function marcarUnidade() {
    document.querySelectorAll(".m3d-aps-unit-btn").forEach(function (btn) {
      var ativo = btn.getAttribute("data-aps-unit") === unidade;
      btn.classList.toggle("ativo", ativo);
      btn.setAttribute("aria-pressed", ativo ? "true" : "false");
    });
  }

  function atualizarStatus(mensagem, tom) {
    var caixa = el("m3dApsStatus");
    var texto = el("m3dApsStatusTexto");
    if (texto) texto.textContent = mensagem;
    if (!caixa) return;
    caixa.classList.remove("ativo", "erro");
    if (tom === "ativo") caixa.classList.add("ativo");
    if (tom === "erro") caixa.classList.add("erro");
  }

  function mostrarOverlay(titulo, mensagem, progresso) {
    var overlay = el("m3dApsOverlay");
    if (!overlay) return;

    overlay.style.display = "flex";
    var tituloEl = el("m3dApsOverlayTitulo");
    var textoEl = el("m3dApsOverlayTexto");
    if (tituloEl) tituloEl.textContent = titulo;
    if (textoEl) textoEl.textContent = mensagem || "";

    var spinner = el("m3dApsSpinner");
    if (spinner) spinner.style.display = "";

    var barra = el("m3dApsProgresso");
    if (barra) {
      var pct = parseInt(String(progresso || "0").replace("%", ""), 10);
      barra.style.width = (isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0) + "%";
    }

    var fallback = overlay.querySelector(".m3d-aps-fallback");
    if (fallback) fallback.remove();
  }

  function esconderOverlay() {
    var overlay = el("m3dApsOverlay");
    if (overlay) overlay.style.display = "none";
  }

  function mostrarErro(mensagem) {
    mostrarOverlay("Não foi possível abrir o APS", mensagem, "0%");

    var spinner = el("m3dApsSpinner");
    if (spinner) spinner.style.display = "none";

    atualizarStatus(mensagem, "erro");

    var overlay = el("m3dApsOverlay");
    var card = overlay && overlay.querySelector(".m3d-aps-overlay-card");
    if (card && !card.querySelector(".m3d-aps-fallback")) {
      var botao = document.createElement("button");
      botao.type = "button";
      botao.className = "btn btn-secondary m3d-aps-fallback";
      botao.textContent = "ABRIR VIEWER LOCAL";
      botao.addEventListener("click", function () {
        fechar();
        if (CF.visualizador3dLocal) CF.visualizador3dLocal.abrirModal3D();
      });
      card.appendChild(botao);
    }
  }

  // ============================================================ ciclo de vida
  function abrir(novoInfo) {
    var overlay = el("modalPeca3DAps");
    if (!overlay) return;

    infoAtual = novoInfo || {};
    aberto = true;
    sessao += 1;
    var minhaSessao = sessao;

    overlay.classList.add("active");

    var titulo = el("modalPeca3DApsTitulo");
    if (titulo) {
      titulo.textContent = infoAtual.titulo || "Visualização 3D — Autodesk Platform Services";
    }
    var sub = el("modalPeca3DApsSub");
    if (sub) {
      sub.textContent = infoAtual.subtitulo || "Modelo traduzido e medido na nuvem Autodesk";
    }
    var chip = el("m3dApsChipArquivo");
    if (chip) {
      chip.textContent = String(infoAtual.arquivo || "STL").toUpperCase();
    }
    var origem = el("m3dApsInfoOrigem");
    if (origem) {
      origem.textContent = infoAtual.infoExtra
        || "Modelo STL traduzido para SVF2 no Autodesk Platform Services";
    }

    if (extensao) {
      try {
        extensao.deleteMeasurements();
      } catch (e) {
        // sem medições para limpar
      }
    }
    listaAtual = [];
    atualizarLista();
    atualizarStatus("Conectando ao APS...", "ativo");
    mostrarOverlay("Conectando ao Autodesk Platform Services", "Solicitando token...", "0%");

    inicializarAps()
      .then(function () {
        if (!aberto || sessao !== minhaSessao) return null;
        mostrarOverlay("Preparando modelo no APS", "Verificando tradução do STL...", "0%");
        return prepararModelo(infoAtual.arquivo, minhaSessao);
      })
      .then(function (urn) {
        if (!aberto || sessao !== minhaSessao || !urn) return null;
        mostrarOverlay("Carregando geometria", "Abrindo o modelo no viewer...", "100%");
        return carregarDocumento(urn, minhaSessao);
      })
      .then(function () {
        if (!aberto || sessao !== minhaSessao) return;
        esconderOverlay();
        atualizarStatus("Modelo carregado. Escolha uma ferramenta de medição.", "ativo");
        marcarModo();
        setTimeout(function () {
          if (aberto && sessao === minhaSessao && viewer) viewer.resize();
        }, 60);
      })
      .catch(function (erro) {
        if (!aberto || sessao !== minhaSessao) return;
        if (erro && erro.message === "cancelado") return;
        mostrarErro(erro && erro.message ? erro.message : "Falha ao abrir o APS.");
      });
  }

  function fechar() {
    aberto = false;
    sessao += 1;
    var overlay = el("modalPeca3DAps");
    if (overlay) overlay.classList.remove("active");

    encerrarMedicao();
  }

  function estaAtivo() {
    return aberto;
  }

  // ============================================================ eventos
  function onKeyDown(evt) {
    if (!aberto) return;

    var alvo = evt.target;
    var digitando = alvo && (
      alvo.tagName === "INPUT" ||
      alvo.tagName === "TEXTAREA" ||
      alvo.tagName === "SELECT" ||
      alvo.isContentEditable
    );
    if (digitando) return;

    if (evt.key === "Escape") {
      evt.preventDefault();
      evt.stopPropagation();

      if (extensao && extensao.activeStatus) {
        encerrarMedicao();
        atualizarStatus("Medição encerrada.", "ativo");
      } else {
        fechar();
      }
      return;
    }

    if (evt.ctrlKey || evt.metaKey || evt.altKey) return;

    if (evt.key === "m" || evt.key === "M") {
      evt.preventDefault();
      ativarModo(modo || "distancia");
      return;
    }

    if (evt.key === "f" || evt.key === "F") {
      evt.preventDefault();
      ajustar();
    }
  }

  function bindEventos() {
    var overlay = el("modalPeca3DAps");
    if (!overlay || overlay.dataset.m3dApsBound === "1") return;
    overlay.dataset.m3dApsBound = "1";

    var fecharTopo = el("btnFecharModal3DAps");
    if (fecharTopo) fecharTopo.addEventListener("click", fechar);

    var fecharRodape = el("btnFecharModal3DApsRodape");
    if (fecharRodape) fecharRodape.addEventListener("click", fechar);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) fechar();
    });

    document.querySelectorAll(".m3d-aps-unit-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        unidade = this.getAttribute("data-aps-unit") === "cm" ? "cm" : "mm";
        marcarUnidade();
        aplicarUnidade();
      });
    });

    document.querySelectorAll(".m3d-aps-mode-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        ativarModo(this.getAttribute("data-aps-mode"));
      });
    });

    var medir = el("btnM3dApsMedir");
    if (medir) {
      medir.addEventListener("click", function () {
        ativarModo(modo || "distancia");
      });
    }

    var calibrarBtn = el("btnM3dApsCalibrar");
    if (calibrarBtn) calibrarBtn.addEventListener("click", calibrar);

    var limparBtn = el("btnM3dApsLimpar");
    if (limparBtn) limparBtn.addEventListener("click", limparMedicoes);

    var fitBtn = el("btnM3dApsFit");
    if (fitBtn) fitBtn.addEventListener("click", ajustar);

    window.addEventListener("resize", function () {
      if (aberto && viewer) viewer.resize();
    });

    document.addEventListener("keydown", onKeyDown, true);
  }

  function init() {
    bindEventos();
    marcarUnidade();
    marcarModo();
    atualizarLista();
    atualizarStatus("Abra uma peça para carregar o modelo.", "ativo");
  }

  CF.visualizador3dAps = {
    init: init,
    abrir: abrir,
    fechar: fechar,
    estaAtivo: estaAtivo,
    ajustar: ajustar,
    limparMedicoes: limparMedicoes,
    definirUnidade: function (valor) {
      unidade = valor === "cm" ? "cm" : "mm";
      marcarUnidade();
      aplicarUnidade();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    setTimeout(init, 0);
  }

})(window.CF = window.CF || {});
