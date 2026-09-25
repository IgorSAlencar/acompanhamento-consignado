"""Ponto de entrada do site de Acompanhamento de Consignado - Bradesco Expresso."""
import mimetypes

from flask import Flask

# Windows pode mapear .js/.css como text/plain; o navegador bloqueia modulo ES.
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")

from config import Config
from routes.api import api_bp
from routes.pages import pages_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    app.register_blueprint(pages_bp)
    app.register_blueprint(api_bp, url_prefix="/api")
    return app


app = create_app()

if __name__ == "__main__":
    app.run(host=Config.APP_HOST, port=Config.APP_PORT, debug=Config.DEBUG)
