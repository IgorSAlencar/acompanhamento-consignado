"""Helpers compartilhados de filtros (hierarquia, loja, produto, situacao e periodo)."""
from datetime import date, timedelta

PRODUTOS = ("INSS", "PRIVADO", "PUBLICO")

INDICADORES = {
    "INSS": "CRÉDITO CONSIGNADO INSS",
    "PRIVADO": "CRÉDITO CONSIGNADO PRIVADO",
    "PUBLICO": "CRÉDITO CONSIGNADO PUBLICO",
}

SITUACOES = ("AVERBADO", "NAO AVERBADO", "AGUARDANDO AVERBACAO")

# "PENDENTE" agrupa tudo que foi produzido mas nao averbou
FILTROS_SITUACAO = {
    **{s: (s,) for s in SITUACOES},
    "PENDENTE": ("AGUARDANDO AVERBACAO", "NAO AVERBADO"),
}

_CAMPOS_HIERARQUIA = (
    ("gerencia", "H.CHAVE_GERENCIA_AREA"),
    ("coordenacao", "H.CHAVE_COORDENACAO"),
    ("supervisao", "H.CHAVE_SUPERVISAO"),
    ("loja", "A.CHAVE_LOJA"),
)


def inicio_mes_vigente() -> str:
    """Primeiro dia do mes de D-1, usado como inicio padrao do filtro De."""
    ontem = date.today() - timedelta(days=1)
    return date(ontem.year, ontem.month, 1).isoformat()


def periodo(args) -> tuple[str, str]:
    """Datas ini/fim ISO; periodo automatico termina em D-1 (ontem)."""
    data_ini = args.get("data_ini") or inicio_mes_vigente()
    data_fim = args.get("data_fim") or (date.today() - timedelta(days=1)).isoformat()
    return data_ini, data_fim


def periodo_mes(data_ini: str, data_fim: str) -> tuple[int, int]:
    """Meses AAAAMM do periodo (usado em TB_INDICADORES_BE.PERIODO)."""
    return int(data_ini[:4] + data_ini[5:7]), int(data_fim[:4] + data_fim[5:7])


def dias_do_periodo(data_ini: str, data_fim: str) -> list[str]:
    atual, fim = date.fromisoformat(data_ini), date.fromisoformat(data_fim)
    dias = []
    while atual <= fim:
        dias.append(atual.isoformat())
        atual = date.fromordinal(atual.toordinal() + 1)
    return dias


def filtro_hierarquia(args) -> tuple[str, list]:
    """Fragmento SQL + parametros para hierarquia (e loja) no CTE de lojas."""
    fragmento, params = "", []
    for campo, coluna in _CAMPOS_HIERARQUIA:
        valor = args.get(campo)
        if valor:
            fragmento += f" AND {coluna} = ?"
            params.append(int(valor))
    return fragmento, params


def produto_selecionado(args) -> str | None:
    produto = (args.get("produto") or "").upper()
    return produto if produto in PRODUTOS else None


def situacao_selecionada(args) -> str | None:
    situacao = (args.get("situacao") or "").upper()
    return situacao if situacao in FILTROS_SITUACAO else None


def filtro_produto_producao(args) -> tuple[str, list]:
    produto = produto_selecionado(args)
    if produto:
        return " AND P.INDICADOR = ?", [INDICADORES[produto]]
    return "", []


def filtro_produto_tentativas(args) -> tuple[str, list]:
    produto = produto_selecionado(args)
    if produto:
        return " AND T.PRODUTO = ?", [produto]
    return "", []


def filtro_situacao(args) -> tuple[str, list]:
    situacao = situacao_selecionada(args)
    if situacao:
        valores = list(FILTROS_SITUACAO[situacao])
        marcadores = ", ".join("?" for _ in valores)
        return f" AND P.SITUACAO_CONTRATO_CONSOLIDADO IN ({marcadores})", valores
    return "", []


def produto_do_indicador(indicador: str) -> str:
    for produto, nome in INDICADORES.items():
        if nome == indicador:
            return produto
    return indicador
