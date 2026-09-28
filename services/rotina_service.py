"""Rotina diaria da equipe: tentativas e producao de cada gerente, dia a dia."""
from repositories.query_runner import run_query
from services.equipe_service import NIVEIS, pais_visiveis
from services.filtros_comuns import (
    dias_do_periodo,
    filtro_hierarquia,
    filtro_produto_producao,
    filtro_produto_tentativas,
    periodo,
    periodo_mes,
)


def _dia_vazio() -> dict:
    return {
        "tent": 0, "conv": 0, "lojas": 0, "qtd": 0, "vlr": 0.0,
        "qtd_ag": 0, "vlr_ag": 0.0, "qtd_nao": 0, "vlr_nao": 0.0,
    }


def obter_rotina(args) -> dict:
    nivel = args.get("nivel") or "supervisao"
    if nivel not in NIVEIS:
        nivel = "supervisao"
    config = NIVEIS[nivel]

    frag_h, params_h = filtro_hierarquia(args)
    data_ini, data_fim = periodo(args)
    mes_ini, mes_fim = periodo_mes(data_ini, data_fim)
    frag_pp, params_pp = filtro_produto_producao(args)
    frag_pt, params_pt = filtro_produto_tentativas(args)
    tokens = {
        "FILTROS": frag_h,
        "NIVEL_CHAVE": config["chave"],
        "NIVEL_DESC": config["desc"],
        "COLS_PAIS": config["cols_pais"],
    }

    entidades = run_query("equipe_cobertura", params_h + [mes_ini, mes_fim, data_ini, data_fim], tokens)
    tentativas = run_query(
        "rotina_tentativas",
        params_h + [data_ini, data_fim] + params_pt,
        {**tokens, "PRODUTO": frag_pt},
    )
    producao = run_query(
        "rotina_producao",
        params_h + [data_ini, data_fim] + params_pp,
        {**tokens, "PRODUTO": frag_pp},
    )

    dias = dias_do_periodo(data_ini, data_fim)
    linhas = {
        e["CHAVE"]: {
            "chave": e["CHAVE"],
            "descricao": e["DESCRICAO"],
            "pai_gerencia": e.get("PAI_GERENCIA"),
            "pai_coordenacao": e.get("PAI_COORDENACAO"),
            "qtd_lojas": int(e["QTD_LOJAS"]),
            "dias": {d: _dia_vazio() for d in dias},
        }
        for e in entidades
    }

    for item in tentativas:
        linha = linhas.get(item["CHAVE"])
        dia = item["DIA"].isoformat()
        if linha and dia in linha["dias"]:
            celula = linha["dias"][dia]
            celula["tent"] = int(item["QTD_TENTATIVAS"])
            celula["conv"] = int(item["QTD_CONVERTIDAS"])
            celula["lojas"] = int(item["QTD_LOJAS_TENTARAM"])

    for item in producao:
        linha = linhas.get(item["CHAVE"])
        dia = item["DIA"].isoformat()
        if linha and dia in linha["dias"]:
            celula = linha["dias"][dia]
            celula["qtd"] = int(item["QTD_AVERBADO"])
            celula["vlr"] = float(item["VLR_AVERBADO"])
            celula["qtd_ag"] = int(item["QTD_AGUARDANDO"])
            celula["vlr_ag"] = float(item["VLR_AGUARDANDO"])
            celula["qtd_nao"] = int(item["QTD_NAO_AVERBADO"])
            celula["vlr_nao"] = float(item["VLR_NAO_AVERBADO"])

    return {
        "nivel": nivel,
        "rotulo": config["rotulo"],
        "pais": pais_visiveis(config["pais"], args),
        "dias": dias,
        "linhas": sorted(linhas.values(), key=lambda l: l["descricao"]),
    }
