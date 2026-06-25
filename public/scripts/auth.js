/**
 * public/auth.js
 *
 * Módulo de Autenticação — Frontend Refatorado
 * ─────────────────────────────────────────────────────────────────────────────
 * MIGRAÇÃO: localStorage/sessionStorage → API REST + Cookie httpOnly
 *
 * O que mudou em relação ao protótipo original:
 *  ❌ REMOVIDO  localStorage.setItem / getItem (usuários e sessão)
 *  ❌ REMOVIDO  sessionStorage.setItem / getItem
 *  ❌ REMOVIDO  gerarHashSHA256 no frontend (bcrypt agora é responsabilidade do backend)
 *  ❌ REMOVIDO  buscarUsuarioPorEmail, obterUsuarios, salvarUsuarios
 *  ✅ ADICIONADO fetch() para todas as operações de auth
 *  ✅ ADICIONADO verificação de sessão via GET /api/auth/sessao no page load
 *  ✅ ADICIONADO fluxo de aceite de termos pós-login via modal bloqueante
 *  ✅ ADICIONADO tratamento de erros padronizado com códigos de erro da API
 *
 * Fluxo de sessão:
 *   1. Page load → GET /api/auth/sessao
 *      - 200: aplica sessão (usuário já logado via cookie httpOnly)
 *      - 401: bloqueia sistema, exibe modal de login
 *   2. Login → POST /api/auth/login
 *      - 200 + precisaAceitarTermos=false: aplica sessão
 *      - 200 + precisaAceitarTermos=true:  exibe modal de aceite de termos
 *   3. Aceite de termos → POST /api/usuarios/aceitar-termos
 *      - 200: aplica sessão
 *   4. Logout → POST /api/auth/logout → bloqueia sistema
 */

'use strict';

// ─── Constantes ────────────────────────────────────────────────────────────────

const VERSAO_TERMOS_ATUAL = '1.0.0';

// ─── Utilitários de UI ─────────────────────────────────────────────────────────

function mostrarAuthMensagem(tipo, mensagem) {
  const el = document.getElementById('authMensagem');
  if (!el) return;
  el.textContent = mensagem;
  el.className = `auth-message ${tipo}`;
  el.hidden = false;
}

function limparAuthMensagem() {
  const el = document.getElementById('authMensagem');
  if (!el) return;
  el.textContent = '';
  el.className = 'auth-message';
  el.hidden = true;
}

function setCarregando(botaoId, carregando, textoOriginal) {
  const btn = document.getElementById(botaoId);
  if (!btn) return;
  btn.disabled = carregando;
  btn.textContent = carregando ? 'Aguarde...' : textoOriginal;
}

function termosForamAceitos(tipo) {
  const id = tipo === 'cadastro' ? 'authCadastroAceiteTermos' : 'authLoginAceiteTermos';
  return Boolean(document.getElementById(id)?.checked);
}

function atualizarEstadoBotoesTermos() {
  const btnLogin   = document.getElementById('btnAuthLogin');
  const btnCadastro = document.getElementById('btnAuthCadastro');
  const btnAceitarTermos = document.getElementById('btnAceitarTermos');
  if (btnLogin)    btnLogin.disabled    = !termosForamAceitos('login');
  if (btnCadastro) btnCadastro.disabled = !termosForamAceitos('cadastro');
  if (btnAceitarTermos) {
    btnAceitarTermos.disabled = !document.getElementById('authTermsAceiteCheck')?.checked;
  }
}

