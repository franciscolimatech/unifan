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

let comunidadePostsCache = [];
let relatorioOrdenacao = { campo: 'criadoEm', direcao: 'desc' };
let graficoRelatorioComunidade = null;

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
                <div class="feed-actions">
                    <button class="btn btn-secondary btn-share-post" type="button" data-share-toggle>
                        <i class="fas fa-share-nodes"></i> Compartilhar
                    </button>
                </div>
                <form class="share-form" data-post-id="${escaparHtml(post.id)}" hidden>
                    <input type="email" name="destinatarioEmail" maxlength="254" placeholder="E-mail do destinatario" required>
                    <input type="text" name="mensagem" maxlength="180" placeholder="Mensagem opcional">
                    <button class="btn btn-secondary" type="submit">
                        <i class="fas fa-paper-plane"></i> Enviar
                    </button>
                    <div class="community-message share-message" hidden></div>
                </form>
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

function mostrarMensagemCompartilhamento(form, tipo, texto) {
    const mensagem = form.querySelector('.share-message');
    if (!mensagem) return;

    mensagem.textContent = texto;
    mensagem.className = `community-message share-message ${tipo}`;
    mensagem.hidden = false;
}

function alternarFormularioCompartilhamento(botao) {
    const post = botao.closest('.feed-post');
    const form = post?.querySelector('.share-form');
    if (!form) return;

    form.hidden = !form.hidden;
    if (!form.hidden) {
        form.querySelector('input[name="destinatarioEmail"]')?.focus();
    }
}

async function compartilharPost(form) {
    const postId = form.dataset.postId;
    const destinatarioEmail = form.elements.destinatarioEmail?.value.trim().toLowerCase() || '';
    const mensagem = form.elements.mensagem?.value.trim() || '';

    if (!destinatarioEmail) {
        mostrarMensagemCompartilhamento(form, 'error', 'Informe o e-mail do destinatario.');
        return;
    }

    try {
        mostrarMensagemCompartilhamento(form, 'success', 'Enviando compartilhamento...');

        const resultado = await apiComunidade('/api/compartilhamentos', 'POST', {
            postId,
            destinatarioEmail,
            mensagem,
        });

        if (!resultado.ok) {
            mostrarMensagemCompartilhamento(form, 'error', resultado.erro || 'Nao foi possivel compartilhar.');
            return;
        }

        form.reset();
        mostrarMensagemCompartilhamento(form, 'success', 'Publicacao compartilhada com sucesso.');
    } catch (error) {
        mostrarMensagemCompartilhamento(form, 'error', error.message || 'Erro ao compartilhar publicacao.');
    }
}

function textoRelatorio(valor) {
    return String(valor || '').trim().toLowerCase();
}

function comentariosDoPost(post) {
    return Array.isArray(post.comentarios) ? post.comentarios : [];
}

function tipoPostRelatorio(post) {
    return post.imagemUrl ? 'imagem' : 'texto';
}

function categoriaPostRelatorio(post) {
    return post.imagemUrl ? 'com-imagem' : 'somente-texto';
}

function statusPostRelatorio(post) {
    return comentariosDoPost(post).length ? 'comentado' : 'sem-comentarios';
}

function rotuloRelatorio(campo, valor) {
    const rotulos = {
        'com-imagem': 'Com imagem',
        'somente-texto': 'Somente texto',
        imagem: 'Com imagem',
        texto: 'Somente texto',
        comentado: 'Com comentarios',
        'sem-comentarios': 'Sem comentarios',
    };

    if (campo === 'usuario') return valor || 'Usuario';
    return rotulos[valor] || valor || 'Nao informado';
}

function lerFiltrosRelatorio() {
    return {
        dataInicio: document.getElementById('relatorioDataInicio')?.value || '',
        dataFim: document.getElementById('relatorioDataFim')?.value || '',
        tipo: document.getElementById('relatorioTipo')?.value || '',
        status: document.getElementById('relatorioStatus')?.value || '',
        categoria: document.getElementById('relatorioCategoria')?.value || '',
        usuario: textoRelatorio(document.getElementById('relatorioUsuario')?.value),
        busca: textoRelatorio(document.getElementById('relatorioBusca')?.value),
        agrupar: document.getElementById('relatorioAgrupar')?.value || 'categoria',
        graficoTipo: document.getElementById('relatorioGraficoTipo')?.value || 'bar',
    };
}

