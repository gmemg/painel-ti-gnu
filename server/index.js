require("dotenv").config();

const cors = require("cors");
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool, types } = require("pg");
// TIMESTAMP WITHOUT TIME ZONE (OID 1114) é armazenado sem info de fuso.
// O driver pg interpreta o valor bruto no fuso local do servidor, causando
// dupla conversão quando o servidor está em UTC-3. Forçamos interpretação UTC
// adicionando 'Z' ao string antes de criar o Date.
types.setTypeParser(1114, (str) =>
  str ? str.replace(" ", "T") + "Z" : null,
);

const app = express();
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";
const distPath = path.join(__dirname, "..", "dist");

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRACAO = "12h";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Autenticação/autorização para toda a API.
// - /login e /health são públicos.
// - Demais rotas exigem token válido.
// - Métodos mutantes (não-GET) exigem role 'admin'.
app.use("/api", (req, res, next) => {
  if (req.path === "/login" || req.path === "/health") {
    return next();
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Não autenticado" });
  }

  if (req.method !== "GET" && req.user.role !== "admin") {
    return res.status(403).json({ error: "Sem permissão para esta ação" });
  }

  next();
});

app.post("/api/login", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Informe usuário e senha." });
    }

    const result = await pool.query(
      "SELECT * FROM usuarios WHERE username = $1",
      [username.trim().toLowerCase()],
    );
    const usuario = result.rows[0];

    if (!usuario || !bcrypt.compareSync(password, usuario.password_hash)) {
      return res.status(401).json({ error: "Usuário ou senha inválidos." });
    }

    const token = jwt.sign(
      { sub: usuario.id, username: usuario.username, role: usuario.role },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRACAO },
    );

    res.json({
      token,
      user: { username: usuario.username, role: usuario.role },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/me", (req, res) => {
  res.json({ username: req.user.username, role: req.user.role });
});

const assertDatabaseUrl = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("Configure DATABASE_URL no arquivo .env antes de iniciar.");
  }
};

const assertJwtSecret = () => {
  if (!JWT_SECRET) {
    throw new Error("Configure JWT_SECRET no arquivo .env antes de iniciar.");
  }
};

