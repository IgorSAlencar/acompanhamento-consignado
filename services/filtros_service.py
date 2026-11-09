"""Opcoes dos filtros em cascata (Ger. Gestao > Ger. Comercial III > Ger. Comercial)."""
from repositories.query_runner import run_query
from services.visao_service import SEGMENTOS, modo_macro


def listar_filtros(args=None) -> dict:
    linhas = run_query("filtros_hierarquia")

    gerencias, coordenacoes, supervisoes = {}, {}, {}
    for linha in linhas:
        gerencias[linha["CHAVE_GERENCIA_AREA"]] = linha["DESC_GERENCIA_AREA"]
        coordenacoes[linha["CHAVE_COORDENACAO"]] = {
            "descricao": linha["DESC_COORDENACAO"],
            "gerencia": linha["CHAVE_GERENCIA_AREA"],
        }
        supervisoes[linha["CHAVE_SUPERVISAO"]] = {
            "descricao": linha["DESC_SUPERVISAO"],
            "coordenacao": linha["CHAVE_COORDENACAO"],
        }

    macro = modo_macro(args or {})
    if macro:
        gerencias.setdefault(0, "Sem hierarquia")
        coordenacoes.setdefault(0, {"descricao": "Sem hierarquia", "gerencia": 0})
        supervisoes.setdefault(0, {"descricao": "Sem hierarquia", "coordenacao": 0})
    return {
        "segmentos": list(SEGMENTOS) if macro else [],
        "gerencias": [
            {"chave": chave, "descricao": desc}
            for chave, desc in sorted(gerencias.items(), key=lambda i: i[1])
        ],
        "coordenacoes": [
            {"chave": chave, **info}
            for chave, info in sorted(coordenacoes.items(), key=lambda i: i[1]["descricao"])
        ],
        "supervisoes": [
            {"chave": chave, **info}
            for chave, info in sorted(supervisoes.items(), key=lambda i: i[1]["descricao"])
        ],
    }
