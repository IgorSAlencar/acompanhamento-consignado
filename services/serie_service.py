"""Serie diaria do grafico: producao averbada e tentativas/convertidas."""
from repositories.query_runner import run_query
from services.filtros_comuns import (
    dia_int_para_iso,
    dias_do_periodo,
    filtro_hierarquia,
    filtro_produto_producao,
    filtro_produto_tentativas,
    periodo,
    periodo_int,
)


def obter_serie(args) -> dict:
    frag_h, params_h = filtro_hierarquia(args)
    data_ini, data_fim = periodo(args)
    ini_int, fim_int = periodo_int(data_ini, data_fim)
    frag_pp, params_pp = filtro_produto_producao(args)
    frag_pt, params_pt = filtro_produto_tentativas(args)

    producao = run_query(
        "serie_diaria",
        params_h + [ini_int, fim_int] + params_pp,
        {"FILTROS": frag_h, "PRODUTO": frag_pp},
    )
    tentativas = run_query(
        "serie_tentativas",
        params_h + [data_ini, data_fim] + params_pt,
        {"FILTROS": frag_h, "PRODUTO": frag_pt},
    )
    prod_dia = {dia_int_para_iso(l["DIA_INT"]): l for l in producao}
    tent_dia = {l["DIA"].isoformat(): l for l in tentativas}

    # Calendario completo para o eixo X ficar continuo
    dias = dias_do_periodo(data_ini, data_fim)
    return {
        "dias": dias,
        "qtd_operacoes": [int(prod_dia[d]["QTD_OPERACOES"]) if d in prod_dia else 0 for d in dias],
        "vlr_producao": [float(prod_dia[d]["VLR_PRODUCAO"]) if d in prod_dia else 0.0 for d in dias],
        "qtd_tentativas": [int(tent_dia[d]["QTD_TENTATIVAS"]) if d in tent_dia else 0 for d in dias],
        "qtd_convertidas": [int(tent_dia[d]["QTD_CONVERTIDAS"]) if d in tent_dia else 0 for d in dias],
    }
