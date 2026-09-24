// Chamadas a API do backend
export async function buscar(caminho, params = {}) {
    const url = new URL(caminho, window.location.origin);
    Object.entries(params).forEach(([chave, valor]) => {
        if (valor) url.searchParams.set(chave, valor);
    });

    const resposta = await fetch(url);
    if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => ({}));
        throw new Error(corpo.erro || "Falha ao consultar o servidor.");
    }
    return resposta.json();
}
