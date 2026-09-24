"""Conexao pyodbc com o SQL Server (Trusted_Connection)."""
from contextlib import contextmanager

import pyodbc

from config import Config


class DatabaseError(Exception):
    """Erro de banco com mensagem amigavel para o usuario."""


@contextmanager
def get_connection():
    conn = None
    try:
        conn = pyodbc.connect(Config.connection_string(), timeout=10)
        yield conn
    except pyodbc.Error as exc:
        raise DatabaseError(
            "Nao foi possivel consultar o banco de dados. "
            f"Verifique se o servidor {Config.DB_SERVER} esta acessivel."
        ) from exc
    finally:
        if conn is not None:
            conn.close()