function validarEmailFrontend(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ─── Gerenciamento de estado de sessão (em memória, sem storage) ───────────────

/**
 * Estado da sessão mantido em memória enquanto a página está aberta.
 * Ao recarregar, o estado é restaurado via GET /api/auth/sessao.
 *
 * NÃO persistir isso em localStorage — o cookie httpOnly é a fonte de verdade.
 */
let sessaoAtual = null;

function setSessao(dadosUsuario) {
  sessaoAtual = dadosUsuario;
}

function getSessao() {
  return sessaoAtual;
}

function limparSessaoMemoria() {
  sessaoAtual = null;
}

// ─── Wrapper de fetch para a API ───────────────────────────────────────────────

/**
 * Wrapper de fetch configurado para sempre:
 *  - enviar cookies (credentials: 'same-origin')
 *  - serializar body como JSON
 *  - retornar o envelope { ok, dados, erro, codigo } já parseado
 *
 * @param {string} url
 * @param {'GET'|'POST'|'PUT'|'DELETE'} metodo
 * @param {object} [body]
 * @returns {Promise<{ httpStatus: number, ok: boolean, dados?: object, erro?: string, codigo?: string }>}
 */
async function chamarAPI(url, metodo = 'GET', body = null) {
  const opcoes = {
    method: metodo,
    // 'same-origin': envia cookies apenas para o mesmo domínio (seguro)
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  };

  if (body) {
    opcoes.body = JSON.stringify(body);
  }

  const resposta = await fetch(url, opcoes);
  const json = await resposta.json();

  return { httpStatus: resposta.status, ...json };
}

// ─── Aplicar / Bloquear sistema ────────────────────────────────────────────────

function aplicarSessao(usuario) {
  setSessao(usuario);

  document.body.classList.remove('auth-bloqueado');
  document.querySelector('.squad-nav')?.classList.remove('auth-locked');
  document.querySelector('.dashboard')?.classList.remove('auth-locked');

  const areaUsuario = document.getElementById('areaUsuarioLogado');
  const nomeUsuario = document.getElementById('nomeUsuarioLogado');
  if (areaUsuario) areaUsuario.hidden = false;
  if (nomeUsuario) nomeUsuario.textContent = usuario.nome;

  document.getElementById('modalAuth')?.classList.remove('open');
  limparAuthMensagem();
}

function bloquearSistema() {
  limparSessaoMemoria();

  document.body.classList.add('auth-bloqueado');
  document.querySelector('.squad-nav')?.classList.add('auth-locked');
  document.querySelector('.dashboard')?.classList.add('auth-locked');
  document.getElementById('areaUsuarioLogado')?.setAttribute('hidden', '');
  document.getElementById('modalAuth')?.classList.add('open');
  abrirAbaAuth('login');
  atualizarEstadoBotoesTermos();
  mostrarAuthMensagem('info', 'ℹ️ Faça login para acessar o sistema.');
}

// ─── Verificação de sessão no carregamento da página ──────────────────────────

/**
 * Chamado no DOMContentLoaded.
 * Verifica com o backend se o cookie de sessão atual é válido.
 * Substitui completamente a verificação via localStorage do protótipo original.
 */
async function verificarSessao() {
  try {
    const resultado = await chamarAPI('/api/auth/sessao', 'GET');

    if (resultado.httpStatus === 200 && resultado.ok) {
      const { usuario, precisaAceitarTermos } = resultado.dados;

      if (precisaAceitarTermos) {
        // Mantém o sistema bloqueado até o backend registrar o novo aceite.
        setSessao(usuario);
        exibirModalAceiteTermos(usuario);
        return;
      }

      aplicarSessao(usuario);
    } else {
      // 401 ou outro erro: sem sessão válida
      bloquearSistema();
    }
  } catch (error) {
    // Erro de rede (ex: offline): bloqueia por segurança
    console.error('[auth] Erro ao verificar sessão:', error);
    bloquearSistema();
  }
}

// ─── Login ─────────────────────────────────────────────────────────────────────

async function loginUsuario() {
  limparAuthMensagem();

  if (!termosForamAceitos('login')) {
    mostrarAuthMensagem('erro', 'Você precisa aceitar os Termos de Uso e a Política de Privacidade.');
    atualizarEstadoBotoesTermos();
    return;
  }

  const email = document.getElementById('authLoginEmail')?.value.trim().toLowerCase() || '';
  const senha = document.getElementById('authLoginSenha')?.value || '';

  if (!validarEmailFrontend(email) || !senha) {
    mostrarAuthMensagem('erro', 'Informe e-mail e senha para entrar.');
    return;
  }

  setCarregando('btnAuthLogin', true, 'Entrar');

  try {
    const resultado = await chamarAPI('/api/auth/login', 'POST', { email, senha });

    if (resultado.ok) {
      const { usuario, precisaAceitarTermos } = resultado.dados;

      if (precisaAceitarTermos) {
        // Login OK, mas termos desatualizados: bloquear em modal de termos
        // A sessão já está ativa no cookie, mas forçamos o aceite antes de liberar
        setSessao(usuario);
        document.getElementById('modalAuth')?.classList.remove('open');
        exibirModalAceiteTermos(usuario);
        return;
      }

      aplicarSessao(usuario);
      return;
    }

    // Tratar erros específicos da API
    switch (resultado.codigo) {
      case 'CREDENCIAIS_INVALIDAS':
        mostrarAuthMensagem('erro', 'E-mail ou senha incorretos.');
        break;
      case 'CAMPOS_FALTANDO':
      case 'EMAIL_INVALIDO':
        mostrarAuthMensagem('erro', resultado.erro);
        break;
      default:
        mostrarAuthMensagem('erro', resultado.erro || 'Não foi possível efetuar o login.');
    }
  } catch (error) {
    console.error('[auth] Erro no login:', error);
    mostrarAuthMensagem('erro', 'Erro de conexão. Verifique sua internet e tente novamente.');
  } finally {
    setCarregando('btnAuthLogin', false, 'Entrar');
    atualizarEstadoBotoesTermos();
  }
}

// ─── Cadastro ──────────────────────────────────────────────────────────────────

async function cadastrarUsuario() {
  limparAuthMensagem();

  const nome            = document.getElementById('authCadastroNome')?.value.trim() || '';
  const email           = document.getElementById('authCadastroEmail')?.value.trim().toLowerCase() || '';
  const senha           = document.getElementById('authCadastroSenha')?.value || '';
  const confirmarSenha  = document.getElementById('authCadastroConfirmarSenha')?.value || '';
  const pergunta        = document.getElementById('authCadastroPergunta')?.value.trim() || '';
  const resposta        = document.getElementById('authCadastroResposta')?.value.trim().toLowerCase() || '';

  // Validações no frontend (duplicadas no backend — defesa em profundidade)
  if (!termosForamAceitos('cadastro')) {
    mostrarAuthMensagem('erro', 'Você precisa aceitar os Termos de Uso e a Política de Privacidade.');
    atualizarEstadoBotoesTermos();
    return;
  }

  if (!nome || !email || !senha || !confirmarSenha || !pergunta || !resposta) {
    mostrarAuthMensagem('erro', 'Preencha todos os campos para criar a conta.');
    return;
  }

  if (!validarEmailFrontend(email)) {
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

  setCarregando('btnAuthCadastro', true, 'Criar Conta');

  try {
    const resultado = await chamarAPI('/api/auth/cadastro', 'POST', {
      nome,
      email,
      senha,
      confirmarSenha,
      perguntaRecuperacao: pergunta,
      respostaRecuperacao: resposta,
      aceitouTermos: true,
      versaoTermos: VERSAO_TERMOS_ATUAL,
    });

    if (resultado.ok) {
      // Cadastro + login automático: sessão já foi criada pelo backend
      aplicarSessao(resultado.dados.usuario);
      return;
    }

    switch (resultado.codigo) {
      case 'EMAIL_DUPLICADO':
        mostrarAuthMensagem('erro', 'Já existe uma conta cadastrada com este e-mail.');
        break;
      case 'SENHAS_DIVERGEM':
        mostrarAuthMensagem('erro', 'A senha e a confirmação precisam ser iguais.');
        break;
      default:
        mostrarAuthMensagem('erro', resultado.erro || 'Não foi possível criar a conta.');
    }
  } catch (error) {
    console.error('[auth] Erro no cadastro:', error);
    mostrarAuthMensagem('erro', 'Erro de conexão. Verifique sua internet e tente novamente.');
  } finally {
    setCarregando('btnAuthCadastro', false, 'Criar Conta');
    atualizarEstadoBotoesTermos();
  }
}

// ─── Aceite de Termos (modal pós-login) ────────────────────────────────────────

/**
 * Exibe o modal bloqueante de aceite de termos.
 * Chamado quando o backend sinaliza precisaAceitarTermos: true.
 */
function exibirModalAceiteTermos(usuario) {
  const modal = document.getElementById('modalAceiteTermos');
  if (!modal) {
    console.error('[auth] Modal de aceite de termos (#modalAceiteTermos) não encontrado no DOM.');
    bloquearSistema();
    mostrarAuthMensagem('erro', 'Não foi possível exibir os termos atualizados. Recarregue a página.');
    return;
  }

  document.body.classList.add('auth-bloqueado');
  document.querySelector('.squad-nav')?.classList.add('auth-locked');
  document.querySelector('.dashboard')?.classList.add('auth-locked');
  document.getElementById('modalAuth')?.classList.remove('open');

  // Preenche nome do usuário no modal, se houver placeholder
  const nomeEl = modal.querySelector('[data-usuario-nome]');
  if (nomeEl) nomeEl.textContent = usuario.nome;

  const checkbox = document.getElementById('authTermsAceiteCheck');
  if (checkbox) checkbox.checked = false;

  const mensagem = document.getElementById('authTermosMensagem');
  if (mensagem) {
    mensagem.textContent = '';
    mensagem.hidden = true;
  }

  atualizarEstadoBotoesTermos();
  modal.classList.add('open');
}

/**
 * Chamado quando o usuário clica em "Aceitar" no modal de termos pós-login.
 */
async function aceitarTermos() {
  const btnAceitar = document.getElementById('btnAceitarTermos');
  const checkbox = document.getElementById('authTermsAceiteCheck');
  const mensagem = document.getElementById('authTermosMensagem');

  if (!checkbox?.checked) {
    if (mensagem) {
      mensagem.textContent = 'Marque a confirmação de leitura e aceite para continuar.';
      mensagem.hidden = false;
    }
    atualizarEstadoBotoesTermos();
    return;
  }

  if (mensagem) {
    mensagem.textContent = '';
    mensagem.hidden = true;
  }

  if (btnAceitar) btnAceitar.disabled = true;

  try {
    const resultado = await chamarAPI('/api/usuarios/aceitar-termos', 'POST', {
      versaoTermos: VERSAO_TERMOS_ATUAL,
    });

    if (resultado.ok) {
      document.getElementById('modalAceiteTermos')?.classList.remove('open');

      const sessao = getSessao();
      if (sessao) {
        aplicarSessao({ ...sessao, versaoTermosAceita: VERSAO_TERMOS_ATUAL });
      } else {
        // Sessão não estava em memória: reverificar
        await verificarSessao();
      }
      return;
    }

    if (mensagem) {
      mensagem.textContent = resultado.erro || 'Não foi possível registrar o aceite dos termos.';
      mensagem.hidden = false;
    }
  } catch (error) {
    console.error('[auth] Erro ao aceitar termos:', error);
    if (mensagem) {
      mensagem.textContent = 'Erro de conexão ao registrar aceite. Tente novamente.';
      mensagem.hidden = false;
    }
  } finally {
    atualizarEstadoBotoesTermos();
  }
}

// ─── Recuperação de Senha ──────────────────────────────────────────────────────

async function recuperarSenha() {
  limparAuthMensagem();

  const email           = document.getElementById('authRecEmail')?.value.trim().toLowerCase() || '';
  const pergunta        = document.getElementById('authRecPergunta')?.value.trim() || '';
  const resposta        = document.getElementById('authRecResposta')?.value.trim().toLowerCase() || '';
  const novaSenha       = document.getElementById('authRecNovaSenha')?.value || '';
  const confirmarSenha  = document.getElementById('authRecConfirmarSenha')?.value || '';

  if (!validarEmailFrontend(email)) {
    mostrarAuthMensagem('erro', 'Informe um e-mail válido.');
    return;
  }

  if (!pergunta || !resposta) {
    mostrarAuthMensagem('erro', 'Informe a pergunta e a resposta de recuperação.');
    return;
  }

  if (!novaSenha) {
    mostrarAuthMensagem('erro', 'Informe a nova senha.');
    return;
  }

  if (!confirmarSenha) {
    mostrarAuthMensagem('erro', 'Confirme a nova senha.');
    return;
  }

  if (novaSenha.length < 6) {
    mostrarAuthMensagem('erro', 'A nova senha precisa ter pelo menos 6 caracteres.');
    return;
  }

  if (novaSenha !== confirmarSenha) {
    mostrarAuthMensagem('erro', 'A nova senha e a confirmação precisam ser iguais.');
    return;
  }

  setCarregando('btnAuthRecuperar', true, 'Redefinir Senha');

  try {
    const resultado = await chamarAPI('/api/auth/recuperar-senha', 'POST', {
      email,
      perguntaRecuperacao: pergunta,
      respostaRecuperacao: resposta,
      novaSenha,
      confirmarNovaSenha: confirmarSenha,
    });

    if (resultado.ok) {
      document.getElementById('authLoginEmail').value = email;
      voltarParaLogin();
      mostrarAuthMensagem('sucesso', 'Senha redefinida com sucesso. Entre com a nova senha.');
      return;
    }

    switch (resultado.codigo) {
      case 'RECUPERACAO_INVALIDA':
        mostrarAuthMensagem('erro', 'Dados de recuperação incorretos. Verifique e-mail, pergunta e resposta.');
        break;
      default:
        mostrarAuthMensagem('erro', resultado.erro || 'Não foi possível redefinir a senha.');
    }
  } catch (error) {
    console.error('[auth] Erro na recuperação de senha:', error);
    mostrarAuthMensagem('erro', 'Erro de conexão. Tente novamente.');
  } finally {
    setCarregando('btnAuthRecuperar', false, 'Redefinir Senha');
  }
}

// ─── Logout ────────────────────────────────────────────────────────────────────

async function logout() {
  try {
    // Chama o backend para apagar o cookie httpOnly
    // (o frontend não consegue fazer isso diretamente — httpOnly é intencional)
    await chamarAPI('/api/auth/logout', 'POST');
  } catch (error) {
    console.error('[auth] Erro no logout (continuando):', error);
    // Mesmo com erro de rede, limpa o estado local e bloqueia a UI
  }

  // Limpa campos do formulário de login
  const senhaInput = document.getElementById('authLoginSenha');
  const termosCheck = document.getElementById('authLoginAceiteTermos');
  if (senhaInput) senhaInput.value = '';
  if (termosCheck) termosCheck.checked = false;

  bloquearSistema();
}

// ─── Navegação entre abas do modal de auth ─────────────────────────────────────

function abrirAbaAuth(aba) {
  if (!['login', 'cadastro'].includes(aba)) return;

  const titulo    = document.getElementById('authModalTitulo');
  const subtitulo = document.getElementById('authModalSubtitulo');
  const icone     = document.querySelector('#authModalIcon i');

  if (titulo)    titulo.textContent    = 'Acesso ao Sistema';
  if (subtitulo) subtitulo.textContent = 'Entre com sua conta para acessar a plataforma Cristóvão';
  if (icone)     icone.className       = 'fas fa-lock';

  document.querySelectorAll('[data-auth-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.authTab === aba);
  });
  document.querySelectorAll('[data-auth-panel]').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.authPanel === aba);
  });

  atualizarEstadoBotoesTermos();
  limparAuthMensagem();
}

