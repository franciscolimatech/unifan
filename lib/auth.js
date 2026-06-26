/**
 * lib/auth.js
 *
 * Utilitários de autenticação:
 *  - Geração e verificação de JWT
 *  - Serialização/leitura de cookie httpOnly seguro
 *  - Middleware de proteção de rotas
 */

'use strict';

const jwt = require('jsonwebtoken');
const cookie = require('cookie');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '8h';
const COOKIE_NAME = 'cristovao_session';

if (!JWT_SECRET) {
  throw new Error(
    '[Auth] A variável de ambiente JWT_SECRET não está definida.\n' +
    'Gere um segredo forte: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
  );
}

// ─── JWT ───────────────────────────────────────────────────────────────────

function gerarToken(payload) {
  return jwt.sign(
    {
      sub: payload._id.toString(),
      nome: payload.nome,
      email: payload.email,
      versaoTermosAceita: payload.versaoTermosAceita || null,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' }
  );
}

function verificarToken(token) {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
}

// ─── Cookie ────────────────────────────────────────────────────────────────

function serializarCookieSessao(token) {
  const isProducao = process.env.NODE_ENV === 'production';
  return cookie.serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProducao,
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60,
  });
}

function serializarCookieLogout() {
  return cookie.serialize(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
}

function extrairTokenDaCookia(req) {
  if (!req.headers.cookie) return null;
  const cookies = cookie.parse(req.headers.cookie);
  return cookies[COOKIE_NAME] || null;
}

// ─── Middleware de autenticação ────────────────────────────────────────────
// CORRIGIDO: substituído res.status().json() (Express/Next.js) pelo
// res.writeHead() + res.end() nativo do Node.js, compatível com Vercel puro.

function _responderJson(res, status, corpo) {
  const json = JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

function verificarSessaoReq(req, res) {
  const token = extrairTokenDaCookia(req);

  if (!token) {
    _responderJson(res, 401, {
      ok: false,
      erro: 'Sessão não encontrada. Faça login.',
      codigo: 'SEM_SESSAO',
    });
    return { usuario: null };
  }

  try {
    const usuario = verificarToken(token);
    return { usuario };
  } catch (err) {
    res.setHeader('Set-Cookie', serializarCookieLogout());
    _responderJson(res, 401, {
      ok: false,
      erro: 'Sessão expirada. Faça login novamente.',
      codigo: 'SESSAO_EXPIRADA',
    });
    return { usuario: null };
  }
}

// ─── Validação de e-mail ───────────────────────────────────────────────────

function emailValido(email) {
  if (typeof email !== 'string') return false;
  return (
    email.length <= 254 &&
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(email)
  );
}

module.exports = {
  gerarToken,
  verificarToken,
  serializarCookieSessao,
  serializarCookieLogout,
  extrairTokenDaCookia,
  verificarSessaoReq,
  emailValido,
  COOKIE_NAME,
};