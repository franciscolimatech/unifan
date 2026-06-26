/**
 * public/scripts/script.js
 * * Lógica de Interface e Regras de Negócio de Squads
 * ─────────────────────────────────────────────────────────────────────────────
 * Nota: Toda a lógica de sessão, cookies e gerenciamento dos modais de login e 
 * aceite de termos foi delegada para o 'public/auth.js' para evitar bugs de UI.
 */

function abrirDocumentoLegal(url, titulo) {
    const modal = document.getElementById('modalDocumentoLegal');
    const iframe = document.getElementById('modalDocumentoLegalFrame');
    const tituloEl = document.getElementById('modalDocumentoLegalTitulo');

    if (!modal || !iframe) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
    }

    iframe.src = url;
    iframe.title = titulo || 'Documento legal';
    if (tituloEl) tituloEl.textContent = titulo || 'Documento legal';

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('legal-document-open');
}

function fecharModal(modalId) {
    if (modalId === 'modalAceiteTermos') {
        return;
    }

    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove('open');

    if (modalId === 'modalDocumentoLegal') {
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('legal-document-open');

        const iframe = document.getElementById('modalDocumentoLegalFrame');
        if (iframe) iframe.removeAttribute('src');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // ── NAVEGAÇÃO ENTRE SQUADS (ABAS DO PAINEL) ──
    const buttons = document.querySelectorAll('.squad-btn');
    const views = document.querySelectorAll('.squad-view');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const squad = btn.dataset.squad;
            
            // Remove estados ativos anteriores e ativa o botão clicado
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Esconde todas as visões e ativa a correspondente ao squad
            views.forEach(view => view.classList.remove('active-view'));
            const targetView = document.getElementById(`${squad}-view`);
            if (targetView) targetView.classList.add('active-view');
            
            // Força o Leaflet a recalcular o tamanho correto do mapa se a aba de logística for aberta
            if (squad === 'logistica' && window.map) {
                setTimeout(() => { 
                    window.map.invalidateSize(); 
                }, 100);
            }
        });
    });

    // ── MAPEAMENTO E ABERTURA DE MODAIS OPERACIONAIS ──
    const configurarModalOperacional = (btnId, modalId) => {
        const btn = document.getElementById(btnId);
        const modal = document.getElementById(modalId);
        if (btn && modal) {
            btn.addEventListener('click', () => modal.classList.add('open'));
        }
    };

    // Vincula os botões da interface aos seus respectivos modais de simulação
    configurarModalOperacional('btnSimularDesconto', 'modalDesconto');
    configurarModalOperacional('btnSimularParcelamento', 'modalParcelamento');
    configurarModalOperacional('btnGerarRecibo', 'modalReciboFatura');
    configurarModalOperacional('btnAnaliseABC', 'modalAnaliseABC');

    // ── FECHAMENTO SEGURO DE MODAIS ──
    // Fecha os modais operacionais ao clicar na área escura de overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target !== overlay) return;
            
            // PROTEÇÃO CRÍTICA: Impede que cliques de fora fechem os modais de segurança controlados por auth.js
            if (overlay.id === 'modalAuth' || overlay.id === 'modalAceiteTermos') return;
            
            overlay.classList.remove('open');
        });
    });

    // ── INICIALIZAÇÃO DE GRÁFICOS E COMPONENTES VISUAIS ──
    const modalDocumentoLegal = document.getElementById('modalDocumentoLegal');
    if (modalDocumentoLegal) {
        modalDocumentoLegal.addEventListener('click', (e) => {
            if (e.target === modalDocumentoLegal) fecharModal('modalDocumentoLegal');
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') fecharModal('modalDocumentoLegal');
    });

    renderizarGraficosPainel();
    inicializarMapaLogistica();
    inicializarComunidade();
});

/**
 * Renderiza e configura os gráficos de análise de estoque e faturamento (Chart.js)
 */
