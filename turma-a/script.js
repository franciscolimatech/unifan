        // ─────────────────────────────────────────────
        // AUTENTICACAO E ACESSO - 15/05/2026
        // Protótipo acadêmico: usa localStorage como banco local do navegador.
        // Senhas e respostas de recuperação são salvas com hash SHA-256.
        // ─────────────────────────────────────────────
        const AUTH_USUARIOS_KEY = 'cristovao_usuarios';
        const AUTH_SESSAO_KEY = 'cristovao_sessao_atual';

        async function gerarHashSHA256(texto) {
            if (!window.crypto || !window.crypto.subtle) {
                throw new Error('SHA-256 indisponível neste navegador.');
            }

            const dados = new TextEncoder().encode(texto);
            const hashBuffer = await crypto.subtle.digest('SHA-256', dados);
            return Array.from(new Uint8Array(hashBuffer))
                .map(byte => byte.toString(16).padStart(2, '0'))
                .join('');
        }

        function obterUsuarios() {
            try {
                return JSON.parse(localStorage.getItem(AUTH_USUARIOS_KEY)) || [];
            } catch (error) {
                return [];
            }
        }

        function salvarUsuarios(usuarios) {
            localStorage.setItem(AUTH_USUARIOS_KEY, JSON.stringify(usuarios));
        }

        function buscarUsuarioPorEmail(email) {
            const emailNormalizado = email.trim().toLowerCase();
            return obterUsuarios().find(usuario => usuario.email === emailNormalizado) || null;
        }

        async function cadastrarUsuario() {
            limparAuthMensagem();

            const nome = document.getElementById('authCadastroNome').value.trim();
            const email = document.getElementById('authCadastroEmail').value.trim().toLowerCase();
            const senha = document.getElementById('authCadastroSenha').value;
            const confirmarSenha = document.getElementById('authCadastroConfirmarSenha').value;
            const pergunta = document.getElementById('authCadastroPergunta').value.trim();
            const resposta = document.getElementById('authCadastroResposta').value.trim().toLowerCase();

            if (!nome || !email || !senha || !confirmarSenha || !pergunta || !resposta) {
                mostrarAuthMensagem('erro', 'Preencha todos os campos para criar a conta.');
                return;
            }

            if (!validarEmail(email)) {
                mostrarAuthMensagem('erro', 'Informe um e-mail válido.');
                return;
            }

            if (senha.length < 6) {
                mostrarAuthMensagem('erro', 'A senha precisa ter pelo menos 6 caracteres.');
                return;
            }

            if (senha !== confirmarSenha) {
                mostrarAuthMensagem('erro', 'A senha e a confirmação precisam ser iguais.');
                return;
            }

            if (buscarUsuarioPorEmail(email)) {
                mostrarAuthMensagem('erro', 'Já existe uma conta cadastrada com este e-mail.');
                return;
            }

            try {
                const usuarios = obterUsuarios();
                usuarios.push({
                    id: `usr_${Date.now()}`,
                    nome,
                    email,
                    senhaHash: await gerarHashSHA256(senha),
                    perguntaRecuperacao: pergunta,
                    respostaHash: await gerarHashSHA256(resposta),
                    criadoEm: new Date().toISOString()
                });

                salvarUsuarios(usuarios);
                document.getElementById('authLoginEmail').value = email;
                abrirAbaAuth('login');
                mostrarAuthMensagem('sucesso', 'Conta criada com sucesso. Entre com seu e-mail e senha.');
            } catch (error) {
                mostrarAuthMensagem('erro', 'Não foi possível criar a conta neste navegador.');
            }
        }

        async function loginUsuario() {
            limparAuthMensagem();

            const email = document.getElementById('authLoginEmail').value.trim().toLowerCase();
            const senha = document.getElementById('authLoginSenha').value;

            if (!validarEmail(email) || !senha) {
                mostrarAuthMensagem('erro', 'Informe e-mail e senha para entrar.');
                return;
            }

            const usuario = buscarUsuarioPorEmail(email);
            if (!usuario) {
                mostrarAuthMensagem('erro', 'Usuário não encontrado no banco local.');
                return;
            }

            try {
                const senhaHash = await gerarHashSHA256(senha);
                if (senhaHash !== usuario.senhaHash) {
                    mostrarAuthMensagem('erro', 'Senha incorreta.');
                    return;
                }

                const sessao = {
                    id: usuario.id,
                    nome: usuario.nome,
                    email: usuario.email,
                    loginEm: new Date().toISOString()
                };

                localStorage.setItem(AUTH_SESSAO_KEY, JSON.stringify(sessao));
                aplicarSessao(sessao);
            } catch (error) {
                mostrarAuthMensagem('erro', 'Não foi possível validar a senha neste navegador.');
            }
        }

        async function recuperarSenha() {
            limparAuthMensagem();

            const email = document.getElementById('authRecEmail').value.trim().toLowerCase();
            const pergunta = document.getElementById('authRecPergunta').value.trim();
            const resposta = document.getElementById('authRecResposta').value.trim().toLowerCase();
            const novaSenha = document.getElementById('authRecNovaSenha').value;

            if (!validarEmail(email) || !pergunta || !resposta || !novaSenha) {
                mostrarAuthMensagem('erro', 'Preencha todos os campos de recuperação.');
                return;
            }

            if (novaSenha.length < 6) {
                mostrarAuthMensagem('erro', 'A nova senha precisa ter pelo menos 6 caracteres.');
                return;
            }

            const usuarios = obterUsuarios();
            const usuarioIndex = usuarios.findIndex(usuario => usuario.email === email);
            if (usuarioIndex === -1) {
                mostrarAuthMensagem('erro', 'E-mail não encontrado no banco local.');
                return;
            }

            const usuario = usuarios[usuarioIndex];
            if (usuario.perguntaRecuperacao.trim().toLowerCase() !== pergunta.toLowerCase()) {
                mostrarAuthMensagem('erro', 'A pergunta de recuperação não confere.');
                return;
            }

            try {
                const respostaHash = await gerarHashSHA256(resposta);
                if (respostaHash !== usuario.respostaHash) {
                    mostrarAuthMensagem('erro', 'Resposta de recuperação incorreta.');
                    return;
                }

                usuarios[usuarioIndex].senhaHash = await gerarHashSHA256(novaSenha);
                salvarUsuarios(usuarios);
                document.getElementById('authLoginEmail').value = email;
                voltarParaLogin();
                mostrarAuthMensagem('sucesso', 'Senha redefinida com sucesso. Entre com a nova senha.');
            } catch (error) {
                mostrarAuthMensagem('erro', 'Não foi possível redefinir a senha neste navegador.');
            }
        }

        function verificarSessao() {
            try {
                const sessao = JSON.parse(localStorage.getItem(AUTH_SESSAO_KEY));
                if (sessao && buscarUsuarioPorEmail(sessao.email)) {
                    aplicarSessao(sessao);
                    return;
                }
            } catch (error) {
                localStorage.removeItem(AUTH_SESSAO_KEY);
            }

            bloquearSistema();
        }

        function aplicarSessao(sessao) {
            document.body.classList.remove('auth-bloqueado');
            document.querySelector('.squad-nav')?.classList.remove('auth-locked');
            document.querySelector('.dashboard')?.classList.remove('auth-locked');

            const areaUsuario = document.getElementById('areaUsuarioLogado');
            const nomeUsuario = document.getElementById('nomeUsuarioLogado');
            if (areaUsuario) areaUsuario.hidden = false;
            if (nomeUsuario) nomeUsuario.textContent = sessao.nome;

            document.getElementById('modalAuth')?.classList.remove('open');
            limparAuthMensagem();
        }

        function bloquearSistema() {
            document.body.classList.add('auth-bloqueado');
            document.querySelector('.squad-nav')?.classList.add('auth-locked');
            document.querySelector('.dashboard')?.classList.add('auth-locked');
            document.getElementById('areaUsuarioLogado')?.setAttribute('hidden', '');
            document.getElementById('modalAuth')?.classList.add('open');
            abrirAbaAuth('login');
            mostrarAuthMensagem('info', 'ℹ️ Faça login para acessar o sistema.');
        }

        function logout() {
            localStorage.removeItem(AUTH_SESSAO_KEY);
            document.getElementById('authLoginSenha').value = '';
            bloquearSistema();
        }

        function abrirAbaAuth(aba) {
            if (!['login', 'cadastro'].includes(aba)) return;

            document.getElementById('authModalTitulo').textContent = 'Acesso ao Sistema';
            document.getElementById('authModalSubtitulo').textContent = 'Entre com sua conta para acessar a plataforma Cristóvão';
            const authIcone = document.querySelector('#authModalIcon i');
            if (authIcone) authIcone.className = 'fas fa-lock';

            document.querySelectorAll('[data-auth-tab]').forEach(botao => {
                botao.classList.toggle('active', botao.dataset.authTab === aba);
            });

            document.querySelectorAll('[data-auth-panel]').forEach(painel => {
                painel.classList.toggle('active', painel.dataset.authPanel === aba);
            });

            limparAuthMensagem();
        }

        function abrirRecuperacaoSenha() {
            document.getElementById('authModalTitulo').textContent = 'Recuperar Senha';
            document.getElementById('authModalSubtitulo').textContent = 'Confirme seus dados locais para redefinir o acesso.';
            const authIcone = document.querySelector('#authModalIcon i');
            if (authIcone) authIcone.className = 'fas fa-key';

            document.querySelectorAll('[data-auth-tab]').forEach(botao => {
                botao.classList.remove('active');
            });

            document.querySelectorAll('[data-auth-panel]').forEach(painel => {
                painel.classList.toggle('active', painel.dataset.authPanel === 'recuperacao');
            });

            const emailLogin = document.getElementById('authLoginEmail').value.trim();
            if (emailLogin) document.getElementById('authRecEmail').value = emailLogin;

            limparAuthMensagem();
        }

        function voltarParaLogin() {
            abrirAbaAuth('login');
        }

        function mostrarAuthMensagem(tipo, mensagem) {
            const mensagemEl = document.getElementById('authMensagem');
            if (!mensagemEl) return;

            mensagemEl.textContent = mensagem;
            mensagemEl.className = `auth-message ${tipo}`;
            mensagemEl.hidden = false;
        }

        function limparAuthMensagem() {
            const mensagemEl = document.getElementById('authMensagem');
            if (!mensagemEl) return;

            mensagemEl.textContent = '';
            mensagemEl.className = 'auth-message';
            mensagemEl.hidden = true;
        }

        function toggleSenha(inputId, botao) {
            const input = document.getElementById(inputId);
            const icone = botao.querySelector('i');
            if (!input) return;

            const mostrar = input.type === 'password';
            input.type = mostrar ? 'text' : 'password';
            botao.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');

            if (icone) {
                icone.classList.toggle('fa-eye', !mostrar);
                icone.classList.toggle('fa-eye-slash', mostrar);
            }
        }

        function validarEmail(email) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
        }

        function existeSessaoAtiva() {
            try {
                const sessao = JSON.parse(localStorage.getItem(AUTH_SESSAO_KEY));
                return Boolean(sessao && buscarUsuarioPorEmail(sessao.email));
            } catch (error) {
                return false;
            }
        }

        document.getElementById('btnLogout')?.addEventListener('click', logout);
        verificarSessao();

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
        document.getElementById('btnGerarRecibo').addEventListener('click', () => {
            document.getElementById('modalReciboFatura').classList.add('open');
        });
        document.getElementById('btnAnaliseABC').addEventListener('click', () => {
            document.getElementById('modalAnaliseABC').classList.add('open');
        });

        function fecharModal(id) {
            document.getElementById(id).classList.remove('open');
        }

        // Fechar modal clicando fora
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target !== overlay) return;

                if (overlay.id === 'modalAuth' && !existeSessaoAtiva()) {
                    mostrarAuthMensagem('info', 'ℹ️ Faça login para acessar o sistema.');
                    return;
                }

                overlay.classList.remove('open');
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

        const moedaBR = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });

        document.getElementById('btnEmitirDocumento').addEventListener('click', () => {
            const tipo = document.getElementById('docTipo').value;
            const valor = parseFloat(document.getElementById('docValor').value);
            const cliente = document.getElementById('docCliente').value.trim();
            const documento = document.getElementById('docDocumento').value.trim();
            const endereco = document.getElementById('docEndereco').value.trim();
            const descricao = document.getElementById('docDescricao').value.trim();
            const res = document.getElementById('resultadoReciboFatura');

            if (!cliente || !documento || !endereco || !descricao || isNaN(valor) || valor <= 0) {
                res.innerHTML = '<p><strong>Atenção:</strong> preencha cliente, CPF/CNPJ, endereço, descrição e valor para emitir o documento.</p>';
                res.classList.add('visible');
                return;
            }

            const numero = `FIN-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
            const icms = valor * 0.12;
            const liquido = valor - icms;
            const data = new Date().toLocaleDateString('pt-BR');

            res.innerHTML = `
                <div class="doc-title">${tipo} ${numero}</div>
                <p><strong>Data:</strong> ${data}</p>
                <p><strong>Cliente:</strong> ${cliente} - ${documento}</p>
                <p><strong>Endereço:</strong> ${endereco}</p>
                <p><strong>Descrição:</strong> ${descricao}</p>
                <p><strong>Valor bruto:</strong> ${moedaBR.format(valor)}</p>
                <p><strong>ICMS estimado (12% BA):</strong> ${moedaBR.format(icms)}</p>
                <p><strong>Valor líquido referencial:</strong> ${moedaBR.format(liquido)}</p>
                <p style="margin-top:10px;"><strong>Status:</strong> documento gerado para conferência fiscal.</p>
            `;
            res.classList.add('visible');
        });

        document.getElementById('btnRecalcularABC').addEventListener('click', () => {
            const res = document.getElementById('resultadoAnaliseABC');
            res.innerHTML = '<p><strong>Cenário recalculado:</strong> manter Classe A com 70% do faturamento, revisar itens Classe B quinzenalmente e reduzir novas compras Classe C até o giro normalizar.</p>';
            res.classList.add('visible');
        });

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