function abrirRecuperacaoSenha() {
  const titulo    = document.getElementById('authModalTitulo');
  const subtitulo = document.getElementById('authModalSubtitulo');
  const icone     = document.querySelector('#authModalIcon i');

  if (titulo)    titulo.textContent    = 'Recuperar Senha';
  if (subtitulo) subtitulo.textContent = 'Confirme seus dados para redefinir o acesso.';
  if (icone)     icone.className       = 'fas fa-key';

  document.querySelectorAll('[data-auth-tab]').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('[data-auth-panel]').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.authPanel === 'recuperacao');
  });

  const emailLogin = document.getElementById('authLoginEmail')?.value.trim();
  if (emailLogin) {
    const emailRec = document.getElementById('authRecEmail');
    if (emailRec) emailRec.value = emailLogin;
  }

  limparAuthMensagem();
}

function voltarParaLogin() {
  abrirAbaAuth('login');
}

// ─── Toggle de visibilidade de senha ──────────────────────────────────────────

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

// ─── Inicialização ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Listeners de checkboxes de termos
  document.querySelectorAll('.auth-terms-input').forEach(checkbox => {
    checkbox.addEventListener('change', atualizarEstadoBotoesTermos);
  });

  // Clicar na área de termos também marca/desmarca o checkbox
  document.querySelectorAll('.auth-terms').forEach(area => {
    area.addEventListener('click', (e) => {
      if (e.target.closest('a') ||
          e.target.closest('label') ||
          e.target.classList.contains('auth-terms-input') ||
          e.target.classList.contains('auth-terms-check')) return;

      const checkbox = area.querySelector('.auth-terms-input');
      if (!checkbox) return;
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  // Fechar modais clicando fora (exceto modal de auth sem sessão)
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target !== overlay) return;

      if (overlay.id === 'modalAuth' && !getSessao()) {
        mostrarAuthMensagem('info', 'ℹ️ Faça login para acessar o sistema.');
        return;
      }

      if (overlay.id === 'modalAceiteTermos') {
        return;
      }

      overlay.classList.remove('open');
    });
  });

  // Logout
  document.getElementById('btnLogout')?.addEventListener('click', logout);

  // Aceite de termos pós-login
  document.getElementById('btnAceitarTermos')?.addEventListener('click', aceitarTermos);

  atualizarEstadoBotoesTermos();

  // ── Verificar sessão com o backend ao carregar a página ──
  // Substitui o verificarSessao() original que lia do localStorage
  verificarSessao();
});