const initDatabase = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS eventos (
      id TEXT PRIMARY KEY,
      nome_evento TEXT NOT NULL,
      adicionado_por TEXT NOT NULL,
      data_hora TIMESTAMP NOT NULL,
      dia_semana TEXT NOT NULL,
      local_evento TEXT NOT NULL,
      funcionario_plantao TEXT,
      equipamentos_necessarios TEXT,
      numero_chamado TEXT,
      requerente TEXT,
      removido BOOLEAN DEFAULT false,
      concluido BOOLEAN DEFAULT false,
      data_remocao TIMESTAMP,
      data_conclusao TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS historico_eventos (
      id TEXT PRIMARY KEY,
      nome_evento TEXT NOT NULL,
      adicionado_por TEXT NOT NULL,
      data_hora TIMESTAMP NOT NULL,
      dia_semana TEXT NOT NULL,
      local_evento TEXT NOT NULL,
      funcionario_plantao TEXT,
      equipamentos_necessarios TEXT,
      numero_chamado TEXT,
      requerente TEXT,
      removido BOOLEAN DEFAULT false,
      concluido BOOLEAN DEFAULT false,
      data_remocao TIMESTAMP,
      data_conclusao TIMESTAMP
    );

    ALTER TABLE eventos ADD COLUMN IF NOT EXISTS requerente TEXT;
    ALTER TABLE historico_eventos ADD COLUMN IF NOT EXISTS requerente TEXT;
    ALTER TABLE eventos ADD COLUMN IF NOT EXISTS plantao_eventos TEXT;
    ALTER TABLE historico_eventos ADD COLUMN IF NOT EXISTS plantao_eventos TEXT;
    ALTER TABLE eventos ADD COLUMN IF NOT EXISTS eq_pendente BOOLEAN DEFAULT false;
    ALTER TABLE historico_eventos ADD COLUMN IF NOT EXISTS eq_pendente BOOLEAN DEFAULT false;

    CREATE TABLE IF NOT EXISTS equipamentos_pendentes (
      id TEXT PRIMARY KEY,
      nome_evento TEXT NOT NULL,
      adicionado_por TEXT NOT NULL,
      data_hora TIMESTAMP NOT NULL,
      dia_semana TEXT NOT NULL,
      local_evento TEXT NOT NULL,
      funcionario_plantao TEXT,
      plantao_eventos TEXT,
      equipamentos_necessarios TEXT,
      numero_chamado TEXT,
      requerente TEXT,
      removido BOOLEAN DEFAULT false,
      concluido BOOLEAN DEFAULT false,
      data_remocao TIMESTAMP,
      data_conclusao TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventario_itens (
      id TEXT PRIMARY KEY,
      item TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventario_unidades (
      id TEXT PRIMARY KEY,
      item_id TEXT REFERENCES inventario_itens(id) ON DELETE CASCADE,
      modelo TEXT,
      patrimonio TEXT,
      localizacao TEXT,
      requerente TEXT,
      montado_por TEXT,
      quantidade TEXT DEFAULT '',
      status TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL
    );

    ALTER TABLE inventario_unidades ADD COLUMN IF NOT EXISTS quantidade TEXT DEFAULT '';
    ALTER TABLE inventario_itens ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
    ALTER TABLE inventario_unidades ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

    CREATE TABLE IF NOT EXISTS inventario_historico (
      id TEXT PRIMARY KEY,
      unidade_id TEXT REFERENCES inventario_unidades(id) ON DELETE CASCADE,
      data TIMESTAMP NOT NULL,
      descricao TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS historico_contadores (
      id TEXT PRIMARY KEY,
      valor INTEGER NOT NULL DEFAULT 0
    );

    INSERT INTO historico_contadores (id, valor)
    VALUES ('removidos', 0)
    ON CONFLICT (id) DO NOTHING;

    CREATE TABLE IF NOT EXISTS impressoras (
      id TEXT PRIMARY KEY,
      local_texto TEXT,
      sede TEXT,
      marca TEXT,
      modelo TEXT,
      numero_serie TEXT,
      ip TEXT,
      mac TEXT,
      toner_preto INTEGER DEFAULT 100,
      toner_ciano INTEGER DEFAULT 100,
      toner_magenta INTEGER DEFAULT 100,
      toner_amarelo INTEGER DEFAULT 100,
      updated_at TIMESTAMP NOT NULL
    );

    ALTER TABLE impressoras ADD COLUMN IF NOT EXISTS sede TEXT;
    ALTER TABLE impressoras ADD COLUMN IF NOT EXISTS link TEXT;
    ALTER TABLE impressoras ADD COLUMN IF NOT EXISTS glpi_id TEXT;

    CREATE TABLE IF NOT EXISTS tarefas (
      id TEXT PRIMARY KEY,
      tarefa TEXT NOT NULL,
      descricao TEXT,
      prioridade TEXT NOT NULL DEFAULT 'media',
      status TEXT NOT NULL DEFAULT 'pendente',
      responsavel TEXT,
      prazo TIMESTAMP,
      chamado TEXT,
      data_criacao TIMESTAMP,
      updated_at TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS historico_tarefas (
      id TEXT PRIMARY KEY,
      tarefa TEXT NOT NULL,
      descricao TEXT,
      prioridade TEXT NOT NULL DEFAULT 'media',
      status TEXT NOT NULL,
      responsavel TEXT,
      prazo TIMESTAMP,
      chamado TEXT,
      data_criacao TIMESTAMP,
      updated_at TIMESTAMP NOT NULL
    );

    INSERT INTO historico_tarefas
      SELECT * FROM tarefas WHERE status IN ('concluida', 'cancelada')
    ON CONFLICT (id) DO NOTHING;

    DELETE FROM tarefas WHERE status IN ('concluida', 'cancelada');

    CREATE TABLE IF NOT EXISTS toner_registros (
      id TEXT PRIMARY KEY,
      tipo TEXT NOT NULL,
      modelo TEXT,
      preto INTEGER DEFAULT 0,
      ciano INTEGER DEFAULT 0,
      magenta INTEGER DEFAULT 0,
      amarelo INTEGER DEFAULT 0,
      updated_at TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS escalas_plantao (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      ano INTEGER NOT NULL,
      mes INTEGER NOT NULL,
      dias TEXT NOT NULL DEFAULT '[]',
      updated_at TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS equipe_ti (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      matricula TEXT NOT NULL DEFAULT '',
      ferias BOOLEAN NOT NULL DEFAULT false,
      ordem INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL
    );

    ALTER TABLE equipe_ti ADD COLUMN IF NOT EXISTS ferias_inicio TEXT DEFAULT '';
    ALTER TABLE equipe_ti ADD COLUMN IF NOT EXISTS ferias_fim TEXT DEFAULT '';
    ALTER TABLE equipe_ti ADD COLUMN IF NOT EXISTS cargo TEXT DEFAULT '';

    CREATE TABLE IF NOT EXISTS feriados (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      nome TEXT NOT NULL DEFAULT '',
      com_plantao BOOLEAN NOT NULL DEFAULT false,
      updated_at TIMESTAMP NOT NULL
    );

    DROP TABLE IF EXISTS cameras_historico;
    DROP TABLE IF EXISTS cameras_unidades;
    DROP TABLE IF EXISTS cameras_itens;

    CREATE TABLE IF NOT EXISTS cameras (
      id TEXT PRIMARY KEY,
      local_texto TEXT DEFAULT '',
      sede TEXT DEFAULT '',
      marca TEXT DEFAULT '',
      modelo TEXT DEFAULT '',
      ip TEXT DEFAULT '',
      rat TEXT DEFAULT '',
      chamado TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'online',
      historico TEXT NOT NULL DEFAULT '[]',
      updated_at TIMESTAMP NOT NULL
    );

    ALTER TABLE cameras ADD COLUMN IF NOT EXISTS chamado TEXT DEFAULT '';

    CREATE TABLE IF NOT EXISTS manutencao_registros (
      id TEXT PRIMARY KEY,
      equipamento TEXT DEFAULT '',
      nm TEXT DEFAULT '',
      local_texto TEXT DEFAULT '',
      patrimonio TEXT DEFAULT '',
      fornecedor TEXT DEFAULT '',
      sede TEXT DEFAULT '',
      updated_at TIMESTAMP NOT NULL
    );

    ALTER TABLE manutencao_registros ADD COLUMN IF NOT EXISTS sede TEXT DEFAULT '';

    CREATE TABLE IF NOT EXISTS tv_config (
      id TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
};

// Cria/atualiza os usuários admin e viewer a partir do .env.
// O .env é a fonte de verdade: ao reiniciar, a senha e o role do usuário
// existente são sincronizados com o que está configurado.
const seedUsuarios = async () => {
  const semente = [
    {
      username: (process.env.ADMIN_USER || "admin").toLowerCase(),
      password: process.env.ADMIN_PASSWORD,
      role: "admin",
    },
    {
      username: (process.env.VIEWER_USER || "viewer").toLowerCase(),
      password: process.env.VIEWER_PASSWORD,
      role: "viewer",
    },
  ];

  for (const { username, password, role } of semente) {
    if (!password) {
      console.warn(
        `Senha do usuário "${username}" (${role}) não definida no .env — pulando seed.`,
      );
      continue;
    }
    const hash = bcrypt.hashSync(password, 10);
    await pool.query(
      `INSERT INTO usuarios (id, username, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role`,
      [crypto.randomUUID(), username, hash, role],
    );
  }
};

const rowToTarefa = (row) => ({
  id: row.id,
  tarefa: row.tarefa || "",
  descricao: row.descricao || "",
  prioridade: row.prioridade || "media",
  status: row.status || "pendente",
  responsavel: row.responsavel || "",
  prazo: row.prazo ? new Date(row.prazo).toISOString() : "",
  chamado: row.chamado || "",
  dataCriacao: row.data_criacao ? new Date(row.data_criacao).toISOString() : "",
  updatedAt: new Date(row.updated_at).toISOString(),
});

const rowToTonerRegistro = (row) => ({
  id: row.id,
  tipo: row.tipo,
  modelo: row.modelo || "",
  preto: row.preto ?? 0,
  ciano: row.ciano ?? 0,
  magenta: row.magenta ?? 0,
  amarelo: row.amarelo ?? 0,
  updatedAt: new Date(row.updated_at).toISOString(),
});

const rowToImpressora = (row) => ({
  id: row.id,
  glpiId: row.glpi_id || null,
  local: row.local_texto || "",
  sede: row.sede || "",
  marca: row.marca || "",
  modelo: row.modelo || "",
  numeroSerie: row.numero_serie || "",
  ip: row.ip || "",
  mac: row.mac || "",
  link: row.link || "",
  tonerPreto: row.toner_preto ?? 100,
  tonerCiano: row.toner_ciano !== null && row.toner_ciano !== undefined ? Number(row.toner_ciano) : null,
  tonerMagenta: row.toner_magenta !== null && row.toner_magenta !== undefined ? Number(row.toner_magenta) : null,
  tonerAmarelo: row.toner_amarelo !== null && row.toner_amarelo !== undefined ? Number(row.toner_amarelo) : null,
  updatedAt: new Date(row.updated_at).toISOString(),
});

const rowToMembro = (row) => ({
  id: row.id,
  nome: row.nome || "",
  matricula: row.matricula || "",
  cargo: row.cargo || "",
  feriasInicio: row.ferias_inicio || "",
  feriasFim: row.ferias_fim || "",
  ordem: row.ordem ?? 0,
  updatedAt: new Date(row.updated_at).toISOString(),
});

const rowToFeriado = (row) => ({
  id: row.id,
  data: row.data || "",
  nome: row.nome || "",
  comPlantao: !!row.com_plantao,
  updatedAt: new Date(row.updated_at).toISOString(),
});

const rowToEscala = (row) => {
  let dias = [];
  try {
    dias = JSON.parse(row.dias || "[]");
  } catch {
    dias = [];
  }
  return {
    id: row.id,
    titulo: row.titulo || "",
    ano: row.ano,
    mes: row.mes,
    dias: Array.isArray(dias) ? dias : [],
    updatedAt: new Date(row.updated_at).toISOString(),
  };
};

const rowToEvento = (row) => ({
  id: row.id,
  nomeEvento: row.nome_evento,
  adicionadoPor: row.adicionado_por,
  dataHora: new Date(row.data_hora).toISOString(),
  diaSemana: row.dia_semana,
  localEvento: row.local_evento,
  funcionarioPlantao: row.funcionario_plantao || "",
  plantaoEventos: row.plantao_eventos || "",
  equipamentosNecessarios: row.equipamentos_necessarios || "",
  numeroChamado: row.numero_chamado || "",
  requerente: row.requerente || "",
  removido: Boolean(row.removido),
  concluido: Boolean(row.concluido),
  eqPendente: Boolean(row.eq_pendente),
  dataRemocao: row.data_remocao
    ? new Date(row.data_remocao).toISOString()
    : undefined,
  dataConclusao: row.data_conclusao
    ? new Date(row.data_conclusao).toISOString()
    : undefined,
});

const upsertEventos = async (client, tableName, eventos) => {
  const ids = eventos.map((evento) => evento.id);
  await client.query(
    `DELETE FROM ${tableName} WHERE NOT (id = ANY($1::text[]))`,
    [ids],
  );

  for (const evento of eventos) {
    await client.query(
      `
        INSERT INTO ${tableName} (
          id, nome_evento, adicionado_por, data_hora, dia_semana, local_evento,
          funcionario_plantao, plantao_eventos, equipamentos_necessarios, numero_chamado, requerente,
          removido, concluido, eq_pendente, data_remocao, data_conclusao
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (id) DO UPDATE SET
          nome_evento = EXCLUDED.nome_evento,
          adicionado_por = EXCLUDED.adicionado_por,
          data_hora = EXCLUDED.data_hora,
          dia_semana = EXCLUDED.dia_semana,
          local_evento = EXCLUDED.local_evento,
          funcionario_plantao = EXCLUDED.funcionario_plantao,
          plantao_eventos = EXCLUDED.plantao_eventos,
          equipamentos_necessarios = EXCLUDED.equipamentos_necessarios,
          numero_chamado = EXCLUDED.numero_chamado,
          requerente = EXCLUDED.requerente,
          removido = EXCLUDED.removido,
          concluido = EXCLUDED.concluido,
          eq_pendente = EXCLUDED.eq_pendente,
          data_remocao = EXCLUDED.data_remocao,
          data_conclusao = EXCLUDED.data_conclusao
      `,
      [
        evento.id,
        evento.nomeEvento,
        evento.adicionadoPor || "",
        evento.dataHora,
        evento.diaSemana,
        evento.localEvento,
        evento.funcionarioPlantao || "",
        evento.plantaoEventos || "",
        evento.equipamentosNecessarios || "",
        evento.numeroChamado || "",
        evento.requerente || "",
        Boolean(evento.removido),
        Boolean(evento.concluido),
        Boolean(evento.eqPendente),
        evento.dataRemocao || null,
        evento.dataConclusao || null,
      ],
    );
  }
};

const getEventosFromTable = async (tableName) => {
  const result = await pool.query(
    `SELECT * FROM ${tableName} ORDER BY data_hora ASC`,
  );
  return result.rows.map(rowToEvento);
};

app.get("/api/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/eventos", async (_req, res, next) => {
  try {
    res.json(await getEventosFromTable("eventos"));
  } catch (error) {
    next(error);
  }
});

app.put("/api/eventos", async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await upsertEventos(client, "eventos", req.body || []);
    await client.query("COMMIT");
    res.json(await getEventosFromTable("eventos"));
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

app.get("/api/historico", async (_req, res, next) => {
  try {
    res.json(await getEventosFromTable("historico_eventos"));
  } catch (error) {
    next(error);
  }
});

app.put("/api/historico", async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await upsertEventos(client, "historico_eventos", req.body || []);
    await client.query("COMMIT");
    res.json(await getEventosFromTable("historico_eventos"));
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

app.get("/api/equipamentos-pendentes", async (_req, res, next) => {
  try {
    res.json(await getEventosFromTable("equipamentos_pendentes"));
  } catch (error) {
    next(error);
  }
});

app.put("/api/equipamentos-pendentes", async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await upsertEventos(client, "equipamentos_pendentes", req.body || []);
    await client.query("COMMIT");
    res.json(await getEventosFromTable("equipamentos_pendentes"));
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

app.get("/api/historico-contadores/removidos", async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT valor FROM historico_contadores WHERE id = 'removidos'",
    );
    res.json({ valor: result.rows[0]?.valor ?? 0 });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/historico-contadores/removidos/increment",
  async (_req, res, next) => {
    try {
      const result = await pool.query(`
        INSERT INTO historico_contadores (id, valor)
        VALUES ('removidos', 1)
        ON CONFLICT (id) DO UPDATE SET valor = historico_contadores.valor + 1
        RETURNING valor
      `);
      res.json({ valor: result.rows[0].valor });
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/inventario", async (_req, res, next) => {
  try {
    const itensResult = await pool.query(
      "SELECT * FROM inventario_itens ORDER BY position ASC, updated_at ASC",
    );
    const unidadesResult = await pool.query(
      "SELECT * FROM inventario_unidades ORDER BY position ASC, updated_at ASC",
    );
    const historicoResult = await pool.query(
      "SELECT * FROM inventario_historico ORDER BY data DESC",
    );

    const historicoPorUnidade = new Map();
    for (const entry of historicoResult.rows) {
      const lista = historicoPorUnidade.get(entry.unidade_id) || [];
      lista.push({
        id: entry.id,
        data: new Date(entry.data).toISOString(),
        descricao: entry.descricao,
      });
      historicoPorUnidade.set(entry.unidade_id, lista);
    }

    const unidadesPorItem = new Map();
    for (const unidade of unidadesResult.rows) {
      const lista = unidadesPorItem.get(unidade.item_id) || [];
      lista.push({
        id: unidade.id,
        modelo: unidade.modelo || "",
        patrimonio: unidade.patrimonio || "",
        localizacao: unidade.localizacao || "",
        requerente: unidade.requerente || "",
        montadoPor: unidade.montado_por || "",
        problema: unidade.quantidade || "",
        status: unidade.status,
        historico: historicoPorUnidade.get(unidade.id) || [],
        updatedAt: new Date(unidade.updated_at).toISOString(),
      });
      unidadesPorItem.set(unidade.item_id, lista);
    }

    res.json(
      itensResult.rows.map((item) => ({
        id: item.id,
        item: item.item,
        unidades: unidadesPorItem.get(item.id) || [],
        updatedAt: new Date(item.updated_at).toISOString(),
      })),
    );
  } catch (error) {
    next(error);
  }
});

app.put("/api/inventario", async (req, res, next) => {
  const itens = req.body || [];
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM inventario_itens");

    for (const [itemIdx, item] of itens.entries()) {
      await client.query(
        "INSERT INTO inventario_itens (id, item, updated_at, position) VALUES ($1, $2, $3, $4)",
        [item.id, item.item, item.updatedAt, itemIdx],
      );

      for (const [uIdx, unidade] of (item.unidades || []).entries()) {
        await client.query(
          `
            INSERT INTO inventario_unidades (
              id, item_id, modelo, patrimonio, localizacao, requerente,
              montado_por, quantidade, status, updated_at, position
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `,
          [
            unidade.id,
            item.id,
            unidade.modelo || "",
            unidade.patrimonio || "",
            unidade.localizacao || "",
            unidade.requerente || "",
            unidade.montadoPor || "",
            unidade.problema || "",
            unidade.status,
            unidade.updatedAt,
            uIdx,
          ],
        );

        for (const entry of unidade.historico || []) {
          await client.query(
            `
              INSERT INTO inventario_historico (id, unidade_id, data, descricao)
              VALUES ($1, $2, $3, $4)
            `,
            [entry.id, unidade.id, entry.data, entry.descricao],
          );
        }
      }
    }

    await client.query("COMMIT");
    res.json(itens);
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});
const rowToCamera = (row) => ({
  id: row.id,
  local: row.local_texto || "",
  sede: row.sede || "",
  marca: row.marca || "",
  modelo: row.modelo || "",
  ip: row.ip || "",
  rat: row.rat || "",
  chamado: row.chamado || "",
  status: row.status,
  historico: (() => { try { return JSON.parse(row.historico || "[]"); } catch { return []; } })(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

app.get("/api/cameras", async (_req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM cameras ORDER BY updated_at ASC");
    res.json(result.rows.map(rowToCamera));
  } catch (error) {
    next(error);
  }
});

app.put("/api/cameras", async (req, res, next) => {
  const cameras = req.body || [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ids = cameras.map((c) => c.id);
    if (ids.length > 0) {
      await client.query("DELETE FROM cameras WHERE NOT (id = ANY($1::text[]))", [ids]);
    } else {
      await client.query("DELETE FROM cameras");
    }
    for (const c of cameras) {
      await client.query(
        `INSERT INTO cameras (id, local_texto, sede, marca, modelo, ip, rat, chamado, status, historico, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           local_texto = EXCLUDED.local_texto,
           sede = EXCLUDED.sede,
           marca = EXCLUDED.marca,
           modelo = EXCLUDED.modelo,
           ip = EXCLUDED.ip,
           rat = EXCLUDED.rat,
           chamado = EXCLUDED.chamado,
           status = EXCLUDED.status,
           historico = EXCLUDED.historico,
           updated_at = EXCLUDED.updated_at`,
        [
          c.id,
          c.local || "",
          c.sede || "",
          c.marca || "",
          c.modelo || "",
          c.ip || "",
          c.rat || "",
          c.chamado || "",
          c.status || "online",
          JSON.stringify(c.historico || []),
          c.updatedAt,
        ],
      );
    }
    await client.query("COMMIT");
    const result = await pool.query("SELECT * FROM cameras ORDER BY updated_at ASC");
    res.json(result.rows.map(rowToCamera));
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

app.get("/api/impressoras", async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM impressoras ORDER BY updated_at ASC",
    );
    res.json(result.rows.map(rowToImpressora));
  } catch (error) {
    next(error);
  }
});

app.put("/api/impressoras", async (req, res, next) => {
  const impressoras = req.body || [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ids = impressoras.map((imp) => imp.id);
    if (ids.length > 0) {
      await client.query(
        "DELETE FROM impressoras WHERE NOT (id = ANY($1::text[]))",
        [ids],
      );
    } else {
      await client.query("DELETE FROM impressoras");
    }
    for (const imp of impressoras) {
      await client.query(
        `
        INSERT INTO impressoras (
          id, glpi_id, local_texto, sede, marca, modelo, numero_serie, ip, mac, link,
          toner_preto, toner_ciano, toner_magenta, toner_amarelo, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          glpi_id = EXCLUDED.glpi_id,
          local_texto = EXCLUDED.local_texto,
          sede = EXCLUDED.sede,
          marca = EXCLUDED.marca,
          modelo = EXCLUDED.modelo,
          numero_serie = EXCLUDED.numero_serie,
          ip = EXCLUDED.ip,
          mac = EXCLUDED.mac,
          link = EXCLUDED.link,
          toner_preto = EXCLUDED.toner_preto,
          toner_ciano = EXCLUDED.toner_ciano,
          toner_magenta = EXCLUDED.toner_magenta,
          toner_amarelo = EXCLUDED.toner_amarelo,
          updated_at = EXCLUDED.updated_at
        `,
        [
          imp.id,
          imp.glpiId || null,
          imp.local || "",
          imp.sede || "",
          imp.marca || "",
          imp.modelo || "",
          imp.numeroSerie || "",
          imp.ip || "",
          imp.mac || "",
          imp.link || "",
          imp.tonerPreto ?? 100,
          imp.tonerCiano ?? null,
          imp.tonerMagenta ?? null,
          imp.tonerAmarelo ?? null,
          imp.updatedAt,
        ],
      );
    }
    await client.query("COMMIT");
    const result = await pool.query(
      "SELECT * FROM impressoras ORDER BY updated_at ASC",
    );
    res.json(result.rows.map(rowToImpressora));
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

app.get("/api/escalas", async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM escalas_plantao ORDER BY ano ASC, mes ASC",
    );
    res.json(result.rows.map(rowToEscala));
  } catch (error) {
    next(error);
  }
});

app.put("/api/escalas", async (req, res, next) => {
  const escalas = req.body || [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ids = escalas.map((e) => e.id);
    if (ids.length > 0) {
      await client.query(
        "DELETE FROM escalas_plantao WHERE NOT (id = ANY($1::text[]))",
        [ids],
      );
    } else {
      await client.query("DELETE FROM escalas_plantao");
    }
    for (const e of escalas) {
      await client.query(
        `INSERT INTO escalas_plantao (id, titulo, ano, mes, dias, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           titulo = EXCLUDED.titulo,
           ano = EXCLUDED.ano,
           mes = EXCLUDED.mes,
           dias = EXCLUDED.dias,
           updated_at = EXCLUDED.updated_at`,
        [
          e.id,
          e.titulo || "",
          Number(e.ano) || 0,
          Number(e.mes) || 0,
          JSON.stringify(Array.isArray(e.dias) ? e.dias : []),
          e.updatedAt,
        ],
      );
    }
    await client.query("COMMIT");
    const result = await pool.query(
      "SELECT * FROM escalas_plantao ORDER BY ano ASC, mes ASC",
    );
    res.json(result.rows.map(rowToEscala));
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

app.get("/api/equipe", async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM equipe_ti ORDER BY ordem ASC",
    );
    res.json(result.rows.map(rowToMembro));
  } catch (error) {
    next(error);
  }
});

app.put("/api/equipe", async (req, res, next) => {
  const membros = req.body || [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ids = membros.map((m) => m.id);
    if (ids.length > 0) {
      await client.query(
        "DELETE FROM equipe_ti WHERE NOT (id = ANY($1::text[]))",
        [ids],
      );
    } else {
      await client.query("DELETE FROM equipe_ti");
    }
    for (const m of membros) {
      await client.query(
        `INSERT INTO equipe_ti (id, nome, matricula, cargo, ferias_inicio, ferias_fim, ordem, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           nome = EXCLUDED.nome,
           matricula = EXCLUDED.matricula,
           cargo = EXCLUDED.cargo,
           ferias_inicio = EXCLUDED.ferias_inicio,
           ferias_fim = EXCLUDED.ferias_fim,
           ordem = EXCLUDED.ordem,
           updated_at = EXCLUDED.updated_at`,
        [
          m.id,
          m.nome || "",
          m.matricula || "",
          m.cargo || "",
          m.feriasInicio || "",
          m.feriasFim || "",
          Number(m.ordem) || 0,
          m.updatedAt,
        ],
      );
    }
    await client.query("COMMIT");
    const result = await pool.query(
      "SELECT * FROM equipe_ti ORDER BY ordem ASC",
    );
    res.json(result.rows.map(rowToMembro));
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

app.get("/api/feriados", async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM feriados ORDER BY data ASC",
    );
    res.json(result.rows.map(rowToFeriado));
  } catch (error) {
    next(error);
  }
});

app.put("/api/feriados", async (req, res, next) => {
  const feriados = req.body || [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ids = feriados.map((f) => f.id);
    if (ids.length > 0) {
      await client.query(
        "DELETE FROM feriados WHERE NOT (id = ANY($1::text[]))",
        [ids],
      );
    } else {
      await client.query("DELETE FROM feriados");
    }
    for (const f of feriados) {
      await client.query(
        `INSERT INTO feriados (id, data, nome, com_plantao, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           data = EXCLUDED.data,
           nome = EXCLUDED.nome,
           com_plantao = EXCLUDED.com_plantao,
           updated_at = EXCLUDED.updated_at`,
        [f.id, f.data || "", f.nome || "", !!f.comPlantao, f.updatedAt],
      );
    }
    await client.query("COMMIT");
    const result = await pool.query("SELECT * FROM feriados ORDER BY data ASC");
    res.json(result.rows.map(rowToFeriado));
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

app.get("/api/toners", async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM toner_registros ORDER BY id ASC",
    );
    res.json(result.rows.map(rowToTonerRegistro));
  } catch (error) {
    next(error);
  }
});

app.put("/api/toners", async (req, res, next) => {
  const registros = req.body || [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ids = registros.map((r) => r.id);
    if (ids.length > 0) {
      await client.query(
        "DELETE FROM toner_registros WHERE NOT (id = ANY($1::text[]))",
        [ids],
      );
    } else {
      await client.query("DELETE FROM toner_registros");
    }
    for (const r of registros) {
      await client.query(
        `INSERT INTO toner_registros (id, tipo, modelo, preto, ciano, magenta, amarelo, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           tipo = EXCLUDED.tipo,
           modelo = EXCLUDED.modelo,
           preto = EXCLUDED.preto,
           ciano = EXCLUDED.ciano,
           magenta = EXCLUDED.magenta,
           amarelo = EXCLUDED.amarelo,
           updated_at = EXCLUDED.updated_at`,
        [
          r.id,
          r.tipo,
          r.modelo || "",
          r.preto ?? 0,
          r.ciano ?? 0,
          r.magenta ?? 0,
          r.amarelo ?? 0,
          r.updatedAt,
        ],
      );
    }
    await client.query("COMMIT");
    const result = await pool.query(
      "SELECT * FROM toner_registros ORDER BY id ASC",
    );
    res.json(result.rows.map(rowToTonerRegistro));
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

const rowToManutencao = (row) => ({
  id: row.id,
  equipamento: row.equipamento || "",
  nm: row.nm || "",
  local: row.local_texto || "",
  patrimonio: row.patrimonio || "",
  fornecedor: row.fornecedor || "",
  sede: row.sede || "",
  updatedAt: new Date(row.updated_at).toISOString(),
});

app.get("/api/manutencao", async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM manutencao_registros ORDER BY updated_at ASC",
    );
    res.json(result.rows.map(rowToManutencao));
  } catch (error) {
    next(error);
  }
});

app.put("/api/manutencao", async (req, res, next) => {
  const registros = req.body || [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ids = registros.map((r) => r.id);
    if (ids.length > 0) {
      await client.query(
        "DELETE FROM manutencao_registros WHERE NOT (id = ANY($1::text[]))",
        [ids],
      );
    } else {
      await client.query("DELETE FROM manutencao_registros");
    }
    for (const r of registros) {
      await client.query(
        `INSERT INTO manutencao_registros (id, equipamento, nm, local_texto, patrimonio, fornecedor, sede, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           equipamento = EXCLUDED.equipamento,
           nm = EXCLUDED.nm,
           local_texto = EXCLUDED.local_texto,
           patrimonio = EXCLUDED.patrimonio,
           fornecedor = EXCLUDED.fornecedor,
           sede = EXCLUDED.sede,
           updated_at = EXCLUDED.updated_at`,
        [
          r.id,
          r.equipamento || "",
          r.nm || "",
          r.local || "",
          r.patrimonio || "",
          r.fornecedor || "",
          r.sede || "",
          r.updatedAt,
        ],
      );
    }
    await client.query("COMMIT");
    const result = await pool.query(
      "SELECT * FROM manutencao_registros ORDER BY updated_at ASC",
    );
    res.json(result.rows.map(rowToManutencao));
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

const TAREFA_FINISHED_STATUSES = ["concluida", "cancelada"];

const upsertTarefa = async (client, tableName, t) => {
  await client.query(
    `INSERT INTO ${tableName} (id, tarefa, descricao, prioridade, status, responsavel, prazo, chamado, data_criacao, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       tarefa = EXCLUDED.tarefa,
       descricao = EXCLUDED.descricao,
       prioridade = EXCLUDED.prioridade,
       status = EXCLUDED.status,
       responsavel = EXCLUDED.responsavel,
       prazo = EXCLUDED.prazo,
       chamado = EXCLUDED.chamado,
       data_criacao = EXCLUDED.data_criacao,
       updated_at = EXCLUDED.updated_at`,
    [
      t.id,
      t.tarefa || "",
      t.descricao || "",
      t.prioridade || "media",
      t.status || "pendente",
      t.responsavel || "",
      t.prazo || null,
      t.chamado || "",
      t.dataCriacao || null,
      t.updatedAt,
    ],
  );
};

app.get("/api/tarefas", async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM tarefas ORDER BY updated_at ASC",
    );
    res.json(result.rows.map(rowToTarefa));
  } catch (error) {
    next(error);
  }
});

app.put("/api/tarefas", async (req, res, next) => {
  const tarefas = req.body || [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ativas = tarefas.filter(
      (t) => !TAREFA_FINISHED_STATUSES.includes(t.status),
    );
    const finalizadas = tarefas.filter((t) =>
      TAREFA_FINISHED_STATUSES.includes(t.status),
    );

    const ativasIds = ativas.map((t) => t.id);
    if (ativasIds.length > 0) {
      await client.query(
        "DELETE FROM tarefas WHERE NOT (id = ANY($1::text[]))",
        [ativasIds],
      );
    } else {
      await client.query("DELETE FROM tarefas");
    }
    for (const t of ativas) {
      await upsertTarefa(client, "tarefas", t);
    }

    for (const t of finalizadas) {
      await client.query("DELETE FROM tarefas WHERE id = $1", [t.id]);
      await upsertTarefa(client, "historico_tarefas", t);
    }

    await client.query("COMMIT");
    const result = await pool.query(
      "SELECT * FROM tarefas ORDER BY updated_at ASC",
    );
    res.json(result.rows.map(rowToTarefa));
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

app.get("/api/historico-tarefas", async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM historico_tarefas ORDER BY updated_at DESC",
    );
    res.json(result.rows.map(rowToTarefa));
  } catch (error) {
    next(error);
  }
});

app.get("/api/tv-config", async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT valor FROM tv_config WHERE id = 'tv'",
    );
    if (result.rows.length === 0) {
      res.json(null);
      return;
    }
    res.json(JSON.parse(result.rows[0].valor));
  } catch (error) {
    next(error);
  }
});

app.put("/api/tv-config", async (req, res, next) => {
  try {
    const valor = JSON.stringify(req.body ?? {});
    await pool.query(
      `INSERT INTO tv_config (id, valor)
       VALUES ('tv', $1)
       ON CONFLICT (id) DO UPDATE SET valor = EXCLUDED.valor`,
      [valor],
    );
    res.json(req.body ?? {});
  } catch (error) {
    next(error);
  }
});

// --- CONFIGURAÇÃO E INTEGRAÇÃO DO GLPI ---
const GLPI_API_URL = process.env.GLPI_API_URL || "";
const GLPI_APP_TOKEN = process.env.GLPI_APP_TOKEN || "";
const GLPI_USER_TOKEN = process.env.GLPI_USER_TOKEN || "";

let syncTimeoutId = null;
let syncIntervalId = null;

async function initGlpiSession() {
  if (!GLPI_API_URL) {
    throw new Error("A variável GLPI_API_URL não está configurada no .env");
  }
  const res = await fetch(`${GLPI_API_URL}/initSession`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "App-Token": GLPI_APP_TOKEN,
      "Authorization": `user_token ${GLPI_USER_TOKEN}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro ao autenticar no GLPI (${res.status}): ${text}`);
  }
  const data = await res.json();
  const sessionToken = data.session_token;

  // Alterna para a entidade do setor de TI (padrão Entidade ID 1 "GNU > TI", ou a definida no .env)
  const entityId = process.env.GLPI_ENTITY_ID || "1";
  try {
    await fetch(`${GLPI_API_URL}/changeActiveEntities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "App-Token": GLPI_APP_TOKEN,
        "Session-Token": sessionToken,
      },
      body: JSON.stringify({ entities_id: Number(entityId), is_recursive: true }),
    });
  } catch (err) {
    console.error("[GLPI] Erro ao alternar entidade ativa para TI:", err.message);
  }

  return sessionToken;
}

async function killGlpiSession(sessionToken) {
  if (!GLPI_API_URL || !sessionToken) return;
  try {
    await fetch(`${GLPI_API_URL}/killSession`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "App-Token": GLPI_APP_TOKEN,
        "Session-Token": sessionToken,
      },
    });
  } catch (e) {
    console.error("[GLPI] Erro ao encerrar sessão:", e.message);
  }
}

async function getTonerDirectlyFromPrinter(ip) {
  if (!ip) return null;
  const cleanedIp = ip.trim();
  if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(cleanedIp)) {
    return null;
  }
  
  try {
    const url = `http://${cleanedIp}/home/status.html`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    
    const htmlContent = await res.text();
    const imgRegex = /<img[^>]+class="tonerremain"[^>]*>/gi;
    
    let levels = null;
    let match;
    
    while ((match = imgRegex.exec(htmlContent)) !== null) {
      const imgTag = match[0];
      const altMatch = /alt="([^"]+)"/i.exec(imgTag);
      const srcMatch = /src="([^"]+)"/i.exec(imgTag);
      const heightMatch = /height="(\d+)"/i.exec(imgTag);
      
      if (heightMatch) {
        const height = parseInt(heightMatch[1], 10);
        // O container tem 60px de altura no CSS, a imagem do toner costuma ter no máximo 56px.
        const percentage = Math.min(100, Math.max(0, Math.round((height / 56) * 100)));
        const name = (altMatch?.[1] || srcMatch?.[1] || "").toLowerCase();
        
        let color = "preto";
        let isColorFound = false;
        if (name.includes("cyan") || name.includes("ciano")) {
          color = "ciano";
          isColorFound = true;
        } else if (name.includes("magenta")) {
          color = "magenta";
          isColorFound = true;
        } else if (name.includes("yellow") || name.includes("amarelo")) {
          color = "amarelo";
          isColorFound = true;
        } else if (name.includes("black") || name.includes("preto")) {
          color = "preto";
        }
        
        if (!levels) {
          levels = { preto: null, ciano: null, magenta: null, amarelo: null };
        }
        levels[color] = percentage;
      }
    }
    
    if (levels && levels.preto === null) {
      levels.preto = 100;
    }
    
    return levels;
  } catch (err) {
    console.log(`[Printer Scrape] Não foi possível obter dados direto da impressora no IP ${cleanedIp}:`, err.message);
    return null;
  }
}

async function getGlpiPrinterToner(sessionToken, printerId) {
  try {
    const res = await fetch(`${GLPI_API_URL}/Printer/${printerId}/Printer_CartridgeInfo`, {
      headers: {
        "App-Token": GLPI_APP_TOKEN,
        "Session-Token": sessionToken,
      },
    });
    if (!res.ok) {
      return { preto: 100, ciano: null, magenta: null, amarelo: null };
    }
    const cartridgeInfos = await res.json();
    
    // Se a impressora só tiver propriedades pretas (monocromática), podemos deixar as outras nulas
    let hasColor = false;
    if (Array.isArray(cartridgeInfos)) {
      cartridgeInfos.forEach((info) => {
        const prop = (info.property || "").toLowerCase();
        if (
          prop.includes("cyan") || 
          prop.includes("ciano") || 
          prop.includes("magenta") || 
          prop.includes("yellow") || 
          prop.includes("amarelo")
        ) {
          hasColor = true;
        }
      });
    }

    const levels = { 
      preto: 100, 
      ciano: hasColor ? 100 : null, 
      magenta: hasColor ? 100 : null, 
      amarelo: hasColor ? 100 : null 
    };
    
    if (Array.isArray(cartridgeInfos)) {
      cartridgeInfos.forEach((info) => {
        const prop = (info.property || "").toLowerCase();
        const val = String(info.value || "").toUpperCase().trim();
        
        let percentage = 100;
        if (val === "OK" || val === "CHEIO" || val === "FULL") {
          percentage = 85;
        } else if (val === "LOW" || val === "VAZIO" || val === "EMPTY" || val === "POUCO") {
          percentage = 10;
        } else {
          const parsed = parseInt(val, 10);
          if (!isNaN(parsed)) {
            percentage = parsed;
          }
        }
        
        if (prop.includes("black") || prop.includes("preto") || prop.includes("drumblack") || prop.includes("tamborpreto")) {
          // Preferimos o nível do toner para a cor preta no painel de toners
          if (prop.includes("toner")) {
            levels.preto = percentage;
          } else if (prop.includes("drum") && (levels.preto === 100 || levels.preto === 85)) {
            levels.preto = percentage;
          } else if (!prop.includes("toner") && !prop.includes("drum")) {
            levels.preto = percentage;
          }
        } else if (prop.includes("cyan") || prop.includes("ciano")) {
          levels.ciano = percentage;
        } else if (prop.includes("magenta")) {
          levels.magenta = percentage;
        } else if (prop.includes("yellow") || prop.includes("amarelo")) {
          levels.amarelo = percentage;
        }
      });
    }
    return levels;
  } catch (e) {
    console.error(`[GLPI] Erro ao obter toner para impressora ${printerId}:`, e.message);
    return { preto: 100, ciano: null, magenta: null, amarelo: null };
  }
}

async function executePrintersSync() {
  console.log("[GLPI Sync] Iniciando sincronização periódica de toners e dados de rede...");
  try {
    const sessionToken = await initGlpiSession();
    const res = await pool.query("SELECT id, glpi_id, marca, modelo FROM impressoras WHERE glpi_id IS NOT NULL");
    const printers = res.rows;
    
    for (const printer of printers) {
      console.log(`[GLPI Sync] Sincronizando impressora: ${printer.marca} ${printer.modelo} (GLPI ID: ${printer.glpi_id})`);
      
      let ip = null;
      let mac = null;
      let brand = null;
      let model = null;
      let serial = null;
      let location = null;
      
      try {
        const searchRes = await fetch(
          `${GLPI_API_URL}/search/Printer` +
          `?criteria[0][field]=2&criteria[0][searchtype]=equals&criteria[0][value]=${printer.glpi_id}` +
          `&forcedisplay[0]=1` +   // Nome
          `&forcedisplay[1]=23` +  // Fabricante (Marca)
          `&forcedisplay[2]=40` +  // Modelo
          `&forcedisplay[3]=5` +   // Número de Série
          `&forcedisplay[4]=21` +  // MAC
          `&forcedisplay[5]=126` + // IP
          `&forcedisplay[6]=3` +   // Localização
          `&range=0-1`,
          {
            headers: {
              "App-Token": GLPI_APP_TOKEN,
              "Session-Token": sessionToken
            }
          }
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const p = searchData.data?.[0];
          if (p) {
            brand = p["23"] || null;
            model = p["40"] || p["1"] || null;
            serial = p["5"] || null;
            mac = p["21"] || null;
            ip = p["126"] || null;
            location = p["3"] || null;
          }
        }
      } catch (err) {
        console.error(`[GLPI Sync] Erro ao buscar dados de rede para impressora ${printer.glpi_id}:`, err.message);
      }
      
      let toners = await getTonerDirectlyFromPrinter(ip);
      if (!toners) {
        toners = await getGlpiPrinterToner(sessionToken, printer.glpi_id);
      }
      
      await pool.query(
        `UPDATE impressoras 
         SET toner_preto = $1, toner_ciano = $2, toner_magenta = $3, toner_amarelo = $4,
             ip = COALESCE($5, ip), mac = COALESCE($6, mac), 
             marca = COALESCE($7, marca), modelo = COALESCE($8, modelo),
             numero_serie = COALESCE($9, numero_serie), local_texto = COALESCE($10, local_texto),
             updated_at = NOW()
         WHERE id = $11`,
        [
          toners.preto, toners.ciano, toners.magenta, toners.amarelo,
          ip, mac, brand, model, serial, location,
          printer.id
        ]
      );
    }
    
    await killGlpiSession(sessionToken);
    
    const agoraStr = new Date().toISOString();
    await pool.query(
      `INSERT INTO tv_config (id, valor) 
       VALUES ('last_glpi_impressoras_sync', $1) 
       ON CONFLICT (id) DO UPDATE SET valor = EXCLUDED.valor`,
      [agoraStr]
    );
    console.log(`[GLPI Sync] Sincronização concluída com sucesso em ${agoraStr}`);
  } catch (e) {
    console.error("[GLPI Sync] Falha na sincronização:", e.message);
  }
}

async function schedulePrintersSync() {
  try {
    const res = await pool.query("SELECT valor FROM tv_config WHERE id = 'last_glpi_impressoras_sync'");
    const lastSyncStr = res.rows[0]?.valor;
    
    const SEIS_HORAS_MS = 6 * 60 * 60 * 1000;
    const agora = Date.now();
    
    let tempoRestante = SEIS_HORAS_MS;
    
    if (lastSyncStr) {
      const lastSync = new Date(lastSyncStr).getTime();
      const tempoDecorrido = agora - lastSync;
      
      if (tempoDecorrido >= SEIS_HORAS_MS) {
        tempoRestante = 0;
      } else {
        tempoRestante = SEIS_HORAS_MS - tempoDecorrido;
      }
    } else {
      tempoRestante = 5000; // Primeira execução
    }
    
    console.log(`[GLPI Sync] Próxima sincronização programada para daqui a ${(tempoRestante / 1000 / 60).toFixed(1)} minutos.`);
    
    if (syncTimeoutId) clearTimeout(syncTimeoutId);
    if (syncTimeoutId) clearTimeout(syncTimeoutId);
    
    syncTimeoutId = setTimeout(async () => {
      await executePrintersSync();
      if (syncIntervalId) clearInterval(syncIntervalId);
      syncIntervalId = setInterval(executePrintersSync, SEIS_HORAS_MS);
    }, tempoRestante);
  } catch (e) {
    console.error("[GLPI Sync] Erro ao agendar sincronização:", e.message);
  }
}

// --- ENDPOINTS EXPRESS DO GLPI ---

app.get("/api/glpi/dashboard", async (req, res, next) => {
  let sessionToken = null;
  try {
    sessionToken = await initGlpiSession();
    
    const statuses = [
      { name: "novos", code: 1 },
      { name: "atribuidos", code: 2 },
      { name: "planejados", code: 3 },
      { name: "pendentes", code: 4 },
      { name: "solucionados", code: 5 },
      { name: "fechados", code: 6 }
    ];
    
    const statusCounts = {};
    await Promise.all(
      statuses.map(async (s) => {
        try {
          const response = await fetch(
            `${GLPI_API_URL}/search/Ticket?criteria[0][field]=12&criteria[0][searchtype]=equals&criteria[0][value]=${s.code}&range=0-1`,
            {
              headers: {
                "App-Token": GLPI_APP_TOKEN,
                "Session-Token": sessionToken
              }
            }
          );
          if (response.ok) {
            const data = await response.json();
            statusCounts[s.name] = data.totalcount || 0;
          } else {
            statusCounts[s.name] = 0;
          }
        } catch (e) {
          statusCounts[s.name] = 0;
        }
      })
    );
    
    let totalComputadores = 0;
    let totalImpressorasGlpi = 0;
    try {
      const compRes = await fetch(`${GLPI_API_URL}/search/Computer?range=0-1`, {
        headers: { "App-Token": GLPI_APP_TOKEN, "Session-Token": sessionToken }
      });
      if (compRes.ok) {
        const compData = await compRes.json();
        totalComputadores = compData.totalcount || 0;
      }
      const printRes = await fetch(`${GLPI_API_URL}/search/Printer?range=0-1`, {
        headers: { "App-Token": GLPI_APP_TOKEN, "Session-Token": sessionToken }
      });
      if (printRes.ok) {
        const printData = await printRes.json();
        totalImpressorasGlpi = printData.totalcount || 0;
      }
    } catch (e) {
      console.error("[GLPI] Erro ao buscar total de computadores/impressoras:", e.message);
    }
    
    let tecnicosList = [];
    let pessoasList = [];
    
    try {
      let usersMap = {};
      try {
        const usersResponse = await fetch(`${GLPI_API_URL}/User?range=0-1000`, {
          headers: {
            "App-Token": GLPI_APP_TOKEN,
            "Session-Token": sessionToken
          }
        });
        if (usersResponse.ok) {
          const usersList = await usersResponse.json();
          if (Array.isArray(usersList)) {
            usersList.forEach(u => {
              const fullname = [u.firstname, u.realname].filter(Boolean).join(" ") || u.name || `User ${u.id}`;
              usersMap[String(u.id)] = fullname;
            });
          }
        }
      } catch (err) {
        console.error("[GLPI] Erro ao carregar mapa de usuários:", err.message);
      }

      const ticketsResponse = await fetch(
        `${GLPI_API_URL}/search/Ticket?sort=2&order=DESC` +
        `&forcedisplay[0]=5` +  // Técnico (Usuário ID)
        `&forcedisplay[1]=4` +  // Requerente (Usuário ID)
        `&forcedisplay[2]=12` + // Status (1=Novo, 2=Atribuído, etc.)
        `&forcedisplay[3]=8` +  // Grupo Técnico (Nome)
        `&range=0-1000`,
        {
          headers: {
            "App-Token": GLPI_APP_TOKEN,
            "Session-Token": sessionToken
          }
        }
      );
      
      if (ticketsResponse.ok) {
        const data = await ticketsResponse.json();
        const tickets = data.data || [];
        
        const contagemTecnicos = {}; // id -> { nome, count }
        const contagemPessoas = {};  // id -> { nome, count }
        
        tickets.forEach(ticket => {
          const rawTech = ticket["5"];
          const techIds = Array.isArray(rawTech) ? rawTech.map(String) : [String(rawTech || "")];
          const pessoaId = String(ticket["4"] || "");
          const statusVal = Number(ticket["12"]);
          const grupoNome = String(ticket["8"] || "");
          
          const pessoaNome = typeof usersMap[pessoaId] === "string" ? usersMap[pessoaId] : null;
          
          if (statusVal === 6) {
            techIds.forEach(tecnicoId => {
              const tecnicoNome = typeof usersMap[tecnicoId] === "string" ? usersMap[tecnicoId] : null;
              if (tecnicoNome) {
                const lowerNome = tecnicoNome.toLowerCase().trim();
                if (
                  lowerNome !== "infraestrutura" &&
                  lowerNome !== "sistemas" &&
                  lowerNome !== "infra/sistemas"
                ) {
                  if (!contagemTecnicos[tecnicoId]) {
                    contagemTecnicos[tecnicoId] = { nome: tecnicoNome, count: 0 };
                  }
                  contagemTecnicos[tecnicoId].count++;
                }
              }
            });
          }
          if (pessoaNome && statusVal === 6) {
            const lowerNome = pessoaNome.toLowerCase().trim();
            if (
              lowerNome !== "infraestrutura" &&
              lowerNome !== "sistemas" &&
              lowerNome !== "infra/sistemas"
            ) {
              if (!contagemPessoas[pessoaId]) {
                contagemPessoas[pessoaId] = { nome: pessoaNome, count: 0 };
              }
              contagemPessoas[pessoaId].count++;
            }
          }
        });
        
        // Buscar chamados fechados do mês atual para o ranking mensal
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0] + ' 00:00:00';
        const contagemTecnicosMes = {};

        try {
          const ticketsMesRes = await fetch(
            `${GLPI_API_URL}/search/Ticket?sort=17&order=DESC` +
            `&forcedisplay[0]=5&forcedisplay[1]=12` +
            `&criteria[0][field]=12&criteria[0][searchtype]=equals&criteria[0][value]=6` +
            `&criteria[1][link]=AND&criteria[1][field]=17&criteria[1][searchtype]=morethan&criteria[1][value]=${encodeURIComponent(firstDayOfMonth)}` +
            `&range=0-1000`,
            {
              headers: {
                "App-Token": GLPI_APP_TOKEN,
                "Session-Token": sessionToken
              }
            }
          );
          if (ticketsMesRes.ok) {
            const dataMes = await ticketsMesRes.json();
            (dataMes.data || []).forEach(t => {
              const rawTech = t["5"];
              const techIds = Array.isArray(rawTech) ? rawTech.map(String) : [String(rawTech || "")];

              techIds.forEach(techId => {
                if (techId && usersMap[techId]) {
                  const name = usersMap[techId];
                  const lowerName = name.toLowerCase().trim();
                  if (lowerName !== "infraestrutura" && lowerName !== "sistemas" && lowerName !== "infra/sistemas") {
                    if (!contagemTecnicosMes[techId]) {
                      contagemTecnicosMes[techId] = { nome: name, count: 0 };
                    }
                    contagemTecnicosMes[techId].count++;
                  }
                }
              });
            });
          }
        } catch (err) {
          console.error("[GLPI] Erro ao buscar chamados do mês para técnicos:", err.message);
        }

        const allTechIds = Array.from(new Set([
          ...Object.keys(contagemTecnicos),
          ...Object.keys(contagemTecnicosMes)
        ]));

        tecnicosList = await Promise.all(
          allTechIds.map(async (techId) => {
            const nome = contagemTecnicos[techId]?.nome || contagemTecnicosMes[techId]?.nome || `User ${techId}`;
            const countMes = contagemTecnicosMes[techId]?.count || 0;
            let totalResolvidos = 0;

            try {
              const countRes = await fetch(
                `${GLPI_API_URL}/search/Ticket?criteria[0][field]=5&criteria[0][searchtype]=equals&criteria[0][value]=${techId}` +
                `&criteria[1][link]=AND&criteria[1][field]=12&criteria[1][searchtype]=equals&criteria[1][value]=6` +
                `&range=0-1`,
                {
                  headers: {
                    "App-Token": GLPI_APP_TOKEN,
                    "Session-Token": sessionToken
                  }
                }
              );
              if (countRes.ok) {
                const countData = await countRes.json();
                totalResolvidos = countData.totalcount || 0;
              }
            } catch (err) {
              console.error(`[GLPI] Erro ao buscar total de chamados para técnico ${nome}:`, err.message);
            }

            return {
              id: nome.toLowerCase().replace(/\s+/g, '-'),
              nome: nome,
              avatar: nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
              role: "Técnico de Suporte",
              resolvidos: totalResolvidos,
              resolvidosMes: countMes
            };
          })
        );
        tecnicosList.sort((a, b) => b.resolvidosMes - a.resolvidosMes || b.resolvidos - a.resolvidos);
          
        const top15PessoasRaw = Object.entries(contagemPessoas)
          .map(([id, item]) => ({ id, nome: item.nome, count: item.count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15);

        const coresSetores = [
          "#2b8ffb", "#10b981", "#eab308", "#f97316", "#a855f7", 
          "#ef4444", "#6366f1", "#14b8a6", "#ec4899", "#f43f5e"
        ];
        pessoasList = await Promise.all(
          top15PessoasRaw.map(async (p, index) => {
            let totalFechados = p.count;
            let totalGeral = p.count;
            let abertos = 0;
            let fechadosMes = 0;
            let abertosMes = 0;
            try {
              const [resTotal, resFechados, resFechadosMes, resCriadosMes] = await Promise.all([
                fetch(
                  `${GLPI_API_URL}/search/Ticket?criteria[0][field]=4&criteria[0][searchtype]=equals&criteria[0][value]=${p.id}&range=0-1`,
                  {
                    headers: {
                      "App-Token": GLPI_APP_TOKEN,
                      "Session-Token": sessionToken
                    }
                  }
                ),
                fetch(
                  `${GLPI_API_URL}/search/Ticket?criteria[0][field]=4&criteria[0][searchtype]=equals&criteria[0][value]=${p.id}` +
                  `&criteria[1][link]=AND&criteria[1][field]=12&criteria[1][searchtype]=equals&criteria[1][value]=6&range=0-1`,
                  {
                    headers: {
                      "App-Token": GLPI_APP_TOKEN,
                      "Session-Token": sessionToken
                    }
                  }
                ),
                fetch(
                  `${GLPI_API_URL}/search/Ticket?criteria[0][field]=4&criteria[0][searchtype]=equals&criteria[0][value]=${p.id}` +
                  `&criteria[1][link]=AND&criteria[1][field]=12&criteria[1][searchtype]=equals&criteria[1][value]=6` +
                  `&criteria[2][link]=AND&criteria[2][field]=17&criteria[2][searchtype]=morethan&criteria[2][value]=${encodeURIComponent(firstDayOfMonth)}` +
                  `&range=0-1`,
                  {
                    headers: {
                      "App-Token": GLPI_APP_TOKEN,
                      "Session-Token": sessionToken
                    }
                  }
                ),
                fetch(
                  `${GLPI_API_URL}/search/Ticket?criteria[0][field]=4&criteria[0][searchtype]=equals&criteria[0][value]=${p.id}` +
                  `&criteria[1][link]=AND&criteria[1][field]=15&criteria[1][searchtype]=morethan&criteria[1][value]=${encodeURIComponent(firstDayOfMonth)}` +
                  `&range=0-1`,
                  {
                    headers: {
                      "App-Token": GLPI_APP_TOKEN,
                      "Session-Token": sessionToken
                    }
                  }
                )
              ]);
              if (resTotal.ok) {
                const dataTotal = await resTotal.json();
                totalGeral = dataTotal.totalcount || 0;
              }
              if (resFechados.ok) {
                const dataFechados = await resFechados.json();
                totalFechados = dataFechados.totalcount || 0;
              }
              if (resFechadosMes.ok) {
                const dataFechadosMes = await resFechadosMes.json();
                fechadosMes = dataFechadosMes.totalcount || 0;
              }
              if (resCriadosMes.ok) {
                const dataCriadosMes = await resCriadosMes.json();
                abertosMes = dataCriadosMes.totalcount || 0;
              }
              abertos = Math.max(0, totalGeral - totalFechados);
            } catch (err) {
              console.error(`[GLPI] Erro ao buscar chamados para requerente ${p.nome}:`, err.message);
            }
            
            return {
              id: p.nome.toLowerCase().replace(/\s+/g, '-'),
              nome: p.nome,
              chamados: totalFechados,
              abertos: abertos,
              fechados: totalFechados,
              total: totalGeral,
              abertosMes: abertosMes,
              fechadosMes: fechadosMes,
              cor: coresSetores[index % coresSetores.length]
            };
          })
        );
        pessoasList.sort((a, b) => b.fechadosMes - a.fechadosMes || b.fechados - a.fechados);
      }
    } catch (e) {
      console.error("[GLPI] Erro ao buscar chamados para ranking:", e.message);
    }
    
    res.json({
      kpis: statusCounts,
      tecnicos: tecnicosList,
      pessoas: pessoasList,
      totalComputadores,
      totalImpressoras: totalImpressorasGlpi
    });
  } catch (error) {
    next(error);
  } finally {
    if (sessionToken) {
      await killGlpiSession(sessionToken);
    }
  }
});

app.get("/api/glpi/impressoras-disponiveis", async (req, res, next) => {
  let sessionToken = null;
  try {
    sessionToken = await initGlpiSession();
    
    const glpiResponse = await fetch(
      `${GLPI_API_URL}/search/Printer` +
      `?forcedisplay[0]=1` +   // Nome
      `&forcedisplay[1]=2` +   // ID
      `&forcedisplay[2]=23` +  // Fabricante (Marca)
      `&forcedisplay[3]=40` +  // Modelo
      `&forcedisplay[4]=5` +   // Número de Série
      `&forcedisplay[5]=21` +  // MAC
      `&forcedisplay[6]=126` + // IP
      `&forcedisplay[7]=3` +   // Localização
      `&range=0-150`,
      {
        headers: {
          "App-Token": GLPI_APP_TOKEN,
          "Session-Token": sessionToken
        }
      }
    );
    
    if (!glpiResponse.ok) {
      throw new Error(`Erro ao buscar impressoras no GLPI: ${glpiResponse.status}`);
    }
    
    const responseData = await glpiResponse.json();
    const glpiPrinters = responseData.data || [];
    
    const localResult = await pool.query("SELECT glpi_id FROM impressoras WHERE glpi_id IS NOT NULL");
    const localGlpiIds = new Set(localResult.rows.map(row => String(row.glpi_id)));
    
    const disponiveis = glpiPrinters
      .filter(p => !localGlpiIds.has(String(p["2"])))
      .map(p => ({
        glpiId: String(p["2"]),
        nome: p["1"] || `Impressora GLPI ${p["2"]}`,
        marca: p["23"] || "",
        modelo: p["40"] || "",
        numeroSerie: p["5"] || "",
        mac: p["21"] || "",
        ip: p["126"] || "",
        local: p["3"] || ""
      }));
      
    res.json(disponiveis);
  } catch (error) {
    next(error);
  } finally {
    if (sessionToken) {
      await killGlpiSession(sessionToken);
    }
  }
});

app.post("/api/impressoras/importar", async (req, res, next) => {
  const { glpiId, local, sede } = req.body || {};
  if (!glpiId) {
    return res.status(400).json({ error: "O parâmetro glpiId é obrigatório." });
  }
  
  let sessionToken = null;
  try {
    sessionToken = await initGlpiSession();
    
    // 1. Buscar a impressora usando o Search API para obter IP, MAC, Marca, Modelo, Serial e Localização corretos
    const searchRes = await fetch(
      `${GLPI_API_URL}/search/Printer` +
      `?criteria[0][field]=2&criteria[0][searchtype]=equals&criteria[0][value]=${glpiId}` +
      `&forcedisplay[0]=1` +   // Nome
      `&forcedisplay[1]=23` +  // Fabricante (Marca)
      `&forcedisplay[2]=40` +  // Modelo
      `&forcedisplay[3]=5` +   // Número de Série
      `&forcedisplay[4]=21` +  // MAC
      `&forcedisplay[5]=126` + // IP
      `&forcedisplay[6]=3` +   // Localização
      `&range=0-1`,
      {
        headers: {
          "App-Token": GLPI_APP_TOKEN,
          "Session-Token": sessionToken
        }
      }
    );
    
    if (!searchRes.ok) {
      return res.status(404).json({ error: "Impressora não encontrada no GLPI." });
    }
    
    const searchData = await searchRes.json();
    const p = searchData.data?.[0];
    
    if (!p) {
      return res.status(404).json({ error: "Impressora não encontrada nos resultados do GLPI." });
    }
    
    const ip = p["126"] || "";
    let toners = await getTonerDirectlyFromPrinter(ip);
    if (!toners) {
      toners = await getGlpiPrinterToner(sessionToken, glpiId);
    }
    
    const novaId = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const agora = new Date().toISOString();
    
    const glpiWebUrl = GLPI_API_URL.replace("apirest.php", "") + `front/printer.form.php?id=${glpiId}`;
    
    const insertRes = await pool.query(
      `INSERT INTO impressoras (
        id, glpi_id, local_texto, sede, marca, modelo, numero_serie, ip, mac, link,
        toner_preto, toner_ciano, toner_magenta, toner_amarelo, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        novaId,
        glpiId,
        local || p["1"] || p["3"] || "Impressora GLPI",
        sede || "AP",
        p["23"] || "",
        p["40"] || p["1"] || "",
        p["5"] || "",
        p["126"] || "",
        p["21"] || "",
        glpiWebUrl,
        toners.preto,
        toners.ciano,
        toners.magenta,
        toners.amarelo,
        agora
      ]
    );
    
    res.status(201).json(rowToImpressora(insertRes.rows[0]));
  } catch (error) {
    next(error);
  } finally {
    if (sessionToken) {
      await killGlpiSession(sessionToken);
    }
  }
});

app.get("/api/glpi/sync-status", async (req, res, next) => {
  try {
    const result = await pool.query("SELECT valor FROM tv_config WHERE id = 'last_glpi_impressoras_sync'");
    const lastSync = result.rows[0]?.valor || null;
    res.json({
      lastSync,
      intervalHours: 6,
      nextSync: lastSync ? new Date(new Date(lastSync).getTime() + 6 * 60 * 60 * 1000).toISOString() : null
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/glpi/sync-now", async (req, res, next) => {
  try {
    await executePrintersSync();
    await schedulePrintersSync();
    
    const result = await pool.query("SELECT valor FROM tv_config WHERE id = 'last_glpi_impressoras_sync'");
    const lastSync = result.rows[0]?.valor || null;
    res.json({
      success: true,
      lastSync,
      nextSync: lastSync ? new Date(new Date(lastSync).getTime() + 6 * 60 * 60 * 1000).toISOString() : null
    });
  } catch (error) {
    next(error);
  }
});

const setupFrontend = async () => {
  if (isProduction) {
    app.use(express.static(distPath));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    return;
  }

  const { createServer } = await import("vite");
  const vite = await createServer({
    configFile: path.join(__dirname, "..", "vite.config.ts"),
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
};

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message || "Erro interno do servidor" });
});

assertDatabaseUrl();
assertJwtSecret();
initDatabase()
  .then(seedUsuarios)
  .then(setupFrontend)
  .then(() => schedulePrintersSync())
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      const modo = isProduction ? "produção" : "desenvolvimento";
      console.log(`Servidor (${modo}) em http://localhost:${port}`);
      if (!isProduction) {
        console.log(
          "Desenvolvimento usa o mesmo servidor e API que npm start (sem build antigo em dist).",
        );
      }
    });
  })
  .catch((error) => {
    console.error("Erro ao iniciar o banco de dados", error);
    process.exit(1);
  });
