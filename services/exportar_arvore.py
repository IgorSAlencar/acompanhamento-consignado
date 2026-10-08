"""Folhas comuns do drill-down: grupos, lojas, contratos e tentativas."""
from repositories.query_runner import run_query
from services.contratos_service import parametros_consulta_contratos
from services.detalhe_service import obter_lojas
from services.filtros_comuns import (
    filtro_hierarquia,
    filtro_produto_tentativas,
    periodo,
    produto_do_indicador,
)
from services.xlsx_planilha import Coluna, escrever_planilha

NIVEIS = ("gerencia", "coordenacao", "supervisao", "loja")
NOMES_ABA = {
    "gerencia": "Ger. Gestão",
    "coordenacao": "Ger. Comercial III",
    "supervisao": "Ger. Comercial",
    "loja": "Lojas",
}

NOMES_PRODUTO = {"INSS": "INSS", "PRIVADO": "Privado", "PUBLICO": "Público"}
NOMES_SITUACAO = {
    "AVERBADO": "Averbado",
    "AGUARDANDO AVERBACAO": "Aguardando averbação",
    "NAO AVERBADO": "Cancelado",
}

CAMPOS_SOMA = (
    "qtd_tentativas", "qtd_convertidas", "qtd_averbado", "vlr_averbado",
    "qtd_aguardando", "vlr_aguardando", "qtd_nao_averbado", "vlr_nao_averbado",
)


def nivel_inicial(args) -> str:
    if args.get("loja") or args.get("supervisao"):
        return "loja"
    if args.get("coordenacao"):
        return "supervisao"
    if args.get("gerencia"):
        return "coordenacao"
    return "gerencia"


def niveis_a_partir(args, ordem: tuple[str, ...]) -> list[str]:
    inicio = nivel_inicial(args)
    if inicio not in ordem:
        return []
    return list(ordem[ordem.index(inicio):])


def tem_movimento(loja: dict) -> bool:
    """Na visao de producao, movimento representa consignado averbado."""
    return loja["qtd_averbado"] > 0


def _com_movimento(loja: dict, foco: str = "", situacao: str = "") -> bool:
    if foco == "tentativas":
        return loja["qtd_tentativas"] > 0
    campos = {
        "AVERBADO": ("qtd_averbado",),
        "AGUARDANDO AVERBACAO": ("qtd_aguardando",),
        "NAO AVERBADO": ("qtd_nao_averbado",),
        "PENDENTE": ("qtd_aguardando", "qtd_nao_averbado"),
    }
    if situacao in campos:
        return any(loja[campo] > 0 for campo in campos[situacao])
    return tem_movimento(loja)


def _somar_produtos(grupo: dict, loja: dict) -> None:
    origem = loja.get("produtos")
    if not origem:
        return
    if "produtos" not in grupo:
        grupo["produtos"] = {
            produto: {"qtd_tentativas": 0, "qtd_convertidas": 0, "pct_conversao": 0.0}
            for produto in NOMES_PRODUTO
        }
    for produto, valores in origem.items():
        if produto not in grupo["produtos"]:
            continue
        grupo["produtos"][produto]["qtd_tentativas"] += valores["qtd_tentativas"]
        grupo["produtos"][produto]["qtd_convertidas"] += valores["qtd_convertidas"]