function postDentroDoPeriodo(post, filtros) {
    const criadoEm = new Date(post.criadoEm);
    if (Number.isNaN(criadoEm.getTime())) return false;

    if (filtros.dataInicio) {
        const inicio = new Date(`${filtros.dataInicio}T00:00:00`);
        if (criadoEm < inicio) return false;
    }

    if (filtros.dataFim) {
        const fim = new Date(`${filtros.dataFim}T23:59:59`);
        if (criadoEm > fim) return false;
    }

    return true;
}

function postCombinaComBusca(post, termo) {
    if (!termo) return true;

    const comentarios = comentariosDoPost(post)
        .map((comentario) => `${comentario.autorNome || ''} ${comentario.texto || ''}`)
        .join(' ');
    const texto = textoRelatorio(`${post.autorNome || ''} ${post.legenda || ''} ${comentarios}`);
    return texto.includes(termo);
}

function filtrarPostsRelatorio(posts, filtros) {
    return posts.filter((post) => {
        if (!postDentroDoPeriodo(post, filtros)) return false;
        if (filtros.tipo && tipoPostRelatorio(post) !== filtros.tipo) return false;
        if (filtros.status && statusPostRelatorio(post) !== filtros.status) return false;
        if (filtros.categoria && categoriaPostRelatorio(post) !== filtros.categoria) return false;
        if (filtros.usuario && !textoRelatorio(post.autorNome).includes(filtros.usuario)) return false;
        if (!postCombinaComBusca(post, filtros.busca)) return false;
        return true;
    });
}

function valorOrdenacaoRelatorio(post, campo) {
    if (campo === 'criadoEm') return new Date(post.criadoEm).getTime() || 0;
    if (campo === 'autorNome') return textoRelatorio(post.autorNome);
    if (campo === 'categoria') return categoriaPostRelatorio(post);
    if (campo === 'status') return statusPostRelatorio(post);
    if (campo === 'comentarios') return comentariosDoPost(post).length;
    return '';
}

function ordenarPostsRelatorio(posts) {
    const direcao = relatorioOrdenacao.direcao === 'asc' ? 1 : -1;
    const campo = relatorioOrdenacao.campo;

    return [...posts].sort((a, b) => {
        const valorA = valorOrdenacaoRelatorio(a, campo);
        const valorB = valorOrdenacaoRelatorio(b, campo);

        if (typeof valorA === 'number' && typeof valorB === 'number') {
            return (valorA - valorB) * direcao;
        }

        return String(valorA).localeCompare(String(valorB), 'pt-BR') * direcao;
    });
}

function agruparPostsRelatorio(posts, campo) {
    return posts.reduce((grupos, post) => {
        const chave = campo === 'usuario'
            ? (post.autorNome || 'Usuario')
            : campo === 'status'
                ? statusPostRelatorio(post)
                : campo === 'tipo'
                    ? tipoPostRelatorio(post)
                    : categoriaPostRelatorio(post);

        const grupo = grupos.get(chave) || { chave, posts: 0, comentarios: 0 };
        grupo.posts += 1;
        grupo.comentarios += comentariosDoPost(post).length;
        grupos.set(chave, grupo);
        return grupos;
    }, new Map());
}

function renderizarResumoRelatorio(posts) {
    const resumo = document.getElementById('resumoRelatorioComunidade');
    const contador = document.getElementById('contadorRelatorio');
    if (!resumo) return;

    const totalPosts = posts.length;
    const totalComentarios = posts.reduce((total, post) => total + comentariosDoPost(post).length, 0);
    const comImagem = posts.filter((post) => Boolean(post.imagemUrl)).length;
    const mediaComentarios = totalPosts ? (totalComentarios / totalPosts).toFixed(1) : '0.0';

    if (contador) contador.textContent = `${totalPosts} itens`;
    resumo.innerHTML = [
        ['Publicacoes', totalPosts],
        ['Comentarios', totalComentarios],
        ['Com imagem', comImagem],
        ['Media comentarios/post', mediaComentarios],
    ].map(([rotulo, valor]) => `
        <div class="report-summary-item">
            <strong>${escaparHtml(valor)}</strong>
            <span>${escaparHtml(rotulo)}</span>
        </div>
    `).join('');
}

