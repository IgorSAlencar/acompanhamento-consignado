"""Ranking por nivel na aba Dia Util.

Agrega as lojas no nivel pedido e compara o mes de referencia com a MEDIA
dos meses anteriores no mesmo DU N ("saiu do padrao comportamental?").
Universo = lojas que produziram (ou tentaram) em algum dos meses comparados.
"""
from repositories.query_runner import run_query
from services.du_calendario import carregar_calendario, du_selecionado
from services.du_padrao import DUS_PARADO_ALERTA, PESO_STATUS, classificar, desvio_percentual
from services.filtros_comuns import (
    filtro_hierarquia,
    filtro_produto_producao,
    filtro_produto_tentativas,
)

# Whitelist de niveis -> colunas do resultado SQL (nunca vem do usuario)
NIVEIS = {
    "gerencia": {
        "chave": "CHAVE_GERENCIA", "desc": "DESC_GERENCIA",
        "rotulo": "Ger. Gestão", "proximo": "coordenacao", "pais": [],
    },
    "coordenacao": {
        "chave": "CHAVE_COORDENACAO", "desc": "DESC_COORDENACAO",
        "rotulo": "Ger. Comercial III", "proximo": "supervisao", "pais": ["gerencia"],
    },
    "supervisao": {
        "chave": "CHAVE_SUPERVISAO", "desc": "DESC_SUPERVISAO",
        "rotulo": "Ger. Comercial", "proximo": "loja",
        "pais": ["gerencia", "coordenacao"],
    },
    "loja": {
        "chave": "CHAVE_LOJA", "desc": "NOME_LOJA",
        "rotulo": "Loja", "proximo": None,
        "pais": ["gerencia", "coordenacao", "supervisao"],
    },
}

METRICAS = ("vlr", "qtd", "lojas", "tentativas")

# Colunas (acumulado ate N, no DU N, base p/ contar loja produtiva) por metrica
_COLUNAS = {
    "vlr": ("VLR_ACUM", "VLR_DU", "QTD_ACUM"),
    "qtd": ("QTD_ACUM", "QTD_DU", "QTD_ACUM"),
    "lojas": ("QTD_ACUM", "QTD_DU", "QTD_ACUM"),
    "tentativas": ("TENT_ACUM", "TENT_DU", "TENT_ACUM"),
}

_MES_VAZIO = {"acum": 0, "du": 0, "lojas": 0, "ultimo_du": 0}


def _consultar_lojas(args, calendario, du, metrica):
    frag_h, params_h = filtro_hierarquia(args)
    data_ini, data_fim = calendario["data_ini"], calendario["data_fim"]
    if metrica == "tentativas":
        frag_p, params_p = filtro_produto_tentativas(args)
        return run_query(
            "du_lojas_tentativas",
            params_h + [data_ini, data_fim, du, du, du, data_ini, data_fim] + params_p,
            {"FILTROS": frag_h, "PRODUTO": frag_p},
        )
    frag_p, params_p = filtro_produto_producao(args)
    return run_query(
        "du_lojas_producao",
        params_h + [data_ini, data_fim, du, du, du, du, du, data_ini, data_fim] + params_p,
        {"FILTROS": frag_h, "PRODUTO": frag_p},
    )


def _agregar(linhas_sql, config, metrica, meses_validos) -> dict:
    """Soma as lojas em entidades do nivel pedido, mes a mes."""
    col_acum, col_du, col_produtiva = _COLUNAS[metrica]
    validos = {int(mes) for mes in meses_validos}
    entidades: dict = {}
    for linha in linhas_sql:
        mes = int(linha["MES"])
        if mes not in validos:
            continue
        chave = linha[config["chave"]]
        entidade = entidades.setdefault(chave, {
            "chave": chave,
            "descricao": linha[config["desc"]],
            "pai_gerencia": linha.get("DESC_GERENCIA"),
            "pai_coordenacao": linha.get("DESC_COORDENACAO"),
            "pai_supervisao": linha.get("DESC_SUPERVISAO"),
            "meses": {},
        })
        mes = entidade["meses"].setdefault(mes, dict(_MES_VAZIO))
        acum_loja = float(linha[col_acum] or 0)
        du_loja = float(linha[col_du] or 0)
        if metrica == "lojas":
            mes["acum"] += 1 if acum_loja > 0 else 0
            mes["du"] += 1 if du_loja > 0 else 0
        else:
            mes["acum"] += acum_loja
            mes["du"] += du_loja
        mes["lojas"] += 1 if float(linha[col_produtiva] or 0) > 0 else 0
        mes["ultimo_du"] = max(mes["ultimo_du"], int(linha["ULTIMO_DU"] or 0))
    return entidades


