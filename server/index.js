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
      [username],
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
      status TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL
    );

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
      username: process.env.ADMIN_USER || "admin",
      password: process.env.ADMIN_PASSWORD,
      role: "admin",
    },
    {
      username: process.env.VIEWER_USER || "viewer",
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
  local: row.local_texto || "",
  sede: row.sede || "",
  marca: row.marca || "",
  modelo: row.modelo || "",
  numeroSerie: row.numero_serie || "",
  ip: row.ip || "",
  mac: row.mac || "",
  link: row.link || "",
  tonerPreto: row.toner_preto ?? 100,
  tonerCiano: row.toner_ciano ?? 100,
  tonerMagenta: row.toner_magenta ?? 100,
  tonerAmarelo: row.toner_amarelo ?? 100,
  updatedAt: new Date(row.updated_at).toISOString(),
});

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
          removido, concluido, data_remocao, data_conclusao
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
      "SELECT * FROM inventario_itens ORDER BY updated_at ASC",
    );
    const unidadesResult = await pool.query(
      "SELECT * FROM inventario_unidades ORDER BY updated_at ASC",
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

    for (const item of itens) {
      await client.query(
        "INSERT INTO inventario_itens (id, item, updated_at) VALUES ($1, $2, $3)",
        [item.id, item.item, item.updatedAt],
      );

      for (const unidade of item.unidades || []) {
        await client.query(
          `
            INSERT INTO inventario_unidades (
              id, item_id, modelo, patrimonio, localizacao, requerente,
              montado_por, status, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            unidade.id,
            item.id,
            unidade.modelo || "",
            unidade.patrimonio || "",
            unidade.localizacao || "",
            unidade.requerente || "",
            unidade.montadoPor || "",
            unidade.status,
            unidade.updatedAt,
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
          id, local_texto, sede, marca, modelo, numero_serie, ip, mac, link,
          toner_preto, toner_ciano, toner_magenta, toner_amarelo, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
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
          imp.local || "",
          imp.sede || "",
          imp.marca || "",
          imp.modelo || "",
          imp.numeroSerie || "",
          imp.ip || "",
          imp.mac || "",
          imp.link || "",
          imp.tonerPreto ?? 100,
          imp.tonerCiano ?? 100,
          imp.tonerMagenta ?? 100,
          imp.tonerAmarelo ?? 100,
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

app.get("/api/toners", async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM toner_registros ORDER BY updated_at ASC",
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
      "SELECT * FROM toner_registros ORDER BY updated_at ASC",
    );
    res.json(result.rows.map(rowToTonerRegistro));
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
