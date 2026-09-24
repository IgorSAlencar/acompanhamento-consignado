"""KPIs do topo: producao, operacoes, averbacao, tentativas, conversao e cobertura."""
from repositories.query_runner import run_query
from services.filtros_comuns import (
    filtro_hierarquia,
    filtro_produto_producao,
    filtro_produto_tentativas,
    periodo,
    periodo_int,
    periodo_mes,
)


def obter_resumo(args) -> dict:
    frag_h, params_h = filtro_hierarquia(args)
    data_ini, data_fim = periodo(args)
    ini_int, fim_int = periodo_int(data_ini, data_fim)
    mes_ini, mes_fim = periodo_mes(data_ini, data_fim)

    frag_pp, params_pp = filtro_produto_producao(args)
    frag_pt, params_pt = filtro_produto_tentativas(args)

    producao = run_query(
        "resumo_producao",
        params_h + [ini_int, fim_int] + params_pp,
        {"FILTROS": frag_h, "PRODUTO": frag_pp},
    )[0]

    tentativas = run_query(
        "resumo_tentativas",
        params_h + [data_ini, data_fim] + params_pt,
        {"FILTROS": frag_h, "PRODUTO": frag_pt},
    )[0]

    cobertura = run_query(
        "cobertura",
        params_h + [mes_ini, mes_fim, ini_int, fim_int] + params_pp,
        {"FILTROS": frag_h, "PRODUTO": frag_pp},
    )[0]

    qtd_tent = int(tentativas["QTD_TENTATIVAS"])
    qtd_conv = int(tentativas["QTD_CONVERTIDAS"])
    qtd_lojas = int(cobertura["QTD_LOJAS"])
    qtd_lojas_prod = int(cobertura["QTD_LOJAS_PRODUCAO"])

    return {
        # Producao considera apenas contratos AVERBADOS
        "vlr_averbado": float(producao["VLR_AVERBADO"]),
        "qtd_averbado": int(producao["QTD_AVERBADO"] or 0),
        # Mostrados a parte
        "vlr_aguardando": float(producao["VLR_AGUARDANDO"]),
        "qtd_aguardando": int(producao["QTD_AGUARDANDO"] or 0),
        "vlr_nao_averbado": float(producao["VLR_NAO_AVERBADO"]),
        "qtd_nao_averbado": int(producao["QTD_NAO_AVERBADO"] or 0),
        "qtd_tentativas": qtd_tent,
        "qtd_convertidas": qtd_conv,
        "pct_conversao": round(100 * qtd_conv / qtd_tent, 1) if qtd_tent else 0.0,
        "qtd_lojas": qtd_lojas,
        "qtd_lojas_producao": qtd_lojas_prod,
        "pct_cobertura": round(100 * qtd_lojas_prod / qtd_lojas, 1) if qtd_lojas else 0.0,
        "periodo": {"data_ini": data_ini, "data_fim": data_fim},
    }
