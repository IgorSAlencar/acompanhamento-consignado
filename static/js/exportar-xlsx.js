// Download de Excel gerado no servidor (uma planilha por etapa)

function nomeDoArquivo(resposta) {
    const cabecalho = resposta.headers.get("Content-Disposition") || "";
    const estrela = /filename\*=UTF-8''([^;]+)/i.exec(cabecalho);
    if (estrela) return decodeURIComponent(estrela[1]);
    const simples = /filename="?([^";]+)"?/i.exec(cabecalho);
    return simples ? simples[1] : "exportacao.xlsx";
}

export async function baixarXlsx(caminho, params, botao) {
    const url = new URL(caminho, window.location.origin);
    Object.entries(params || {}).forEach(([chave, valor]) => {
        if (valor === true || valor === 1) url.searchParams.set(chave, "1");
        else if (valor) url.searchParams.set(chave, valor);
    });

    const rotulo = botao?.textContent;
    if (botao) {
        botao.disabled = true;
        botao.textContent = "Gerando...";
    }
    try {
        const resposta = await fetch(url);
        if (!resposta.ok) {
            const corpo = await resposta.json().catch(() => ({}));
            throw new Error(corpo.erro || "Falha ao gerar o Excel.");
        }
        const blob = await resposta.blob();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = nomeDoArquivo(resposta);
        link.click();
        URL.revokeObjectURL(link.href);
    } catch (erro) {
        alert(erro.message);
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.textContent = rotulo;
        }
    }
}
