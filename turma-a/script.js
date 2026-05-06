// ── Navegação entre Squads ──
const buttons = document.querySelectorAll('.squad-btn');
const views = document.querySelectorAll('.squad-view');

const nomes = {
    vendas:     'Vendas & PDV — Cristóvão',
    financeiro: 'Financeiro — Cristóvão',
    producao:   'Produção & OS — Cristóvão',
    estoque:    'Estoque — Cristóvão',
    logistica:  'Logística — Cristóvão',
    compras:    'Compras — Cristóvão'
};

document.title = 'Vendas & PDV — Cristóvão';

buttons.forEach(btn => {
    btn.addEventListener('click', () => {
        const squad = btn.dataset.squad;
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        views.forEach(view => view.classList.remove('active-view'));
        document.getElementById(`${squad}-view`).classList.add('active-view');
        if (squad === 'logistica') {
            setTimeout(() => { if (window.map) window.map.invalidateSize(); }, 100);
        }
        document.title = nomes[squad] || 'Cristóvão';
    });
});

// ── Modais ──
document.getElementById('btnSimularDesconto').addEventListener('click', () => {
    document.getElementById('modalDesconto').classList.add('open');
});
document.getElementById('btnSimularParcelamento').addEventListener('click', () => {
    document.getElementById('modalParcelamento').classList.add('open');
});

// Botão Exportar Dados — Rentabilidade
document.querySelector('#financeiro-view .card-financeiro:nth-child(3) .btn-secondary')
    .addEventListener('click', exportarRentabilidade);

// Botão Gerar Recibo
document.querySelector('#financeiro-view .card-financeiro:nth-child(4) .btn')
    .addEventListener('click', () => {
        document.getElementById('modalRecibo').classList.add('open');
    });

// Botão Análise Detalhada — Curva ABC
document.querySelector('#financeiro-view .card-financeiro:nth-child(5) .btn-secondary')
    .addEventListener('click', () => {
        document.getElementById('modalCurvaABC').classList.add('open');
        renderizarTabelaABC();
    });

function fecharModal(id) {
    document.getElementById(id).classList.remove('open');
    // Limpa resultado ao fechar
    const res = document.getElementById('resultadoDesconto');
    const res2 = document.getElementById('resultadoParcelamento');
    if (res) res.classList.remove('visible');
    if (res2) res2.classList.remove('visible');
}

// Fechar modal clicando fora
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('open');
    });
});

// ── SIMULADOR DE DESCONTO (MARGEM SEGURA — TAREFA 1) ──
function calcularDesconto() {
    const [margem, min, max] = document.getElementById('simCategoria').value.split(',').map(Number);
    const preco = parseFloat(document.getElementById('simPreco').value);
    const desconto = parseFloat(document.getElementById('simDesconto').value);
    const res = document.getElementById('resultadoDesconto');

    if (isNaN(preco) || isNaN(desconto) || preco <= 0) {
        res.innerHTML = '⚠️ Preencha o preço e o desconto corretamente.';
        res.classList.add('visible');
        return;
    }

    const travaMáx = 10;
    const precoFinal = preco * (1 - desconto / 100);
    const margemResultante = margem - desconto;
    const aprovado = desconto <= travaMáx && margemResultante >= min;

    res.innerHTML = `
        <p>💰 <strong>Preço original:</strong> R$ ${preco.toFixed(2)}</p>
        <p>🏷️ <strong>Preço com desconto:</strong> R$ ${precoFinal.toFixed(2)}</p>
        <p>📊 <strong>Margem resultante:</strong> ~${margemResultante.toFixed(2)}%</p>
        <p>🔒 <strong>Trava máxima:</strong> ${travaMáx}%</p>
        <p style="margin-top:10px; font-size:16px;">${aprovado
            ? '✅ <strong style="color:#2e7d32;">Desconto APROVADO</strong> — dentro da margem segura.'
            : '❌ <strong style="color:#c62828;">Desconto REPROVADO</strong> — ultrapassa a trava ou compromete a margem mínima (' + min + '%).'}
        </p>
    `;
    res.classList.add('visible');
}

