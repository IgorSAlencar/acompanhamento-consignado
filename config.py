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

    # Cache local por processo; 0 desliga. Nao armazena falhas de consulta.
    CACHE_SEGUNDOS = max(0, int(os.getenv("CACHE_SEGUNDOS", "300")))
    CACHE_MAX_ENTRADAS = max(0, int(os.getenv("CACHE_MAX_ENTRADAS", "64")))

    # Banco de dados (SQL Server, autenticacao Windows)
    DB_SERVER = os.getenv("DB_SERVER", "DESKTOP-G4V6794")
    DB_DRIVER = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")

    @classmethod
    def connection_string(cls) -> str:
        return (
            f"DRIVER={{{cls.DB_DRIVER}}};"
            f"SERVER={cls.DB_SERVER};"
            "Trusted_Connection=yes;"
        )
