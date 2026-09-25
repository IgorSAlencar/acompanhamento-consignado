"""Calendario de dias uteis (MESU..TB_DIA_UTIL) para a aba Dia Util.

Regras:
- QT_DIAS_UTEIS_MES = 0 (ex.: 1o dia nao util do mes) conta como DU 1.
- Sabado/domingo herdam o numero da sexta; a producao do fim de semana
  soma no mesmo DU (agrupamos por DU, nunca por data).
"""
from datetime import date, timedelta

from repositories.query_runner import run_query

MESES_PERMITIDOS = (3, 6)


def mes_referencia(args) -> int:
    """Mes de referencia AAAAMM (aceita AAAA-MM); padrao = mes atual."""
    bruto = (args.get("mes_ref") or "").replace("-", "")
    if len(bruto) == 6 and bruto.isdigit():
        return int(bruto)
    hoje = date.today()
    return hoje.year * 100 + hoje.month


def qtd_meses(args) -> int:
    """Quantidade de meses comparados (whitelist: 3 ou 6)."""
    try:
        qtd = int(args.get("meses") or 0)
    except (TypeError, ValueError):
        qtd = 0
    return qtd if qtd in MESES_PERMITIDOS else MESES_PERMITIDOS[0]


def meses_comparacao(mes_ref: int, qtd: int) -> list[int]:
    """Lista AAAAMM do mes mais antigo ate o mes de referencia."""
    ano, mes = divmod(mes_ref, 100)
    meses = []
    for _ in range(qtd):
        meses.append(ano * 100 + mes)
        ano, mes = (ano, mes - 1) if mes > 1 else (ano - 1, 12)
    return meses[::-1]


def meses_anteriores_permitidos(mes_ref: int, qtd: int = 12) -> list[int]:
    """Ate 12 meses antes do mes de referencia, do mais recente ao mais antigo."""
    return [mes for mes in reversed(meses_comparacao(mes_ref, qtd + 1)) if mes != mes_ref]


def meses_escolhidos(args, mes_ref: int) -> list[int]:
    """Meses da analise: referencia + os que o usuario marcou.

    `comparar` vem como AAAAMM separados por virgula. Fora da whitelist
    (12 meses anteriores) o valor e ignorado. Sem escolha valida, cai na
    janela de 3 ou 6 meses.
    """
    permitidos = set(meses_anteriores_permitidos(mes_ref))
    escolhidos = []
    for parte in str(args.get("comparar") or "").split(","):
        parte = parte.strip()
        if len(parte) == 6 and parte.isdigit():
            mes = int(parte)
            if mes in permitidos and mes not in escolhidos:
                escolhidos.append(mes)
    if not escolhidos:
        return meses_comparacao(mes_ref, qtd_meses(args))
    return sorted(escolhidos) + [mes_ref]


def intervalo_datas(meses: list[int]) -> tuple[str, str]:
    """Primeiro dia do mes mais antigo e ultimo dia do mes de referencia (ISO)."""
    ini_ano, ini_mes = divmod(meses[0], 100)
    fim_ano, fim_mes = divmod(meses[-1], 100)
    proximo = date(fim_ano + 1, 1, 1) if fim_mes == 12 else date(fim_ano, fim_mes + 1, 1)
    ultimo = date.fromordinal(proximo.toordinal() - 1)
    return date(ini_ano, ini_mes, 1).isoformat(), ultimo.isoformat()


def carregar_calendario(args) -> dict:
    """Calendario dos meses comparados: total de DUs por mes e DU de D-1 (ontem).

    A producao averbada e acompanhada ate ontem; o DU de hoje ainda nao fecha.
    """
    mes_ref = mes_referencia(args)
    meses = meses_escolhidos(args, mes_ref)
    data_ini, data_fim = intervalo_datas(meses)
    linhas = run_query("du_calendario", [data_ini, data_fim])

    total_dus = {mes: 0 for mes in meses}
    du_hoje = 0
    ontem = date.today() - timedelta(days=1)
    for linha in linhas:
        mes, du = int(linha["MES"]), int(linha["DU"])
        if mes not in total_dus:
            continue
        total_dus[mes] = max(total_dus[mes], du)
        dia = linha["DATA"]
        if hasattr(dia, "date"):  # datetime -> date
            dia = dia.date()
        if mes == mes_ref and dia <= ontem:
            du_hoje = max(du_hoje, du)

    return {
        "mes_ref": mes_ref,
        "meses": meses,
        "meses_disponiveis": meses_anteriores_permitidos(mes_ref),
        "data_ini": data_ini,
        "data_fim": data_fim,
        "total_dus": total_dus,
        "du_hoje": du_hoje or 1,
        "max_du": max(list(total_dus.values()) or [1]),
    }


def du_selecionado(args, calendario: dict) -> int:
    """DU "ate" da analise: parametro ?du=, limitado ao DU de ontem (D-1).

    Nao deixa comparar o mes corrente num DU que ainda nao fechou —
    a producao e vista sempre ate D-1.
    """
    total = calendario["total_dus"].get(calendario["mes_ref"]) or calendario["max_du"] or 1
    teto = min(total, calendario["du_hoje"] or 1)
    try:
        du = int(args.get("du") or 0)
    except (TypeError, ValueError):
        du = 0
    if du < 1:
        du = calendario["du_hoje"] or 1
    return min(du, teto)


def obter_calendario(args) -> dict:
    """Resposta da API /api/du/calendario."""
    calendario = carregar_calendario(args)
    calendario["du_atual"] = du_selecionado(args, calendario)
    return calendario
