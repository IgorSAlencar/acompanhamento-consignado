"""Consulta de contratos do periodo, compartilhada com a exportacao."""
from repositories.query_runner import run_query
from services.filtros_comuns import (
    filtro_hierarquia, filtro_produto_producao, filtro_situacao,
    periodo, produto_do_indicador,
)


def parametros_consulta_contratos(args) -> tuple[list, dict]:
    frag_h, params_h = filtro_hierarquia(args)
    data_ini, data_fim = periodo(args)
    frag_p, params_p = filtro_produto_producao(args)
    frag_s, params_s = filtro_situacao(args)
    return (
        params_h + [data_ini, data_fim] + params_p + params_s,
        {"FILTROS": frag_h, "PRODUTO": frag_p, "SITUACAO": frag_s},
    )


def consultar_linhas_contratos(args) -> list[dict]:
    params, tokens = parametros_consulta_contratos(args)
    return run_query("exportar_contratos", params, tokens)


def hierarquia_contratos_visivel(args) -> tuple[str, ...]:
    niveis = ("gerencia", "coordenacao", "supervisao")
    if args.get("loja"):
        return ()
    for indice in range(len(niveis) - 1, -1, -1):
        if args.get(niveis[indice]):
            return niveis[indice + 1:]
    return niveis


def _identificador(valor) -> str:
    return "" if valor is None else str(valor).split(".")[0]


def _cpf(valor) -> str:
    numero = str(valor or "").strip().zfill(11)
    return f"{numero[:3]}.{numero[3:6]}.{numero[6:9]}-{numero[9:]}"


def obter_contratos(args) -> list[dict]:
    linhas = [{
        "gerencia": c["DESC_GERENCIA_AREA"],
        "coordenacao": c["DESC_COORDENACAO"],
        "supervisao": c["DESC_SUPERVISAO"],
        "chave_loja": c["CHAVE_LOJA"],
        "nome_loja": c["NOME_LOJA"],
        "dia": c["DIA"].isoformat(),
        "produto": produto_do_indicador(c["INDICADOR"]),
        "situacao": c["SITUACAO"],
        "contrato": _identificador(c["CONTRATO"]),
        "nsu": _identificador(c["NSU_TRX"]),
        "cpf": _cpf(c["CPF_CLIENTE"]),
        "valor": float(c["VLR_CONTRATO"]),
    } for c in consultar_linhas_contratos(args)]
    busca = (args.get("busca") or "").strip().lower()
    if busca:
        linhas = [linha for linha in linhas if any(
            busca in str(valor).lower() for valor in linha.values()
        )]
    return linhas