function renderizarTabelaRelatorio(posts) {
    const corpo = document.getElementById('corpoRelatorioComunidade');
    const rodape = document.getElementById('rodapeRelatorioComunidade');
    if (!corpo || !rodape) return;

    if (!posts.length) {
        corpo.innerHTML = '<tr><td colspan="5">Nenhum item encontrado para os filtros atuais.</td></tr>';
        rodape.innerHTML = '<tr><td colspan="5">Total: 0 publicacoes | Comentarios: 0 | Media: 0.0</td></tr>';
        return;
    }

    corpo.innerHTML = posts.map((post) => {
        const comentarios = comentariosDoPost(post).length;
        const legenda = post.legenda ? `<br><small>${escaparHtml(post.legenda)}</small>` : '';

        return `
            <tr>
                <td>${escaparHtml(formatarDataComunidade(post.criadoEm))}</td>
                <td>${escaparHtml(post.autorNome || 'Usuario')}</td>
                <td>${escaparHtml(rotuloRelatorio('categoria', categoriaPostRelatorio(post)))}${legenda}</td>
                <td>${escaparHtml(rotuloRelatorio('status', statusPostRelatorio(post)))}</td>
                <td>${escaparHtml(comentarios)}</td>
            </tr>
        `;
    }).join('');

    const totalComentarios = posts.reduce((total, post) => total + comentariosDoPost(post).length, 0);
    const mediaComentarios = posts.length ? (totalComentarios / posts.length).toFixed(1) : '0.0';
    rodape.innerHTML = `
        <tr>
            <td colspan="5">Total: ${escaparHtml(posts.length)} publicacoes | Soma de comentarios: ${escaparHtml(totalComentarios)} | Media: ${escaparHtml(mediaComentarios)} comentarios por post</td>
        </tr>
    `;
}

function renderizarGraficoRelatorio(posts, filtros) {
    const canvas = document.getElementById('graficoRelatorioComunidade');
    if (!canvas || typeof Chart === 'undefined') return;

    const grupos = Array.from(agruparPostsRelatorio(posts, filtros.agrupar).values());
    const labels = grupos.map((grupo) => rotuloRelatorio(filtros.agrupar, grupo.chave));
    const postsPorGrupo = grupos.map((grupo) => grupo.posts);
    const comentariosPorGrupo = grupos.map((grupo) => grupo.comentarios);
    const tipo = ['bar', 'pie', 'line'].includes(filtros.graficoTipo) ? filtros.graficoTipo : 'bar';

    if (graficoRelatorioComunidade) {
        graficoRelatorioComunidade.destroy();
    }

    graficoRelatorioComunidade = new Chart(canvas, {
        type: tipo,
        data: {
            labels,
            datasets: tipo === 'pie'
                ? [{
                    label: 'Publicacoes',
                    data: postsPorGrupo,
                    backgroundColor: ['#1a3c2c', '#ff9800', '#1565c0', '#6a1b9a', '#2e7d32'],
                }]
                : [
                    {
                        label: 'Publicacoes',
                        data: postsPorGrupo,
                        backgroundColor: '#1a3c2c',
                        borderColor: '#1a3c2c',
                        tension: 0.3,
                    },
                    {
                        label: 'Comentarios',
                        data: comentariosPorGrupo,
                        backgroundColor: '#ff9800',
                        borderColor: '#ff9800',
                        tension: 0.3,
                    },
                ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
            },
            scales: tipo === 'pie' ? {} : {
                y: { beginAtZero: true, ticks: { precision: 0 } },
            },
        },
    });
}

function renderizarRelatorioComunidade() {
    const filtros = lerFiltrosRelatorio();
    const filtrados = ordenarPostsRelatorio(filtrarPostsRelatorio(comunidadePostsCache, filtros));

    renderizarResumoRelatorio(filtrados);
    renderizarTabelaRelatorio(filtrados);
    renderizarGraficoRelatorio(filtrados, filtros);
}

