"use strict";

(function (CF) {

  // ============================================================ estado 3D
  var cena = null;
  var camera = null;
  var renderer = null;
  var controls = null;
  var objetoAtual = null;
  var malhaBordas = null;
  var planoCorte = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  var corteAtivo = false;
  var gradeSolo = null;
  var animacaoId = null;
  var autoGirar = false;
  var faceSelecionadaNormal = null;
  var raioEsfera = 25;
  var centroModelo = null;
  var modeloCarregadoUrl = null;
  var animandoCamera = false;
  var inicializado = false;

  // ============================================================ estado medição
  var grupoMedicoes = null;
  var grupoPreview = null;
  var linhaPreview = null;
  var marcadoresPendentes = [];
  var verticesMundo = [];
  var modoMedicao = null;
  var unidadeMedicao = "mm";
  var pontosPendentes = [];
  var snapAtual = null;
  var medidas = [];
  var contadorMedidas = 0;
  var calloutInfo = null;
  var raycaster = null;
  var mouseNDC = null;
  var ponteiroDown = null;
  var ultimoEventoPonteiro = null;
  var snapAgendado = false;
  var vetorProjecao = null;
  var viewportLargura = 0;
  var viewportAltura = 0;

  // materiais compartilhados (evitam lixo a cada medição)
  var matMarcador = null;
  var matLinha = null;
  var matLinhaTracejada = null;

  var VISTAS = {
    1: { nome: "Frontal", atalho: "Ctrl+1", dir: [0, 0, 1], up: [0, 1, 0] },
    2: { nome: "Posterior", atalho: "Ctrl+2", dir: [0, 0, -1], up: [0, 1, 0] },
    3: { nome: "Lateral Esquerda", atalho: "Ctrl+3", dir: [-1, 0, 0], up: [0, 1, 0] },
    4: { nome: "Lateral Direita", atalho: "Ctrl+4", dir: [1, 0, 0], up: [0, 1, 0] },
    5: { nome: "Superior", atalho: "Ctrl+5", dir: [0, 1, 0], up: [0, 0, -1] },
    6: { nome: "Inferior", atalho: "Ctrl+6", dir: [0, -1, 0], up: [0, 0, 1] },
    7: { nome: "Perspectiva Isométrica", atalho: "Ctrl+7", dir: [0.7071, 0.7071, 0.7071], up: [0, 1, 0] },
    8: { nome: "Normal a Face / Alinhada", atalho: "Ctrl+8", dir: [0, 0, 1], up: [0, 1, 0] }
  };

  var NOMES_MEDICAO = {
    distancia: "Distância",
    angulo: "Ângulo",
    diametro: "Diâmetro",
    caixa: "Caixa envolvente"
  };

  var TAGS_MEDICAO = {
    distancia: "DIST",
    angulo: "ÂNG",
    diametro: "Ø",
    caixa: "CAIXA"
  };

  function el(id) {
    return document.getElementById(id);
  }

  function getContextPath() {
    var bodyCtx = document.body && document.body.dataset && document.body.dataset.context;
    return bodyCtx != null ? bodyCtx : "/CustomFusionWeb";
  }

  function resolverUrl(rel) {
    if (CF.cfg && typeof CF.cfg.urlRecurso === "function") {
      return CF.cfg.urlRecurso(rel);
    }
    var ctx = getContextPath();
    var limpo = String(rel || "").replace(/^\/+/, "");
    return (ctx ? ctx + "/" : "/") + limpo;
  }

  // A fachada (visualizador3dFacade.js) decide entre APS e este viewer local.
  function abrirPeloMenu() {
    var api = CF.visualizador3d || CF.visualizador3dLocal;
    if (api && typeof api.abrirModal3D === "function") {
      api.abrirModal3D();
    }
  }

  // ============================================================ geometria
  function criarGeometriaConexaoProcedural() {
    // Perfil técnico exato do corte da Conexão Esferográfica (REV05 - 23.05.01-06)
    // Coordenadas (Raio X, Altura Y ao longo do eixo de revolução), em milímetros:
    var pontos = [
      new THREE.Vector2(1.5, -7.6),   // Furo frontal do bocal
      new THREE.Vector2(2.4, -7.6),   // Face externa frontal do bocal
      new THREE.Vector2(2.5, -7.1),   // Início do cone externo
      new THREE.Vector2(4.1, -0.1),   // Fim do cone / corpo cilíndrico externo
      new THREE.Vector2(4.1, 6.2),    // Parede cilíndrica externa
      new THREE.Vector2(4.7, 6.6),    // Degrau do flange/batente traseiro
      new THREE.Vector2(4.7, 7.6),    // Borda do flange traseiro
      new THREE.Vector2(4.2, 7.6),    // Face traseira da saia
      new THREE.Vector2(4.2, 6.4),    // Rebaixo da saia
      new THREE.Vector2(3.7, 6.2),    // Parede externa da câmara anular
      new THREE.Vector2(3.7, -2.4),   // Fundo da câmara anular
      new THREE.Vector2(2.1, -2.4),   // Raiz do pino/tubo central interno
      new THREE.Vector2(2.1, 4.9),    // Comprimento do tubo central estendendo para trás
      new THREE.Vector2(1.3, 4.9),    // Face da borda do tubo central
      new THREE.Vector2(1.3, -1.1),   // Furo passante interno
      new THREE.Vector2(1.6, -1.6),   // Câmara frontal interna
      new THREE.Vector2(1.5, -7.6)    // Fechamento no bocal
    ];

    var geom = new THREE.LatheGeometry(pontos, 64);
    geom.computeVertexNormals();
    geom.center();
    return geom;
  }

  // ============================================================ cena
  function inicializarThree() {
    if (cena) return true;
    if (typeof THREE === "undefined") {
      console.warn("Biblioteca Three.js não encontrada.");
      return false;
    }

    var container = el("m3dViewport");
    if (!container) return false;

    var largura = container.clientWidth || 800;
    var altura = container.clientHeight || 450;

    cena = new THREE.Scene();
    cena.background = new THREE.Color(0xd6dae0);

    camera = new THREE.PerspectiveCamera(45, largura / altura, 0.1, 2000);
    camera.position.set(35, 35, 35);
    camera.up.set(0, 1, 0);

    renderer = new THREE.WebGLRenderer({
      canvas: el("m3dCanvas"),
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      localClippingEnabled: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(largura, altura, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputEncoding = THREE.sRGBEncoding;

    if (typeof THREE.OrbitControls === "function") {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.rotateSpeed = 0.8;
      controls.zoomSpeed = 1.0;
      controls.panSpeed = 0.8;
      controls.screenSpacePanning = true;
      controls.target.set(0, 0, 0);
    }

    // Iluminação com mais contraste (menos "tudo branco")
    cena.add(new THREE.AmbientLight(0xffffff, 0.32));
    cena.add(new THREE.HemisphereLight(0xeaf0f8, 0x9aa3b2, 0.35));

    var luzDir1 = new THREE.DirectionalLight(0xffffff, 1.05);
    luzDir1.position.set(60, 90, 70);
    cena.add(luzDir1);

    var luzDir2 = new THREE.DirectionalLight(0xffffff, 0.35);
    luzDir2.position.set(-70, -20, -60);
    cena.add(luzDir2);

    var luzRim = new THREE.DirectionalLight(0xffffff, 0.5);
    luzRim.position.set(0, 40, -90);
    cena.add(luzRim);

    gradeSolo = new THREE.GridHelper(80, 40, 0xa0a0a0, 0xd8d8d8);
    gradeSolo.position.y = -10;
    cena.add(gradeSolo);

    grupoMedicoes = new THREE.Group();
    grupoMedicoes.name = "medicoes";
    cena.add(grupoMedicoes);

    grupoPreview = new THREE.Group();
    grupoPreview.name = "medicao-preview";
    cena.add(grupoPreview);

    matMarcador = new THREE.MeshBasicMaterial({ color: 0x1976a8 });
    matLinha = new THREE.LineBasicMaterial({ color: 0x1976a8 });
    matLinhaTracejada = new THREE.LineDashedMaterial({
      color: 0x1976a8,
      dashSize: 0.5,
      gapSize: 0.32
    });

    raycaster = new THREE.Raycaster();
    mouseNDC = new THREE.Vector2();
    vetorProjecao = new THREE.Vector3();

    configurarInteracao();
    iniciarLoop();

    return true;
  }

  function iniciarLoop() {
    if (animacaoId) cancelAnimationFrame(animacaoId);

    function loop() {
      animacaoId = requestAnimationFrame(loop);

      if (autoGirar && controls && !animandoCamera) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 2.0;
      } else if (controls) {
        controls.autoRotate = false;
      }

      if (controls) controls.update();
      if (renderer && cena && camera) {
        renderer.render(cena, camera);
        posicionarCallout();
      }
    }

    loop();
  }

  // ============================================================ interação
  function configurarInteracao() {
    var canvas = renderer.domElement;

    canvas.addEventListener("pointerdown", function (evt) {
      if (evt.button !== 0) return;
      ponteiroDown = { x: evt.clientX, y: evt.clientY };
    });

    canvas.addEventListener("pointermove", function (evt) {
      ultimoEventoPonteiro = { clientX: evt.clientX, clientY: evt.clientY, altKey: evt.altKey };
      if (!modoMedicao || !objetoAtual) return;
      if (snapAgendado) return;
      snapAgendado = true;
      requestAnimationFrame(function () {
        snapAgendado = false;
        if (!ultimoEventoPonteiro || !modoMedicao) return;
        processarSnapPonteiro(ultimoEventoPonteiro);
      });
    });

    canvas.addEventListener("pointerup", function (evt) {
      if (evt.button !== 0) return;

      var arrastou = false;
      if (ponteiroDown) {
        var dx = evt.clientX - ponteiroDown.x;
        var dy = evt.clientY - ponteiroDown.y;
        arrastou = Math.sqrt(dx * dx + dy * dy) > 6;
      }
      ponteiroDown = null;

      if (!objetoAtual || arrastou) return;

      if (modoMedicao && modoMedicao !== "caixa") {
        var snap = processarSnapPonteiro(evt);
        if (snap) adicionarPontoMedicao(snap.ponto);
        return;
      }

      if (!modoMedicao) selecionarFace(evt);
    });

    canvas.addEventListener("pointerleave", function () {
      ultimoEventoPonteiro = null;
      snapAtual = null;
      esconderTagSnap();
      esconderLinhaPreview();
      if (calloutInfo && calloutInfo.tipo === "preview") {
        calloutInfo = null;
        atualizarCalloutTexto();
      }
    });
  }

  function selecionarFace(evt) {
    if (!objetoAtual || !raycaster) return;
    var rect = renderer.domElement.getBoundingClientRect();
    mouseNDC.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouseNDC, camera);
    var intersects = raycaster.intersectObject(objetoAtual, false);

    if (intersects.length > 0 && intersects[0].face) {
      var hit = intersects[0];
      var normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
      faceSelecionadaNormal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
      atualizarIndicadorVista("Face selecionada (Ctrl+8 alinha a vista)");
    }
  }

  function processarSnapPonteiro(evt) {
    if (!objetoAtual || !raycaster || !renderer) return null;

    var rect = renderer.domElement.getBoundingClientRect();
    mouseNDC.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouseNDC, camera);
    var hits = raycaster.intersectObject(objetoAtual, false);

    if (!hits.length) {
      snapAtual = null;
      esconderTagSnap();
      esconderLinhaPreview();
      if (calloutInfo && calloutInfo.tipo === "preview") {
        calloutInfo = null;
        atualizarCalloutTexto();
      }
      return null;
    }

    snapAtual = calcularSnap(hits[0], evt, rect);
    atualizarTagSnap(snapAtual, evt, rect);
    atualizarPreviewMedicao();
    return snapAtual;
  }

  function calcularSnap(hit, evt, rect) {
    var px = evt.clientX - rect.left;
    var py = evt.clientY - rect.top;

    // Alt força a medição no ponto exato da face, sem snap
    if (!evt.altKey) {
      // 1) Vértice mais próximo em tela (snap exato)
      var melhorVertice = null;
      var melhorDistVertice = 11;
      var p = vetorProjecao;

      for (var i = 0; i < verticesMundo.length; i++) {
        p.copy(verticesMundo[i]).project(camera);
        if (p.z < -1 || p.z > 1) continue;

        var sx = (p.x * 0.5 + 0.5) * rect.width;
        var sy = (-p.y * 0.5 + 0.5) * rect.height;
        var d = Math.sqrt((sx - px) * (sx - px) + (sy - py) * (sy - py));

        if (d < melhorDistVertice) {
          melhorDistVertice = d;
          melhorVertice = verticesMundo[i];
        }
      }

      if (melhorVertice) {
        // Ignora vértices escondidos atrás da peça: o primeiro acerto do raio
        // até o vértice precisa coincidir com a distância dele à câmera.
        var projVertice = melhorVertice.clone().project(camera);
        mouseNDC.set(projVertice.x, projVertice.y);
        raycaster.setFromCamera(mouseNDC, camera);
        var hitsVertice = raycaster.intersectObject(objetoAtual, false);
        var distanciaVertice = camera.position.distanceTo(melhorVertice);
        var toleranciaVertice = Math.max(0.05, raioEsfera * 0.01);
        var verticeVisivel = !hitsVertice.length ||
          Math.abs(hitsVertice[0].distance - distanciaVertice) <= toleranciaVertice;

        if (verticeVisivel) {
          return { ponto: melhorVertice.clone(), tipo: "vertice" };
        }
      }
    }

    // 2) Aresta mais próxima do triângulo atingido
    if (!evt.altKey && hit.face) {
      var pos = objetoAtual.geometry.attributes.position;
      var ids = [hit.face.a, hit.face.b, hit.face.c];
      var pares = [[0, 1], [1, 2], [2, 0]];
      var melhorAresta = null;
      var melhorDistAresta = 9;

      for (var j = 0; j < 3; j++) {
        var ia = ids[pares[j][0]];
        var ib = ids[pares[j][1]];
        var a = new THREE.Vector3().fromBufferAttribute(pos, ia).applyMatrix4(objetoAtual.matrixWorld);
        var b = new THREE.Vector3().fromBufferAttribute(pos, ib).applyMatrix4(objetoAtual.matrixWorld);

        var pa = a.clone().project(camera);
        var pb = b.clone().project(camera);
        if (pa.z < -1 || pa.z > 1 || pb.z < -1 || pb.z > 1) continue;

        var ax = (pa.x * 0.5 + 0.5) * rect.width;
        var ay = (-pa.y * 0.5 + 0.5) * rect.height;
        var bx = (pb.x * 0.5 + 0.5) * rect.width;
        var by = (-pb.y * 0.5 + 0.5) * rect.height;

        var seg = pontoSegmento2D(px, py, ax, ay, bx, by);
        if (seg.dist < melhorDistAresta) {
          melhorDistAresta = seg.dist;
          melhorAresta = a.clone().lerp(b, seg.t);
        }
      }

      if (melhorAresta) {
        return { ponto: melhorAresta, tipo: "aresta" };
      }
    }

    // 3) Ponto exato sobre a face
    return { ponto: hit.point.clone(), tipo: "face" };
  }

  function pontoSegmento2D(px, py, ax, ay, bx, by) {
    var dx = bx - ax;
    var dy = by - ay;
    var len2 = dx * dx + dy * dy;
    var t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    var cx = ax + dx * t;
    var cy = ay + dy * t;
    return { t: t, dist: Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy)) };
  }

  function reconstruirCacheVertices() {
    verticesMundo = [];
    if (!objetoAtual) return;

    objetoAtual.updateMatrixWorld(true);
    var pos = objetoAtual.geometry.attributes.position;
    if (!pos) return;

    var passo = Math.max(1, Math.floor(pos.count / 20000));
    var mapa = {};
    var v = new THREE.Vector3();

    for (var i = 0; i < pos.count; i += passo) {
      v.fromBufferAttribute(pos, i).applyMatrix4(objetoAtual.matrixWorld);
      var chave = Math.round(v.x * 1000) + "_" + Math.round(v.y * 1000) + "_" + Math.round(v.z * 1000);
      if (!mapa[chave]) {
        mapa[chave] = 1;
        verticesMundo.push(v.clone());
      }
    }
  }

  // ============================================================ medição — UI
  function configurarBotoesMedicao() {
    document.querySelectorAll("[data-measure-mode]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        ativarModoMedicao(this.dataset.measureMode);
      });
    });

    document.querySelectorAll("[data-unit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        definirUnidade(this.dataset.unit);
      });
    });

    var btnLimpar = el("btnM3dLimparMedicoes");
    if (btnLimpar) {
      btnLimpar.addEventListener("click", limparMedicoes);
    }

    var btnMedir = el("btnM3dMedir");
    if (btnMedir) {
      btnMedir.addEventListener("click", function () {
        ativarModoMedicao(modoMedicao === "distancia" ? null : "distancia");
      });
    }

    var lista = el("m3dMeasureList");
    if (lista) {
      lista.addEventListener("click", function (evt) {
        var alvo = evt.target;
        while (alvo && alvo !== lista) {
          if (alvo.dataset && alvo.dataset.delMedida) {
            removerMedida(parseInt(alvo.dataset.delMedida, 10));
            return;
          }
          alvo = alvo.parentNode;
        }
      });
    }

    atualizarListaMedicoes();
    atualizarBotoesModo();
    atualizarStatusModo();
  }

  function ativarModoMedicao(modo) {
    if (modo === "caixa") {
      if (modoMedicao) desativarMedicao();
      medirCaixaEnvolvente();
      return;
    }

    if (modoMedicao === modo) {
      desativarMedicao();
      return;
    }

    modoMedicao = modo || null;
    limparPendentes();
    autoGirar = false;

    var btnGirar = el("btnM3dGirar");
    if (btnGirar) btnGirar.classList.remove("ativo");

    atualizarBotoesModo();
    atualizarStatusModo();
    atualizarHudMedicao();
    atualizarHintRodape();
    atualizarCursorCanvas();
  }

  function desativarMedicao(silencioso) {
    modoMedicao = null;
    limparPendentes();
    esconderTagSnap();
    esconderLinhaPreview();

    if (calloutInfo && calloutInfo.tipo === "preview") calloutInfo = null;

    atualizarBotoesModo();
    atualizarHudMedicao();
    atualizarCursorCanvas();

    if (!silencioso) {
      atualizarStatusModo();
      atualizarHintRodape();
    }
  }

  function definirUnidade(unidade) {
    unidadeMedicao = unidade === "cm" ? "cm" : "mm";

    document.querySelectorAll("[data-unit]").forEach(function (btn) {
      var ativo = btn.dataset.unit === unidadeMedicao;
      btn.classList.toggle("ativo", ativo);
      btn.setAttribute("aria-pressed", ativo ? "true" : "false");
    });

    var precisao = el("m3dPrecisaoTexto");
    if (precisao) {
      precisao.textContent = unidadeMedicao === "cm" ? "0,001 cm" : "0,01 mm";
    }

    atualizarListaMedicoes();
    atualizarStatusModo();
    atualizarHudMedicao();

    if (calloutInfo && calloutInfo.tipo === "medida") {
      var medidaAtual = obterMedidaPorId(calloutInfo.medidaId);
      if (medidaAtual) {
        atualizarCalloutDaMedida(medidaAtual);
      } else {
        calloutInfo = null;
        atualizarCalloutTexto();
      }
    } else if (calloutInfo && calloutInfo.tipo === "preview") {
      calloutInfo = null;
      atualizarCalloutTexto();
    }
  }

  function atualizarBotoesModo() {
    document.querySelectorAll("[data-measure-mode]").forEach(function (btn) {
      var ativo = btn.dataset.measureMode === modoMedicao;
      btn.classList.toggle("ativo", ativo);
      btn.setAttribute("aria-pressed", ativo ? "true" : "false");
    });

    var btnMedir = el("btnM3dMedir");
    if (btnMedir) {
      btnMedir.classList.toggle("ativo", !!modoMedicao);
      btnMedir.setAttribute("aria-pressed", modoMedicao ? "true" : "false");
    }
  }

  function atualizarCursorCanvas() {
    if (renderer && renderer.domElement) {
      renderer.domElement.style.cursor = modoMedicao ? "crosshair" : "";
    }
  }

  function atualizarHintRodape() {
    var hint = el("m3dHintRow");
    var hud = el("m3dHudHint");

    if (modoMedicao) {
      if (hint) {
        hint.innerHTML = "Medição ativa: clique na peça para marcar pontos. Segure <code>Alt</code> para um ponto livre, arraste para girar e use <code>Esc</code> para sair da ferramenta.";
      }
      if (hud) {
        hud.textContent = "Clique: marcar ponto · Arraste: girar · Scroll: zoom";
      }
      return;
    }

    if (hint) {
      hint.innerHTML = "Dica: clique em uma face e use <code>Ctrl + 8</code> para alinhar a vista. Pressione <code>M</code> para medir.";
    }
    if (hud) {
      hud.textContent = "Arraste: girar · Botão direito: pan · Scroll: zoom";
    }
  }

  function atualizarStatusModo(mensagemPersonalizada, tom) {
    var status = el("m3dMeasureStatus");
    var texto = el("m3dMeasureStatusText");
    if (!status || !texto) return;

    var msg = mensagemPersonalizada;
    if (!msg) {
      if (!modoMedicao) {
        msg = "Selecione uma ferramenta de medição para começar.";
      } else if (modoMedicao === "distancia") {
        msg = pontosPendentes.length === 0
          ? "Clique no primeiro ponto da distância."
          : "Clique no segundo ponto para concluir a distância.";
      } else if (modoMedicao === "angulo") {
        if (pontosPendentes.length === 0) msg = "Clique no primeiro ponto do ângulo.";
        else if (pontosPendentes.length === 1) msg = "Clique no vértice do ângulo (ponto 2).";
        else msg = "Clique no terceiro ponto para fechar o ângulo.";
      } else if (modoMedicao === "diametro") {
        if (pontosPendentes.length === 0) msg = "Clique no primeiro ponto da circunferência.";
        else if (pontosPendentes.length === 1) msg = "Clique no segundo ponto da mesma circunferência.";
        else msg = "Clique no terceiro ponto para calcular o diâmetro.";
      } else {
        msg = "Selecione uma ferramenta de medição para começar.";
      }
    }

    status.className = "m3d-measure-status" + (tom ? " " + tom : "");
    texto.textContent = msg;
  }

  function atualizarHudMedicao() {
    var hud = el("m3dHudMeasure");
    var texto = el("m3dHudMeasureText");
    if (!hud || !texto) return;

    if (!modoMedicao) {
      hud.style.display = "none";
      return;
    }

    var total = modoMedicao === "distancia" ? 2 : 3;
    var atual = Math.min(pontosPendentes.length + 1, total);
    var dicas = {
      distancia: ["selecione a origem", "selecione o destino"],
      angulo: ["selecione o ponto 1", "selecione o vértice", "selecione o ponto 3"],
      diametro: ["selecione o ponto 1", "selecione o ponto 2", "selecione o ponto 3"]
    };
    var dica = (dicas[modoMedicao] || [""])[Math.min(atual - 1, total - 1)] || "";

    hud.style.display = "inline-flex";
    texto.textContent = "PONTO " + atual + " DE " + total + " · " + dica;
  }

  function atualizarTagSnap(snap, evt, rect) {
    var tag = el("m3dSnapTag");
    if (!tag) return;

    if (!snap || !modoMedicao) {
      esconderTagSnap();
      return;
    }

    var nomes = { vertice: "VÉRTICE", aresta: "ARESTA", face: "FACE" };
    tag.textContent = nomes[snap.tipo] || "PONTO";
    tag.className = "m3d-cursor-tag m3d-cursor-tag-" + snap.tipo;
    tag.style.display = "inline-flex";

    var x = evt.clientX - rect.left + 14;
    var y = evt.clientY - rect.top + 16;
    var larguraTag = tag.offsetWidth || 60;
    if (x + larguraTag > rect.width - 8) x = rect.width - larguraTag - 8;
    if (y + 24 > rect.height - 8) y = evt.clientY - rect.top - 26;

    tag.style.left = Math.max(4, x) + "px";
    tag.style.top = Math.max(4, y) + "px";
  }

  function esconderTagSnap() {
    var tag = el("m3dSnapTag");
    if (tag) tag.style.display = "none";
  }

  // ============================================================ medição — pontos
  function adicionarPontoMedicao(ponto) {
    if (!modoMedicao || modoMedicao === "caixa") return;

    for (var i = 0; i < pontosPendentes.length; i++) {
      if (pontosPendentes[i].distanceTo(ponto) < 0.0005) {
        atualizarStatusModo("Selecione um ponto diferente dos já marcados.", "erro");
        return;
      }
    }

    pontosPendentes.push(ponto.clone());
    adicionarMarcadorPendente(ponto);
    snapAtual = null;
    ultimoEventoPonteiro = null;
    esconderLinhaPreview();

    var total = modoMedicao === "distancia" ? 2 : 3;
    if (pontosPendentes.length >= total) {
      finalizarMedida();
      return;
    }

    atualizarStatusModo();
    atualizarHudMedicao();
    atualizarPreviewMedicao();
  }

  function finalizarMedida() {
    if (!pontosPendentes.length || !grupoMedicoes) return;

    var tipo = modoMedicao;
    var pontos = pontosPendentes.slice();
    var id = ++contadorMedidas;
    var grupo = new THREE.Group();
    var dados = { id: id, tipo: tipo, pontos: pontos, grupo: grupo };
    var mensagem = "";

    if (tipo === "distancia") {
      var distancia = pontos[0].distanceTo(pontos[1]);
      dados.valorMm = distancia;
      dados.delta = {
        x: Math.abs(pontos[1].x - pontos[0].x),
        y: Math.abs(pontos[1].y - pontos[0].y),
        z: Math.abs(pontos[1].z - pontos[0].z)
      };
      grupo.add(criarLinha([pontos[0], pontos[1]], false));
      grupo.add(criarMarcador(pontos[0]));
      grupo.add(criarMarcador(pontos[1]));
      dados.centro = pontos[0].clone().add(pontos[1]).multiplyScalar(0.5);
      mensagem = "Distância registrada: " + formatarMm(distancia) + ".";
    } else if (tipo === "angulo") {
      var angulo = calcularAngulo(pontos[0], pontos[1], pontos[2]);
      if (angulo == null) {
        definirStatus("Não foi possível calcular o ângulo. Escolha três pontos distintos.", "erro");
        limparPendentes();
        atualizarHudMedicao();
        return;
      }
      dados.valorGraus = angulo;
      grupo.add(criarLinha([pontos[0], pontos[1]], false));
      grupo.add(criarLinha([pontos[1], pontos[2]], false));
      grupo.add(criarMarcador(pontos[0]));
      grupo.add(criarMarcador(pontos[1]));
      grupo.add(criarMarcador(pontos[2]));
      dados.centro = pontos[1].clone();
      mensagem = "Ângulo registrado: " + formatarGraus(angulo) + ".";
    } else if (tipo === "diametro") {
      var circulo = calcularCirculo3D(pontos[0], pontos[1], pontos[2]);
      if (!circulo) {
        definirStatus("Os três pontos não formam uma circunferência válida. Clique em pontos de uma mesma circunferência.", "erro");
        limparPendentes();
        atualizarHudMedicao();
        return;
      }
      dados.valorMm = circulo.raio * 2;
      dados.raioMm = circulo.raio;
      grupo.add(criarCirculo(circulo));
      grupo.add(criarMarcador(pontos[0]));
      grupo.add(criarMarcador(pontos[1]));
      grupo.add(criarMarcador(pontos[2]));
      dados.centro = circulo.centro.clone();
      mensagem = "Diâmetro registrado: Ø " + formatarMm(circulo.raio * 2) + ".";
    } else {
      return;
    }

    grupoMedicoes.add(grupo);
    medidas.push(dados);

    limparPendentes();
    atualizarListaMedicoes();
    atualizarCalloutDaMedida(dados);
    atualizarStatusModo(mensagem + " Clique para medir novamente.", "ativo");
    atualizarHudMedicao();
  }

  function medirCaixaEnvolvente() {
    if (!objetoAtual || !grupoMedicoes) {
      definirStatus("Carregue o modelo 3D antes de medir a caixa envolvente.", "erro");
      return;
    }

    for (var i = 0; i < medidas.length; i++) {
      if (medidas[i].tipo === "caixa") {
        definirStatus("A caixa envolvente deste modelo já está na lista de medições.", "erro");
        return;
      }
    }

    var box = new THREE.Box3().setFromObject(objetoAtual);
    var tamanho = new THREE.Vector3();
    box.getSize(tamanho);

    var id = ++contadorMedidas;
    var grupo = new THREE.Group();
    var helper = new THREE.Box3Helper(box, 0x1976a8);
    helper.material.transparent = true;
    helper.material.opacity = 0.85;
    grupo.add(helper);
    grupoMedicoes.add(grupo);

    var centro = new THREE.Vector3();
    box.getCenter(centro);

    var dadosCaixa = {
      id: id,
      tipo: "caixa",
      pontos: [box.min.clone(), box.max.clone()],
      dims: { x: tamanho.x, y: tamanho.y, z: tamanho.z },
      centro: centro,
      grupo: grupo
    };
    medidas.push(dadosCaixa);

    atualizarListaMedicoes();
    atualizarCalloutDaMedida(dadosCaixa);
    definirStatus(
      "Caixa envolvente: X " + formatarMm(tamanho.x) + " · Y " + formatarMm(tamanho.y) + " · Z " + formatarMm(tamanho.z) + ".",
      "ativo"
    );
  }

  // ============================================================ medição — cálculo
  function calcularAngulo(a, b, c) {
    var v1 = a.clone().sub(b);
    var v2 = c.clone().sub(b);
    var l1 = v1.length();
    var l2 = v2.length();
    if (l1 < 1e-6 || l2 < 1e-6) return null;

    var cos = v1.dot(v2) / (l1 * l2);
    cos = Math.max(-1, Math.min(1, cos));
    return Math.acos(cos) * 180 / Math.PI;
  }

  function calcularCirculo3D(a, b, c) {
    var ab = b.clone().sub(a);
    var ac = c.clone().sub(a);
    var normal = ab.clone().cross(ac);
    var area2 = normal.length();
    if (area2 < 1e-7) return null;

    var a2 = b.distanceToSquared(c);
    var b2 = a.distanceToSquared(c);
    var c2 = a.distanceToSquared(b);

    var wA = a2 * (b2 + c2 - a2);
    var wB = b2 * (c2 + a2 - b2);
    var wC = c2 * (a2 + b2 - c2);
    var denom = wA + wB + wC;
    if (Math.abs(denom) < 1e-9) return null;

    var centro = new THREE.Vector3(
      (a.x * wA + b.x * wB + c.x * wC) / denom,
      (a.y * wA + b.y * wB + c.y * wC) / denom,
      (a.z * wA + b.z * wB + c.z * wC) / denom
    );

    var raio = centro.distanceTo(a);
    if (!isFinite(raio) || raio <= 0 || raio > raioEsfera * 100) return null;

    return {
      centro: centro,
      raio: raio,
      normal: normal.normalize()
    };
  }

  // ============================================================ medição — objetos 3D
  function raioMarcador() {
    return Math.max(0.1, raioEsfera * 0.026);
  }

  function criarMarcador(ponto) {
    var geom = new THREE.SphereGeometry(raioMarcador(), 14, 10);
    var mesh = new THREE.Mesh(geom, matMarcador);
    mesh.position.copy(ponto);
    mesh.renderOrder = 999;
    return mesh;
  }

  function criarLinha(pontos, tracejada) {
    var geom = new THREE.BufferGeometry().setFromPoints(pontos);
    var linha = new THREE.Line(geom, tracejada ? matLinhaTracejada : matLinha);
    if (tracejada) atualizarDistanciasLinha(linha, pontos);
    linha.renderOrder = 998;
    return linha;
  }

  function atualizarDistanciasLinha(linha, pontos) {
    var attr = linha.geometry.attributes.lineDistance;
    if (!attr || attr.count !== pontos.length) {
      attr = new THREE.BufferAttribute(new Float32Array(pontos.length), 1);
      linha.geometry.setAttribute("lineDistance", attr);
    }

    var acumulado = 0;
    attr.setX(0, 0);
    for (var i = 1; i < pontos.length; i++) {
      acumulado += pontos[i].distanceTo(pontos[i - 1]);
      attr.setX(i, acumulado);
    }
    attr.needsUpdate = true;
  }

  function criarCirculo(circulo) {
    // base estável no plano do círculo
    var referencia = Math.abs(circulo.normal.x) > 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    var e1 = new THREE.Vector3().crossVectors(circulo.normal, referencia).normalize();
    var e2 = new THREE.Vector3().crossVectors(circulo.normal, e1).normalize();

    var pontos = [];
    var segmentos = 96;
    for (var i = 0; i <= segmentos; i++) {
      var ang = (i / segmentos) * Math.PI * 2;
      var p = circulo.centro.clone()
        .add(e1.clone().multiplyScalar(Math.cos(ang) * circulo.raio))
        .add(e2.clone().multiplyScalar(Math.sin(ang) * circulo.raio));
      pontos.push(p);
    }

    return criarLinha(pontos, false);
  }

  function adicionarMarcadorPendente(ponto) {
    if (!grupoPreview) return;
    var marcador = criarMarcador(ponto);
    grupoPreview.add(marcador);
    marcadoresPendentes.push(marcador);
  }

  function obterLinhaPreview() {
    if (linhaPreview) return linhaPreview;
    if (!grupoPreview) return null;

    var geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    linhaPreview = new THREE.Line(geom, matLinhaTracejada);
    linhaPreview.frustumCulled = false;
    linhaPreview.renderOrder = 1000;
    grupoPreview.add(linhaPreview);
    return linhaPreview;
  }

  function atualizarLinhaPreview(a, b) {
    var linha = obterLinhaPreview();
    if (!linha) return;

    var attr = linha.geometry.attributes.position;
    attr.setXYZ(0, a.x, a.y, a.z);
    attr.setXYZ(1, b.x, b.y, b.z);
    attr.needsUpdate = true;
    atualizarDistanciasLinha(linha, [a, b]);
    linha.visible = true;
  }

  function esconderLinhaPreview() {
    if (linhaPreview) linhaPreview.visible = false;
  }

  function atualizarPreviewMedicao() {
    if (!modoMedicao || !pontosPendentes.length || !snapAtual || modoMedicao === "caixa") {
      esconderLinhaPreview();
      if (calloutInfo && calloutInfo.tipo === "preview") {
        calloutInfo = null;
        atualizarCalloutTexto();
      }
      return;
    }

    var ultimo = pontosPendentes[pontosPendentes.length - 1];
    atualizarLinhaPreview(ultimo, snapAtual.ponto);

    if (modoMedicao === "distancia" && pontosPendentes.length === 1) {
      var d = ultimo.distanceTo(snapAtual.ponto);
      calloutInfo = {
        tipo: "preview",
        texto: formatarMm(d),
        ponto: ultimo.clone().add(snapAtual.ponto).multiplyScalar(0.5)
      };
    } else if (modoMedicao === "angulo" && pontosPendentes.length === 2) {
      var ang = calcularAngulo(pontosPendentes[0], pontosPendentes[1], snapAtual.ponto);
      calloutInfo = ang == null ? null : {
        tipo: "preview",
        texto: formatarGraus(ang),
        ponto: pontosPendentes[1].clone()
      };
    } else if (modoMedicao === "diametro" && pontosPendentes.length === 2) {
      var circ = calcularCirculo3D(pontosPendentes[0], pontosPendentes[1], snapAtual.ponto);
      calloutInfo = circ == null ? null : {
        tipo: "preview",
        texto: "Ø " + formatarMm(circ.raio * 2),
        ponto: circ.centro.clone()
      };
    } else {
      calloutInfo = null;
    }

    atualizarCalloutTexto();
  }

  function limparPendentes() {
    pontosPendentes = [];
    marcadoresPendentes = [];
    linhaPreview = null;

    if (grupoPreview) {
      while (grupoPreview.children.length) {
        var obj = grupoPreview.children[0];
        if (obj.geometry) obj.geometry.dispose();
        grupoPreview.remove(obj);
      }
    }

    if (calloutInfo && calloutInfo.tipo === "preview") calloutInfo = null;
    atualizarCalloutTexto();
  }

  function obterMedidaPorId(id) {
    for (var i = 0; i < medidas.length; i++) {
      if (medidas[i].id === id) return medidas[i];
    }
    return null;
  }

  function textoCalloutDaMedida(m) {
    if (!m) return "";
    if (m.tipo === "distancia") return formatarMm(m.valorMm);
    if (m.tipo === "angulo") return formatarGraus(m.valorGraus);
    if (m.tipo === "diametro") return "Ø " + formatarMm(m.valorMm);
    if (m.tipo === "caixa") {
      return formatarMm(m.dims.x) + " × " + formatarMm(m.dims.y) + " × " + formatarMm(m.dims.z);
    }
    return "";
  }

  function atualizarCalloutDaMedida(m) {
    if (!m || !m.centro) return;
    calloutInfo = {
      tipo: "medida",
      medidaId: m.id,
      texto: textoCalloutDaMedida(m),
      ponto: m.centro.clone()
    };
    atualizarCalloutTexto();
  }

  function atualizarCalloutTexto() {
    var callout = el("m3dCallout");
    var valor = el("m3dCalloutValue");
    if (!callout || !valor) return;
    if (!calloutInfo) {
      callout.style.display = "none";
      return;
    }
    valor.textContent = calloutInfo.texto;
  }

  function posicionarCallout() {
    var callout = el("m3dCallout");
    var viewport = el("m3dViewport");
    if (!callout || !viewport || !camera) return;

    if (!calloutInfo) {
      callout.style.display = "none";
      return;
    }

    var overlay = el("modalPeca3D");
    if (!overlay || !overlay.classList.contains("active")) {
      callout.style.display = "none";
      return;
    }

    if (!viewportLargura || !viewportAltura) {
      callout.style.display = "none";
      return;
    }

    var p = vetorProjecao.copy(calloutInfo.ponto).project(camera);
    if (p.z < -1 || p.z > 1 || !isFinite(p.x) || !isFinite(p.y)) {
      callout.style.display = "none";
      return;
    }

    var largura = viewportLargura;
    var altura = viewportAltura;
    var x = (p.x * 0.5 + 0.5) * largura;
    var y = (-p.y * 0.5 + 0.5) * altura;

    if (x < 8 || x > largura - 8 || y < 8 || y > altura - 8) {
      callout.style.display = "none";
      return;
    }

    callout.style.left = x + "px";
    callout.style.top = y + "px";
    callout.style.display = "block";
  }

  // ============================================================ medição — lista
  function formatarMm(valor) {
    return formatarSemUnidade(valor) + " " + unidadeMedicao;
  }

  function formatarSemUnidade(valor) {
    var fator = unidadeMedicao === "cm" ? 0.1 : 1;
    var casas = unidadeMedicao === "cm" ? 3 : 2;
    return (valor * fator).toFixed(casas).replace(".", ",");
  }

  function formatarGraus(valor) {
    return valor.toFixed(2).replace(".", ",") + "°";
  }

  function atualizarListaMedicoes() {
    var lista = el("m3dMeasureList");
    var contador = el("m3dResultsCount");
    var btnLimpar = el("btnM3dLimparMedicoes");
    if (!lista) return;

    if (contador) contador.textContent = String(medidas.length);
    if (btnLimpar) btnLimpar.disabled = medidas.length === 0;

    if (!medidas.length) {
      lista.innerHTML =
        '<div class="m3d-measure-empty">' +
        '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5">' +
        '<path d="M3 17.5 17.5 3M4.5 15.5l2 2M8 12l2 2M11.5 8.5l2 2M15 5l2 2"></path>' +
        '<path d="M15.5 15.5h5v5"></path>' +
        '</svg>' +
        '<strong>Nenhuma medição</strong>' +
        '<span>Escolha uma ferramenta e clique na peça.</span>' +
        '</div>';
      return;
    }

    var html = "";
    for (var i = 0; i < medidas.length; i++) {
      var m = medidas[i];
      var indice = i + 1;
      var nome = NOMES_MEDICAO[m.tipo] || "Medição";
      var tag = TAGS_MEDICAO[m.tipo] || "MED";

      html += '<div class="m3d-medida-item" data-medida="' + m.id + '">';
      html += '<div class="m3d-medida-top">';
      html += '<span class="m3d-medida-tag">' + tag + "</span>";
      html += '<span class="m3d-medida-nome">' + nome + " " + indice + "</span>";
      html += '<button type="button" class="m3d-medida-del" data-del-medida="' + m.id + '" aria-label="Remover ' + nome + " " + indice + '" title="Remover medição">×</button>';
      html += "</div>";

      if (m.tipo === "distancia") {
        html += '<div class="m3d-medida-valor">' + formatarMm(m.valorMm) + "</div>";
        html += '<div class="m3d-medida-sub">ΔX ' + formatarSemUnidade(m.delta.x) +
          " · ΔY " + formatarSemUnidade(m.delta.y) +
          " · ΔZ " + formatarSemUnidade(m.delta.z) + " " + unidadeMedicao + "</div>";
      } else if (m.tipo === "angulo") {
        html += '<div class="m3d-medida-valor">' + formatarGraus(m.valorGraus) + "</div>";
        html += '<div class="m3d-medida-sub">Ângulo no ponto 2 · 3 pontos</div>';
      } else if (m.tipo === "diametro") {
        html += '<div class="m3d-medida-valor">Ø ' + formatarMm(m.valorMm) + "</div>";
        html += '<div class="m3d-medida-sub">Raio ' + formatarMm(m.raioMm) + " · 3 pontos</div>";
      } else if (m.tipo === "caixa") {
        html += '<div class="m3d-medida-valor m3d-medida-caixa">' +
          "<span><em>X</em>" + formatarMm(m.dims.x) + "</span>" +
          "<span><em>Y</em>" + formatarMm(m.dims.y) + "</span>" +
          "<span><em>Z</em>" + formatarMm(m.dims.z) + "</span>" +
          "</div>";
        html += '<div class="m3d-medida-sub">Limites do modelo · valores absolutos</div>';
      }

      html += "</div>";
    }

    lista.innerHTML = html;
  }

  function removerMedida(id) {
    if (!id) return;

    for (var i = 0; i < medidas.length; i++) {
      if (medidas[i].id === id) {
        descartarGrupo(medidas[i].grupo);
        medidas.splice(i, 1);
        break;
      }
    }

    if (calloutInfo && calloutInfo.medidaId === id) calloutInfo = null;
    atualizarListaMedicoes();
    atualizarCalloutTexto();
    atualizarStatusModo("Medição removida. Selecione um ponto para medir novamente.", "");
  }

  function limparMedicoes() {
    if (grupoMedicoes) {
      while (grupoMedicoes.children.length) {
        descartarGrupo(grupoMedicoes.children[0]);
      }
    }

    medidas = [];
    contadorMedidas = 0;
    calloutInfo = null;
    limparPendentes();

    atualizarListaMedicoes();
    atualizarCalloutTexto();
    atualizarHudMedicao();
    definirStatus("Todas as medições foram removidas.", "");
  }

  function descartarGrupo(grupo) {
    if (!grupo) return;

    grupo.traverse(function (obj) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material && obj.material !== matMarcador && obj.material !== matLinha && obj.material !== matLinhaTracejada) {
        obj.material.dispose();
      }
    });

    if (grupo.parent) grupo.parent.remove(grupo);
  }

  function definirStatus(mensagem, tom) {
    var status = el("m3dMeasureStatus");
    var texto = el("m3dMeasureStatusText");
    if (!status || !texto) return;
    status.className = "m3d-measure-status" + (tom ? " " + tom : "");
    texto.textContent = mensagem;
  }

  // ============================================================ câmera / vista
  function redimensionar() {
    var container = el("m3dViewport");
    if (!container || !renderer || !camera) return;

    var w = container.clientWidth;
    var h = container.clientHeight;
    if (w === 0 || h === 0) return;

    viewportLargura = w;
    viewportAltura = h;

    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function aplicarGeometriaNaCena(geometry, infoExtra) {
    if (objetoAtual) {
      cena.remove(objetoAtual);
      if (malhaBordas) {
        cena.remove(malhaBordas);
        if (malhaBordas.geometry) malhaBordas.geometry.dispose();
        if (malhaBordas.material) malhaBordas.material.dispose();
      }
      if (objetoAtual.geometry) objetoAtual.geometry.dispose();
      if (objetoAtual.material) objetoAtual.material.dispose();
      objetoAtual = null;
      malhaBordas = null;
    }

    limparMedicoes();
    limparPendentes();
    faceSelecionadaNormal = null;
    snapAtual = null;
    esconderTagSnap();

    try {
      if (THREE.BufferGeometryUtils && typeof THREE.BufferGeometryUtils.mergeVertices === "function") {
        geometry = THREE.BufferGeometryUtils.mergeVertices(geometry, 1e-4);
      }
    } catch (e) { /* mantém geometria original */ }
    geometry.computeVertexNormals();
    geometry.center();

    var material = new THREE.MeshStandardMaterial({
      color: 0x8a9399,
      metalness: 0.25,
      roughness: 0.55,
      flatShading: false,
      envMapIntensity: 0.8,
      side: THREE.DoubleSide,
      clippingPlanes: corteAtivo ? [planoCorte] : []
    });

    var mesh = new THREE.Mesh(geometry, material);

    try {
      var edges = new THREE.EdgesGeometry(geometry, 80);
      malhaBordas = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x7a7a7a, transparent: true, opacity: 0.55, linewidth: 1 })
      );
      mesh.add(malhaBordas);
    } catch (e) {
      // Ignora erro de borda
    }

    objetoAtual = mesh;
    cena.add(objetoAtual);
    objetoAtual.updateMatrixWorld(true);

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    var bbox = geometry.boundingBox;
    var sphere = geometry.boundingSphere;

    centroModelo = sphere ? sphere.center.clone() : new THREE.Vector3(0, 0, 0);
    raioEsfera = sphere ? sphere.radius : Math.max(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y, bbox.max.z - bbox.min.z);

    if (matLinhaTracejada) {
      matLinhaTracejada.dashSize = Math.max(0.12, raioEsfera * 0.045);
      matLinhaTracejada.gapSize = Math.max(0.08, raioEsfera * 0.028);
      matLinhaTracejada.needsUpdate = true;
    }

    if (gradeSolo) {
      gradeSolo.position.y = bbox.min.y - 1.0;
    }

    if (controls) {
      controls.target.copy(centroModelo);
    }

    reconstruirCacheVertices();

    var loading = el("m3dLoading");
    if (loading) loading.style.display = "none";

    var infoOrigem = el("m3dInfoOrigem");
    if (infoOrigem) {
      infoOrigem.textContent = infoExtra || "Modelo 3D CAD: Conexão Esferográfica";
    }

    ajustarAoModelo();
    irParaVista(7, false);
    atualizarStatusModo();
  }

  function carregarModelo(url, nomePeca, infoExtra, permitirProcedural) {
    // Evita cache do navegador/reuso de geometria quando o arquivo STL for substituído.
    url = String(url || "");
    if (url.indexOf("?") === -1) {
      url += "?v=" + Date.now();
    }

    var loading = el("m3dLoading");
    if (loading) {
      loading.style.display = "flex";
      loading.textContent = "Carregando modelo 3D (" + (nomePeca || "Peça") + ")...";
    }

    if (typeof THREE.STLLoader === "function") {
      var loader = new THREE.STLLoader();
      loader.load(
        url,
        function (geometry) {
          modeloCarregadoUrl = url;
          aplicarGeometriaNaCena(geometry, infoExtra);
        },
        function (xhr) {
          if (xhr.lengthComputable && loading) {
            var pct = Math.round((xhr.loaded / xhr.total) * 100);
            loading.textContent = "Carregando modelo 3D (" + pct + "%)...";
          }
        },
        function () {
          console.warn("Arquivo STL não carregado via rede (" + url + ").");
          if (permitirProcedural) {
            modeloCarregadoUrl = "procedural";
            var geom = criarGeometriaConexaoProcedural();
            aplicarGeometriaNaCena(geom, "Geometria CAD 3D: Conexão Esferográfica Padrão (REV05)");
          } else {
            modeloCarregadoUrl = null;
            mostrarModeloIndisponivel(infoExtra || url);
          }
        }
      );
    } else if (permitirProcedural) {
      modeloCarregadoUrl = "procedural";
      var geom = criarGeometriaConexaoProcedural();
      aplicarGeometriaNaCena(geom, "Geometria CAD 3D: Conexão Esferográfica Padrão (REV05)");
    } else {
      modeloCarregadoUrl = null;
      mostrarModeloIndisponivel(infoExtra || url);
    }
  }

  function mostrarModeloIndisponivel(referencia) {
    var loading = el("m3dLoading");
    if (loading) {
      loading.style.display = "flex";
      loading.textContent = "Modelo 3D indisponível: " + referencia;
    }

    var infoOrigem = el("m3dInfoOrigem");
    if (infoOrigem) infoOrigem.textContent = "Modelo 3D indisponível: " + referencia;
  }

  function ajustarAoModelo() {
    if (!camera || !controls) return;

    var alvo = centroModelo || new THREE.Vector3(0, 0, 0);
    var dist = Math.max(raioEsfera * 2.8, 35);

    camera.near = Math.max(0.05, raioEsfera / 100);
    camera.far = Math.max(500, raioEsfera * 200);
    camera.updateProjectionMatrix();

    var direcao = camera.position.clone().sub(alvo);
    if (direcao.lengthSq() < 1e-6) direcao.set(1, 1, 1);
    direcao.normalize();

    camera.position.copy(alvo).add(direcao.multiplyScalar(dist));
    controls.target.copy(alvo);
    camera.lookAt(alvo);
    controls.update();
  }

  function alternarCorte() {
    corteAtivo = !corteAtivo;
    if (objetoAtual && objetoAtual.material) {
      objetoAtual.material.clippingPlanes = corteAtivo ? [planoCorte] : [];
      objetoAtual.material.needsUpdate = true;
    }
    var btn = el("btnM3dCorte");
    if (btn) btn.classList.toggle("ativo", corteAtivo);
    if (renderer) renderer.localClippingEnabled = true;
  }

  function irParaVista(n, animar) {
    if (animar === undefined) animar = true;
    var vista = VISTAS[n];
    if (!vista || !camera || !controls) return;

    var dir = vista.dir;
    var up = vista.up;

    if (n === 8) {
      if (faceSelecionadaNormal) {
        dir = [faceSelecionadaNormal.x, faceSelecionadaNormal.y, faceSelecionadaNormal.z];
        up = Math.abs(dir[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
      } else {
        dir = [0, 0, 1];
        up = [0, 1, 0];
      }
    }

    var dist = Math.max(raioEsfera * 2.8, 35);
    var alvo = centroModelo || new THREE.Vector3(0, 0, 0);

    var posFinal = new THREE.Vector3(
      alvo.x + dir[0] * dist,
      alvo.y + dir[1] * dist,
      alvo.z + dir[2] * dist
    );
    var upFinal = new THREE.Vector3(up[0], up[1], up[2]).normalize();

    atualizarBotoesVista(n);
    atualizarIndicadorVista(vista.nome + " (" + vista.atalho + ")");

    if (!animar) {
      camera.position.copy(posFinal);
      camera.up.copy(upFinal);
      controls.target.copy(alvo);
      camera.lookAt(alvo);
      controls.update();
      return;
    }

    animandoCamera = true;
    var posInicial = camera.position.clone();
    var upInicial = camera.up.clone();
    var t0 = performance.now();
    var duracao = 320;

    function animarPasso(agora) {
      var t = Math.min(1, (agora - t0) / duracao);
      var ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      camera.position.lerpVectors(posInicial, posFinal, ease);
      camera.up.lerpVectors(upInicial, upFinal, ease).normalize();
      camera.lookAt(alvo);
      controls.target.copy(alvo);
      controls.update();

      if (t < 1) {
        requestAnimationFrame(animarPasso);
      } else {
        camera.position.copy(posFinal);
        camera.up.copy(upFinal);
        controls.update();
        animandoCamera = false;
      }
    }

    requestAnimationFrame(animarPasso);
  }

  function atualizarBotoesVista(n) {
    document.querySelectorAll(".m3d-view-btn[data-view], .m3d-btn[data-view]").forEach(function (btn) {
      btn.classList.toggle("ativo", parseInt(btn.dataset.view, 10) === n);
    });
  }

  function atualizarIndicadorVista(texto) {
    var ind = el("m3dViewTexto") || el("m3dViewIndicator");
    if (ind) ind.textContent = "Vista: " + texto;
  }

  function obterUrlModeloParaMolde(moldeCodigo, molde) {
    var info = null;
    if (molde && CF.cfg && typeof CF.cfg.resolverModelo3d === "function") {
      info = CF.cfg.resolverModelo3d(molde);
    }

    if (!info || !info.arquivo) {
      var cod = String(moldeCodigo || "").trim().toUpperCase();
      var nomeArquivo = cod ? "molde-" + cod + ".stl" : "conexao-padrao.stl";
      info = {
        arquivo: "assets/models/" + nomeArquivo,
        nomeArquivo: nomeArquivo,
        titulo: "Desenho 3D da Peça — Molde " + cod,
        subtitulo: "Visualização técnica 3D",
        infoExtra: "Arquivo 3D: " + nomeArquivo,
        fallbackProcedural: false
      };
    }

    return {
      url: resolverUrl(info.arquivo),
      titulo: info.titulo,
      subtitulo: info.subtitulo,
      infoExtra: info.infoExtra,
      fallbackProcedural: info.fallbackProcedural
    };
  }

  function abrirModal3D(dados) {
    var estado = CF.estado && CF.estado.estado;
    var molde = (dados && dados.molde) || (estado && estado.molde);
    var moldeCodigo = (molde && molde.codigo) || (estado && estado.dadosGrade && estado.dadosGrade.moldeNum) || "168";

    var infoModelo = obterUrlModeloParaMolde(moldeCodigo, molde);

    var tituloEl = el("modalPeca3dTitulo");
    if (tituloEl) tituloEl.textContent = infoModelo.titulo;

    var subEl = el("modalPeca3dSub");
    if (subEl) subEl.textContent = infoModelo.subtitulo;

    var overlay = el("modalPeca3D");
    if (overlay) overlay.classList.add("active");

    if (!inicializarThree()) {
      alert("Não foi possível inicializar o visualizador WebGL.");
      return;
    }

    atualizarListaMedicoes();
    atualizarStatusModo();
    atualizarHintRodape();
    atualizarCursorCanvas();

    setTimeout(function () {
      redimensionar();
      carregarModelo(infoModelo.url, molde && (molde.nomePeca || molde.codigo), infoModelo.infoExtra, infoModelo.fallbackProcedural);
    }, 50);
  }

  function fecharModal3D() {
    var overlay = el("modalPeca3D");
    if (overlay) overlay.classList.remove("active");

    autoGirar = false;
    var btnGirar = el("btnM3dGirar");
    if (btnGirar) btnGirar.classList.remove("ativo");

    if (modoMedicao) desativarMedicao(true);
    esconderTagSnap();
    esconderLinhaPreview();
    atualizarCursorCanvas();
  }

  // ============================================================ teclado
  function onKeyDown(evt) {
    var overlay = el("modalPeca3D");
    if (!overlay || !overlay.classList.contains("active")) return;

    if (evt.key === "Escape") {
      evt.preventDefault();
      if (modoMedicao) {
        desativarMedicao();
      } else {
        fecharModal3D();
      }
      return;
    }

    var alvo = evt.target;
    var digitando = alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT" || alvo.isContentEditable);
    if (digitando) return;

    if (evt.ctrlKey && !evt.shiftKey && !evt.altKey) {
      var num = parseInt(evt.key, 10);
      if (num >= 1 && num <= 8) {
        evt.preventDefault();
        evt.stopPropagation();
        irParaVista(num, true);
        return;
      }
    }

    if (evt.ctrlKey || evt.metaKey || evt.altKey) return;

    if (evt.key === "m" || evt.key === "M") {
      evt.preventDefault();
      ativarModoMedicao(modoMedicao === "distancia" ? null : "distancia");
      return;
    }

    if (evt.key === "Delete" || evt.key === "Backspace") {
      evt.preventDefault();
      if (medidas.length) {
        removerMedida(medidas[medidas.length - 1].id);
      }
      return;
    }

    if (evt.key === "f" || evt.key === "F") {
      evt.preventDefault();
      ajustarAoModelo();
    }
  }

  // ============================================================ init
  function init() {
    if (inicializado) return;
    inicializado = true;

    var pecaBox = el("pecaBox") || document.querySelector(".peca-box");
    if (pecaBox) {
      pecaBox.addEventListener("click", function () {
        abrirPeloMenu();
      });
    }

    var pecaGatilho = el("pecaGatilho");
    if (pecaGatilho) {
      pecaGatilho.addEventListener("click", function (e) {
        e.stopPropagation();
        abrirPeloMenu();
      });
    }

    var btn3d = el("btnAbrir3D");
    if (btn3d) {
      btn3d.addEventListener("click", function (e) {
        e.stopPropagation();
        abrirPeloMenu();
      });
    }

    var btnFecharTopo = el("btnFecharModal3D");
    if (btnFecharTopo) btnFecharTopo.addEventListener("click", fecharModal3D);

    var btnFecharRodape = el("btnFecharModal3DRodape");
    if (btnFecharRodape) btnFecharRodape.addEventListener("click", fecharModal3D);

    var overlay = el("modalPeca3D");
    if (overlay) {
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) fecharModal3D();
      });
    }

    document.querySelectorAll(".m3d-view-btn[data-view], .m3d-btn[data-view]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        irParaVista(parseInt(this.dataset.view, 10), true);
      });
    });

    var btnFit = el("btnM3dFit");
    if (btnFit) {
      btnFit.addEventListener("click", function () {
        ajustarAoModelo();
      });
    }

    var btnGirar = el("btnM3dGirar");
    if (btnGirar) {
      btnGirar.addEventListener("click", function () {
        autoGirar = !autoGirar;
        btnGirar.classList.toggle("ativo", autoGirar);
      });
    }

    var btnGrade = el("btnM3dGrade");
    if (btnGrade) {
      btnGrade.addEventListener("click", function () {
        if (gradeSolo) {
          gradeSolo.visible = !gradeSolo.visible;
          btnGrade.classList.toggle("ativo", !gradeSolo.visible);
        }
      });
    }

    var btnCorte = el("btnM3dCorte");
    if (btnCorte) {
      btnCorte.addEventListener("click", function () {
        alternarCorte();
      });
    }

    configurarBotoesMedicao();

    window.addEventListener("resize", function () {
      var ov = el("modalPeca3D");
      if (ov && ov.classList.contains("active")) redimensionar();
    });

    window.addEventListener("keydown", onKeyDown, true);
  }

  CF.visualizador3dLocal = {
    init: init,
    abrirModal3D: abrirModal3D,
    fecharModal3D: fecharModal3D,
    irParaVista: irParaVista,
    ajustarAoModelo: ajustarAoModelo,
    ativarModoMedicao: ativarModoMedicao,
    limparMedicoes: limparMedicoes,
    definirUnidade: definirUnidade,
    alternarCorte: alternarCorte
  };

  // Mantém o objeto antigo válido enquanto a fachada não é carregada.
  CF.visualizador3d = CF.visualizador3dLocal;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    setTimeout(init, 0);
  }

})(window.CF = window.CF || {});
