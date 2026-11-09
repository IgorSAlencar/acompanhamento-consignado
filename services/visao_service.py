"""Visao comercial padrao e visao macro por segmento do CASE original."""
from repositories.lojas_sql import CASE_SEGMENTO, TOKENS_LOJAS

SEGMENTOS = ("Ilha 2.0", "Ilha", "Exclusivo", "Casas Bahia", "Grandes Redes", "Varejo")


def modo_macro(args) -> bool:
    return args.get("escopo") == "macro"


def segmento_selecionado(args) -> str | None:
    if not modo_macro(args):
        return None
    segmento = args.get("segmento")
    if segmento and segmento not in SEGMENTOS:
        raise ValueError("Segmento invalido")
    return segmento or None


def tokens_visao(args) -> dict:
    # O CASE sempre retorna uma das seis classificacoes, inclusive sem hierarquia.
    segmento_selecionado(args)
    return {
        "UNIVERSO": "IS NOT NULL" if modo_macro(args) else TOKENS_LOJAS["UNIVERSO"],
        "JOIN_HIERARQUIA": "LEFT JOIN" if modo_macro(args) else "INNER JOIN",
    }


def nivel_visao(args, padrao="gerencia") -> str:
    nivel = args.get("nivel") or ("segmento" if modo_macro(args) else padrao)
    return padrao if nivel == "segmento" and not modo_macro(args) else nivel


def filtro_segmento(args) -> tuple[str, list]:
    segmento = segmento_selecionado(args)
    return (f" AND ({CASE_SEGMENTO}) = ?", [segmento]) if segmento else ("", [])
