"""Drill-down ate o maior detalhe: numero -> lojas -> contratos / tentativas da loja."""
from repositories.query_runner import run_query
from services.filtros_comuns import (
    PRODUTOS,
    filtro_hierarquia,
    filtro_produto_producao,
    filtro_produto_tentativas,
    filtro_situacao,
    periodo,
    periodo_mes,
    produto_do_indicador,
    produto_selecionado,
    situacao_selecionada,
)

_SOMENTE_COM_MOVIMENTO = "WHERE P.QTD_AVERBADO > 0"
_QUALQUER_MOVIMENTO = (
    "ISNULL(P.QTD_AVERBADO, 0) + ISNULL(P.QTD_AGUARDANDO, 0) + "
    "ISNULL(P.QTD_NAO_AVERBADO, 0) > 0 OR ISNULL(T.QTD_TENTATIVAS, 0) > 0"
)


def _filtro_movimento(args) -> str:
    # Mantem todas as metricas dos grupos, inclusive movimento de lojas inativas.
    if args.get("incluir_sem_movimento") == "1":
        return f"WHERE L.ATIVA = 1 OR {_QUALQUER_MOVIMENTO}"
    if args.get("qualquer_movimento") == "1":
        return f"WHERE {_QUALQUER_MOVIMENTO}"
    if args.get("foco") == "tentativas":
        return "WHERE T.QTD_TENTATIVAS > 0"
    if situacao_selecionada(args):
        return "WHERE P.QTD_AVERBADO + P.QTD_AGUARDANDO + P.QTD_NAO_AVERBADO > 0"
    return _SOMENTE_COM_MOVIMENTO


def _formatar_cpf(cpf: str) -> str:
    cpf = (cpf or "").strip().zfill(11)
    return f"{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:]}"


def obter_lojas(args) -> list[dict]:
    frag_h, params_h = filtro_hierarquia(args)
    data_ini, data_fim = periodo(args)
    mes_ini, mes_fim = periodo_mes(data_ini, data_fim)
    frag_pp, params_pp = filtro_produto_producao(args)
    frag_pt, params_pt = filtro_produto_tentativas(args)
    frag_s, params_s = filtro_situacao(args)

    linhas = run_query(
        "detalhe_lojas",
        [mes_ini, mes_fim] + [data_ini, data_fim] + params_pp + params_s + [data_ini, data_fim] + params_pt + params_h,
        {
            "FILTROS": frag_h,
            "PRODUTO_P": frag_pp,
            "SITUACAO": frag_s,
            "PRODUTO_T": frag_pt,
            "INCLUIR_ATIVAS": "UNION SELECT CHAVE_LOJA FROM ATIVAS" if args.get("incluir_sem_movimento") == "1" else "",
            "SOMENTE_COM_MOVIMENTO": _filtro_movimento(args),
        },
    )

    resultado = []
    for l in linhas:
        tent = int(l["QTD_TENTATIVAS"])
        conv = int(l["QTD_CONVERTIDAS"])
        resultado.append({
            "chave_loja": l["CHAVE_LOJA"],
            "nome_loja": l["NOME_LOJA"],
            "municipio": l["MUNICIPIO"],
            "uf": l["UF"],
            "gerencia": l["DESC_GERENCIA_AREA"],
            "coordenacao": l["DESC_COORDENACAO"],
            "supervisao": l["DESC_SUPERVISAO"],
            "qtd_averbado": int(l["QTD_AVERBADO"]),
            "vlr_averbado": float(l["VLR_AVERBADO"]),
            "qtd_aguardando": int(l["QTD_AGUARDANDO"]),
            "vlr_aguardando": float(l["VLR_AGUARDANDO"]),
            "qtd_nao_averbado": int(l["QTD_NAO_AVERBADO"]),
            "vlr_nao_averbado": float(l["VLR_NAO_AVERBADO"]),
            "ativa": bool(l["ATIVA"]),
            "qtd_tentativas": tent,
            "qtd_convertidas": conv,
            "pct_conversao": round(100 * conv / tent, 1) if tent else 0.0,
        })
    if args.get("por_produto") == "1" and not produto_selecionado(args):
        _anexar_produtos(resultado, frag_h, params_h, data_ini, data_fim)
    return resultado


def _produto_vazio() -> dict:
    return {
        produto: {"qtd_tentativas": 0, "qtd_convertidas": 0, "pct_conversao": 0.0}
        for produto in PRODUTOS
    }


def _anexar_produtos(lojas, frag_h, params_h, data_ini, data_fim) -> None:
    """Quebra tentativas e convertidas de cada loja por produto (visao Geral)."""
    linhas = run_query(
        "detalhe_tentativas_produto",
        params_h + [data_ini, data_fim],
        {"FILTROS": frag_h},
    )
    por_loja = {int(loja["chave_loja"]): _produto_vazio() for loja in lojas}
    for linha in linhas:
        produtos = por_loja.get(int(linha["CHAVE_LOJA"]))
        produto = linha["PRODUTO"]
        if not produtos or produto not in produtos:
            continue
        tent = int(linha["QTD_TENTATIVAS"])
        conv = int(linha["QTD_CONVERTIDAS"])
        produtos[produto] = {
            "qtd_tentativas": tent,
            "qtd_convertidas": conv,
            "pct_conversao": round(100 * conv / tent, 1) if tent else 0.0,
        }
    for loja in lojas:
        loja["produtos"] = por_loja[int(loja["chave_loja"])]


def obter_loja(args) -> dict:
    """Contratos e tentativas por dia de uma loja especifica."""
    chave_loja = int(args["loja"])
    data_ini, data_fim = periodo(args)
    frag_pp, params_pp = filtro_produto_producao(args)
    frag_pt, params_pt = filtro_produto_tentativas(args)
    frag_s, params_s = filtro_situacao(args)

    contratos = run_query(
        "detalhe_contratos",
        [chave_loja, data_ini, data_fim] + params_pp + params_s,
        {"PRODUTO": frag_pp, "SITUACAO": frag_s},
    )
    tentativas = run_query(
        "detalhe_tentativas_loja",
        [chave_loja, data_ini, data_fim] + params_pt,
        {"PRODUTO": frag_pt},
    )

    return {
        "contratos": [
            {
                "dia": c["DIA"].isoformat(),
                "produto": produto_do_indicador(c["INDICADOR"]),
                "situacao": c["SITUACAO"],
                "contrato": str(c["CONTRATO"]),
                "nsu": str(c["NSU_TRX"]),
                "cpf": _formatar_cpf(c["CPF_CLIENTE"]),
                "valor": float(c["VLR_CONTRATO"]),
            }
            for c in contratos
        ],
        "tentativas": [
            {
                "dia": t["DATA_ETAPA"].isoformat(),
                "produto": t["PRODUTO"],
                "tentativas": int(t["QTD_CLIENTES"]),
                "clientes": int(t["QTD_CLIENTES"]),
                "convertidos": int(t["QTD_CONVERTIDOS"]),
                "abandonadas": int(t["QTD_ABANDONADAS"]),
                "erro_inelegibilidade": int(t["QTD_ERRO_INELEGIBILIDADE"]),
                "outros_erros": int(t["QTD_OUTROS_ERROS"]),
            }
            for t in tentativas
        ],
    }
