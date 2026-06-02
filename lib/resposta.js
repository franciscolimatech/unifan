/**
 * lib/resposta.js
 *
 * Helpers para padronizar as respostas HTTP das Serverless Functions.
 * Compatível com o ambiente Node.js nativo da Vercel (sem Express/Next.js).
 */

'use strict';

/**
 * Envia uma resposta JSON de sucesso.
 * @param {import('http').ServerResponse} res
 * @param {object} dados  - Dados a retornar no campo "dados"
 * @param {number} [status=200]
 */
function sucesso(res, dados, status = 200) {
  const corpo = JSON.stringify({ ok: true, dados });
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(corpo),
  });
  res.end(corpo);
}

/**
 * Envia uma resposta JSON de erro.
 * @param {import('http').ServerResponse} res
 * @param {string} mensagem  - Mensagem legível para o usuário
 * @param {number} [status=400]
 * @param {string} [codigo]  - Código de erro em SNAKE_UPPER_CASE para o frontend
 */
function erro(res, mensagem, status = 400, codigo) {
  const corpo = JSON.stringify({ ok: false, erro: mensagem, codigo: codigo || null });
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(corpo),
  });
  res.end(corpo);
}

/**
 * Envia 405 Method Not Allowed com o header Allow correto.
 * @param {import('http').ServerResponse} res
 * @param {string[]} metodosPermitidos  - Ex: ['GET', 'POST']
 */
function metodaNaoPermitido(res, metodosPermitidos) {
  const corpo = JSON.stringify({
    ok: false,
    erro: `Método não permitido. Use: ${metodosPermitidos.join(', ')}`,
    codigo: 'METODO_NAO_PERMITIDO',
  });
  res.writeHead(405, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(corpo),
    Allow: metodosPermitidos.join(', '),
  });
  res.end(corpo);
}

module.exports = { sucesso, erro, metodaNaoPermitido };