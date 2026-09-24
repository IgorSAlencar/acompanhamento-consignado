"""Tabela diaria: producao averbada por produto + tentativas + valores a parte."""
from repositories.query_runner import run_query
from services.filtros_comuns import (
    PRODUTOS,
    dia_int_para_iso,
    filtro_hierarquia,
    periodo,
    periodo_int,
)


def _linha_vazia(dia: str) -> dict:
    return {
        "dia": dia,
        "produtos": {
            p: {"qtd": 0, "vlr": 0.0, "tentativas": 0, "convertidas": 0}
            for p in PRODUTOS
        },
        # Valores averbados (contam como producao)
        "total_qtd": 0,
        "total_vlr": 0.0,
        # Mostrados a parte
        "qtd_aguardando": 0,
        "vlr_aguardando": 0.0,
        "qtd_nao_averbado": 0,
        "vlr_nao_averbado": 0.0,
    }


def obter_tabela(args) -> list[dict]:
    frag_h, params_h = filtro_hierarquia(args)
    data_ini, data_fim = periodo(args)
    ini_int, fim_int = periodo_int(data_ini, data_fim)

    producao = run_query(
        "tabela_producao_diaria",
        params_h + [ini_int, fim_int],
        {"FILTROS": frag_h},
    )
    tentativas = run_query(
        "tabela_tentativas_diaria",
        params_h + [data_ini, data_fim],
        {"FILTROS": frag_h},
    )

    linhas: dict[str, dict] = {}

    for item in producao:
        dia = dia_int_para_iso(item["DIA_INT"])
        linha = linhas.setdefault(dia, _linha_vazia(dia))
        produto = linha["produtos"][item["PRODUTO"]]
        produto["qtd"] = int(item["QTD_AVERBADO"])
        produto["vlr"] = float(item["VLR_AVERBADO"])
        linha["total_qtd"] += produto["qtd"]
        linha["total_vlr"] += produto["vlr"]
        linha["qtd_aguardando"] += int(item["QTD_AGUARDANDO"])
        linha["vlr_aguardando"] += float(item["VLR_AGUARDANDO"])
        linha["qtd_nao_averbado"] += int(item["QTD_NAO_AVERBADO"])
        linha["vlr_nao_averbado"] += float(item["VLR_NAO_AVERBADO"])

    for item in tentativas:
        dia = item["DIA"].isoformat()
        linha = linhas.setdefault(dia, _linha_vazia(dia))
        produto = linha["produtos"][item["PRODUTO"]]
        produto["tentativas"] = int(item["QTD_TENTATIVAS"])
        produto["convertidas"] = int(item["QTD_CONVERTIDAS"])

    return [linhas[dia] for dia in sorted(linhas, reverse=True)]
