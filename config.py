"""Configuracao central do app, lida do .env (com padroes seguros para dev)."""
import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    # Servidor web
    APP_HOST = os.getenv("APP_HOST", "0.0.0.0")
    APP_PORT = int(os.getenv("APP_PORT", "5000"))
    APP_ENV = os.getenv("APP_ENV", "dev")
    DEBUG = APP_ENV == "dev"

    # Banco de dados (SQL Server, autenticacao Windows)
    DB_SERVER = os.getenv("DB_SERVER", "DESKTOP-G4V6794")
    DB_DRIVER = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")

    # Periodo padrao do acompanhamento
    DATA_INICIO = os.getenv("DATA_INICIO", "2026-07-01")

    @classmethod
    def connection_string(cls) -> str:
        return (
            f"DRIVER={{{cls.DB_DRIVER}}};"
            f"SERVER={cls.DB_SERVER};"
            "Trusted_Connection=yes;"
        )
