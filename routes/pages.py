"""Paginas HTML."""
from datetime import date

from flask import Blueprint, render_template

from services.filtros_comuns import inicio_mes_vigente

pages_bp = Blueprint("pages", __name__)


@pages_bp.get("/")
def index():
    return render_template(
        "index.html",
        data_inicio=inicio_mes_vigente(),
        data_hoje=date.today().isoformat(),
    )