// ── SIMULADOR DE PARCELAMENTO (TAREFA 2) ──
const infos = {
    pix: 'ℹ️ Pix: sem custo ao lojista, liquidação instantânea. Ideal para à vista.',
    debito: 'ℹ️ Cartão Débito: taxa MDR 1,5%–2,5% pela adquirente. Liquidação D+1.',
    boleto: 'ℹ️ Boleto: taxa fixa R$ 3,00–4,50 por emissão. Risco de inadimplência. Liquidação D+2.',
    credito1: 'ℹ️ Crédito 1x: taxa gateway 2,5%–4,0%. Antecipação D+2 cobra spread adicional.',
    credito2: 'ℹ️ Crédito 2x: taxa 3,0%–5,5% — até 6x o custo é absorvido pelo lojista.',
    credito3: 'ℹ️ Crédito 3x: taxa 3,0%–5,5% — absorvida pelo lojista.',
    credito4: 'ℹ️ Crédito 4x: taxa ~5% — absorvida pelo lojista.',
    credito5: 'ℹ️ Crédito 5x: taxa ~5% — absorvida pelo lojista.',
    credito6: 'ℹ️ Crédito 6x: taxa 5,5% — último parcelamento sem juros ao cliente.',
    credito7: 'ℹ️ Crédito 7x: taxa 5,5% + juros 1,99% a.m. repassados ao cliente. Exibir CET.',
    credito10: 'ℹ️ Crédito 10x: taxa 6,5% + juros 1,99% a.m. ao cliente.',
    credito12: 'ℹ️ Crédito 12x: taxa 7% + juros 1,99% a.m. ao cliente.'
};

function atualizarInfoTaxa() {
    const forma = document.getElementById('parForma').value.split(',')[0];
    document.getElementById('taxaInfo').textContent = infos[forma] || '';
}

function calcularParcelamento() {
    const valor = parseFloat(document.getElementById('parValor').value);
    const [forma, taxaStr, parcelasStr] = document.getElementById('parForma').value.split(',');
    const taxa = parseFloat(taxaStr);
    const parcelas = parseInt(parcelasStr);
    const res = document.getElementById('resultadoParcelamento');

    if (isNaN(valor) || valor <= 0) {
        res.innerHTML = '⚠️ Informe o valor da compra.';
        res.classList.add('visible');
        return;
    }

    let totalLojista, totalCliente, valorParcela, descricao;

    if (forma === 'boleto') {
        totalCliente = valor + 3.50;
        totalLojista = valor - 3.50;
        valorParcela = totalCliente;
        descricao = 'Taxa fixa de emissão: R$ 3,50';
    } else if (['credito7', 'credito10', 'credito12'].includes(forma)) {
        const jurosMes = 0.0199;
        valorParcela = (valor * (1 + taxa)) / parcelas * (1 + jurosMes);
        totalCliente = valorParcela * parcelas;
        totalLojista = valor * (1 - taxa);
        descricao = `Juros: 1,99% a.m. + taxa gateway ${(taxa * 100).toFixed(1)}%`;
    } else {
        totalCliente = forma === 'pix' ? valor : valor * (1 + taxa);
        totalLojista = valor * (1 - taxa);
        valorParcela = totalCliente / parcelas;
        descricao = forma === 'pix' ? 'Sem custo' : `Taxa gateway: ${(taxa * 100).toFixed(1)}%`;
    }

    res.innerHTML = `
        <p>💳 <strong>Forma:</strong> ${document.getElementById('parForma').options[document.getElementById('parForma').selectedIndex].text.split('—')[0]}</p>
        <p>📦 <strong>Valor da compra:</strong> R$ ${valor.toFixed(2)}</p>
        <p>🧾 <strong>${descricao}</strong></p>
        ${parcelas > 1 ? `<p>📅 <strong>Parcelas:</strong> ${parcelas}x de R$ ${valorParcela.toFixed(2)}</p>` : ''}
        <p>👤 <strong>Total pago pelo cliente:</strong> R$ ${totalCliente.toFixed(2)}</p>
        <p>🏪 <strong>Valor líquido recebido pela loja:</strong> R$ ${totalLojista.toFixed(2)}</p>
    `;
    res.classList.add('visible');
}

