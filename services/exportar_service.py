"""Monta o Excel de cada base exportavel (uma aba por etapa do drill-down)."""
from datetime import date, timedelta

from repositories.query_runner import run_query
from services.contratos_service import hierarquia_contratos_visivel, obter_contratos
from services.du_calendario import carregar_calendario, du_selecionado, mes_referencia
from services.du_ranking_service import obter_ranking
from services.equipe_service import NIVEIS as NIVEIS_EQUIPE
from services.equipe_service import obter_equipe
from services.exportar_arvore import COLUNAS_CONTRATOS, NOMES_ABA, NOMES_SITUACAO, adicionar_arvore, niveis_a_partir
from services.filtros_comuns import PRODUTOS, periodo
from services.rotina_service import obter_rotina
from services.tabela_service import obter_tabela
from services.xlsx_planilha import Coluna, bytes_workbook, escrever_planilha, novo_workbook

_ROTULOS_PAI = {
    "gerencia": "Ger. Gestão",
    "coordenacao": "Ger. Comercial III",
    "supervisao": "Ger. Comercial",
}
_NOMES_PRODUTO = {"INSS": "INSS", "PRIVADO": "Privado", "PUBLICO": "Público"}
_NOMES_DU = {
    "vlr": "Valor averbado",
    "qtd": "Operações averbadas",
    "lojas": "Lojas produtivas",
    "tentativas": "Tentativas",
}
_METRICAS_ROTINA = {
    "tentativas": (lambda c, _l: c["tent"], "inteiro", "Tentativas"),
    "lojas": (lambda c, l: (100 * c["lojas"] / l["qtd_lojas"]) if l["qtd_lojas"] else 0, "percentual", "% lojas que tentaram"),
    "conversao": (lambda c, _l: (100 * c["conv"] / c["tent"]) if c["tent"] else 0, "percentual", "Conversão (%)"),
    "producao": (lambda c, _l: c["vlr"], "reais", "Averbado (R$)"),
    "aguardando": (lambda c, _l: c["vlr_ag"], "reais", "Aguardando averbação (R$)"),
    "cancelada": (lambda c, _l: c["vlr_nao"], "reais", "Cancelado (R$)"),
    "pendente": (lambda c, _l: c["vlr_ag"] + c["vlr_nao"], "reais", "Pendente (R$)"),
}
_DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"]


def exportar_equipe(args) -> tuple[str, bytes]:
    wb = novo_workbook()
    for nivel in niveis_a_partir(args, ("gerencia", "coordenacao", "supervisao")):
        dados = obter_equipe({**dict(args), "nivel": nivel})
        escrever_planilha(wb, NOMES_ABA[nivel], colunas_equipe(nivel, dados["rotulo"]), dados["linhas"])
    adicionar_arvore(wb, args, grupos=False, lojas=True)
    return _nome("equipe", args), bytes_workbook(wb)


def exportar_rotina(args) -> tuple[str, bytes]:
    metrica = args.get("metrica") or "producao"
    if metrica not in _METRICAS_ROTINA:
        metrica = "producao"
    wb = novo_workbook()
    for nivel in niveis_a_partir(args, ("gerencia", "coordenacao", "supervisao")):
        dados = obter_rotina({**dict(args), "nivel": nivel})
        escrever_planilha(wb, NOMES_ABA[nivel], colunas_rotina(dados, metrica), _linhas_rotina(dados, metrica))
    adicionar_arvore(wb, args, grupos=False, lojas=True)
    return _nome("rotina", args), bytes_workbook(wb)


def exportar_tabela(args) -> tuple[str, bytes]:
    wb = novo_workbook()
    escrever_planilha(wb, "Por dia", COLUNAS_TABELA, obter_tabela(args))
    adicionar_arvore(wb, args, grupos=True, lojas=True)
    return _nome("detalhamento_diario", args), bytes_workbook(wb)


def exportar_du(args) -> tuple[str, bytes]:
    args = dict(args)
    metrica = (args.get("metrica") or "vlr").lower()
    wb = novo_workbook()
    niveis = niveis_a_partir(args, ("gerencia", "coordenacao", "supervisao", "loja"))
    dados = None
    for nivel in niveis:
        dados = obter_ranking({**args, "nivel": nivel, "metrica": metrica})
        nome = "Lojas" if nivel == "loja" else NOMES_ABA[nivel]
        escrever_planilha(wb, nome, colunas_du(dados), dados["linhas"])
    data_ini, data_fim = periodo_mes_ate_du(args)
    adicionar_arvore(wb, {**args, "data_ini": data_ini, "data_fim": data_fim}, grupos=False, lojas=False)
    mes_ref = (dados or {}).get("mes_ref") or mes_referencia(args)
    du = (dados or {}).get("du") or args.get("du") or ""
    return f"dia_util_{metrica}_{mes_ref}_du{du}.xlsx", bytes_workbook(wb)


