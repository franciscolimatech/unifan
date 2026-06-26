'use strict';

const { ObjectId } = require('mongodb');
const { getDb } = require('../../lib/mongodb');
const { verificarSessaoReq, emailValido } = require('../../lib/auth');
const { sucesso, erro, metodaNaoPermitido } = require('../../lib/resposta');

const LIMITE_MENSAGEM = 180;

function limparMensagem(valor) {
  if (typeof valor !== 'string') return '';
  return valor.trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return metodaNaoPermitido(res, ['POST']);
  }

  const { usuario } = verificarSessaoReq(req, res);
  if (!usuario) return;

  const { postId, destinatarioEmail, mensagem } = req.body || {};
  const postIdTexto = typeof postId === 'string' ? postId.trim() : '';
  const emailDestino = typeof destinatarioEmail === 'string'
    ? destinatarioEmail.trim().toLowerCase()
    : '';
  const mensagemLimpa = limparMensagem(mensagem);

  if (!ObjectId.isValid(postIdTexto)) {
    return erro(res, 'Publicacao invalida para compartilhamento.', 400, 'POST_INVALIDO');
  }

  if (!emailValido(emailDestino)) {
    return erro(res, 'Informe um e-mail de destinatario valido.', 400, 'EMAIL_INVALIDO');
  }

  if (mensagemLimpa.length > LIMITE_MENSAGEM) {
    return erro(
      res,
      `A mensagem deve ter no maximo ${LIMITE_MENSAGEM} caracteres.`,
      400,
      'MENSAGEM_LONGA'
    );
  }

  const db = await getDb();
  const remetenteId = new ObjectId(usuario.sub);
  const postObjectId = new ObjectId(postIdTexto);

  const [post, remetente, destinatario] = await Promise.all([
    db.collection('posts').findOne(
      { _id: postObjectId },
      { projection: { _id: 1, autorId: 1, autorNome: 1, legenda: 1, criadoEm: 1 } }
    ),
    db.collection('users').findOne(
      { _id: remetenteId },
      { projection: { nome: 1 } }
    ),
    db.collection('users').findOne(
      { email: emailDestino },
      { projection: { nome: 1, email: 1 } }
    ),
  ]);

  if (!post) {
    return erro(res, 'Publicacao nao encontrada.', 404, 'POST_NAO_ENCONTRADO');
  }

  if (!destinatario) {
    return erro(res, 'Destinatario nao encontrado.', 404, 'DESTINATARIO_NAO_ENCONTRADO');
  }

  if (destinatario._id.equals(remetenteId)) {
    return erro(res, 'Voce nao pode compartilhar uma publicacao consigo mesmo.', 400, 'AUTO_COMPARTILHAMENTO');
  }

  const agora = new Date();
  const remetenteNome = remetente?.nome || usuario.nome || 'Usuario';
  const compartilhamento = {
    tipo: 'post',
    postId: postObjectId,
    remetenteId,
    remetenteNome,
    destinatarioId: destinatario._id,
    destinatarioEmail: destinatario.email,
    mensagem: mensagemLimpa || null,
    criadoEm: agora,
  };

  const resultado = await db.collection('shared_items').insertOne(compartilhamento);

  await db.collection('notifications').insertOne({
    userId: destinatario._id,
    tipo: 'compartilhamento',
    mensagem: `${remetenteNome} compartilhou uma publicacao com voce.`,
    lida: false,
    compartilhamentoId: resultado.insertedId,
    postId: postObjectId,
    criadoEm: agora,
  });

  return sucesso(
    res,
    {
      compartilhamento: {
        id: resultado.insertedId.toString(),
        tipo: compartilhamento.tipo,
        postId: postObjectId.toString(),
        destinatarioNome: destinatario.nome || 'Destinatario',
        criadoEm: agora,
      },
    },
    201
  );
};
