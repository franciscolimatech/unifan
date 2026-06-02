/**
 * api/auth/logout.js
 *
 * POST /api/auth/logout
 *
 * Encerra a sessão do usuário apagando o cookie httpOnly de sessão.
 * Como o JWT é stateless, o "logout real" é feito sobrescrevendo o cookie
 * com um valor vazio e maxAge=0, forçando o navegador a descartá-lo.
 *
 * Para invalidação server-side (ex: "deslogar de todos os dispositivos"),
 * seria necessário uma blocklist de JTIs no Redis/MongoDB — fora do escopo
 * atual, mas a estrutura está preparada para essa extensão.
 *
 * Respostas:
 *   200 - Logout efetuado. Cookie de sessão apagado.
 *   405 - Método não permitido
 */

'use strict';

const { serializarCookieLogout } = require('../../lib/auth');
const { sucesso, metodaNaoPermitido } = require('../../lib/resposta');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return metodaNaoPermitido(res, ['POST']);
  }

  // Sobrescreve o cookie com valor vazio e expira imediatamente
  res.setHeader('Set-Cookie', serializarCookieLogout());

  return sucesso(res, { mensagem: 'Sessão encerrada com sucesso.' });
};