def agrupar(lojas: list[dict], nivel: str, foco: str = "", situacao: str = "") -> list[dict]:
    pais = list(NIVEIS[:NIVEIS.index(nivel)])
    grupos: dict[str, dict] = {}
    lojas_movimento: dict[str, set] = {}
    for loja in lojas:
        chave = loja.get(nivel) or "Sem hierarquia"
        if chave not in grupos:
            base = {nivel: chave, "qtd_lojas": 0, "qtd_lojas_ativas": 0, "qtd_lojas_mov": 0}
            for pai in pais:
                base[pai] = loja.get(pai)
            for campo in CAMPOS_SOMA:
                base[campo] = 0
            grupos[chave] = base
            lojas_movimento[chave] = set()
        grupo = grupos[chave]
        grupo["qtd_lojas"] += 1
        if loja.get("ativa"):
            grupo["qtd_lojas_ativas"] += 1
        if _com_movimento(loja, foco, situacao):
            lojas_movimento[chave].add(loja["chave_loja"])
        grupo["qtd_lojas_mov"] = len(lojas_movimento[chave])
        for campo in CAMPOS_SOMA:
            grupo[campo] += loja[campo]
        _somar_produtos(grupo, loja)
    for grupo in grupos.values():
        tent = grupo["qtd_tentativas"]
        grupo["pct_conversao"] = round(100 * grupo["qtd_convertidas"] / tent, 1) if tent else 0.0
        for item in grupo.get("produtos", {}).values():
            item_tent = item["qtd_tentativas"]
            item["pct_conversao"] = round(100 * item["qtd_convertidas"] / item_tent, 1) if item_tent else 0.0
    return list(grupos.values())


def formatar_cpf(cpf: str) -> str:
    cpf = (cpf or "").strip().zfill(11)
    return f"{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:]}"


def listar_contratos(args) -> list[dict]:
    params, tokens = parametros_consulta_contratos(args)
    return [_contrato(linha) for linha in run_query("exportar_contratos", params, tokens)]


def listar_tentativas(args) -> list[dict]:
    frag_h, params_h = filtro_hierarquia(args)
    data_ini, data_fim = periodo(args)
    frag_p, params_p = filtro_produto_tentativas(args)
    linhas = run_query(
        "exportar_tentativas",
        params_h + [data_ini, data_fim] + params_p,
        {"FILTROS": frag_h, "PRODUTO": frag_p},
    )
    return [_tentativa(linha) for linha in linhas]


def adicionar_arvore(wb, args, grupos: bool = True, lojas: bool = True) -> None:
    """Acrescenta grupos (opcional), lojas, contratos e tentativas do filtro."""
    foco = args.get("foco") or ""
    situacao = args.get("situacao") or ""
    por_produto = str(args.get("por_produto") or "") == "1"
    if grupos or lojas:
        incluir_todas = str(args.get("incluir_sem_movimento") or "") in ("1", "true", "True")
        # Grupos exportam tambem a coluna Lojas ativas: precisam das ativas sem
        # movimento para preservar esse denominador. Nunca do cadastro historico.
        todas = obter_lojas({
            **dict(args), "qualquer_movimento": "1",
            "incluir_sem_movimento": "1" if incluir_todas or grupos else "",
        })
        visiveis = todas if incluir_todas else [loja for loja in todas if _com_movimento(loja, foco, situacao)]
        if grupos:
            for nivel in niveis_a_partir(args, ("gerencia", "coordenacao", "supervisao")):
                linhas = agrupar(todas, nivel, foco, situacao)
                if foco == "tentativas":
                    linhas = [grupo for grupo in linhas if grupo["qtd_tentativas"] > 0]
                escrever_planilha(wb, NOMES_ABA[nivel], colunas_grupo(nivel, foco, por_produto), linhas)
        if lojas:
            escrever_planilha(wb, "Lojas", colunas_lojas(foco, por_produto), visiveis)
    if foco != "tentativas":
        escrever_planilha(wb, "Contratos", COLUNAS_CONTRATOS, listar_contratos(args))
    escrever_planilha(wb, "Tentativas", COLUNAS_TENTATIVAS, listar_tentativas(args))


def _colunas_por_produto() -> list[Coluna]:
    colunas = []
    for codigo, nome in NOMES_PRODUTO.items():
        colunas.extend([
            Coluna(f"{nome} · Tentativas", lambda l, c=codigo: l["produtos"][c]["qtd_tentativas"], "inteiro"),
            Coluna(f"{nome} · Convertidas", lambda l, c=codigo: l["produtos"][c]["qtd_convertidas"], "inteiro"),
            Coluna(f"{nome} · Conversão", lambda l, c=codigo: l["produtos"][c]["pct_conversao"], "percentual"),
        ])
    return colunas


