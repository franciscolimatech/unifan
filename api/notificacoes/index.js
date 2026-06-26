'use strict';

const { ObjectId } = require('mongodb');
const { getDb } = require('../../lib/mongodb');
const { verificarSessaoReq } = require('../../lib/auth');
const { sucesso, metodaNaoPermitido } = require('../../lib/resposta');

module.exports = async function handler(req, res) {
  if (!['GET', 'PUT'].includes(req.method)) {
    return metodaNaoPermitido(res, ['GET', 'PUT']);
  }

  const { usuario } = verificarSessaoReq(req, res);
  if (!usuario) return;

  const db = await getDb();
  const userId = new ObjectId(usuario.sub);
  const notificacoes = db.collection('notifications');

  if (req.method === 'PUT') {
    await notificacoes.updateMany(
      { userId, lida: false },
      { $set: { lida: true, lidaEm: new Date() } }
    );
    return sucesso(res, { mensagem: 'Notificacoes marcadas como lidas.' });
  }

  const itens = await notificacoes
    .find({ userId })
    .sort({ criadoEm: -1 })
    .limit(30)
    .toArray();

  const naoLidas = await notificacoes.countDocuments({ userId, lida: false });

  return sucesso(res, {
    naoLidas,
    notificacoes: itens.map(item => ({
      id: item._id.toString(),
      tipo: item.tipo,
      mensagem: item.mensagem,
      lida: Boolean(item.lida),
      criadoEm: item.criadoEm,
    })),
  });
};
