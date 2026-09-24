"""Cockpit da equipe por nivel hierarquico, com drill-down, pais e chips de alerta."""
from repositories.query_runner import run_query
from services.filtros_comuns import PRODUTOS, filtro_hierarquia, periodo, periodo_int, periodo_mes

# Whitelist de niveis -> colunas (nunca vem do usuario)
NIVEIS = {
    "gerencia": {
        "chave": "L.CHAVE_GERENCIA_AREA",
        "desc": "L.DESC_GERENCIA_AREA",
        "rotulo": "Ger. Gestão",
        "proximo": "coordenacao",
        "cols_pais": "",
        "pais": [],
    },
    "coordenacao": {
        "chave": "L.CHAVE_COORDENACAO",
        "desc": "L.DESC_COORDENACAO",
        "rotulo": "Ger. Comercial III",
        "proximo": "supervisao",
        "cols_pais": ", MAX(L.DESC_GERENCIA_AREA) AS PAI_GERENCIA",
        "pais": ["gerencia"],
    },
    "supervisao": {
        "chave": "L.CHAVE_SUPERVISAO",
        "desc": "L.DESC_SUPERVISAO",
        "rotulo": "Ger. Comercial",
        "proximo": None,
        "cols_pais": (
            ", MAX(L.DESC_GERENCIA_AREA) AS PAI_GERENCIA"
            ", MAX(L.DESC_COORDENACAO) AS PAI_COORDENACAO"
        ),
        "pais": ["gerencia", "coordenacao"],
    },
}


def obter_equipe(args) -> dict:
    nivel = args.get("nivel") or "gerencia"
    if nivel not in NIVEIS:
        nivel = "gerencia"
    config = NIVEIS[nivel]

    frag_h, params_h = filtro_hierarquia(args)
    data_ini, data_fim = periodo(args)
    ini_int, fim_int = periodo_int(data_ini, data_fim)
    mes_ini, mes_fim = periodo_mes(data_ini, data_fim)
    tokens = {
        "FILTROS": frag_h,
        "NIVEL_CHAVE": config["chave"],
        "NIVEL_DESC": config["desc"],
        "COLS_PAIS": config["cols_pais"],
    }

    cobertura = run_query("equipe_cobertura", params_h + [mes_ini, mes_fim, ini_int, fim_int], tokens)
    producao = run_query("equipe_producao", params_h + [ini_int, fim_int], tokens)
    tentativas = run_query("equipe_tentativas", params_h + [data_ini, data_fim], tokens)

    linhas: dict[int, dict] = {}
    for item in cobertura:
        qtd_lojas = int(item["QTD_LOJAS"])
        qtd_prod = int(item["QTD_LOJAS_PRODUCAO"])
        linhas[item["CHAVE"]] = {
            "chave": item["CHAVE"],
            "descricao": item["DESCRICAO"],
            "pai_gerencia": item.get("PAI_GERENCIA"),
            "pai_coordenacao": item.get("PAI_COORDENACAO"),
            "qtd_lojas": qtd_lojas,
            "qtd_lojas_producao": qtd_prod,
            "pct_cobertura": round(100 * qtd_prod / qtd_lojas, 1) if qtd_lojas else 0.0,
            "produtos": {
                p: {
                    "vlr": 0.0, "qtd": 0, "vlr_aguardando": 0.0,
                    "tentativas": 0, "convertidas": 0, "pct_conversao": 0.0,
                }
                for p in PRODUTOS
            },
        }

    for item in producao:
        linha = linhas.get(item["CHAVE"])
        if linha:
            produto = linha["produtos"][item["PRODUTO"]]
            produto["vlr"] = float(item["VLR_PRODUCAO"])
            produto["qtd"] = int(item["QTD_OPERACOES"])
            produto["vlr_aguardando"] = float(item["VLR_AGUARDANDO"])

    for item in tentativas:
        linha = linhas.get(item["CHAVE"])
        if linha:
            produto = linha["produtos"][item["PRODUTO"]]
            produto["tentativas"] = int(item["QTD_TENTATIVAS"])
            produto["convertidas"] = int(item["QTD_CONVERTIDAS"])
            if produto["tentativas"]:
                produto["pct_conversao"] = round(
                    100 * produto["convertidas"] / produto["tentativas"], 1
                )

    resultado = sorted(
        linhas.values(), key=lambda l: l["produtos"]["INSS"]["vlr"], reverse=True
    )

    chips = {
        produto: sum(1 for l in resultado if l["produtos"][produto]["tentativas"] == 0)
        for produto in PRODUTOS
    }

    return {
        "nivel": nivel,
        "rotulo": config["rotulo"],
        "proximo_nivel": config["proximo"],
        "pais": config["pais"],
        "total_entidades": len(resultado),
        "sem_tentativa": chips,
        "linhas": resultado,
    }