function renderizarGraficosPainel() {
    // Gráfico 1: Curva ABC de Vendas/Faturamento
    const ctxABC = document.getElementById('curvaABCChart');
    if (ctxABC && typeof Chart !== 'undefined') {
        new Chart(ctxABC, {
            type: 'bar',
            data: {
                labels: ['Classe A (70%)', 'Classe B (20%)', 'Classe C (10%)'],
                datasets: [{
                    label: 'Participação no Faturamento',
                    data: [70, 20, 10],
                    backgroundColor: ['#1a3c2c', '#ff9800', '#e0e0e0'],
                    borderRadius: 6
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    // Gráfico 2: Curva ABC de Compras/Estoque
    const ctxCompras = document.getElementById('curvaABCChartCompras');
    if (ctxCompras && typeof Chart !== 'undefined') {
        new Chart(ctxCompras, {
            type: 'bar',
            data: {
                labels: ['Classe A (65%)', 'Classe B (25%)', 'Classe C (10%)'],
                datasets: [{
                    label: 'Participação nas Compras',
                    data: [65, 25, 10],
                    backgroundColor: ['#1a3c2c', '#ff9800', '#e0e0e0'],
                    borderRadius: 6
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

/**
 * Inicializa a instância do mapa do Leaflet focado nas simulações de rota de entrega
 */
function inicializarMapaLogistica() {
    const mapElement = document.getElementById('logistics-map');
    
    // Certifica-se de que a div existe no HTML e a biblioteca Leaflet (L) está carregada via CDN
    if (mapElement && typeof L !== 'undefined') {
        // Centraliza o mapa por padrão (coordenadas demonstrativas)
        window.map = L.map('logistics-map').setView([-23.5505, -46.6333], 12);
        
        // Aplica o tema de mapa "CartoDB Positron" (visual limpo e profissional)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(window.map);
    }
}

function mostrarMensagemComunidade(id, tipo, texto) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = texto;
    el.className = `community-message ${tipo}`;
    el.hidden = false;
}

async function apiComunidade(url, metodo = 'GET', body = null) {
    const opcoes = {
        method: metodo,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
    };

    if (body) opcoes.body = JSON.stringify(body);

    const resposta = await fetch(url, opcoes);
    const json = await resposta.json().catch(() => ({
        ok: false,
        erro: 'Resposta invalida do servidor.',
    }));

    return { httpStatus: resposta.status, ...json };
}

function escaparHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function imagemSegura(valor) {
    const url = String(valor || '').trim();
    if (/^https?:\/\//i.test(url)) return url;
    if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(url)) return url;
    return '';
}

function formatarDataComunidade(valor) {
    if (!valor) return '';
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(valor));
}

function iniciais(nome) {
    return (nome || 'U')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(parte => parte[0])
        .join('')
        .toUpperCase();
}

function avatarHtml(nome, avatar, classe = 'feed-avatar') {
    const nomeSeguro = escaparHtml(nome || 'Usuario');
    const avatarSeguro = imagemSegura(avatar);
    const conteudo = avatarSeguro
        ? `<img src="${escaparHtml(avatarSeguro)}" alt="Avatar de ${nomeSeguro}">`
        : escaparHtml(iniciais(nome));

    return `<div class="${classe}">${conteudo}</div>`;
}

function atualizarPreviewAvatar(url) {
    const preview = document.getElementById('perfilAvatarPreview');
    if (!preview) return;

    const avatarSeguro = imagemSegura(url);
    preview.innerHTML = avatarSeguro
        ? `<img src="${escaparHtml(avatarSeguro)}" alt="Avatar do perfil">`
        : '<i class="fas fa-user"></i>';
}

async function arquivoParaBase64(input) {
    const arquivo = input?.files?.[0];
    if (!arquivo) return null;

    if (!arquivo.type.startsWith('image/')) {
        throw new Error('Selecione um arquivo de imagem.');
    }

    if (arquivo.size > 700 * 1024) {
        throw new Error('Use uma imagem menor que 700 KB para este prototipo.');
    }

    return new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(leitor.result);
        leitor.onerror = () => reject(new Error('Nao foi possivel ler a imagem.'));
        leitor.readAsDataURL(arquivo);
    });
}

async function carregarPerfilComunidade() {
    const resultado = await apiComunidade('/api/usuarios/perfil');
    if (!resultado.ok) return;

    const usuario = resultado.dados.usuario;
    const nome = document.getElementById('perfilNome');
    const email = document.getElementById('perfilEmail');
    const avatar = document.getElementById('perfilAvatar');

    if (nome) nome.value = usuario.nome || '';
    if (email) email.value = usuario.email || '';
    if (avatar) avatar.value = usuario.avatar || '';

    atualizarPreviewAvatar(usuario.avatar);
}

function renderizarPosts(posts) {
    const lista = document.getElementById('listaPosts');
    const contador = document.getElementById('contadorPosts');
    if (!lista) return;

    if (contador) contador.textContent = `${posts.length} itens`;

    if (!posts.length) {
        lista.innerHTML = '<div class="empty-state">Nenhum conteudo encontrado.</div>';
        return;
    }

    lista.innerHTML = posts.map((post) => {
        const imagem = imagemSegura(post.imagemUrl);
        const comentarios = post.comentarios || [];

        return `
            <article class="feed-post">
                <div class="feed-post-header">
                    ${avatarHtml(post.autorNome, post.autorAvatar)}
                    <div>
                        <div class="feed-author">${escaparHtml(post.autorNome)}</div>
                        <div class="feed-date">${escaparHtml(formatarDataComunidade(post.criadoEm))}</div>
                    </div>
                </div>
                ${imagem ? `<img class="feed-image" src="${escaparHtml(imagem)}" alt="Imagem da publicacao">` : ''}
                <p class="feed-caption">${escaparHtml(post.legenda || '')}</p>
                <div class="comments-list">
                    ${comentarios.length
                        ? comentarios.map((comentario) => `
                            <div class="comment-item">
                                <strong>${escaparHtml(comentario.autorNome)}:</strong>
                                ${escaparHtml(comentario.texto)}
                            </div>
                        `).join('')
                        : '<div class="empty-state">Sem comentarios ainda.</div>'}
                </div>
                <form class="comment-form" data-post-id="${escaparHtml(post.id)}">
                    <input type="text" name="comentario" maxlength="240" placeholder="Escrever depoimento ou comentario">
                    <button class="btn btn-secondary" type="submit" aria-label="Enviar comentario">
                        <i class="fas fa-comment"></i>
                    </button>
                </form>
            </article>
        `;
    }).join('');
}

function renderizarNotificacoes(notificacoes, naoLidas) {
    const lista = document.getElementById('listaNotificacoes');
    const contador = document.getElementById('contadorNotificacoes');

    if (contador) contador.textContent = `${naoLidas} novas`;
    if (!lista) return;

    if (!notificacoes.length) {
        lista.innerHTML = '<div class="empty-state">Nenhuma notificacao por enquanto.</div>';
        return;
    }

    lista.innerHTML = notificacoes.map((item) => `
        <div class="notification-item ${item.lida ? '' : 'unread'}">
            <strong>${escaparHtml(item.tipo)}</strong><br>
            ${escaparHtml(item.mensagem)}
            <div class="feed-date">${escaparHtml(formatarDataComunidade(item.criadoEm))}</div>
        </div>
    `).join('');
}

async function carregarConteudoComunidade() {
    const termo = document.getElementById('buscaConteudo')?.value.trim() || '';
    const [posts, notificacoes] = await Promise.all([
        apiComunidade(`/api/posts${termo ? `?q=${encodeURIComponent(termo)}` : ''}`),
        apiComunidade('/api/notificacoes'),
    ]);

    if (posts.ok) renderizarPosts(posts.dados.posts || []);
    if (notificacoes.ok) {
        renderizarNotificacoes(
            notificacoes.dados.notificacoes || [],
            notificacoes.dados.naoLidas || 0
        );
    }
}

function inicializarComunidade() {
    if (!document.getElementById('comunidade-view')) return;

    document.getElementById('btnAtualizarComunidade')?.addEventListener('click', carregarConteudoComunidade);
    document.getElementById('buscaConteudo')?.addEventListener('input', () => {
        clearTimeout(window._communitySearchTimer);
        window._communitySearchTimer = setTimeout(carregarConteudoComunidade, 350);
    });
    document.getElementById('perfilAvatar')?.addEventListener('input', (e) => atualizarPreviewAvatar(e.target.value));

    document.getElementById('formPerfil')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const body = {
            nome: document.getElementById('perfilNome')?.value.trim(),
            email: document.getElementById('perfilEmail')?.value.trim().toLowerCase(),
            avatar: document.getElementById('perfilAvatar')?.value.trim() || null,
        };
        const resultado = await apiComunidade('/api/usuarios/perfil', 'PUT', body);

        if (resultado.ok) {
            mostrarMensagemComunidade('perfilMensagem', 'success', 'Perfil atualizado com sucesso.');
            const nomeUsuarioLogado = document.getElementById('nomeUsuarioLogado');
            if (nomeUsuarioLogado) nomeUsuarioLogado.textContent = resultado.dados.usuario.nome;
            atualizarPreviewAvatar(resultado.dados.usuario.avatar);
            carregarConteudoComunidade();
        } else {
            mostrarMensagemComunidade('perfilMensagem', 'error', resultado.erro || 'Nao foi possivel salvar o perfil.');
        }
    });

    document.getElementById('formPublicacao')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
            const imagemArquivo = await arquivoParaBase64(document.getElementById('postImagemArquivo'));
            const body = {
                imagemUrl: imagemArquivo || document.getElementById('postImagemUrl')?.value.trim(),
                legenda: document.getElementById('postLegenda')?.value.trim(),
            };
            const resultado = await apiComunidade('/api/posts', 'POST', body);

            if (resultado.ok) {
                e.target.reset();
                mostrarMensagemComunidade('postMensagem', 'success', 'Publicacao criada.');
                carregarConteudoComunidade();
            } else {
                mostrarMensagemComunidade('postMensagem', 'error', resultado.erro || 'Nao foi possivel publicar.');
            }
        } catch (error) {
            mostrarMensagemComunidade('postMensagem', 'error', error.message);
        }
    });

    document.getElementById('listaPosts')?.addEventListener('submit', async (e) => {
        const form = e.target.closest('.comment-form');
        if (!form) return;

        e.preventDefault();

        const texto = form.comentario.value.trim();
        if (!texto) return;

        const resultado = await apiComunidade(`/api/posts/${form.dataset.postId}/comentarios`, 'POST', { texto });
        if (resultado.ok) {
            form.reset();
            carregarConteudoComunidade();
        }
    });

    document.getElementById('btnMarcarNotificacoes')?.addEventListener('click', async () => {
        await apiComunidade('/api/notificacoes', 'PUT', { lida: true });
        carregarConteudoComunidade();
    });

    setTimeout(() => {
        carregarPerfilComunidade().catch(() => {});
        carregarConteudoComunidade().catch(() => {});
    }, 500);
}
