"""Trechos SQL fixos do universo de lojas; nenhum texto vem do usuario."""

CASE_SEGMENTO = """CASE
    WHEN A.ILHA_V2 > 0 THEN 'Ilha 2.0'
    WHEN A.BE_ILHA > 0 THEN 'Ilha'
    WHEN A.BE_EXCLUSIVO > '0' THEN 'Exclusivo'
    WHEN A.COD_GRUPO_ECON IN (36, 202) THEN 'Casas Bahia'
    WHEN A.DESC_GERENCIA_NEGOCIO IS NOT NULL THEN 'Grandes Redes'
    ELSE 'Varejo'
END"""

TOKENS_LOJAS = {
    "UNIVERSO": "IN ('Ilha 2.0', 'Ilha', 'Varejo')",
    "JOIN_HIERARQUIA": "INNER JOIN",
    "COLUNA_SEGMENTO": f", {CASE_SEGMENTO} AS SEGMENTO",
}
