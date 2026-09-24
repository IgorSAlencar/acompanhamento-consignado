"""Endpoints JSON consumidos pelo front-end."""
from flask import Blueprint, jsonify, request

from db.connection import DatabaseError
from services.detalhe_service import obter_loja, obter_lojas
from services.equipe_service import obter_equipe
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


@api_bp.get("/detalhe/lojas")
def detalhe_lojas():
    return jsonify({"linhas": obter_lojas(request.args)})


@api_bp.get("/detalhe/loja")
def detalhe_loja():
    return jsonify(obter_loja(request.args))
