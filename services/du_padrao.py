"""Classificacao do padrao comportamental por dia util (funcoes puras).

O status compara o acumulado do mes de referencia ate o DU N com a media
dos meses anteriores no MESMO DU N (cada um comparado com o proprio historico).
"""

LIMIAR_ABAIXO = -30.0   # desvio menor que isso => "abaixo"
LIMIAR_ATENCAO = -10.0  # entre LIMIAR_ABAIXO e isso => "atencao"
LIMIAR_ACIMA = 10.0     # desvio maior que isso => "acima"
DUS_PARADO_ALERTA = 3   # DUs uteis seguidos sem producao para alertar

# Ordem de severidade usada no ranking (pior primeiro)
PESO_STATUS = {"zerado": 0, "abaixo": 1, "atencao": 2, "padrao": 3, "acima": 4, "novo": 5}


def desvio_percentual(atual: float, media: float) -> float | None:
    """Desvio % vs media historica; None quando nao ha base de comparacao."""
    if not media or media <= 0:
        return None
    return round(100.0 * (atual - media) / media, 1)


def classificar(atual: float, media: float) -> str:
    """Status do padrao comportamental.

    - "novo":   sem historico (media <= 0) - nao da para comparar
    - "zerado": tem historico mas ainda nao produziu no mes
    - "abaixo" / "atencao" / "padrao" / "acima": faixas de desvio vs media
    """
    if media is None or media <= 0:
        return "novo"
    if not atual:
        return "zerado"
    desvio = 100.0 * (atual - media) / media
    if desvio < LIMIAR_ABAIXO:
        return "abaixo"
    if desvio <= LIMIAR_ATENCAO:
        return "atencao"
    if desvio > LIMIAR_ACIMA:
        return "acima"
    return "padrao"
