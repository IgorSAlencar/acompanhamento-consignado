"""Drill-down ate o maior detalhe: numero -> lojas -> contratos / tentativas da loja."""
from repositories.query_runner import run_query
from services.filtros_comuns import (
    dia_int_para_iso,
    filtro_hierarquia,
    filtro_produto_producao,
    filtro_produto_tentativas,
    filtro_situacao,
    periodo,
    periodo_int,
    produto_do_indicador,
)

_SOMENTE_COM_MOVIMENTO = "WHERE P.CHAVE_LOJA IS NOT NULL OR T.CHAVE_LOJA IS NOT NULL"


def _formatar_cpf(cpf: str) -> str:
    cpf = (cpf or "").strip().zfill(11)
    return f"{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:]}"


def obter_lojas(args) -> list[dict]:
    frag_h, params_h = filtro_hierarquia(args)
    data_ini, data_fim = periodo(args)
    ini_int, fim_int = periodo_int(data_ini, data_fim)
    frag_pp, params_pp = filtro_produto_producao(args)
    frag_pt, params_pt = filtro_produto_tentativas(args)
    frag_s, params_s = filtro_situacao(args)
    incluir_todas = args.get("incluir_sem_movimento") == "1"

    linhas = run_query(
        "detalhe_lojas",
        params_h + [ini_int, fim_int] + params_pp + params_s + [data_ini, data_fim] + params_pt,
        {
            "FILTROS": frag_h,
            "PRODUTO_P": frag_pp,
            "SITUACAO": frag_s,
            "PRODUTO_T": frag_pt,
            "SOMENTE_COM_MOVIMENTO": "" if incluir_todas else _SOMENTE_COM_MOVIMENTO,
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
            "qtd_tentativas": tent,
            "qtd_convertidas": conv,
            "pct_conversao": round(100 * conv / tent, 1) if tent else 0.0,
        })
    return resultado


def obter_loja(args) -> dict:
    """Contratos e tentativas por dia de uma loja especifica."""
    chave_loja = int(args["loja"])
    data_ini, data_fim = periodo(args)
    ini_int, fim_int = periodo_int(data_ini, data_fim)
    frag_pp, params_pp = filtro_produto_producao(args)
    frag_pt, params_pt = filtro_produto_tentativas(args)
    frag_s, params_s = filtro_situacao(args)

    contratos = run_query(
        "detalhe_contratos",
        [chave_loja, ini_int, fim_int] + params_pp + params_s,
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
                "dia": dia_int_para_iso(c["DIA_INT"]),
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
                "tentativas": int(t["QTD_TENTATIVAS_TOTAL"]),
                "clientes": int(t["QTD_CLIENTES"]),
                "convertidos": int(t["QTD_CONVERTIDOS"]),
                "abandonadas": int(t["QTD_ABANDONADAS"]),
                "erro_inelegibilidade": int(t["QTD_ERRO_INELEGIBILIDADE"]),
                "outros_erros": int(t["QTD_OUTROS_ERROS"]),
            }
            for t in tentativas
        ],
    }
