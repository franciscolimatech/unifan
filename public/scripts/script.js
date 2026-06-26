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
