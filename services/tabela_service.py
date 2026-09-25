"""Tabela diaria: producao averbada por produto + tentativas + valores a parte."""
from repositories.query_runner import run_query
from services.filtros_comuns import (
    PRODUTOS,
    filtro_hierarquia,
    periodo,
)


def _linha_vazia(dia: str) -> dict:
    return {
        "dia": dia,
        "produtos": {
            p: {"qtd": 0, "lojas": 0, "vlr": 0.0, "tentativas": 0, "convertidas": 0}
            for p in PRODUTOS
        },
        # Valores averbados (contam como producao)
        "total_qtd": 0,
        "total_lojas": 0,
        "total_vlr": 0.0,
        # Mostrados a parte
        "qtd_aguardando": 0,
        "lojas_aguardando": 0,
        "vlr_aguardando": 0.0,
        "qtd_nao_averbado": 0,
        "lojas_nao_averbado": 0,
        "vlr_nao_averbado": 0.0,
    }


def obter_tabela(args) -> list[dict]:
    frag_h, params_h = filtro_hierarquia(args)
    data_ini, data_fim = periodo(args)

    producao = run_query(
        "tabela_producao_diaria",
        params_h + [data_ini, data_fim],
        {"FILTROS": frag_h},
    )
    tentativas = run_query(
        "tabela_tentativas_diaria",
        params_h + [data_ini, data_fim],
        {"FILTROS": frag_h},
    )

    linhas: dict[str, dict] = {}

    for item in producao:
        dia = item["DIA"].isoformat()
        linha = linhas.setdefault(dia, _linha_vazia(dia))
        produto = linha["produtos"][item["PRODUTO"]]
        produto["qtd"] = int(item["QTD_AVERBADO"])
        produto["lojas"] = int(item["QTD_LOJAS"])
        produto["vlr"] = float(item["VLR_AVERBADO"])
        linha["total_qtd"] += produto["qtd"]
        linha["total_vlr"] += produto["vlr"]
        linha["total_lojas"] = int(item["LOJAS_AVERBADO"] or 0)
        linha["qtd_aguardando"] += int(item["QTD_AGUARDANDO"])
        linha["vlr_aguardando"] += float(item["VLR_AGUARDANDO"])
        linha["lojas_aguardando"] = int(item["LOJAS_AGUARDANDO"] or 0)
        linha["qtd_nao_averbado"] += int(item["QTD_NAO_AVERBADO"])
        linha["vlr_nao_averbado"] += float(item["VLR_NAO_AVERBADO"])
        linha["lojas_nao_averbado"] = int(item["LOJAS_NAO_AVERBADO"] or 0)

    for item in tentativas:
        dia = item["DIA"].isoformat()
        linha = linhas.setdefault(dia, _linha_vazia(dia))
        produto = linha["produtos"][item["PRODUTO"]]
        produto["tentativas"] = int(item["QTD_TENTATIVAS"])
        produto["convertidas"] = int(item["QTD_CONVERTIDAS"])

    return [linhas[dia] for dia in sorted(linhas, reverse=True)]
