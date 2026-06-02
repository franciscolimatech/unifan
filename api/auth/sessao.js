/**
 * api/auth/sessao.js
 *
 * GET /api/auth/sessao
 *
 * Verifica se a sessão atual é válida sem reautenticar.
 * O frontend chama esta rota no carregamento da página para restaurar
 * o estado do usuário logado sem depender de localStorage.
 *
 * Respostas:
 *   200 - Sessão válida. Retorna dados públicos do usuário.
 *   401 - Sem sessão ou token expirado/inválido.
 */

'use strict';

const { verificarSessaoReq } = require('../../lib/auth');
const { sucesso, metodaNaoPermitido } = require('../../lib/resposta');

const VERSAO_TERMOS_ATUAL = process.env.VERSAO_TERMOS_ATUAL || '1.0.0';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return metodaNaoPermitido(res, ['GET']);
  }

  const { usuario } = verificarSessaoReq(req, res);
  if (!usuario) return; // verificarSessaoReq já enviou 401

  return sucesso(res, {
    usuario: {
      id: usuario.sub,
      nome: usuario.nome,
      email: usuario.email,
      versaoTermosAceita: usuario.versaoTermosAceita || null,
    },
    precisaAceitarTermos: usuario.versaoTermosAceita !== VERSAO_TERMOS_ATUAL,
    versaoTermosAtual: VERSAO_TERMOS_ATUAL,
  });
};
