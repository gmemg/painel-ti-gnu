# Painel T.I. GNU

Sistema de gerenciamento de montagens de TI com painel de eventos, inventário de equipamentos e histórico.

## Funcionalidades

### Montagens

- Cadastrar, editar e remover eventos de montagem
- Campos: nome, data/hora, local, funcionário de plantão, equipamentos necessários, número do chamado e responsável
- Destaque visual para eventos com até 2 dias de antecedência
- Eventos passados são concluídos automaticamente

### Histórico

- Exibe todos os eventos concluídos ou removidos
- Fonte única: tabela `historico_eventos` no PostgreSQL — deletar uma linha no banco remove diretamente do site

### Inventário de Montagem

- Cadastro de itens com múltiplas unidades
- Status por unidade: Disponível, Em uso, Manutenção, Reservado
- Histórico de alterações por unidade (últimas 25 entradas)
- Busca por item, patrimônio, localização e outros campos
- Ordenação manual (drag-and-drop), por nome, quantidade ou edição recente

## Tecnologias

- React 18 + TypeScript
- Vite
- React Router DOM v6
- Node.js + Express 5
- PostgreSQL (`pg`)

## Configuração

1. Copie o arquivo de exemplo e preencha a connection string:

```bash
cp .env.example .env
```

```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/painel_montagem
PORT=3000
```

2. Instale as dependências:

```bash
npm install
```

3. As tabelas são criadas automaticamente na primeira execução.

## Scripts

| Comando         | Descrição                                                   |
| --------------- | ----------------------------------------------------------- |
| `npm run dev`   | Desenvolvimento — Express + Vite em `http://localhost:5173` |
| `npm run build` | Gera build de produção em `dist/`                           |
| `npm start`     | Produção — Express serve o build em `http://localhost:3000` |

## Estrutura

```text
server/
└── index.js              # API Express + inicialização do banco

src/
├── components/
│   ├── Painel.tsx         # Lista de eventos ativos
│   ├── FormularioEvento.tsx
│   ├── Historico.tsx      # Histórico de eventos finalizados
│   ├── InventarioMontagem.tsx
│   └── *.css
├── utils/
│   ├── storage.ts         # Chamadas à API REST
│   └── dateUtils.ts       # Formatação e cálculos de data
├── types.ts
├── App.tsx
└── main.tsx
```

## Banco de dados

Tabelas criadas automaticamente:

| Tabela                 | Conteúdo                                |
| ---------------------- | --------------------------------------- |
| `eventos`              | Todos os eventos (ativos e finalizados) |
| `historico_eventos`    | Eventos exibidos no histórico           |
| `inventario_itens`     | Itens do inventário                     |
| `inventario_unidades`  | Unidades por item                       |
| `inventario_historico` | Log de alterações das unidades          |
