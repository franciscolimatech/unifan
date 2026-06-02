/**
 * api/auth/recuperar-senha.js
 *
 * POST /api/auth/recuperar-senha
 *
 * Redefine a senha do usuário validando a pergunta e resposta de recuperação.
 *
 * Body JSON esperado:
 * {
 *   "email":              "ana@exemplo.com",
 *   "perguntaRecuperacao": "Nome do seu primeiro pet?",
 *   "respostaRecuperacao": "bolinha",
 *   "novaSenha":          "NovaSenha@456",
 *   "confirmarNovaSenha": "NovaSenha@456"
 * }
 *
 * Respostas:
 *   200 - Senha redefinida com sucesso
 *   400 - Campos faltando ou senhas divergem
 *   401 - Dados de recuperação incorretos (mensagem genérica)
 *   500 - Erro interno
 */

'use strict';

const bcrypt = require('bcryptjs');
const { getDb } = require('../../lib/mongodb');
const { emailValido } = require('../../lib/auth');
const { sucesso, erro, metodaNaoPermitido } = require('../../lib/resposta');

const BCRYPT_ROUNDS = 12;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return metodaNaoPermitido(res, ['POST']);
  }

  const {
    email,
    perguntaRecuperacao,
    respostaRecuperacao,
    novaSenha,
    confirmarNovaSenha,
  } = req.body || {};

  const emailLimpo    = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const perguntaLimpa = typeof perguntaRecuperacao === 'string' ? perguntaRecuperacao.trim() : '';
  const respostaLimpa = typeof respostaRecuperacao === 'string' ? respostaRecuperacao.trim().toLowerCase() : '';

  if (!emailLimpo || !perguntaLimpa || !respostaLimpa || !novaSenha || !confirmarNovaSenha) {
    return erro(res, 'Preencha todos os campos de recuperação.', 400, 'CAMPOS_FALTANDO');
  }

  if (!emailValido(emailLimpo)) {
    return erro(res, 'Informe um e-mail válido.', 400, 'EMAIL_INVALIDO');
  }

  if (novaSenha.length < 6) {
    return erro(res, 'A nova senha precisa ter pelo menos 6 caracteres.', 400, 'SENHA_CURTA');
  }

  if (novaSenha !== confirmarNovaSenha) {
    return erro(res, 'A nova senha e a confirmação precisam ser iguais.', 400, 'SENHAS_DIVERGEM');
  }

  try {
    const db = await getDb();
    const usuario = await db.collection('users').findOne(
      { email: emailLimpo },
      { projection: { _id: 1, perguntaRecuperacao: 1, respostaRecuperacaoHash: 1 } }
    );

    // Hash fictício para proteção de timing (mesmo sem usuário, bcrypt.compare é chamado)
    const HASH_FICTICIO = '$2a$12$invalidhashusedfortimingprotection000000000000000';
    const hashResposta = usuario ? usuario.respostaRecuperacaoHash : HASH_FICTICIO;

    const perguntaCorreta = usuario
      ? usuario.perguntaRecuperacao.trim().toLowerCase() === perguntaLimpa.toLowerCase()
      : false;

    const respostaCorreta = await bcrypt.compare(respostaLimpa, hashResposta);

    if (!usuario || !perguntaCorreta || !respostaCorreta) {
      return erro(
        res,
        'Dados de recuperação incorretos. Verifique e-mail, pergunta e resposta.',
        401,
        'RECUPERACAO_INVALIDA'
      );
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, BCRYPT_ROUNDS);

    await db.collection('users').updateOne(
      { _id: usuario._id },
      { $set: { senhaHash: novaSenhaHash, atualizadoEm: new Date() } }
    );

    return sucesso(res, { mensagem: 'Senha redefinida com sucesso. Faça login com a nova senha.' });
  } catch (err) {
    console.error('[recuperar-senha] Erro interno:', err);
    return erro(res, 'Não foi possível redefinir a senha. Tente novamente.', 500, 'ERRO_INTERNO');
  }
};
