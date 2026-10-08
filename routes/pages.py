"""Paginas HTML."""
from flask import Blueprint, render_template

from services.filtros_comuns import periodo

pages_bp = Blueprint("pages", __name__)


@pages_bp.get("/")
def index():
    data_inicio, data_fim = periodo({})
    return render_template(
        "index.html",
        data_inicio=data_inicio,
        data_fim=data_fim,
    )
