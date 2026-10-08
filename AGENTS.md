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
  css/                 # tokens, layout, lateral, components, interacao, rotina, detalhe, du
  js/                  # módulos ES (main.js orquestra)
  vendor/chart.umd.js
templates/
  base.html, index.html
  partials/            # header, filtros, kpis, grafico, tabela, equipe, rotina, detalhe, du
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
| `/du/calendario` | du_calendario | meses, DU de D-1 (ontem), total de DUs |
| `/du/curva` | du_curva_service | gráfico + KPIs de ritmo (aba Dia Útil) |
| `/du/ranking` | du_ranking_service | ranking/semáforo por nível |

Query params comuns: `produto`, `gerencia`, `coordenacao`, `supervisao`, `loja`, `data_ini`, `data_fim`, `situacao`, `nivel`, `incluir_sem_movimento`.

Params da aba Dia Útil: `mes_ref` (AAAAMM), `comparar` (AAAAMM dos meses anteriores, separados por vírgula; sem isso vale a janela de 3), `du` (1..DU de ontem / D-1), `metrica` (vlr|qtd|lojas|tentativas).

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
| `exportar.js` / `rotina-exportar.js` / `du-exportar.js` | CSV (`;`, BOM, valores cheios) |
| `du.js` + `du-grafico.js` + `du-kpis.js` + `du-ranking.js` | aba Dia Útil (página própria) |
| `formato.js` / `ordenacao.js` / `api.js` | utilitários |

Layout: topo vermelho (marca + abas produto **e Dia Útil**) + **lateral esquerda sticky** (`partials/filtros.html`) + conteúdo. Em `.modo-du` some o período De/Até e o conteúdo geral.

---

## Dados e regras de negócio

### Fontes

- Produção: `DEF..TB_CONSIG_AVERBADO_EXP` (`ANO_MES` int **AAAAMM**, só o mês; `DATA_TRX` date, o dia da operação; `INDICADOR`, `SITUACAO_CONTRATO_CONSOLIDADO`, `VLR_CONTRATO`, `CHAVE_LOJA`…)
- Tentativas: `TESTE..TENTATIVAS_CONSIGNADO_DIA` (`DATA_ETAPA` datetime, produto, qtds…)
- Lojas: `DATALAKE..DL_BRADESCO_EXPRESSO` join `MESU..CONS_DISTRIBUICAO_ENTIDADES` via `TRY_CAST(H.COD_AG AS BIGINT) = A.COD_AG_LOJA`
- Ativas: `DATAWAREHOUSE..TB_INDICADORES_BE` (`PERIODO` AAAAMM, `QTD_ATIVOS > 0`)
- Calendário DU: `MESU..TB_DIA_UTIL` (`DT_REFERENCIA`, `QT_DIAS_UTEIS_MES`; **0 conta como 1**)

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

- **Lojas c/ movimento** depende do assunto da tela: na produção, lojas com **AVERBADO**; em tentativas, lojas que tentaram; em aguardando/não averbado/pendente, lojas com contratos na situação correspondente. Sempre contar lojas únicas no dia/período e produto filtrados; em Geral, unir produtos sem repetir lojas. Aplicar a mesma regra no resumo, lista e exportação, incluindo inativas com movimento no contexto.
- **Cobertura** (KPI + coluna Equipe + `% lojas que tentaram` da rotina): denominador = lojas **ativas no período** (`TB_INDICADORES_BE`, `PERIODO BETWEEN` meses de `data_ini`/`data_fim`)
- **Produção e tentativas**: **não** cortar por ativas (loja inativa ainda conta no total se teve movimento)
- **Indicador Tentativas**: somar `QTD_CLIENTES` da tabela diária em todas as telas e exportações. Conversão = `SUM(QTD_CONVERTIDAS) / SUM(QTD_CLIENTES) * 100`. A soma mantém a granularidade da fonte, sem deduplicar clientes entre dias/produtos. Movimento de tentativa considera `QTD_CLIENTES > 0`.

### Datas (crítico)

SQL Server em português (dmy). Em produção e tentativas **sempre**:

`P.DATA_TRX >= CAST(? AS DATE) AND P.DATA_TRX < DATEADD(DAY, 1, CAST(? AS DATE))`

`T.DATA_ETAPA >= CAST(? AS DATE) AND T.DATA_ETAPA < DATEADD(DAY, 1, CAST(? AS DATE))`

O filtro diário de produção usa `DATA_TRX` (date), não o inteiro `ANO_MES`. Nunca comparar datetime com string `'YYYY-MM-DD'` crua.

### SQL (`sql/app` + `run_query`)

- Tokens `/*NOME*/` substituídos só com trechos de **whitelist** no Python (nunca input do usuário)
- Valores de filtro sempre como `?` + params
- CTE `LOJAS` padrão: Expresso + hierarquia + `/*FILTROS*/`

### Detalhe (drill-down)

Clique em número → resumo por nível (Ger. Gestão → III → Comercial → Loja) → contratos / tentativas por dia. Agrupamento no browser a partir de `/detalhe/lojas`. Rodapé de totais no `tfoot`.

### Aba Dia Útil

Página própria (não um filtro de produto). Compara o mês atual com 3 ou 6 meses anteriores **alinhados pelo DU**, não pelo calendário.

- DU de cada data: `CASE WHEN QT_DIAS_UTEIS_MES = 0 THEN 1 ELSE QT_DIAS_UTEIS_MES END`. Sábado/domingo herdam o número de sexta; a produção do fim de semana soma no mesmo DU.
- Eixo X = DU 1..N; uma linha por mês (atual em vermelho). Visões **dia** e **acumulado**.
- Métricas: valor averbado, qtd operações, lojas produtivas (únicas no acumulado), tentativas.
- “Até DU N” nunca passa do DU de ontem (D-1): a produção é acompanhada com essa visão, o dia corrente ainda não fechou.
- Ranking por nível com status vs a **média do próprio histórico no mesmo DU**: zerado / abaixo (<-30%) / atenção (-30% a -10%) / padrão / acima (>+10%) / novo (sem histórico).
- Universo = lojas que produziram (ou tentaram) em algum dos meses comparados — **não** corta por ativas.
- Classificação pura em `services/du_padrao.py` (testes em `tests/`).

---

## Restrições ao editar

1. Não alterar `.env` sem pedir.
2. Não criar mocks em dev/prod; dados vêm do SQL Server.
3. Não inventar endpoints/SQL paralelos se já existir em `services` + `sql/app`.
4. Manter arquivos JS/CSS modulares (evitar monólitos > ~300 linhas).
5. Marca: tokens em `static/css/tokens.css` (vermelho Bradesco); não reintroduzir tema genérico.
6. Produção de valor = averbado; cobertura = ativas; produção diária = `DATA_TRX` e tentativas = `DATA_ETAPA`, ambas com `CAST(? AS DATE)`.
7. Não commitar/push a menos que o usuário peça.

---

## Como estender com segurança

1. Nova agregação: criar `sql/app/novo.sql` → service → rota em `api.py` → módulo JS.
2. Novo filtro SQL: helper em `filtros_comuns.py` + token/`?`, nunca concatenar input.
3. Nova seção visual: partial em `templates/partials` + CSS dedicado + init em `main.js`.
4. Exportação: reutilizar `exportar.js` (valores cheios, `;`).