function atualizarOrdenacaoRelatorio(campo) {
    if (relatorioOrdenacao.campo === campo) {
        relatorioOrdenacao.direcao = relatorioOrdenacao.direcao === 'asc' ? 'desc' : 'asc';
    } else {
        relatorioOrdenacao = {
            campo,
            direcao: campo === 'criadoEm' || campo === 'comentarios' ? 'desc' : 'asc',
        };
    }

    renderizarRelatorioComunidade();
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

function nomeArquivoExportacao(resposta, formato) {
    const disposition = resposta.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/i);
    if (match?.[1]) return match[1];

    const data = new Date().toISOString().slice(0, 10);
    return `comunidade-export-${data}.${formato}`;
}

async function baixarExportacaoComunidade(formato) {
    try {
        mostrarMensagemComunidade('exportMensagem', 'success', `Preparando exportacao ${formato.toUpperCase()}...`);

        const resposta = await fetch(`/api/export/comunidade?formato=${encodeURIComponent(formato)}`, {
            method: 'GET',
            credentials: 'same-origin',
        });

        if (!resposta.ok) {
            const json = await resposta.json().catch(() => null);
            throw new Error(json?.erro || 'Nao foi possivel gerar o arquivo de exportacao.');
        }

        const blob = await resposta.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = nomeArquivoExportacao(resposta, formato);
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        mostrarMensagemComunidade('exportMensagem', 'success', `Exportacao ${formato.toUpperCase()} gerada com sucesso.`);
    } catch (error) {
        mostrarMensagemComunidade('exportMensagem', 'error', error.message || 'Erro ao exportar dados.');
    }
}

function textoImagemRelatorio(imagemUrl) {
    const valor = String(imagemUrl || '').trim();
    if (!valor) return '';
    if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(valor)) {
        return `Imagem enviada por upload/base64 (${valor.length} caracteres)`;
    }
    return valor;
}

function comentariosRelatorioHtml(comentarios) {
    if (!comentarios?.length) {
        return '<p class="empty">Sem comentarios.</p>';
    }

    return `
        <ul>
            ${comentarios.map((comentario) => `
                <li>
                    <strong>${escaparHtml(comentario.autor || comentario.autorNome || 'Usuario')}:</strong>
                    ${escaparHtml(comentario.texto || '')}
                    <span>${escaparHtml(formatarDataComunidade(comentario.criadoEm))}</span>
                </li>
            `).join('')}
        </ul>
    `;
}

function montarRelatorioComunidadeHtml(dados) {
    const posts = dados.posts || [];
    const geradoEm = formatarDataComunidade(dados.geradoEm || new Date());

    return `<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <title>Relatorio da Comunidade</title>
    <style>
        body {
            color: #1f2933;
            font-family: Arial, sans-serif;
            line-height: 1.5;
            margin: 32px;
        }
        h1 {
            color: #1a3c2c;
            margin-bottom: 4px;
        }
        .meta {
            color: #5f6f7a;
            margin-bottom: 24px;
        }
        article {
            border-top: 1px solid #d8dee4;
            break-inside: avoid;
            padding: 18px 0;
        }
        h2 {
            font-size: 18px;
            margin: 0 0 8px;
        }
        p {
            margin: 6px 0;
        }
        .label {
            color: #52616b;
            font-weight: 700;
        }
        .image-url {
            overflow-wrap: anywhere;
        }
        ul {
            margin: 8px 0 0 18px;
            padding: 0;
        }
        li {
            margin-bottom: 6px;
        }
        li span {
            color: #6b7780;
            display: block;
            font-size: 12px;
        }
        .empty {
            color: #6b7780;
            font-style: italic;
        }
        @media print {
            body {
                margin: 18mm;
            }
        }
    </style>
</head>
<body>
    <h1>Relatorio da Comunidade</h1>
    <div class="meta">
        Gerado em ${escaparHtml(geradoEm)}<br>
        Total de posts: ${escaparHtml(posts.length)}
    </div>
    ${posts.length ? posts.map((post) => {
        const imagem = textoImagemRelatorio(post.imagemUrl);

        return `
            <article>
                <h2>${escaparHtml(post.autor || 'Usuario')}</h2>
                <p><span class="label">Data:</span> ${escaparHtml(formatarDataComunidade(post.criadoEm))}</p>
                <p><span class="label">Legenda:</span> ${escaparHtml(post.legenda || '')}</p>
                ${imagem ? `<p class="image-url"><span class="label">Imagem:</span> ${escaparHtml(imagem)}</p>` : ''}
                <p><span class="label">Comentarios:</span> ${escaparHtml(post.quantidadeComentarios || 0)}</p>
                ${comentariosRelatorioHtml(post.comentarios || [])}
            </article>
        `;
    }).join('') : '<p class="empty">Nenhum post encontrado para exportacao.</p>'}
</body>
</html>`;
}

