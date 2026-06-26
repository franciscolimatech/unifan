/**
 * api/auth/login.js
 *
 * POST /api/auth/login
 *
 * Autentica o usuário contra o MongoDB e emite um cookie de sessão JWT httpOnly.
 * Se o usuário ainda não aceitou a versão atual dos termos, o backend sinaliza
 * isso na resposta para que o frontend exiba o modal bloqueante de aceite.
 *
 * Body JSON esperado:
 * {
 *   "email": "ana@exemplo.com",
 *   "senha": "MinhaSenh@123"
 * }
 *
 * Respostas:
 *   200 - Login bem-sucedido. Cookie de sessão setado.
 *         { ok: true, dados: { usuario: {...}, precisaAceitarTermos: false } }
 *   200 - Login OK mas termos desatualizados.
 *         { ok: true, dados: { usuario: {...}, precisaAceitarTermos: true } }
 *   400 - Campos faltando ou e-mail inválido
 *   401 - Credenciais inválidas (mensagem genérica — não revela se o e-mail existe)
 *   500 - Erro interno
 */

'use strict';

const bcrypt = require('bcryptjs');
const { getDb } = require('../../lib/mongodb');
const {
  gerarToken,
  serializarCookieSessao,
  emailValido,
} = require('../../lib/auth');
const { sucesso, erro, metodaNaoPermitido } = require('../../lib/resposta');

const VERSAO_TERMOS_ATUAL = process.env.VERSAO_TERMOS_ATUAL || '1.0.0';

module.exports = async function handler(req, res) {
  // ── Aceita apenas POST ──────────────────────────────────────────────
  if (req.method !== 'POST') {
    return metodaNaoPermitido(res, ['POST']);
  }

  // ── Extração dos campos ─────────────────────────────────────────────
  const { email, senha } = req.body || {};

  const emailLimpo = typeof email === 'string' ? email.trim().toLowerCase() : '';

  // ── Validações básicas ──────────────────────────────────────────────
  if (!emailLimpo || !senha) {
    return erro(res, 'Informe e-mail e senha para entrar.', 400, 'CAMPOS_FALTANDO');
  }

  if (!emailValido(emailLimpo)) {
    return erro(res, 'Informe um e-mail válido.', 400, 'EMAIL_INVALIDO');
  }

  // ── Autenticação ────────────────────────────────────────────────────
  try {
    const db = await getDb();

    const usuario = await db.collection('users').findOne(
      { email: emailLimpo },
      {
        projection: {
          _id: 1,
          nome: 1,
          email: 1,
          senhaHash: 1,
          versaoTermosAceita: 1,
          dataAceiteTermos: 1,
          avatar: 1,
        },
      }
    );

    // ──────────────────────────────────────────────────────────────────
    // IMPORTANTE: mesmo que o usuário não exista, realizamos uma
    // comparação bcrypt fictícia para que o tempo de resposta seja
    // constante, evitando ataques de enumeração de usuários por timing.
    // ──────────────────────────────────────────────────────────────────
    const HASH_FICTICIO = '$2a$12$invalidhashusedfortimingprotection000000000000000';
    const hashParaComparar = usuario ? usuario.senhaHash : HASH_FICTICIO;

    const senhaCorreta = await bcrypt.compare(senha, hashParaComparar);

    if (!usuario || !senhaCorreta) {
      // Mensagem genérica: não revela se o e-mail existe ou não
      return erro(res, 'E-mail ou senha incorretos.', 401, 'CREDENCIAIS_INVALIDAS');
    }

    // ── Verificar versão dos termos ─────────────────────────────────
    const precisaAceitarTermos = usuario.versaoTermosAceita !== VERSAO_TERMOS_ATUAL;

    // ── Gerar token e setar cookie ──────────────────────────────────
    const payloadToken = {
      _id: usuario._id,
      nome: usuario.nome,
      email: usuario.email,
      versaoTermosAceita: usuario.versaoTermosAceita || null,
    };

    const token = gerarToken(payloadToken);

    res.setHeader('Set-Cookie', serializarCookieSessao(token));

    return sucesso(res, {
      usuario: {
        id: usuario._id.toString(),
        nome: usuario.nome,
        email: usuario.email,
        avatar: usuario.avatar || null,
        versaoTermosAceita: usuario.versaoTermosAceita || null,
      },
      precisaAceitarTermos,
      versaoTermosAtual: VERSAO_TERMOS_ATUAL,
    });
  } catch (err) {
    console.error('[login] Erro interno:', err);
    return erro(res, 'Não foi possível efetuar o login. Tente novamente.', 500, 'ERRO_INTERNO');
  }
};
