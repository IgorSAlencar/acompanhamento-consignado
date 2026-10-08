"""Negociacao e equivalencia HTTP usando o cliente real do Flask."""
import gzip
from unittest import TestCase

from flask import Flask, Response, jsonify

from http_compressao import comprimir_json


class TestCompressao(TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.after_request(comprimir_json)
        self.payload = {"linhas": [{"nome": "Loja de teste", "valor": 100}] * 100}

        @app.get("/json")
        def grande():
            response = jsonify(self.payload)
            response.vary.add("Origin")
            return response

        @app.get("/pequeno")
        def pequeno():
            return jsonify(linhas=[])

        @app.get("/especial/<tipo>")
        def especial(tipo):
            if tipo == "stream":
                return Response(iter(['{"texto":"' + "x" * 4000 + '"}']), mimetype="application/json")
            response = Response('"' + "x" * 4000 + '"', mimetype="application/json")
            if tipo == "html":
                response.mimetype = "text/html"
            elif tipo == "download":
                response.headers["Content-Disposition"] = 'attachment; filename="dados.json"'
            elif tipo == "gzip":
                response.set_data(gzip.compress(response.data))
                response.headers["Content-Encoding"] = "gzip"
            elif tipo == "erro":
                response.status_code = 503
            elif tipo == "parcial":
                response.status_code = 206
            elif tipo == "no-transform":
                response.cache_control.no_transform = True
            return response

        self.client = app.test_client()

    def test_gzip_preserva_corpo_e_headers(self):
        plain = self.client.get("/json")
        zipped = self.client.get("/json", headers={"Accept-Encoding": "gzip"})
        self.assertEqual(gzip.decompress(zipped.data), plain.data)
        self.assertEqual(zipped.headers["Content-Encoding"], "gzip")
        self.assertEqual(zipped.content_length, len(zipped.data))
        self.assertIn("Origin", zipped.vary)
        self.assertIn("Accept-Encoding", zipped.vary)
        self.assertIn("Accept-Encoding", plain.vary)

    def test_sem_suporte_ou_gzip_recusado(self):
        for encoding in ("", "br", "gzip;q=0", "gzip;q=0, *;q=1"):
            with self.subTest(encoding=encoding):
                response = self.client.get("/json", headers={"Accept-Encoding": encoding})
                self.assertNotIn("Content-Encoding", response.headers)
                self.assertEqual(response.get_json(), self.payload)

    def test_respostas_inelegiveis(self):
        for path in ("/pequeno", "/especial/html", "/especial/download", "/especial/stream",
                     "/especial/erro", "/especial/parcial", "/especial/no-transform"):
            with self.subTest(path=path):
                response = self.client.get(path, headers={"Accept-Encoding": "gzip"})
                self.assertNotIn("Content-Encoding", response.headers)
        head = self.client.head("/json", headers={"Accept-Encoding": "gzip"})
        self.assertEqual(head.data, b"")
        self.assertNotIn("Content-Encoding", head.headers)

    def test_nao_comprime_duas_vezes(self):
        response = self.client.get("/especial/gzip", headers={"Accept-Encoding": "gzip"})
        self.assertEqual(gzip.decompress(response.data), ('"' + "x" * 4000 + '"').encode())