async function imprimirExportacaoComunidadePdf() {
    let janela = null;

    try {
        mostrarMensagemComunidade('exportMensagem', 'success', 'Preparando relatorio imprimivel...');

        janela = window.open('', '_blank');
        if (!janela) {
            throw new Error('Permita pop-ups para abrir o relatorio imprimivel.');
        }

        janela.document.open();
        janela.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatorio da Comunidade</title></head><body><p>Preparando relatorio...</p></body></html>');
        janela.document.close();

        const resposta = await fetch('/api/export/comunidade?formato=json', {
            method: 'GET',
            credentials: 'same-origin',
        });
        const resultado = await resposta.json().catch(() => null);

        if (!resposta.ok || !resultado?.ok) {
            throw new Error(resultado?.erro || 'Nao foi possivel gerar o relatorio.');
        }

        janela.document.open();
        janela.document.write(montarRelatorioComunidadeHtml(resultado.dados || {}));
        janela.document.close();
        janela.focus();
        setTimeout(() => janela.print(), 300);

        mostrarMensagemComunidade('exportMensagem', 'success', 'Relatorio aberto. Use a impressao do navegador para salvar em PDF.');
    } catch (error) {
        if (janela && !janela.closed) {
            janela.document.open();
            janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Erro na exportacao</title></head><body><p>${escaparHtml(error.message || 'Erro ao gerar PDF.')}</p></body></html>`);
            janela.document.close();
        }
        mostrarMensagemComunidade('exportMensagem', 'error', error.message || 'Erro ao gerar PDF.');
    }
}

async function carregarConteudoComunidade() {
    const termo = document.getElementById('buscaConteudo')?.value.trim() || '';
    const [posts, notificacoes] = await Promise.all([
        apiComunidade(`/api/posts${termo ? `?q=${encodeURIComponent(termo)}` : ''}`),
        apiComunidade('/api/notificacoes'),
    ]);

    if (posts.ok) {
        comunidadePostsCache = posts.dados.posts || [];
        renderizarPosts(comunidadePostsCache);
        renderizarRelatorioComunidade();
    }
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
    document.getElementById('btnExportarComunidadeCsv')?.addEventListener('click', () => baixarExportacaoComunidade('csv'));
    document.getElementById('btnExportarComunidadeJson')?.addEventListener('click', () => baixarExportacaoComunidade('json'));
    document.getElementById('btnExportarComunidadePdf')?.addEventListener('click', imprimirExportacaoComunidadePdf);
    document.getElementById('buscaConteudo')?.addEventListener('input', () => {
        clearTimeout(window._communitySearchTimer);
        window._communitySearchTimer = setTimeout(carregarConteudoComunidade, 350);
    });
    [
        'relatorioDataInicio',
        'relatorioDataFim',
        'relatorioTipo',
        'relatorioStatus',
        'relatorioCategoria',
        'relatorioUsuario',
        'relatorioBusca',
        'relatorioAgrupar',
        'relatorioGraficoTipo',
    ].forEach((id) => {
        document.getElementById(id)?.addEventListener('input', renderizarRelatorioComunidade);
        document.getElementById(id)?.addEventListener('change', renderizarRelatorioComunidade);
    });
    document.querySelectorAll('[data-report-sort]').forEach((botao) => {
        botao.addEventListener('click', () => atualizarOrdenacaoRelatorio(botao.dataset.reportSort));
    });
    document.getElementById('listaPosts')?.addEventListener('click', (e) => {
        const botao = e.target.closest('[data-share-toggle]');
        if (botao) alternarFormularioCompartilhamento(botao);
    });
    document.getElementById('listaPosts')?.addEventListener('submit', (e) => {
        const form = e.target.closest('.share-form');
        if (!form) return;

        e.preventDefault();
        compartilharPost(form);
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
