"use strict";

(function (CF) {

  const { estado } = CF.estado;

  let cacheFormas = null;
  let cacheDesenhos = null;
  let cacheMaquinas = null;
  let cacheModelos3d = null;

  function url(rel) {
    const caminho = String(rel == null ? "" : rel).replace(/^\/+/, "");
    const partes = caminho.split("/").map(encodeURIComponent).join("/");
    return estado.contextPath + "/" + partes;
  }

  async function buscarApi(caminho) {
    const resp = await fetch(estado.contextPath + "/api" + caminho, { cache: "no-store" });
    if (!resp.ok) {
      let detalhe = "";
      try {
        const corpo = await resp.json();
        detalhe = corpo && corpo.erro ? corpo.erro : "";
      } catch (e) {
        // resposta sem JSON: mantém a mensagem padrão
      }
      throw new Error(detalhe || ("Recurso indisponível (" + resp.status + "): " + caminho));
    }
    return resp.json();
  }

  async function carregarCatalogo(forcarModelos) {
    const cat = await buscarApi("/config/moldes");
    const moldes = Array.isArray(cat.moldes) ? cat.moldes : [];
    const modelos = await carregarModelos3d(forcarModelos);
    moldes.forEach((molde) => {
      molde.modelo3d = resolverModelo3d(molde, modelos);
    });
    return moldes;
  }

  async function carregarModelos3d(forcar) {
    if (forcar) cacheModelos3d = null;
    if (cacheModelos3d) return cacheModelos3d;
    let mapa = {};
    try {
      const cat = await buscarApi("/config/modelos3d");
      (cat.modelos || []).forEach((modelo) => {
        if (modelo && modelo.id) mapa[modelo.id] = modelo;
      });
    } catch (e) {
      console.warn("Catálogo de modelos 3D indisponível (" + e.message + ").");
    }
    cacheModelos3d = mapa;
    return mapa;
  }

  // Resolve o STL do molde pelo catálogo. Sem 'modelo3dId', mantém a convenção
  // antiga de arquivo por código (assets/models/molde-<codigo>.stl).
  function resolverModelo3d(molde, catalogo) {
    if (molde && molde.modelo3d && typeof molde.modelo3d === "object" && molde.modelo3d.arquivo) {
      return molde.modelo3d;
    }

    const mapa = catalogo || cacheModelos3d || {};
    const codigo = String((molde && molde.codigo) || "").trim().toUpperCase();
    const entrada = molde && molde.modelo3dId ? mapa[molde.modelo3dId] : null;

    let arquivo = entrada && entrada.arquivo
      ? String(entrada.arquivo).replace(/^\/+/, "")
      : "assets/models/molde-" + codigo + ".stl";
    if (!codigo && !entrada) arquivo = "assets/models/conexao-padrao.stl";

    const nomeArquivo = arquivo.split("/").pop();
    const nome = (entrada && entrada.nome) || (molde && molde.nomePeca) || ("Molde " + codigo);

    let subtitulo = "Visualização técnica 3D";
    if (entrada) {
      const partes = [];
      if (entrada.revisao) partes.push("REV" + entrada.revisao);
      if (entrada.codigoTecnico) partes.push(entrada.codigoTecnico);
      if (partes.length) subtitulo = partes.join(" · ");
    }

    return {
      id: (entrada && entrada.id) || null,
      arquivo: arquivo,
      nomeArquivo: nomeArquivo,
      nome: nome,
      titulo: "Desenho 3D da Peça — " + nome,
      subtitulo: subtitulo,
      infoExtra: entrada && entrada.documentoOriginal
        ? "Arquivo CAD SolidWorks: " + entrada.documentoOriginal
        : "Arquivo 3D: " + nomeArquivo,
      fallbackProcedural: !!(entrada && entrada.fallbackProcedural)
    };
  }

  // Recarrega o catálogo depois de um cadastro e publica no estado global.
  async function recarregarCatalogo() {
    const moldes = await carregarCatalogo(true);
    estado.moldes = moldes;
    return moldes;
  }

  async function recarregarMaquinas() {
    cacheMaquinas = null;
    const maquinas = await carregarMaquinas();
    estado.maquinas = maquinas;
    return maquinas;
  }

  function acharMolde(id) {
    return estado.moldes.find((m) => m.id === id) || null;
  }

  async function carregarLayout(layoutId) {
    if (!layoutId) {
      throw new Error("Layout não cadastrado para este molde.");
    }
    return buscarApi("/config/layouts/" + encodeURIComponent(layoutId));
  }

  async function carregarFormas() {
    if (cacheFormas) return cacheFormas;
    const cat = await buscarApi("/config/formas");
    const mapa = {};
    (cat.formas || []).forEach((f) => { mapa[f.id] = f; });
    cacheFormas = mapa;
    return mapa;
  }

  async function carregarDesenhos() {
    if (cacheDesenhos) return cacheDesenhos;
    const cat = await buscarApi("/config/desenhos");
    const mapa = {};
    (cat.desenhos || []).forEach((d) => { mapa[d.id] = d; });
    cacheDesenhos = mapa;
    return mapa;
  }

  async function carregarMaquinas() {
    if (cacheMaquinas) return cacheMaquinas;
    let lista = [];
    try {
      const cat = await buscarApi("/config/maquinas");
      lista = Array.isArray(cat.maquinas) ? cat.maquinas : [];
    } catch (e) {
      console.warn("Catálogo de máquinas indisponível (" + e.message + ").");
    }
    cacheMaquinas = lista;
    return lista;
  }

  // Lista final usada na abertura de grade: catálogo + máquinas citadas nos moldes.
  function listarMaquinas() {
    const saida = [];
    const vistos = {};

    function adicionar(nome) {
      const texto = String(nome == null ? "" : nome).trim();
      if (!texto) return;
      const chave = texto.toUpperCase();
      if (vistos[chave]) return;
      vistos[chave] = true;
      saida.push(texto);
    }

    (estado.maquinas || []).forEach((m) => {
      adicionar(typeof m === "string" ? m : (m && (m.nome || m.codigo)) || "");
    });
    (estado.moldes || []).forEach((mol) => {
      adicionar(mol.padroes && mol.padroes.maquina);
    });

    saida.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    return saida;
  }

  async function verificarArquivoModelo3d(caminho) {
    if (!caminho) return false;
    try {
      const resp = await buscarApi("/api/config/modelo3d/existe?caminho=" + encodeURIComponent(caminho));
      return resp && resp.existe === true;
    } catch (e) {
      return false;
    }
  }

  function urlRecurso(rel) {
    if (!rel) return "";
    return url(rel);
  }

  CF.cfg = {
    carregarCatalogo: carregarCatalogo,
    recarregarCatalogo: recarregarCatalogo,
    carregarMoldes: carregarCatalogo,
    recarregarMaquinas: recarregarMaquinas,
    acharMolde: acharMolde,
    carregarLayout: carregarLayout,
    carregarFormas: carregarFormas,
    carregarDesenhos: carregarDesenhos,
    verificarArquivoModelo3d: verificarArquivoModelo3d,
    carregarMaquinas: carregarMaquinas,
    listarMaquinas: listarMaquinas,
    carregarModelos3d: carregarModelos3d,
    resolverModelo3d: resolverModelo3d,
    urlRecurso: urlRecurso
  };

})(window.CF = window.CF || {});
