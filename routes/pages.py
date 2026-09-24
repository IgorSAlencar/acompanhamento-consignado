"""Paginas HTML."""
from datetime import date

from flask import Blueprint, render_template

from config import Config

pages_bp = Blueprint("pages", __name__)


@pages_bp.get("/")
def index():
    return render_template(
        "index.html",
        data_inicio=Config.DATA_INICIO,
        data_hoje=date.today().isoformat(),
    )
