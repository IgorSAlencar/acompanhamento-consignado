# Acompanhamento Consignado — Guia para a IA

Cockpit comercial Flask do **Bradesco Expresso** para acompanhar produção e tentativas de **crédito consignado**, com gestão por hierarquia:

`Ger. Gestão` (DESC_GERENCIA_AREA) → `Ger. Comercial III` (DESC_COORDENACAO) → `Ger. Comercial` (DESC_SUPERVISAO) → loja → contrato.

Stack: Flask + pyodbc (SQL Server, Trusted Connection) + front vanilla (ES modules) + Chart.js local.

Rodar: `python app.py` (host/porta em `.env`). Nunca sobrescrever `.env` sem confirmação explícita do usuário.

---

## Estrutura de pastas

```
app.py                 # create_app() + run
config.py              # Config + connection_string()
requirements.txt
.env / .env.example

db/connection.py       # get_connection(); DatabaseError
repositories/
  query_runner.py      # run_query(nome, params, tokens) → list[dict]
services/              # regras de negócio / montagem de JSON
routes/
  pages.py             # GET / → index.html
  api.py               # blueprint /api/*
sql/app/*.sql          # ÚNICAS consultas usadas em runtime
static/
  css/                 # tokens, layout, lateral, components, interacao, rotina, detalhe
  js/                  # módulos ES (main.js orquestra)
  vendor/chart.umd.js
templates/
  base.html, index.html
  partials/            # header, filtros, kpis, grafico, tabela, equipe, rotina, detalhe
```

Fluxo: `routes` → `services` → `run_query("arquivo")` → `sql/app/<arquivo>.sql`.

---

## APIs (`/api`)

| Rota | Service | Uso na tela |
|------|---------|-------------|
| `/filtros` | filtros_service | selects hierarquia |
| `/resumo` | resumo_service | cards KPI |
| `/serie-diaria` | serie_service | gráfico |
| `/tabela-diaria` | tabela_service | detalhamento diário |
| `/equipe` | equipe_service | tabela Equipe |
| `/equipe-diaria` | rotina_service | Rotina Diária |
| `/detalhe/lojas` | detalhe_service | painel → lojas |
| `/detalhe/loja` | detalhe_service | painel → contratos / tentativas |

Query params comuns: `produto`, `gerencia`, `coordenacao`, `supervisao`, `loja`, `data_ini`, `data_fim`, `situacao`, `nivel`, `incluir_sem_movimento`.

---

## Front (`static/js`)

| Módulo | Papel |
|--------|-------|
| `main.js` | carregarTudo, abas de produto |
| `estado.js` | filtros globais + `parametros()` |
| `filtros.js` | cascata Ger. Gestão → III → Comercial |
| `periodo.js` | selo de período nos cards/seções |
| `kpis.js` / `grafico.js` / `tabela.js` / `equipe.js` / `rotina.js` | seções |
| `detalhe.js` + `detalhe-agrupar.js` + `detalhe-colunas.js` + `detalhe-total.js` | drill-down |
| `exportar.js` / `rotina-exportar.js` | CSV (`;`, BOM, valores cheios) |
| `formato.js` / `ordenacao.js` / `api.js` | utilitários |

Layout: topo vermelho (marca + abas produto) + **lateral esquerda sticky** (`partials/filtros.html`) + conteúdo.

---

## Dados e regras de negócio

### Fontes

- Produção: `DEF..TB_CONSIG_AVERBADO_EXP` (`ANO_MES` int **AAAAMMDD**, `INDICADOR`, `SITUACAO_CONTRATO_CONSOLIDADO`, `VLR_CONTRATO`, `CHAVE_LOJA`…)
- Tentativas: `TESTE..TENTATIVAS_CONSIGNADO_DIA` (`DATA_ETAPA` datetime, produto, qtds…)
- Lojas: `DATALAKE..DL_BRADESCO_EXPRESSO` join `MESU..CONS_DISTRIBUICAO_ENTIDADES` via `TRY_CAST(H.COD_AG AS BIGINT) = A.COD_AG_LOJA`
- Ativas: `DATAWAREHOUSE..TB_INDICADORES_BE` (`PERIODO` AAAAMM, `QTD_ATIVOS > 0`)

Universo base das consultas: `TIPO_POSTO IN ('Tradicional','Ilha')` + hierarquia.

### Situação e produto

- Situações: `AVERBADO`, `AGUARDANDO AVERBACAO`, `NAO AVERBADO`
- Filtro especial `PENDENTE` = aguardando + não averbado (rotina “Não averbada”)
- Indicadores: `CRÉDITO CONSIGNADO INSS` / `PRIVADO` / `PUBLICO` → abas INSS / Privado / Público

### Valores

- **Produção / “valor” em quase tudo = só AVERBADO**
- Aguardando e não averbado aparecem **à parte** (cards, colunas, detalhe, rotina)
- Cards KPI e CSV: números **cheios** (sem mil/mi), exceto heatmap da rotina na tela (compacto)

### Cobertura vs produção

- **Cobertura** (KPI + coluna Equipe + `% lojas que tentaram` da rotina): denominador = lojas **ativas no período** (`TB_INDICADORES_BE`, `PERIODO BETWEEN` meses de `data_ini`/`data_fim`)
- **Produção e tentativas**: **não** cortar por ativas (loja inativa ainda conta no total se teve movimento)

### Datas (crítico)

SQL Server em português (dmy). Em tentativas **sempre**:

`T.DATA_ETAPA >= CAST(? AS DATE) AND T.DATA_ETAPA < DATEADD(DAY, 1, CAST(? AS DATE))`

Nunca comparar datetime com string `'YYYY-MM-DD'` crua.

### SQL (`sql/app` + `run_query`)

- Tokens `/*NOME*/` substituídos só com trechos de **whitelist** no Python (nunca input do usuário)
- Valores de filtro sempre como `?` + params
- CTE `LOJAS` padrão: Expresso + hierarquia + `/*FILTROS*/`

### Detalhe (drill-down)

Clique em número → resumo por nível (Ger. Gestão → III → Comercial → Loja) → contratos / tentativas por dia. Agrupamento no browser a partir de `/detalhe/lojas`. Rodapé de totais no `tfoot`.

---

## Restrições ao editar

1. Não alterar `.env` sem pedir.
2. Não criar mocks em dev/prod; dados vêm do SQL Server.
3. Não inventar endpoints/SQL paralelos se já existir em `services` + `sql/app`.
4. Manter arquivos JS/CSS modulares (evitar monólitos > ~300 linhas).
5. Marca: tokens em `static/css/tokens.css` (vermelho Bradesco); não reintroduzir tema genérico.
6. Produção de valor = averbado; cobertura = ativas; datas de tentativa = `CAST(? AS DATE)`.
7. Não commitar/push a menos que o usuário peça.

---

## Como estender com segurança

1. Nova agregação: criar `sql/app/novo.sql` → service → rota em `api.py` → módulo JS.
2. Novo filtro SQL: helper em `filtros_comuns.py` + token/`?`, nunca concatenar input.
3. Nova seção visual: partial em `templates/partials` + CSS dedicado + init em `main.js`.
4. Exportação: reutilizar `exportar.js` (valores cheios, `;`).
