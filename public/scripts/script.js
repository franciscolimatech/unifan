/**
 * public/scripts/script.js
 * * LÃ³gica de Interface e Regras de NegÃ³cio de Squads
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Nota: Toda a lÃ³gica de sessÃ£o, cookies e gerenciamento dos modais de login e 
 * aceite de termos foi delegada para o 'public/auth.js' para evitar bugs de UI.
 */

document.addEventListener('DOMContentLoaded', () => {
    // â”€â”€ NAVEGAÃ‡ÃƒO ENTRE SQUADS (ABAS DO PAINEL) â”€â”€
    const buttons = document.querySelectorAll('.squad-btn');
    const views = document.querySelectorAll('.squad-view');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const squad = btn.dataset.squad;
            
            // Remove estados ativos anteriores e ativa o botÃ£o clicado
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Esconde todas as visÃµes e ativa a correspondente ao squad
            views.forEach(view => view.classList.remove('active-view'));
            const targetView = document.getElementById(`${squad}-view`);
            if (targetView) targetView.classList.add('active-view');
            
            // ForÃ§a o Leaflet a recalcular o tamanho correto do mapa se a aba de logÃ­stica for aberta
            if (squad === 'logistica' && window.map) {
                setTimeout(() => { 
                    window.map.invalidateSize(); 
                }, 100);
            }
        });
    });

    // â”€â”€ MAPEAMENTO E ABERTURA DE MODAIS OPERACIONAIS â”€â”€
    const configurarModalOperacional = (btnId, modalId) => {
        const btn = document.getElementById(btnId);
        const modal = document.getElementById(modalId);
        if (btn && modal) {
            btn.addEventListener('click', () => modal.classList.add('open'));
        }
    };

    // Vincula os botÃµes da interface aos seus respectivos modais de simulaÃ§Ã£o
    configurarModalOperacional('btnSimularDesconto', 'modalDesconto');
    configurarModalOperacional('btnSimularParcelamento', 'modalParcelamento');
    configurarModalOperacional('btnGerarRecibo', 'modalReciboFatura');
    configurarModalOperacional('btnAnaliseABC', 'modalAnaliseABC');

    // â”€â”€ FECHAMENTO SEGURO DE MODAIS â”€â”€
    // Fecha os modais operacionais ao clicar na Ã¡rea escura de overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target !== overlay) return;
            
            // PROTEÃ‡ÃƒO CRÃTICA: Impede que cliques de fora fechem os modais de seguranÃ§a controlados por auth.js
            if (overlay.id === 'modalAuth' || overlay.id === 'modalAceiteTermos') return;
            
            overlay.classList.remove('open');
        });
    });

    // â”€â”€ INICIALIZAÃ‡ÃƒO DE GRÃFICOS E COMPONENTES VISUAIS â”€â”€
    renderizarGraficosPainel();
    inicializarMapaLogistica();
    inicializarComunidade();
});

/**
 * Renderiza e configura os grÃ¡ficos de anÃ¡lise de estoque e faturamento (Chart.js)
 */
function renderizarGraficosPainel() {
    // GrÃ¡fico 1: Curva ABC de Vendas/Faturamento
    const ctxABC = document.getElementById('curvaABCChart');
    if (ctxABC && typeof Chart !== 'undefined') {
        new Chart(ctxABC, {
            type: 'bar',
            data: {
                labels: ['Classe A (70%)', 'Classe B (20%)', 'Classe C (10%)'],
                datasets: [{
                    label: 'ParticipaÃ§Ã£o no Faturamento',
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

    // GrÃ¡fico 2: Curva ABC de Compras/Estoque
    const ctxCompras = document.getElementById('curvaABCChartCompras');
    if (ctxCompras && typeof Chart !== 'undefined') {
        new Chart(ctxCompras, {
            type: 'bar',
            data: {
                labels: ['Classe A (65%)', 'Classe B (25%)', 'Classe C (10%)'],
                datasets: [{
                    label: 'ParticipaÃ§Ã£o nas Compras',
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
 * Inicializa a instÃ¢ncia do mapa do Leaflet focado nas simulaÃ§Ãµes de rota de entrega
 */
function inicializarMapaLogistica() {
    const mapElement = document.getElementById('logistics-map');
    
    // Certifica-se de que a div existe no HTML e a biblioteca Leaflet (L) estÃ¡ carregada via CDN
    if (mapElement && typeof L !== 'undefined') {
        // Centraliza o mapa por padrÃ£o (coordenadas demonstrativas)
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
    const json = await resposta.json();
    return { httpStatus: resposta.status, ...json };
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
    const conteudo = avatar
        ? `<img src="${avatar}" alt="Avatar de ${nome}">`
        : iniciais(nome);
    return `<div class="${classe}">${conteudo}</div>`;
}

function atualizarPreviewAvatar(url) {
    const preview = document.getElementById('perfilAvatarPreview');
    if (!preview) return;
    preview.innerHTML = url
        ? `<img src="${url}" alt="Avatar do perfil">`
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
    lista.innerHTML = posts.map(post => `
        <article class="feed-post">
            <div class="feed-post-header">
                ${avatarHtml(post.autorNome, post.autorAvatar)}
                <div>
                    <div class="feed-author">${post.autorNome}</div>
                    <div class="feed-date">${formatarDataComunidade(post.criadoEm)}</div>
                </div>
            </div>
            ${post.imagemUrl ? `<img class="feed-image" src="${post.imagemUrl}" alt="Imagem da publicacao">` : ''}
            <p class="feed-caption">${post.legenda || ''}</p>
            <div class="comments-list">
                ${(post.comentarios || []).map(comentario => `
                    <div class="comment-item">
                        <strong>${comentario.autorNome}:</strong> ${comentario.texto}
                    </div>
                `).join('') || '<div class="empty-state">Sem comentarios ainda.</div>'}
            </div>
            <form class="comment-form" data-post-id="${post.id}">
                <input type="text" name="comentario" maxlength="240" placeholder="Escrever depoimento ou comentario">
                <button class="btn btn-secondary" type="submit"><i class="fas fa-comment"></i></button>
            </form>
        </article>
    `).join('');
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
    lista.innerHTML = notificacoes.map(item => `
        <div class="notification-item ${item.lida ? '' : 'unread'}">
            <strong>${item.tipo}</strong><br>
            ${item.mensagem}
            <div class="feed-date">${formatarDataComunidade(item.criadoEm)}</div>
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
            document.getElementById('nomeUsuarioLogado').textContent = resultado.dados.usuario.nome;
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