def _montar_linhas(entidades, calendario, du) -> list[dict]:
    mes_ref = calendario["mes_ref"]
    anteriores = [mes for mes in calendario["meses"] if mes != mes_ref]
    qtd_ant = len(anteriores) or 1
    linhas = []
    for entidade in entidades.values():
        meses = entidade["meses"]
        atual = meses.get(mes_ref, _MES_VAZIO)
        media_acum = sum(meses.get(m, _MES_VAZIO)["acum"] for m in anteriores) / qtd_ant
        media_du = sum(meses.get(m, _MES_VAZIO)["du"] for m in anteriores) / qtd_ant
        media_lojas = sum(meses.get(m, _MES_VAZIO)["lojas"] for m in anteriores) / qtd_ant
        tem_historico = any(meses.get(m, _MES_VAZIO)["acum"] > 0 for m in anteriores)
        ultimo_du = int(atual["ultimo_du"])
        linhas.append({
            "chave": entidade["chave"],
            "descricao": entidade["descricao"],
            "pai_gerencia": entidade.get("pai_gerencia"),
            "pai_coordenacao": entidade.get("pai_coordenacao"),
            "pai_supervisao": entidade.get("pai_supervisao"),
            "atual_du": round(atual["du"], 2),
            "media_du": round(media_du, 2),
            "atual_acum": round(atual["acum"], 2),
            "media_acum": round(media_acum, 2),
            "diferenca": round(atual["acum"] - media_acum, 2),
            "desvio_pct": desvio_percentual(atual["acum"], media_acum),
            "lojas_acum": int(atual["lojas"]),
            "media_lojas": round(media_lojas, 1),
            "ultimo_du": ultimo_du,
            "dus_parado": max(du - ultimo_du, 0),
            "status": classificar(atual["acum"], media_acum if tem_historico else 0),
        })
    linhas.sort(key=lambda l: (
        l["desvio_pct"] is None,
        -(l["desvio_pct"] if l["desvio_pct"] is not None else 0),
        -l["media_acum"],
    ))
    return linhas


def obter_ranking(args) -> dict:
    nivel = args.get("nivel") or "gerencia"
    if nivel not in NIVEIS:
        nivel = "gerencia"
    metrica = (args.get("metrica") or "vlr").lower()
    if metrica not in METRICAS:
        metrica = "vlr"
    config = NIVEIS[nivel]

    calendario = carregar_calendario(args)
    du = du_selecionado(args, calendario)
    linhas_sql = _consultar_lojas(args, calendario, du, metrica)
    linhas = _montar_linhas(
        _agregar(linhas_sql, config, metrica, calendario["meses"]), calendario, du,
    )

    resumo = {status: 0 for status in PESO_STATUS}
    for linha in linhas:
        resumo[linha["status"]] += 1
    resumo["parados"] = sum(
        1 for l in linhas if l["dus_parado"] >= DUS_PARADO_ALERTA and l["status"] != "novo"
    )

    return {
        "nivel": nivel,
        "rotulo": config["rotulo"],
        "proximo_nivel": config["proximo"],
        "pais": config["pais"],
        "metrica": metrica,
        "mes_ref": calendario["mes_ref"],
        "meses": calendario["meses"],
        "du": du,
        "dus_parado_alerta": DUS_PARADO_ALERTA,
        "total_entidades": len(linhas),
        "resumo": resumo,
        "linhas": linhas,
    }
