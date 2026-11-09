-- CustomFusionWeb - schema do banco SQLite (fonte de verdade do projeto).
-- Aplicado de forma idempotente por Database.inicializar().

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS moldes (
    id TEXT PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    nome_peca TEXT NOT NULL,
    familia TEXT,
    revisao_cadastro TEXT,
    layout_id TEXT,
    desenho_id TEXT,
    modelo3d_id TEXT,
    padroes_json TEXT NOT NULL DEFAULT '{}',
    origem TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS molde_cavidades (
    molde_id TEXT NOT NULL REFERENCES moldes(id) ON DELETE CASCADE,
    numero TEXT NOT NULL,
    ordem INTEGER NOT NULL,
    PRIMARY KEY (molde_id, numero)
);

CREATE TABLE IF NOT EXISTS desenhos (
    id TEXT PRIMARY KEY,
    molde_id TEXT REFERENCES moldes(id) ON DELETE SET NULL,
    papel TEXT,
    revisao TEXT,
    imagem TEXT,
    documento TEXT,
    origem TEXT,
    observacao TEXT,
    dados_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_desenhos_molde ON desenhos(molde_id);

CREATE TABLE IF NOT EXISTS formas (
    id TEXT PRIMARY KEY,
    revisao TEXT,
    descricao TEXT,
    dados_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS maquinas (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    ocorrencias INTEGER NOT NULL DEFAULT 0,
    dados_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS layouts (
    id TEXT PRIMARY KEY,
    molde_id TEXT REFERENCES moldes(id) ON DELETE SET NULL,
    tipo TEXT,
    revisao TEXT,
    dados_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_layouts_molde ON layouts(molde_id);

CREATE TABLE IF NOT EXISTS modelos3d (
    id TEXT PRIMARY KEY,
    arquivo TEXT NOT NULL,
    nome TEXT,
    revisao TEXT,
    codigo_tecnico TEXT,
    documento_original TEXT,
    fallback_procedural INTEGER NOT NULL DEFAULT 0,
    dados_json TEXT NOT NULL DEFAULT '{}'
);

DROP TABLE IF EXISTS historico_grades;

CREATE TABLE IF NOT EXISTS grades (
    id TEXT PRIMARY KEY,
    molde_id TEXT NOT NULL REFERENCES moldes(id) ON DELETE CASCADE,
    aberta_em TEXT NOT NULL,
    maquina TEXT,
    data_entrada TEXT,
    dados_grade_json TEXT NOT NULL DEFAULT '{}',
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_grades_molde ON grades(molde_id);

CREATE TABLE IF NOT EXISTS grade_cavidades (
    grade_id TEXT NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
    cavidade TEXT NOT NULL,
    desvio TEXT,
    data TEXT,
    vedado TEXT NOT NULL DEFAULT 'N',
    observacao TEXT,
    controlador TEXT,
    PRIMARY KEY (grade_id, cavidade)
);
CREATE INDEX IF NOT EXISTS idx_grade_cavidades_grade ON grade_cavidades(grade_id);

-- Compatibilidade com o endpoint antigo PUT /api/moldes/{codigo}/cavidades.
CREATE TABLE IF NOT EXISTS registros_molde (
    molde_id TEXT PRIMARY KEY REFERENCES moldes(id) ON DELETE CASCADE,
    dados_cavidades_json TEXT NOT NULL DEFAULT '{}',
    dados_grade_json TEXT NOT NULL DEFAULT '{}',
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