def _metricas_grupo(foco: str, por_produto: bool) -> list[Coluna]:
    if foco == "tentativas" and por_produto:
        return COLUNAS_METRICAS_GRUPO[:2] + _colunas_por_produto()
    if foco == "tentativas":
        return COLUNAS_METRICAS_GRUPO[:5]
    return COLUNAS_METRICAS_GRUPO


def _metricas_loja(foco: str, por_produto: bool) -> list[Coluna]:
    if foco == "tentativas" and por_produto:
        return _colunas_por_produto()
    if foco == "tentativas":
        return COLUNAS_METRICAS_LOJA[:3]
    return COLUNAS_METRICAS_LOJA


def colunas_grupo(nivel: str, foco: str = "", por_produto: bool = False) -> list[Coluna]:
    pais = [Coluna(NOMES_ABA[p], lambda l, p=p: l.get(p) or "", "texto")
            for p in NIVEIS[:NIVEIS.index(nivel)]]
    nome = [Coluna(NOMES_ABA[nivel], lambda l, n=nivel: l.get(n) or "", "texto")]
    return pais + nome + _metricas_grupo(foco, por_produto)


def colunas_lojas(foco: str = "", por_produto: bool = False) -> list[Coluna]:
    return [
        Coluna("Ger. Gestão", lambda l: l.get("gerencia") or ""),
        Coluna("Ger. Comercial III", lambda l: l.get("coordenacao") or ""),
        Coluna("Ger. Comercial", lambda l: l.get("supervisao") or ""),
        Coluna("Chave", lambda l: l.get("chave_loja"), "inteiro"),
        Coluna("Loja", lambda l: l.get("nome_loja") or ""),
        Coluna("Município", lambda l: l.get("municipio") or ""),
        Coluna("UF", lambda l: l.get("uf") or ""),
        *_metricas_loja(foco, por_produto),
    ]


COLUNAS_METRICAS_GRUPO = [
    Coluna("Lojas c/ movimento", lambda l: l["qtd_lojas_mov"], "inteiro"),
    Coluna("Lojas ativas", lambda l: l["qtd_lojas_ativas"], "inteiro"),
    Coluna("Tentativas", lambda l: l["qtd_tentativas"], "inteiro"),
    Coluna("Convertidas", lambda l: l["qtd_convertidas"], "inteiro"),
    Coluna("Conversão", lambda l: l["pct_conversao"], "percentual"),
    Coluna("Averbado (R$)", lambda l: l["vlr_averbado"], "reais"),
    Coluna("Averbado (QTD)", lambda l: l["qtd_averbado"], "inteiro"),
    Coluna("Aguardando averbação (R$)", lambda l: l["vlr_aguardando"], "reais"),
    Coluna("Aguardando averbação (QTD)", lambda l: l["qtd_aguardando"], "inteiro"),
    Coluna("Cancelado (R$)", lambda l: l["vlr_nao_averbado"], "reais"),
    Coluna("Cancelado (QTD)", lambda l: l["qtd_nao_averbado"], "inteiro"),
]

COLUNAS_METRICAS_LOJA = [
    Coluna("Tentativas", lambda l: l["qtd_tentativas"], "inteiro"),
    Coluna("Convertidas", lambda l: l["qtd_convertidas"], "inteiro"),
    Coluna("Conversão", lambda l: l["pct_conversao"], "percentual"),
    Coluna("Averbado (R$)", lambda l: l["vlr_averbado"], "reais"),
    Coluna("Averbado (QTD)", lambda l: l["qtd_averbado"], "inteiro"),
    Coluna("Aguardando averbação (R$)", lambda l: l["vlr_aguardando"], "reais"),
    Coluna("Aguardando averbação (QTD)", lambda l: l["qtd_aguardando"], "inteiro"),
    Coluna("Cancelado (R$)", lambda l: l["vlr_nao_averbado"], "reais"),
    Coluna("Cancelado (QTD)", lambda l: l["qtd_nao_averbado"], "inteiro"),
]

