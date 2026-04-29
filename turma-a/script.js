        // ── Navegação entre Squads ──
        const buttons = document.querySelectorAll('.squad-btn');
        const views = document.querySelectorAll('.squad-view');

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
            });
        });

        // ── Modais ──
        document.getElementById('btnSimularDesconto').addEventListener('click', () => {
            document.getElementById('modalDesconto').classList.add('open');
        });
        document.getElementById('btnSimularParcelamento').addEventListener('click', () => {
            document.getElementById('modalParcelamento').classList.add('open');
        });

        function fecharModal(id) {
            document.getElementById(id).classList.remove('open');
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
            } else if (['credito7','credito10','credito12'].includes(forma)) {
                const jurosMes = 0.0199;
                const fatorJuros = (jurosMes * Math.pow(1 + jurosMes, parcelas)) / (Math.pow(1 + jurosMes, parcelas) - 1);
                valorParcela = (valor * (1 + taxa)) / parcelas * (1 + jurosMes);
                totalCliente = valorParcela * parcelas;
                totalLojista = valor * (1 - taxa);
                descricao = `Juros: 1,99% a.m. + taxa gateway ${(taxa*100).toFixed(1)}%`;
            } else {
                totalCliente = forma === 'pix' ? valor : valor * (1 + taxa);
                totalLojista = valor * (1 - taxa);
                valorParcela = totalCliente / parcelas;
                descricao = forma === 'pix' ? 'Sem custo' : `Taxa gateway: ${(taxa*100).toFixed(1)}%`;
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

        // Curva ABC
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