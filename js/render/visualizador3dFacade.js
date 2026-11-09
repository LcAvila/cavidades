"use strict";

/*
 * Fachada pública do visualizador 3D.
 *
 * Decide, na abertura, entre:
 *   - Autodesk Platform Services (quando configurado no backend);
 *   - viewer Three.js local (fallback offline/sem credenciais).
 *
 * A decisão é tomada por /api/aps/modelo?verificar=1, que NÃO envia o modelo
 * nem consome créditos: apenas informa se o APS está configurado.
 */
(function (CF) {

  var TTL_VERIFICACAO_MS = 30000;

  var verificacao = null;
  var ultimaVerificacao = 0;

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
      xhr.timeout = timeoutMs || 4000;

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
        reject(new Error("Falha de rede."));
      };
      xhr.ontimeout = function () {
        reject(new Error("Tempo esgotado."));
      };
      xhr.send();
    });
  }

  function codigoMolde(dados) {
    var estado = CF.estado && CF.estado.estado;
    var molde = (dados && dados.molde) || (estado && estado.molde);
    return String(
      (molde && molde.codigo) ||
      (estado && estado.dadosGrade && estado.dadosGrade.moldeNum) ||
      "168"
    ).trim().toUpperCase();
  }

  function infoModelo(dados) {
    var estado = CF.estado && CF.estado.estado;
    var molde = (dados && dados.molde) || (estado && estado.molde) || null;

    if (molde && CF.cfg && typeof CF.cfg.resolverModelo3d === "function") {
      var resolvido = CF.cfg.resolverModelo3d(molde);
      return {
        arquivo: resolvido.nomeArquivo,
        titulo: resolvido.titulo,
        subtitulo: resolvido.subtitulo,
        infoExtra: resolvido.infoExtra
      };
    }

    var cod = codigoMolde(dados);
    return {
      arquivo: "molde-" + cod + ".stl",
      titulo: "Desenho 3D da Peça — Molde " + cod,
      subtitulo: "Visualização técnica 3D",
      infoExtra: "Arquivo 3D: molde-" + cod + ".stl"
    };
  }

  function verificarAps(forcar) {
    var agora = Date.now();
    if (!forcar && verificacao && agora - ultimaVerificacao < TTL_VERIFICACAO_MS) {
      return verificacao;
    }

    ultimaVerificacao = agora;
    var info = infoModelo();

    verificacao = jsonGet(
      "api/aps/modelo?verificar=1&arquivo=" + encodeURIComponent(info.arquivo),
      4000
    ).then(function (dados) {
      return !!(dados && dados.configurado);
    }).catch(function () {
      // Sem sessão/backend: usa o viewer local.
      return false;
    });

    return verificacao;
  }

  async function abrirModal3D(dados) {
    var info = infoModelo(dados);

    // Prioriza o STL local quando o arquivo existe na pasta do projeto.
    // Basta colocar, por exemplo, src/main/webapp/assets/models/molde-117.stl.
    if (info.arquivo && CF.cfg && typeof CF.cfg.verificarArquivoModelo3d === "function") {
      try {
        if (await CF.cfg.verificarArquivoModelo3d(info.arquivo)) {
          CF.visualizador3dLocal.abrirModal3D(dados);
          return;
        }
      } catch (e) {
        // Ignora falha de verificação e tenta o APS/local abaixo.
      }
    }

    verificarAps(false).then(function (configurado) {
      if (configurado && CF.visualizador3dAps) {
        CF.visualizador3dAps.abrir(info);
      } else if (CF.visualizador3dLocal) {
        CF.visualizador3dLocal.abrirModal3D(dados);
      }
    });
  }

  function fecharModal3D() {
    if (CF.visualizador3dAps && CF.visualizador3dAps.estaAtivo()) {
      CF.visualizador3dAps.fechar();
    }
    if (CF.visualizador3dLocal) {
      CF.visualizador3dLocal.fecharModal3D();
    }
  }

  CF.visualizador3d = {
    init: function () {},
    abrirModal3D: abrirModal3D,
    fecharModal3D: fecharModal3D,

    irParaVista: function (numero, animar) {
      if (CF.visualizador3dLocal) {
        CF.visualizador3dLocal.irParaVista(numero, animar);
      }
    },

    ajustarAoModelo: function () {
      if (CF.visualizador3dAps && CF.visualizador3dAps.estaAtivo()) {
        CF.visualizador3dAps.ajustar();
      } else if (CF.visualizador3dLocal) {
        CF.visualizador3dLocal.ajustarAoModelo();
      }
    },

    ativarModoMedicao: function (modo) {
      if (CF.visualizador3dLocal) {
        CF.visualizador3dLocal.ativarModoMedicao(modo);
      }
    },

    limparMedicoes: function () {
      if (CF.visualizador3dAps && CF.visualizador3dAps.estaAtivo()) {
        CF.visualizador3dAps.limparMedicoes();
      } else if (CF.visualizador3dLocal) {
        CF.visualizador3dLocal.limparMedicoes();
      }
    },

    definirUnidade: function (unidade) {
      if (CF.visualizador3dAps && CF.visualizador3dAps.estaAtivo()) {
        CF.visualizador3dAps.definirUnidade(unidade);
      } else if (CF.visualizador3dLocal) {
        CF.visualizador3dLocal.definirUnidade(unidade);
      }
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      verificarAps(true);
    });
  } else {
    setTimeout(function () {
      verificarAps(true);
    }, 0);
  }

})(window.CF = window.CF || {});