COLUNAS_CONTRATOS = [
    Coluna("Ger. Gestão", lambda c: c["gerencia"]),
    Coluna("Ger. Comercial III", lambda c: c["coordenacao"]),
    Coluna("Ger. Comercial", lambda c: c["supervisao"]),
    Coluna("Chave", lambda c: c["chave_loja"], "inteiro"),
    Coluna("Loja", lambda c: c["nome_loja"]),
    Coluna("Data", lambda c: c["dia"], "data"),
    Coluna("Produto", lambda c: c["produto"]),
    Coluna("Situação", lambda c: c["situacao"]),
    Coluna("Contrato", lambda c: c["contrato"]),
    Coluna("NSU", lambda c: c["nsu"]),
    Coluna("CPF", lambda c: c["cpf"]),
    Coluna("Valor", lambda c: c["valor"], "reais"),
]

COLUNAS_TENTATIVAS = [
    Coluna("Ger. Gestão", lambda t: t["gerencia"]),
    Coluna("Ger. Comercial III", lambda t: t["coordenacao"]),
    Coluna("Ger. Comercial", lambda t: t["supervisao"]),
    Coluna("Chave", lambda t: t["chave_loja"], "inteiro"),
    Coluna("Loja", lambda t: t["nome_loja"]),
    Coluna("Data", lambda t: t["dia"], "data"),
    Coluna("Produto", lambda t: t["produto"]),
    Coluna("Tentativas", lambda t: t["tentativas"], "inteiro"),
    Coluna("Clientes", lambda t: t["clientes"], "inteiro"),
    Coluna("Convertidos", lambda t: t["convertidos"], "inteiro"),
    Coluna("Conversão", lambda t: t["pct_conversao"], "percentual"),
    Coluna("Abandonadas", lambda t: t["abandonadas"], "inteiro"),
    Coluna("Erro inelegib.", lambda t: t["erro_inelegibilidade"], "inteiro"),
    Coluna("Outros erros", lambda t: t["outros_erros"], "inteiro"),
]


def _contrato(linha: dict) -> dict:
    produto = produto_do_indicador(linha["INDICADOR"])
    situacao = linha["SITUACAO"]
    return {
        "gerencia": linha["DESC_GERENCIA_AREA"],
        "coordenacao": linha["DESC_COORDENACAO"],
        "supervisao": linha["DESC_SUPERVISAO"],
        "chave_loja": linha["CHAVE_LOJA"],
        "nome_loja": linha["NOME_LOJA"],
        "dia": linha["DIA"],
        "produto": NOMES_PRODUTO.get(produto, produto),
        "situacao": NOMES_SITUACAO.get(situacao, situacao),
        "contrato": str(linha["CONTRATO"]),
        "nsu": str(linha["NSU_TRX"]),
        "cpf": formatar_cpf(linha["CPF_CLIENTE"]),
        "valor": float(linha["VLR_CONTRATO"]),
    }


def _tentativa(linha: dict) -> dict:
    tent = int(linha["QTD_CLIENTES"])
    conv = int(linha["QTD_CONVERTIDOS"])
    produto = linha["PRODUTO"]
    return {
        "gerencia": linha["DESC_GERENCIA_AREA"],
        "coordenacao": linha["DESC_COORDENACAO"],
        "supervisao": linha["DESC_SUPERVISAO"],
        "chave_loja": linha["CHAVE_LOJA"],
        "nome_loja": linha["NOME_LOJA"],
        "dia": linha["DATA_ETAPA"],
        "produto": NOMES_PRODUTO.get(produto, produto),
        "tentativas": tent,
        "clientes": int(linha["QTD_CLIENTES"]),
        "convertidos": conv,
        "pct_conversao": round(100 * conv / tent, 1) if tent else 0.0,
        "abandonadas": int(linha["QTD_ABANDONADAS"]),
        "erro_inelegibilidade": int(linha["QTD_ERRO_INELEGIBILIDADE"]),
        "outros_erros": int(linha["QTD_OUTROS_ERROS"]),
    }
