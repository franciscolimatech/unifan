'use strict';

const { ObjectId } = require('mongodb');
const { getDb } = require('../../../lib/mongodb');
const { verificarSessaoReq } = require('../../../lib/auth');
const { sucesso, erro, metodaNaoPermitido } = require('../../../lib/resposta');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return metodaNaoPermitido(res, ['POST']);
  }

  const { usuario } = verificarSessaoReq(req, res);
  if (!usuario) return;

  const postIdTexto = req.query?.id;
  if (!ObjectId.isValid(postIdTexto)) {
    return erro(res, 'Publicacao invalida.', 400, 'POST_INVALIDO');
  }

  const { texto } = req.body || {};
  const textoLimpo = typeof texto === 'string' ? texto.trim() : '';

  if (!textoLimpo) {
    return erro(res, 'Escreva um comentario antes de enviar.', 400, 'COMENTARIO_VAZIO');
  }

  if (textoLimpo.length > 240) {
    return erro(res, 'O comentario deve ter no maximo 240 caracteres.', 400, 'COMENTARIO_LONGO');
  }

  const db = await getDb();
  const postId = new ObjectId(postIdTexto);
  const autorId = new ObjectId(usuario.sub);

  const post = await db.collection('posts').findOne(
    { _id: postId },
    { projection: { autorId: 1 } }
  );

  if (!post) {
    return erro(res, 'Publicacao nao encontrada.', 404, 'POST_NAO_ENCONTRADO');
  }

  const autor = await db.collection('users').findOne(
    { _id: autorId },
    { projection: { nome: 1 } }
  );

  const agora = new Date();
  const comentario = {
    postId,
    autorId,
    autorNome: autor?.nome || usuario.nome,
    texto: textoLimpo,
    criadoEm: agora,
  };

  const resultado = await db.collection('comments').insertOne(comentario);

  if (!post.autorId.equals(autorId)) {
    await db.collection('notifications').insertOne({
      userId: post.autorId,
      tipo: 'comentario',
      mensagem: `${comentario.autorNome} comentou em uma publicacao sua.`,
      lida: false,
      criadoEm: agora,
    });
  }

  return sucesso(
    res,
    {
      comentario: {
        id: resultado.insertedId.toString(),
        autorId: autorId.toString(),
        autorNome: comentario.autorNome,
        texto: comentario.texto,
        criadoEm: comentario.criadoEm,
      },
    },
    201
  );
};
