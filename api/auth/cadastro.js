/**
 * api/auth/cadastro.js
 *
 * POST /api/auth/cadastro
 *
 * Registra um novo usuário no MongoDB.
 * A senha e a resposta de recuperação são armazenadas com bcrypt (12 rounds).
 * O usuário recebe um JWT de sessão via cookie httpOnly logo após o cadastro.
 *
 * Body JSON esperado:
 * {
 *   "nome":               "Ana Souza",
 *   "email":              "ana@exemplo.com",
 *   "senha":              "MinhaSenh@123",
 *   "confirmarSenha":     "MinhaSenh@123",
 *   "perguntaRecuperacao": "Nome do seu primeiro pet?",
 *   "respostaRecuperacao": "bolinha",
 *   "aceitouTermos":      true,
 *   "versaoTermos":       "1.0.0" // opcional; o backend grava a versao atual
 * }
 *
 * Respostas:
 *   201 - Conta criada. Cookie de sessão setado. Retorna dados públicos do usuário.
 *   400 - Validação falhou (campos faltando, e-mail inválido, senhas divergem etc.)
 *   409 - E-mail já cadastrado
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
const BCRYPT_ROUNDS = 12;

module.exports = async function handler(req, res) {
  // ── Aceita apenas POST ──────────────────────────────────────────────
  if (req.method !== 'POST') {
    return metodaNaoPermitido(res, ['POST']);
  }

  // ── Extração e sanitização dos campos ──────────────────────────────
  const {
    nome,
    email,
    senha,
    confirmarSenha,
    perguntaRecuperacao,
    respostaRecuperacao,
    aceitouTermos,
  } = req.body || {};

  const nomeLimpo        = typeof nome === 'string' ? nome.trim() : '';
  const emailLimpo       = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const perguntaLimpa    = typeof perguntaRecuperacao === 'string' ? perguntaRecuperacao.trim() : '';
  const respostaLimpa    = typeof respostaRecuperacao === 'string' ? respostaRecuperacao.trim().toLowerCase() : '';

  // ── Validações de negócio ───────────────────────────────────────────
  if (!nomeLimpo || !emailLimpo || !senha || !confirmarSenha || !perguntaLimpa || !respostaLimpa) {
    return erro(res, 'Preencha todos os campos para criar a conta.', 400, 'CAMPOS_FALTANDO');
  }

  if (nomeLimpo.length < 2 || nomeLimpo.length > 100) {
    return erro(res, 'O nome deve ter entre 2 e 100 caracteres.', 400, 'NOME_INVALIDO');
  }

  if (!emailValido(emailLimpo)) {
    return erro(res, 'Informe um e-mail válido.', 400, 'EMAIL_INVALIDO');
  }

  if (typeof senha !== 'string' || senha.length < 6) {
    return erro(res, 'A senha precisa ter pelo menos 6 caracteres.', 400, 'SENHA_CURTA');
  }

  if (senha !== confirmarSenha) {
    return erro(res, 'A senha e a confirmação precisam ser iguais.', 400, 'SENHAS_DIVERGEM');
  }

  if (aceitouTermos !== true) {
    return erro(res, 'Você precisa aceitar os Termos de Uso e a Política de Privacidade.', 400, 'TERMOS_NAO_ACEITOS');
  }

  // ── Operações de banco ──────────────────────────────────────────────
  try {
    const db = await getDb();
    const colecao = db.collection('users');

    // Verificar duplicidade de e-mail
    const existente = await colecao.findOne(
      { email: emailLimpo },
      { projection: { _id: 1 } }
    );

    if (existente) {
      return erro(res, 'Já existe uma conta cadastrada com este e-mail.', 409, 'EMAIL_DUPLICADO');
    }

    // Hash das credenciais sensíveis com bcrypt
    const [senhaHash, respostaHash] = await Promise.all([
      bcrypt.hash(senha, BCRYPT_ROUNDS),
      bcrypt.hash(respostaLimpa, BCRYPT_ROUNDS),
    ]);

    const agora = new Date();

    const novoUsuario = {
      nome: nomeLimpo,
      email: emailLimpo,
      senhaHash,
      perguntaRecuperacao: perguntaLimpa,
      respostaRecuperacaoHash: respostaHash,
      versaoTermosAceita: VERSAO_TERMOS_ATUAL,
      dataAceiteTermos: agora,
      avatar: null,
      criadoEm: agora,
      atualizadoEm: agora,
    };

    const resultado = await colecao.insertOne(novoUsuario);

    // Gera sessão imediata após cadastro
    const payloadToken = {
      _id: resultado.insertedId,
      nome: nomeLimpo,
      email: emailLimpo,
      versaoTermosAceita: VERSAO_TERMOS_ATUAL,
    };

    const token = gerarToken(payloadToken);

    res.setHeader('Set-Cookie', serializarCookieSessao(token));

    return sucesso(
      res,
      {
        mensagem: 'Conta criada com sucesso.',
        usuario: {
          id: resultado.insertedId.toString(),
          nome: nomeLimpo,
          email: emailLimpo,
          versaoTermosAceita: VERSAO_TERMOS_ATUAL,
        },
        versaoTermosAtual: VERSAO_TERMOS_ATUAL,
      },
      201
    );
  } catch (err) {
    // Índice único violado em race condition (dois cadastros simultâneos)
    if (err.code === 11000) {
      return erro(res, 'Já existe uma conta cadastrada com este e-mail.', 409, 'EMAIL_DUPLICADO');
    }

    console.error('[cadastro] Erro interno:', err);
    return erro(res, 'Não foi possível criar a conta. Tente novamente.', 500, 'ERRO_INTERNO');
  }
};
