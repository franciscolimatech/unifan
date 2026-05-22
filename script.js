let conhecimento = {

    intencaoPagamento: [
        "pagar",
        "pagamento",
        "forma de pagamento",
        "como pago",
        "método de pagamento",
        "pix",
        "cartão",
        "débito",
        "crédito",
        "boleto",
        "boleto bancário",
        "qr code",
        "pagamento online",
        "pagar pedido",
        "finalizar compra",
        "checkout",
        "pagamento recusado",
        "erro no pagamento"
    ],

    parcelamento: [
        "parcelar",
        "parcelas",
        "quantas vezes",
        "dividir",
        "prestações",
        "sem juros",
        "12x",
        "6x",
        "3x",
        "24x",
        "parcelamento no cartão",
        "dividir valor",
        "parcelar compra",
        "parcelado",
        "entrada + parcelas"
    ],

    cupomDesconto: [
        "cupom",
        "desconto",
        "código promocional",
        "promoção",
        "oferta",
        "voucher",
        "descontos",
        "cupons",
        "promoções",
        "cupom ativo",
        "cupom inválido",
        "usar cupom",
        "cupom expirado",
        "desconto primeira compra",
        "cashback"
    ],

    reembolsoEstorno: [
        "reembolso",
        "estorno",
        "devolução",
        "troca",
        "garantia",
        "cancelamento",
        "dinheiro de volta",
        "reembolsar",
        "estornar",
        "cancelar pedido",
        "devolver produto",
        "prazo do estorno",
        "pedido cancelado",
        "cancelar compra",
        "ressarcimento"
    ],

    statusDoPagamento: [
        "pagamento aprovado",
        "pedido pendente",
        "pagamento recusado",
        "não aprovado",
        "cobrança",
        "status do pagamento",
        "meu pagamento foi",
        "meu pagamento está",
        "aguardando pagamento",
        "processando pagamento",
        "pagamento confirmado",
        "erro de pagamento",
        "transação recusada",
        "compra aprovada",
        "análise de pagamento"
    ],

    notaFiscal: [
        "nota fiscal",
        "NF",
        "NFe",
        "danfe",
        "nota",
        "comprovante fiscal",
        "segunda via da nota",
        "emissão de nota",
        "baixar nota fiscal",
        "enviar nota fiscal",
        "nota do pedido",
        "comprovante de compra",
        "documento fiscal",
        "emitir nota",
        "xml da nota"
    ]

};

//depois que terminar, adicionar mis intenç~pes/palavras chave.

let respostas = {
    intencaoPagamento: [
        "Aceitamos Pix, cartão de crédito (até 12x) e cartão de débito Qual você prefere usar hoje?"
    ],

    parcelamento: [
        "Você pode parcelar em até 12x sem juros no cartão de crédito para compras acima de R$ 100. Deseja ver as opções de parcelamento para o seu pedido?"
    ],

    cupomDesconto: [
        "Ótimo! Você pode inserir seu cupom na etapa de revisão do pedido, antes de finalizar a compra. Caso o cupom não funcione, posso verificar a validade para você."
    ],  

    reembolsoEstorno: [
        "Após a aprovação da devolução, o estorno é processado em até 7 dias úteis para Pix e até 2 faturas para cartão de crédito. Quer que eu abra uma solicitação de reembolso para você?"
    ],

    statusDoPagamento: [
        "Status do pagamento,pagamento aprovado, pedido pendente, pagamento recusado, não aprovado, cobrança, status do pagamento, meu pagamento foi	Vou verificar o status do seu pagamento agora. Por favor, informe o número do pedido ou o e-mail cadastrado para eu consultar.."
    ],

    notaFiscal: [
        "Sua nota fiscal é enviada por e-mail assim que o pedido é faturado. Se não recebeu, posso reenviar. Qual e-mail devo usar?"
    ],
}

let usuario = prompt("Digite sua pergunta:");

usuario = usuario.toLowerCase();

let encontrou = false;

for(let categoria in conhecimento){

    for(let palavra of conhecimento[categoria]){

        if(usuario.includes(palavra)){

            alert(respostas[categoria][0]);

            encontrou = true;

            break;

        }

    }

    if(encontrou){
        break;
    }

}

if(!encontrou){

    alert("Desculpe, não entendi sua pergunta.");

}
