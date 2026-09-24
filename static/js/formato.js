// Formatacao de numeros e datas em pt-BR
const moedaCheia = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
});

const moedaComCentavos = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
});

const numero = new Intl.NumberFormat("pt-BR");

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

export function moeda(valor) {
    return moedaCheia.format(valor || 0);
}

export function moedaCentavos(valor) {
    return moedaComCentavos.format(valor || 0);
}

export function compacto(valor) {
    if (valor >= 1_000_000) return `${(valor / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
    if (valor >= 1_000) return `${(valor / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
    return numero.format(Math.round(valor || 0));
}

export function moedaCompacta(valor) {
    return valor >= 1_000 ? `R$ ${compacto(valor)}` : moeda(valor);
}

export function inteiro(valor) {
    return numero.format(valor || 0);
}

export function percentual(valor) {
    return `${(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function dataCurta(iso) {
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
}

export function diaMes(iso) {
    const [, mes, dia] = iso.split("-");
    return `${dia}/${mes}`;
}

export function diaSemana(iso) {
    return DIAS_SEMANA[new Date(`${iso}T00:00:00`).getDay()];
}

export function fimDeSemana(iso) {
    const dia = new Date(`${iso}T00:00:00`).getDay();
    return dia === 0 || dia === 6;
}
