"""Curvas por dia util: mes de referencia vs meses anteriores (dia e acumulado).

Series por mes para 4 metricas (vlr, qtd, lojas, tentativas) + KPIs de
ritmo/projecao ate o DU N. Producao/valor = so contratos AVERBADOS.
"""
from repositories.query_runner import run_query
from services.du_calendario import carregar_calendario, du_selecionado, intervalo_datas
from services.du_padrao import desvio_percentual
from services.filtros_comuns import (
    filtro_hierarquia,
    filtro_produto_producao,
    filtro_produto_tentativas,
)

METRICAS = ("vlr", "qtd", "lojas", "tentativas")


def _series_vazias(calendario: dict) -> dict:
    return {
        mes: {metrica: {"dia": [0] * calendario["total_dus"][mes]} for metrica in METRICAS}
        for mes in calendario["meses"]
    }


def _somar_dia(series: dict, mes: int, du: int, metrica: str, valor):
    serie = series.get(mes)
    if not serie:
        return
    dias = serie[metrica]["dia"]
    if 1 <= du <= len(dias):
        dias[du - 1] += valor


def _acumular(dias: list) -> list:
    acumulado, total = [], 0
    for valor in dias:
        total += valor
        acumulado.append(round(total, 2) if isinstance(total, float) else total)
    return acumulado


def _no_du(dias: list, du: int):
    return dias[du - 1] if 1 <= du <= len(dias) else 0


def _ate_du(acumulado: list, du: int):
    if not acumulado or du < 1:
        return 0
    return acumulado[min(du, len(acumulado)) - 1]


def _ritmo(series: dict, calendario: dict, du: int) -> dict:
    """KPIs ate o DU N: acumulado, dia, media historica, desvio e projecao."""
    mes_ref = calendario["mes_ref"]
    anteriores = [mes for mes in calendario["meses"] if mes != mes_ref]
    total_ref = calendario["total_dus"].get(mes_ref) or 1
    ritmo = {}
    for metrica in METRICAS:
        atual = series[mes_ref][metrica]
        acum = _ate_du(atual["acum"], du)
        dia = _no_du(atual["dia"], du)
        qtd_ant = len(anteriores)
        media_acum = (
            sum(_ate_du(series[mes][metrica]["acum"], du) for mes in anteriores) / qtd_ant
            if qtd_ant else 0
        )
        media_du = (
            sum(_no_du(series[mes][metrica]["dia"], du) for mes in anteriores) / qtd_ant
            if qtd_ant else 0
        )
        ritmo[metrica] = {
            "atual_acum": acum,
            "media_acum": round(media_acum, 2),
            "atual_du": dia,
            "media_du": round(media_du, 2),
            "desvio_pct": desvio_percentual(acum, media_acum),
            "projecao": round(acum / du * total_ref, 2) if du else 0,
        }
    return ritmo


def obter_curva(args) -> dict:
    calendario = carregar_calendario(args)
    du = du_selecionado(args, calendario)
    frag_h, params_h = filtro_hierarquia(args)
    frag_pp, params_pp = filtro_produto_producao(args)
    frag_pt, params_pt = filtro_produto_tentativas(args)

    data_ini, data_fim = calendario["data_ini"], calendario["data_fim"]
    tokens_prod = {"FILTROS": frag_h, "PRODUTO": frag_pp}
    params_prod = params_h + [data_ini, data_fim, data_ini, data_fim] + params_pp

    producao = run_query("du_curva_producao", params_prod, tokens_prod)
    primeiras = run_query("du_curva_lojas", params_prod, tokens_prod)
    tentativas = run_query(
        "du_curva_tentativas",
        params_h + [data_ini, data_fim, data_ini, data_fim] + params_pt,
        {"FILTROS": frag_h, "PRODUTO": frag_pt},
    )

    series = _series_vazias(calendario)
    for linha in producao:
        mes, dia_util = int(linha["MES"]), int(linha["DU"])
        _somar_dia(series, mes, dia_util, "vlr", float(linha["VLR_PRODUCAO"]))
        _somar_dia(series, mes, dia_util, "qtd", int(linha["QTD_OPERACOES"]))
        _somar_dia(series, mes, dia_util, "lojas", int(linha["QTD_LOJAS"]))
    for linha in tentativas:
        _somar_dia(series, int(linha["MES"]), int(linha["DU"]), "tentativas", int(linha["QTD_TENTATIVAS"]))

    # Lojas produtivas acumuladas = soma das lojas cujo PRIMEIRO DU <= N
    novas = {mes: [0] * calendario["total_dus"][mes] for mes in calendario["meses"]}
    for linha in primeiras:
        mes, dia_util = int(linha["MES"]), int(linha["DU"])
        if mes in novas and 1 <= dia_util <= len(novas[mes]):
            novas[mes][dia_util - 1] += int(linha["QTD_LOJAS_NOVAS"])

    for mes, serie in series.items():
        serie["vlr"]["dia"] = [round(v, 2) for v in serie["vlr"]["dia"]]
        for metrica in ("vlr", "qtd", "tentativas"):
            serie[metrica]["acum"] = _acumular(serie[metrica]["dia"])
        serie["lojas"]["acum"] = _acumular(novas[mes])

    ritmo = _ritmo(series, calendario, du)
    _ocultar_futuro(series, calendario)

    mes_ref_ini, mes_ref_fim = intervalo_datas([calendario["mes_ref"]])
    return {
        "mes_ref": calendario["mes_ref"],
        "meses": calendario["meses"],
        "meses_disponiveis": calendario["meses_disponiveis"],
        "du_atual": du,
        "du_hoje": calendario["du_hoje"],
        "total_dus": calendario["total_dus"],
        "max_du": calendario["max_du"],
        "mes_ref_ini": mes_ref_ini,
        "mes_ref_fim": mes_ref_fim,
        "series": series,
        "ritmo": ritmo,
    }


def _ocultar_futuro(series: dict, calendario: dict):
    """No mes de referencia, anula DUs depois de D-1 (a linha para no ultimo DU fechado)."""
    mes_ref = calendario["mes_ref"]
    du_hoje = calendario["du_hoje"]
    if mes_ref not in series or du_hoje < 1:
        return
    for metrica in METRICAS:
        for chave in ("dia", "acum"):
            valores = series[mes_ref][metrica].get(chave)
            if not valores:
                continue
            for i in range(du_hoje, len(valores)):
                valores[i] = None