def exportar_detalhe(args) -> tuple[str, bytes]:
    wb = novo_workbook()
    if args.get("visao") == "contratos":
        linhas = obter_contratos(args)
        for linha in linhas:
            linha["produto"] = _NOMES_PRODUTO.get(linha["produto"], linha["produto"])
            linha["situacao"] = NOMES_SITUACAO.get(linha["situacao"], linha["situacao"])
        niveis = ("gerencia", "coordenacao", "supervisao")
        visiveis = hierarquia_contratos_visivel(args)
        colunas = [c for i, c in enumerate(COLUNAS_CONTRATOS) if i >= 3 or niveis[i] in visiveis]
        escrever_planilha(wb, "Contratos", colunas, linhas)
        return _nome("contratos", args), bytes_workbook(wb)
    adicionar_arvore(wb, args, grupos=True, lojas=True)
    return _nome("detalhe", args), bytes_workbook(wb)


def periodo_mes_ate_du(args) -> tuple[str, str]:
    """Primeiro dia do mes de referencia ate o ultimo dia do DU escolhido."""
    calendario = carregar_calendario(args)
    du = du_selecionado(args, calendario)
    mes_ref = calendario["mes_ref"]
    ano, mes = divmod(mes_ref, 100)
    data_ini = date(ano, mes, 1)
    proximo = date(ano + 1, 1, 1) if mes == 12 else date(ano, mes + 1, 1)
    ultimo = proximo - timedelta(days=1)
    linhas = run_query("du_calendario", [data_ini.isoformat(), ultimo.isoformat()])
    data_fim = data_ini
    for linha in linhas:
        if int(linha["DU"]) <= du:
            dia = linha["DATA"]
            data_fim = dia.date() if hasattr(dia, "date") else dia
    data_fim = min(data_fim, date.today() - timedelta(days=1))
    return data_ini.isoformat(), data_fim.isoformat()


def colunas_equipe(nivel: str, rotulo: str) -> list[Coluna]:
    pais = [
        Coluna(_ROTULOS_PAI[p], lambda l, p=p: l.get(f"pai_{p}") or "")
        for p in NIVEIS_EQUIPE[nivel]["pais"]
    ]
    fixas = [
        Coluna(rotulo, lambda l: l["descricao"]),
        Coluna("Lojas com produção", lambda l: l["qtd_lojas_producao"], "inteiro"),
        Coluna("Lojas ativas", lambda l: l["qtd_lojas"], "inteiro"),
        Coluna("Cobertura (%)", lambda l: l["pct_cobertura"], "percentual"),
    ]
    produtos = []
    for chave in PRODUTOS:
        nome = _NOMES_PRODUTO[chave]
        produtos.extend([
            Coluna(f"{nome} averbado (R$)", lambda l, c=chave: l["produtos"][c]["vlr"], "reais"),
            Coluna(f"{nome} operações", lambda l, c=chave: l["produtos"][c]["qtd"], "inteiro"),
            Coluna(f"{nome} lojas", lambda l, c=chave: l["produtos"][c]["lojas"], "inteiro"),
            Coluna(f"{nome} tentativas", lambda l, c=chave: l["produtos"][c]["tentativas"], "inteiro"),
            Coluna(f"{nome} convertidas", lambda l, c=chave: l["produtos"][c]["convertidas"], "inteiro"),
            Coluna(f"{nome} conversão (%)", lambda l, c=chave: l["produtos"][c]["pct_conversao"], "percentual"),
            Coluna(f"{nome} aguardando averbação (R$)", lambda l, c=chave: l["produtos"][c]["vlr_aguardando"], "reais"),
        ])
    return pais + fixas + produtos


def colunas_rotina(dados: dict, metrica: str) -> list[Coluna]:
    _fn, tipo, nome = _METRICAS_ROTINA[metrica]
    pais = [
        Coluna(_ROTULOS_PAI[p], lambda l, p=p: l.get(f"pai_{p}") or "")
        for p in NIVEIS_EQUIPE[dados["nivel"]]["pais"]
    ]
    fixas = [
        Coluna(dados["rotulo"], lambda l: l["descricao"]),
        Coluna("Lojas", lambda l: l["qtd_lojas"], "inteiro"),
        Coluna("Dias úteis sem tentativa", lambda l: l["sem_tentativa"], "inteiro"),
        Coluna("Tentativas", lambda l: l["tent"], "inteiro"),
        Coluna("Conversão (%)", lambda l: l["conversao"], "percentual"),
        Coluna("Averbado (R$)", lambda l: l["vlr"], "reais"),
        Coluna("Aguardando averbação (R$)", lambda l: l["aguardando"], "reais"),
        Coluna("Cancelado (R$)", lambda l: l["cancelada"], "reais"),
    ]
    dias = [
        Coluna(f"{nome} {_data_curta(dia)} ({_dia_semana(dia)})", lambda l, d=dia: l[d], tipo)
        for dia in dados["dias"]
    ]
    return pais + fixas + dias


