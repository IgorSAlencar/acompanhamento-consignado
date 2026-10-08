// Mesmo indicador para todas as consultas de tabelas.
export function linhaCarregandoTabela(colunas = 1) {
    return `<tr><td colspan="${colunas}" class="carregando">
        <div class="tabela-carregamento" role="status" aria-live="polite">
            <span class="tabela-carregamento-icone" aria-hidden="true"></span>
            <strong>Carregando dados</strong>
            <span class="tabela-carregamento-nota">Aguarde enquanto a tabela é atualizada.</span>
        </div>
    </td></tr>`;
}
