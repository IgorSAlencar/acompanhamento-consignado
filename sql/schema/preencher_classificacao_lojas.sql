-- Preenchimento aleatorio solicitado pelo usuario para o banco configurado.
-- Executar classificacao_lojas.sql antes: os flags usam 1 para o CASE original.
-- Reexecutar este arquivo refaz o sorteio e o preenchimento das cinco colunas.
-- Nao altera TIPO_POSTO nem cria lojas.
USE DATALAKE;
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF (SELECT COUNT(DISTINCT CHAVE_LOJA)
        FROM dbo.DL_BRADESCO_EXPRESSO WHERE TIPO_POSTO = 'Ilha') < 5
        THROW 50002, 'Sao necessarias pelo menos cinco lojas do tipo Ilha.', 1;

    UPDATE dbo.DL_BRADESCO_EXPRESSO
    SET ILHA_V2 = NULL,
        BE_ILHA = CASE WHEN TIPO_POSTO = 'Ilha' THEN 1 END,
        BE_EXCLUSIVO = CASE WHEN TIPO_POSTO = 'Exclusivo' THEN 1 END,
        COD_GRUPO_ECON = CASE WHEN TIPO_POSTO = N'Mesa de Negócios'
                             THEN CASE WHEN (CHECKSUM(NEWID()) & 1) = 0 THEN 36 ELSE 202 END END,
        DESC_GERENCIA_NEGOCIO = CASE WHEN TIPO_POSTO = 'Gerenciada'
                                   THEN 'Gerenciada ' + CAST(ABS(CHECKSUM(NEWID()) % 5) + 1 AS VARCHAR(1)) END;

    ;WITH SORTEADAS AS (
        SELECT TOP (5) CHAVE_LOJA
        FROM dbo.DL_BRADESCO_EXPRESSO
        WHERE TIPO_POSTO = 'Ilha'
        GROUP BY CHAVE_LOJA
        ORDER BY NEWID()
    )
    UPDATE A
    SET ILHA_V2 = 1
    FROM dbo.DL_BRADESCO_EXPRESSO A
    INNER JOIN SORTEADAS S ON S.CHAVE_LOJA = A.CHAVE_LOJA
    WHERE A.TIPO_POSTO = 'Ilha';

    IF (SELECT COUNT(DISTINCT CHAVE_LOJA)
        FROM dbo.DL_BRADESCO_EXPRESSO WHERE ILHA_V2 = 1) <> 5
        THROW 50003, 'O sorteio deve marcar exatamente cinco lojas como Ilha 2.0.', 1;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
