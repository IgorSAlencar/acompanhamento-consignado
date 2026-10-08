"""Periodo automatico em D-1, inclusive nas viradas de mes e ano."""
from datetime import date
from unittest import TestCase
from unittest.mock import patch

from flask import Flask

from routes.pages import pages_bp
from services.filtros_comuns import periodo


class TestPeriodo(TestCase):
    @patch("services.filtros_comuns.date")
    def test_padrao_termina_ontem(self, mock_date):
        mock_date.side_effect = date
        for hoje, esperado in [
            (date(2026, 10, 7), ("2026-10-01", "2026-10-06")),
            (date(2026, 10, 1), ("2026-09-01", "2026-09-30")),
            (date(2026, 1, 1), ("2025-12-01", "2025-12-31")),
            (date(2024, 3, 1), ("2024-02-01", "2024-02-29")),
        ]:
            with self.subTest(hoje=hoje):
                mock_date.today.return_value = hoje
                self.assertEqual(periodo({}), esperado)

    def test_preserva_periodo_escolhido(self):
        self.assertEqual(
            periodo({"data_ini": "2026-09-10", "data_fim": "2026-09-20"}),
            ("2026-09-10", "2026-09-20"),
        )

    @patch("routes.pages.render_template")
    @patch("services.filtros_comuns.date")
    def test_pagina_envia_o_mesmo_periodo_ao_front(self, mock_date, render):
        mock_date.side_effect = date
        mock_date.today.return_value = date(2026, 10, 7)
        render.return_value = "ok"
        app = Flask(__name__)
        app.register_blueprint(pages_bp)
        self.assertEqual(app.test_client().get("/").status_code, 200)
        render.assert_called_once_with(
            "index.html", data_inicio="2026-10-01", data_fim="2026-10-06",
        )
