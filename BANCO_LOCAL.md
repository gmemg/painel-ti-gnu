# Banco de dados local

Este projeto usa PostgreSQL por meio de uma API Node/Express local.

## Configuracao

1. Crie um arquivo `.env` na raiz do projeto usando `.env.example` como base.
2. Troque `SUA_SENHA_AQUI` pela senha criada na instalacao do PostgreSQL.

### Desenvolvimento (alteracoes na hora)

```bash
npm install
npm run dev
```

Acesse:

```text
http://localhost:5173
```

O `npm run dev` sobe o mesmo servidor Express + API + PostgreSQL do
`npm start`, com o front-end ao vivo via Vite (sem usar a pasta `dist`
antiga).

### Producao / rede local

3. Gere o site de producao:

```bash
npm run build
```

4. Inicie o servidor:

```bash
npm start
```

5. Acesse no computador servidor:

```text
http://localhost:3000
```

Para acessar de outros computadores na rede, descubra o IPv4 do servidor com
`ipconfig` e use:

```text
http://IP_DO_SERVIDOR:3000
```

O servidor cria automaticamente as tabelas que faltarem no banco
`painel_montagem`.
