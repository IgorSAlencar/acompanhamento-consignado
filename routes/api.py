"""Endpoints JSON consumidos pelo front-end."""
from io import BytesIO

from flask import Blueprint, jsonify, request, send_file

from db.connection import DatabaseError
from services.detalhe_service import obter_loja, obter_lojas
from services.contratos_service import obter_contratos
from services.du_calendario import obter_calendario
from services.du_curva_service import obter_curva
from services.du_ranking_service import obter_ranking
from services.equipe_service import obter_equipe
from services.exportar_service import (
    exportar_detalhe,
    exportar_du,
    exportar_equipe,
    exportar_rotina,
    exportar_tabela,
    periodo_mes_ate_du,
)
from services.filtros_comuns import periodo
from services.filtros_service import listar_filtros
from services.resumo_service import obter_resumo
from services.rotina_service import obter_rotina
from services.serie_service import obter_serie
from services.tabela_service import obter_tabela

api_bp = Blueprint("api", __name__)


@api_bp.errorhandler(DatabaseError)
def erro_banco(exc):
    return jsonify({"erro": str(exc)}), 503


@api_bp.errorhandler(ValueError)
@api_bp.errorhandler(KeyError)
def erro_parametro(exc):
    return jsonify({"erro": "Parametros invalidos na consulta."}), 400


@api_bp.get("/filtros")
def filtros():
    return jsonify(listar_filtros())


@api_bp.get("/resumo")
def resumo():
    return jsonify(obter_resumo(request.args))


@api_bp.get("/serie-diaria")
def serie_diaria():
    return jsonify(obter_serie(request.args))


@api_bp.get("/tabela-diaria")
def tabela_diaria():
    return jsonify({"linhas": obter_tabela(request.args)})


@api_bp.get("/equipe")
def equipe():
    return jsonify(obter_equipe(request.args))


@api_bp.get("/equipe-diaria")
def equipe_diaria():
    return jsonify(obter_rotina(request.args))


@api_bp.get("/du/calendario")
def du_calendario():
    return jsonify(obter_calendario(request.args))


@api_bp.get("/du/curva")
def du_curva():
    return jsonify(obter_curva(request.args))


@api_bp.get("/du/ranking")
def du_ranking():
    return jsonify(obter_ranking(request.args))


@api_bp.get("/detalhe/lojas")
def detalhe_lojas():
    return jsonify({"linhas": obter_lojas(request.args)})


@api_bp.get("/detalhe/loja")
def detalhe_loja():
    return jsonify(obter_loja(request.args))


@api_bp.get("/detalhe/contratos")
def detalhe_contratos():
    args = dict(request.args)
    data_ini, data_fim = periodo_mes_ate_du(args) if args.get("modo") == "du" else periodo(args)
    args.update(data_ini=data_ini, data_fim=data_fim)
    return jsonify({"linhas": obter_contratos(args), "periodo": {
        "data_ini": data_ini, "data_fim": data_fim,
    }})


def _xlsx(nome: str, conteudo: bytes):
    return send_file(
        BytesIO(conteudo),
        as_attachment=True,
        download_name=nome,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@api_bp.get("/exportar/equipe")
def baixar_equipe():
    return _xlsx(*exportar_equipe(request.args))


@api_bp.get("/exportar/rotina")
def baixar_rotina():
    return _xlsx(*exportar_rotina(request.args))


@api_bp.get("/exportar/tabela")
def baixar_tabela():
    return _xlsx(*exportar_tabela(request.args))


@api_bp.get("/exportar/du")
def baixar_du():
    return _xlsx(*exportar_du(request.args))


@api_bp.get("/exportar/detalhe")
def baixar_detalhe():
    return _xlsx(*exportar_detalhe(request.args))