// ════════════════════════════════════════
// 1. EXPORTAR RENTABILIDADE POR CATEGORIA
// ════════════════════════════════════════
function exportarRentabilidade() {
    const dados = [
        ['Categoria', 'Itens', 'Margem Média (%)', 'Margem Mín (%)', 'Margem Máx (%)', 'Trava de Desconto (%)'],
        ['Acabamento',       122, '35,16', '23,67', '44,43', '10,00'],
        ['Construção Bruta', 123, '35,33', '23,34', '44,22', '10,00'],
        ['Elétrica',         127, '35,46', '23,13', '44,44', '10,00'],
        ['Ferragens',        129, '35,11', '23,13', '44,31', '10,00'],
        ['Ferramentas',       99, '35,64', '23,29', '44,36', '10,00'],
        ['Hidráulica',       131, '34,66', '23,10', '44,37', '10,00'],
        ['Iluminação',       139, '34,70', '23,15', '44,04', '10,00'],
        ['Pintura',          130, '35,04', '23,10', '44,35', '10,00'],
        ['GERAL',           1000, '35,11', '-',     '-',     '10,00'],
    ];

    const csvContent = dados.map(row => row.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rentabilidade_por_categoria.csv';
    link.click();
    URL.revokeObjectURL(url);
}

// ════════════════════════════════════════
// 2. MODAL GERAR RECIBO
// ════════════════════════════════════════
function gerarRecibo() {
    const nome    = document.getElementById('reciboNome').value.trim();
    const cpfcnpj = document.getElementById('reciboCpfCnpj').value.trim();
    const end     = document.getElementById('reciboEndereco').value.trim();
    const itens   = document.getElementById('reciboItens').value.trim();
    const valor   = parseFloat(document.getElementById('reciboValor').value);
    const forma   = document.getElementById('reciboForma').value;
    const res     = document.getElementById('resultadoRecibo');

    if (!nome || !cpfcnpj || isNaN(valor) || valor <= 0) {
        res.innerHTML = '⚠️ Preencha Nome, CPF/CNPJ e Valor Total.';
        res.classList.add('visible');
        return;
    }

    // Cálculo de tributos (Simples Nacional — referência)
    const icms   = valor * 0.12;
    const pis    = valor * 0.0165;
    const cofins = valor * 0.03;
    const totalTributos = icms + pis + cofins;
    const valorLiquido  = valor - totalTributos;

    // Número do recibo gerado automaticamente
    const numero = 'REC-' + Date.now().toString().slice(-6);
    const dataHora = new Date().toLocaleString('pt-BR');

    res.innerHTML = `
        <div style="border-bottom:1px solid #c8ddd4; padding-bottom:10px; margin-bottom:10px;">
            <p>🧾 <strong>Nº Recibo:</strong> ${numero}</p>
            <p>📅 <strong>Emissão:</strong> ${dataHora}</p>
        </div>
        <div style="border-bottom:1px solid #c8ddd4; padding-bottom:10px; margin-bottom:10px;">
            <p>👤 <strong>Cliente:</strong> ${nome}</p>
            <p>🪪 <strong>CPF/CNPJ:</strong> ${cpfcnpj}</p>
            ${end ? `<p>📍 <strong>Endereço:</strong> ${end}</p>` : ''}
            ${itens ? `<p>📦 <strong>Itens:</strong> ${itens}</p>` : ''}
            <p>💳 <strong>Forma de pagamento:</strong> ${forma}</p>
        </div>
        <div style="border-bottom:1px solid #c8ddd4; padding-bottom:10px; margin-bottom:10px;">
            <p>💰 <strong>Valor bruto:</strong> R$ ${valor.toFixed(2)}</p>
            <p>📊 <strong>ICMS (12%):</strong> R$ ${icms.toFixed(2)}</p>
            <p>📊 <strong>PIS (1,65%):</strong> R$ ${pis.toFixed(2)}</p>
            <p>📊 <strong>COFINS (3%):</strong> R$ ${cofins.toFixed(2)}</p>
            <p>📊 <strong>Total tributos:</strong> R$ ${totalTributos.toFixed(2)}</p>
        </div>
        <p style="font-size:16px;">✅ <strong style="color:#2e7d32;">Valor líquido: R$ ${valorLiquido.toFixed(2)}</strong></p>
        <p style="font-size:11px; color:#888; margin-top:8px;">⚠️ Simples Nacional: ICMS/PIS/COFINS recolhidos via DAS. Documento para controle interno.</p>
    `;
    res.classList.add('visible');
}

// ════════════════════════════════════════
// 3. MODAL ANÁLISE DETALHADA — CURVA ABC
// ════════════════════════════════════════
// Dados simulados por categoria para a análise ABC
const dadosABC = [
    { nome: 'Cimento CPII',         categoria: 'Construção Bruta', classe: 'A', faturamento: 18.5, giro: 'Alto',  margem: '35,33%' },
    { nome: 'Tijolo 8 Furos',       categoria: 'Construção Bruta', classe: 'A', faturamento: 15.2, giro: 'Alto',  margem: '35,33%' },
    { nome: 'Areia Média',          categoria: 'Construção Bruta', classe: 'A', faturamento: 12.8, giro: 'Alto',  margem: '35,33%' },
    { nome: 'Tinta Acrílica 18L',   categoria: 'Pintura',          classe: 'A', faturamento: 10.1, giro: 'Alto',  margem: '35,04%' },
    { nome: 'Disjuntor 20A',        categoria: 'Elétrica',         classe: 'A', faturamento: 8.3,  giro: 'Médio', margem: '35,46%' },
    { nome: 'Cano PVC 100mm',       categoria: 'Hidráulica',       classe: 'B', faturamento: 5.1,  giro: 'Médio', margem: '34,66%' },
    { nome: 'Parafuso Sextavado',   categoria: 'Ferragens',        classe: 'B', faturamento: 4.8,  giro: 'Médio', margem: '35,11%' },
    { nome: 'Lâmpada LED 9W',       categoria: 'Iluminação',       classe: 'B', faturamento: 4.2,  giro: 'Médio', margem: '34,70%' },
    { nome: 'Lixa D\'água 220',     categoria: 'Acabamento',       classe: 'B', faturamento: 3.6,  giro: 'Médio', margem: '35,16%' },
    { nome: 'Serra Circular',       categoria: 'Ferramentas',      classe: 'C', faturamento: 2.1,  giro: 'Baixo', margem: '35,64%' },
    { nome: 'Chave de Fenda 6mm',   categoria: 'Ferramentas',      classe: 'C', faturamento: 1.8,  giro: 'Baixo', margem: '35,64%' },
    { nome: 'Adesivo PVC 175g',     categoria: 'Hidráulica',       classe: 'C', faturamento: 1.2,  giro: 'Baixo', margem: '34,66%' },
];

function renderizarTabelaABC() {
    const filtro = document.getElementById('filtroABC').value;
    const lista = filtro === 'todos' ? dadosABC : dadosABC.filter(d => d.classe === filtro);

    const corClasse = { A: '#1a3c2c', B: '#ff9800', C: '#9e9e9e' };
    const bgClasse  = { A: '#e8f5e9', B: '#fff3e0', C: '#f5f5f5' };

    const linhas = lista.map(d => `
        <tr>
            <td>${d.nome}</td>
            <td>${d.categoria}</td>
            <td><span style="background:${bgClasse[d.classe]}; color:${corClasse[d.classe]}; padding:2px 10px; border-radius:20px; font-weight:600; font-size:12px;">
                ${d.classe}
            </span></td>
            <td>${d.faturamento}%</td>
            <td>${d.giro}</td>
            <td>${d.margem}</td>
        </tr>
    `).join('');

    document.getElementById('tabelaABCBody').innerHTML = linhas;
}

// Imprimir recibo
function imprimirRecibo() {
    const conteudo = document.getElementById('resultadoRecibo').innerHTML;
    if (!conteudo) {
        alert('⚠️ Gere o recibo primeiro antes de imprimir.');
        return;
    }
    const janela = window.open('', '_blank');
    janela.document.write(`
        <html><head><title>Recibo — Cristóvão Materiais</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #1a2a3a; max-width: 500px; margin: 0 auto; }
            h2 { color: #1a3c2c; border-bottom: 2px solid #1a3c2c; padding-bottom: 10px; }
            p { margin: 6px 0; font-size: 14px; }
            strong { color: #1a3c2c; }
            hr { border: none; border-top: 1px solid #ccc; margin: 12px 0; }
        </style></head>
        <body>
            <h2>🏗️ Cristóvão Materiais de Construção</h2>
            <p>Serrinha — BA</p>
            <hr>
            ${conteudo}
            <hr>
            <p style="font-size:11px; color:#888; margin-top:16px;">Documento gerado automaticamente pelo sistema Cristóvão Omnichannel.</p>
        </body></html>
    `);
    janela.document.close();
    janela.print();
}

// Exportar Curva ABC como CSV
function exportarABC() {
    const filtro = document.getElementById('filtroABC').value;
    const lista = filtro === 'todos' ? dadosABC : dadosABC.filter(d => d.classe === filtro);

    const cabecalho = ['Produto', 'Categoria', 'Classe', '% Faturamento', 'Giro', 'Margem'];
    const linhas = lista.map(d => [d.nome, d.categoria, d.classe, d.faturamento + '%', d.giro, d.margem]);

    const csv = [cabecalho, ...linhas].map(r => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `curva_abc${filtro !== 'todos' ? '_classe_' + filtro : ''}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// ── GRÁFICOS ──

// Vendas
new Chart(document.getElementById('vendasChart'), {
    type: 'line',
    data: {
        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
        datasets: [{ label: 'Vendas (R$ mil)', data: [180, 210, 245, 230, 270, 285], borderColor: '#1a3c2c', fill: true, tension: 0.3 }]
    },
    options: { responsive: true, maintainAspectRatio: true }
});

// Pagamentos — gráfico de rosca
new Chart(document.getElementById('pagamentosChart'), {
    type: 'doughnut',
    data: {
        labels: ['Pix', 'Cartão Crédito', 'Boleto', 'Cartão Débito'],
        datasets: [{
            data: [40, 30, 18, 12],
            backgroundColor: ['#1a3c2c', '#ff9800', '#2196f3', '#9c27b0']
        }]
    },
    options: { responsive: true, maintainAspectRatio: true }
});

// Rentabilidade por Categoria — 8 categorias reais
new Chart(document.getElementById('rentabilidadeChart'), {
    type: 'bar',
    data: {
        labels: ['Acabamento', 'Const. Bruta', 'Elétrica', 'Ferragens', 'Ferramentas', 'Hidráulica', 'Iluminação', 'Pintura'],
        datasets: [{
            label: 'Margem (%)',
            data: [35.16, 35.33, 35.46, 35.11, 35.64, 34.66, 34.70, 35.04],
            backgroundColor: '#1a3c2c'
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
            y: { min: 34, max: 36, ticks: { callback: v => v + '%' } }
        }
    }
});

// Curva ABC Financeiro
new Chart(document.getElementById('curvaABCChart'), {
    type: 'bar',
    data: {
        labels: ['A (70%)', 'B (20%)', 'C (10%)'],
        datasets: [{
            label: 'Participação no faturamento',
            data: [70, 20, 10],
            backgroundColor: ['#1a3c2c', '#ff9800', '#e0e0e0']
        }]
    },
    options: { responsive: true, maintainAspectRatio: true }
});

// Curva ABC Compras
new Chart(document.getElementById('curvaABCChartCompras'), {
    type: 'bar',
    data: {
        labels: ['A (70%)', 'B (20%)', 'C (10%)'],
        datasets: [{
            label: 'Participação no faturamento',
            data: [70, 20, 10],
            backgroundColor: ['#1a3c2c', '#ff9800', '#e0e0e0']
        }]
    },
    options: { responsive: true, maintainAspectRatio: true }
});

// ── MAPA LOGÍSTICA ──
var map = L.map('logistics-map').setView([-23.5505, -46.6333], 12);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' }).addTo(map);
L.marker([-23.5505, -46.6333]).bindPopup('Loja Cristóvão').addTo(map);
L.marker([-23.6000, -46.6500]).bindPopup('Cliente A - Entrega').addTo(map);
L.marker([-23.5200, -46.6200]).bindPopup('Cliente B - Entrega').addTo(map);