def colunas_du(dados: dict) -> list[Coluna]:
    du = dados["du"]
    nome = _NOMES_DU.get(dados["metrica"], dados["metrica"])
    tipo = "reais" if dados["metrica"] == "vlr" else "decimal"
    pais = [
        Coluna(_ROTULOS_PAI[p], lambda l, p=p: l.get(f"pai_{p}") or "")
        for p in dados.get("pais") or []
    ]
    return pais + [
        Coluna(dados["rotulo"], lambda l: l["descricao"]),
        Coluna(f"{nome} no DU {du}", lambda l: l["atual_du"], tipo),
        Coluna(f"Média do DU {du} nos meses anteriores", lambda l: l["media_du"], tipo),
        Coluna(f"Acumulado até DU {du}", lambda l: l["atual_acum"], tipo),
        Coluna(f"Média acumulada dos meses anteriores até DU {du}", lambda l: l["media_acum"], tipo),
        Coluna("Diferença (mês atual − média)", lambda l: l["diferenca"], tipo),
        Coluna("Desvio vs meses anteriores (%)", lambda l: l["desvio_pct"], "percentual"),
        Coluna("Lojas produtivas", lambda l: l["lojas_acum"], "inteiro"),
        Coluna("Média lojas produtivas", lambda l: l["media_lojas"], "decimal"),
        Coluna("Último DU com produção", lambda l: l["ultimo_du"], "inteiro"),
        Coluna("DUs sem produzir", lambda l: l["dus_parado"], "inteiro"),
        Coluna("Status", lambda l: l["status"]),
    ]


COLUNAS_TABELA = [
    Coluna("Dia", lambda l: l["dia"], "data"),
    *[c for produto, nome in (("INSS", "INSS"), ("PUBLICO", "Público"), ("PRIVADO", "Privado")) for c in (
        Coluna(f"{nome} averbado (R$)", lambda l, p=produto: l["produtos"][p]["vlr"], "reais"),
        Coluna(f"{nome} operações", lambda l, p=produto: l["produtos"][p]["qtd"], "inteiro"),
        Coluna(f"{nome} lojas", lambda l, p=produto: l["produtos"][p]["lojas"], "inteiro"),
        Coluna(f"{nome} tentativas", lambda l, p=produto: l["produtos"][p]["tentativas"], "inteiro"),
        Coluna(f"{nome} convertidas", lambda l, p=produto: l["produtos"][p]["convertidas"], "inteiro"),
    )],
    Coluna("Total averbado (R$)", lambda l: l["total_vlr"], "reais"),
    Coluna("Total operações", lambda l: l["total_qtd"], "inteiro"),
    Coluna("Total lojas", lambda l: l["total_lojas"], "inteiro"),
    Coluna("Aguardando averbação (R$)", lambda l: l["vlr_aguardando"], "reais"),
    Coluna("Aguardando averbação (QTD)", lambda l: l["qtd_aguardando"], "inteiro"),
    Coluna("Aguardando averbação (lojas)", lambda l: l["lojas_aguardando"], "inteiro"),
    Coluna("Cancelado (R$)", lambda l: l["vlr_nao_averbado"], "reais"),
    Coluna("Cancelado (QTD)", lambda l: l["qtd_nao_averbado"], "inteiro"),
    Coluna("Cancelado (lojas)", lambda l: l["lojas_nao_averbado"], "inteiro"),
]


def _linhas_rotina(dados: dict, metrica: str) -> list[dict]:
    fn, _tipo, _nome = _METRICAS_ROTINA[metrica]
    linhas = []
    for linha in dados["linhas"]:
        resumo = _resumo_rotina(linha, dados["dias"])
        row = {
            "descricao": linha["descricao"],
            "pai_gerencia": linha.get("pai_gerencia") or "",
            "pai_coordenacao": linha.get("pai_coordenacao") or "",
            "qtd_lojas": linha["qtd_lojas"],
            **resumo,
        }
        for dia in dados["dias"]:
            row[dia] = fn(linha["dias"][dia], linha)
        linhas.append(row)
    return linhas


def _resumo_rotina(linha: dict, dias: list[str]) -> dict:
    celulas = [linha["dias"][d] for d in dias]
    tent = sum(c["tent"] for c in celulas)
    conv = sum(c["conv"] for c in celulas)
    return {
        "sem_tentativa": sum(1 for d in dias if not _fim_de_semana(d) and linha["dias"][d]["tent"] == 0),
        "tent": tent,
        "conversao": round(100 * conv / tent, 1) if tent else 0.0,
        "vlr": sum(c["vlr"] for c in celulas),
        "aguardando": sum(c["vlr_ag"] for c in celulas),
        "cancelada": sum(c["vlr_nao"] for c in celulas),
        "pendente": sum(c["vlr_ag"] + c["vlr_nao"] for c in celulas),
    }


def _nome(prefixo: str, args) -> str:
    data_ini, data_fim = periodo(args)
    return f"{prefixo}_{data_ini.replace('-', '')}_{data_fim.replace('-', '')}.xlsx"


def _data_curta(iso: str) -> str:
    ano, mes, dia = iso.split("-")
    return f"{dia}/{mes}/{ano}"


def _dia_semana(iso: str) -> str:
    return _DIAS_SEMANA[date.fromisoformat(iso).isoweekday() % 7]


def _fim_de_semana(iso: str) -> bool:
    return date.fromisoformat(iso).weekday() >= 5
