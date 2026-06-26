/**
 * api/usuarios/aceitar-termos.js
 *
 * POST /api/usuarios/aceitar-termos
 *
 * Registra o aceite da versão atual dos Termos de Uso no banco de dados
 * e reemite o cookie de sessão com a versão dos termos atualizada no JWT.
 *
 * Esta rota é chamada pelo frontend após o usuário visualizar e aceitar
 * o modal bloqueante de termos (exibido quando login retorna precisaAceitarTermos: true).
 *
 * Requer sessão autenticada (cookie JWT válido).
 *
 * Body JSON esperado:
 * {
 *   "versaoTermos": "1.0.0"
 * }
 *
 * Respostas:
 *   200 - Aceite registrado. Novo cookie emitido com versão atualizada.
 *   400 - Versão dos termos inválida ou já aceita
 *   401 - Sem sessão
 *   500 - Erro interno
 */

'use strict';

const { ObjectId } = require('mongodb');
const { getDb } = require('../../lib/mongodb');
const {
  verificarSessaoReq,
  gerarToken,
  serializarCookieSessao,
} = require('../../lib/auth');
const { sucesso, erro, metodaNaoPermitido } = require('../../lib/resposta');

const VERSAO_TERMOS_ATUAL = process.env.VERSAO_TERMOS_ATUAL || '1.0.0';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return metodaNaoPermitido(res, ['POST']);
  }

  // ── Verificar sessão ────────────────────────────────────────────────
  const { usuario } = verificarSessaoReq(req, res);
  if (!usuario) return;

  // ── Validar versão dos termos ───────────────────────────────────────
  const { versaoTermos } = req.body || {};

  if (versaoTermos !== VERSAO_TERMOS_ATUAL) {
    return erro(
      res,
      `Versão dos termos inválida. A versão atual é ${VERSAO_TERMOS_ATUAL}.`,
      400,
      'VERSAO_TERMOS_INVALIDA'
    );
  }

  if (usuario.versaoTermosAceita === VERSAO_TERMOS_ATUAL) {
    return erro(res, 'Os termos desta versão já foram aceitos.', 400, 'TERMOS_JA_ACEITOS');
  }

  // ── Atualizar banco ─────────────────────────────────────────────────
  try {
    const db = await getDb();
    const agora = new Date();

    const resultado = await db.collection('users').findOneAndUpdate(
      { _id: new ObjectId(usuario.sub) },
      {
        $set: {
          versaoTermosAceita: VERSAO_TERMOS_ATUAL,
          dataAceiteTermos: agora,
          atualizadoEm: agora,
        },
      },
      {
        returnDocument: 'after',
        projection: { _id: 1, nome: 1, email: 1, versaoTermosAceita: 1 },
      }
    );

    if (!resultado) {
      return erro(res, 'Usuário não encontrado.', 404, 'USUARIO_NAO_ENCONTRADO');
    }

    // Reemite cookie com versão dos termos atualizada no JWT
    const novoToken = gerarToken({
      _id: resultado._id,
      nome: resultado.nome,
      email: resultado.email,
      versaoTermosAceita: resultado.versaoTermosAceita,
    });

    res.setHeader('Set-Cookie', serializarCookieSessao(novoToken));

    return sucesso(res, {
      mensagem: 'Termos aceitos com sucesso.',
      versaoTermosAceita: VERSAO_TERMOS_ATUAL,
    });
  } catch (err) {
    console.error('[aceitar-termos] Erro interno:', err);
    return erro(res, 'Não foi possível registrar o aceite. Tente novamente.', 500, 'ERRO_INTERNO');
  }
};
