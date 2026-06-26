'use strict';

const { ObjectId } = require('mongodb');
const { getDb } = require('../../lib/mongodb');
const { verificarSessaoReq } = require('../../lib/auth');
const { sucesso, erro, metodaNaoPermitido } = require('../../lib/resposta');

function normalizarPost(post, comentariosPorPost) {
  const id = post._id.toString();
  return {
    id,
    autorId: post.autorId.toString(),
    autorNome: post.autorNome,
    autorAvatar: post.autorAvatar || null,
    imagemUrl: post.imagemUrl || null,
    legenda: post.legenda || '',
    criadoEm: post.criadoEm,
    comentarios: comentariosPorPost.get(id) || [],
  };
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return metodaNaoPermitido(res, ['GET', 'POST']);
  }

  const { usuario } = verificarSessaoReq(req, res);
  if (!usuario) return;

  const db = await getDb();

  if (req.method === 'POST') {
    const { imagemUrl, legenda } = req.body || {};
    const imagemLimpa = typeof imagemUrl === 'string' && imagemUrl.trim() ? imagemUrl.trim() : null;
    const legendaLimpa = typeof legenda === 'string' ? legenda.trim() : '';

    if (!imagemLimpa && !legendaLimpa) {
      return erro(res, 'Informe uma imagem ou uma legenda para publicar.', 400, 'PUBLICACAO_VAZIA');
    }

    if (legendaLimpa.length > 280) {
      return erro(res, 'A legenda deve ter no maximo 280 caracteres.', 400, 'LEGENDA_LONGA');
    }

    if (imagemLimpa && imagemLimpa.length > 950000) {
      return erro(res, 'A imagem enviada e muito grande para este prototipo.', 400, 'IMAGEM_GRANDE');
    }

    const autor = await db.collection('users').findOne(
      { _id: new ObjectId(usuario.sub) },
      { projection: { nome: 1, avatar: 1 } }
    );

    const agora = new Date();
    const novoPost = {
      autorId: new ObjectId(usuario.sub),
      autorNome: autor?.nome || usuario.nome,
      autorAvatar: autor?.avatar || null,
      imagemUrl: imagemLimpa,
      legenda: legendaLimpa,
      criadoEm: agora,
      atualizadoEm: agora,
    };

    const resultado = await db.collection('posts').insertOne(novoPost);
    await db.collection('notifications').insertOne({
      userId: new ObjectId(usuario.sub),
      tipo: 'sistema',
      mensagem: 'Sua publicacao foi criada com sucesso.',
      lida: false,
      criadoEm: agora,
    });

    return sucesso(res, {
      post: normalizarPost({ ...novoPost, _id: resultado.insertedId }, new Map()),
    }, 201);
  }

  const termo = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
  const filtro = termo
    ? {
        $or: [
          { legenda: { $regex: termo, $options: 'i' } },
          { autorNome: { $regex: termo, $options: 'i' } },
        ],
      }
    : {};

  const posts = await db.collection('posts')
    .find(filtro)
    .sort({ criadoEm: -1 })
    .limit(50)
    .toArray();

  const postIds = posts.map(post => post._id);
  const comentarios = postIds.length
    ? await db.collection('comments')
        .find({ postId: { $in: postIds } })
        .sort({ criadoEm: 1 })
        .toArray()
    : [];

  const comentariosFiltrados = termo
    ? comentarios.filter(comentario => comentario.texto.toLowerCase().includes(termo.toLowerCase()))
    : comentarios;

  const comentariosPorPost = new Map();
  comentariosFiltrados.forEach(comentario => {
    const postId = comentario.postId.toString();
    const lista = comentariosPorPost.get(postId) || [];
    lista.push({
      id: comentario._id.toString(),
      autorId: comentario.autorId.toString(),
      autorNome: comentario.autorNome,
      texto: comentario.texto,
      criadoEm: comentario.criadoEm,
    });
    comentariosPorPost.set(postId, lista);
  });

  const termoLower = termo.toLowerCase();
  const postsComComentarios = posts
    .filter(post => {
      if (!termo) return true;
      return (
        (post.legenda || '').toLowerCase().includes(termoLower) ||
        (post.autorNome || '').toLowerCase().includes(termoLower) ||
        comentariosPorPost.has(post._id.toString())
      );
    })
    .map(post => normalizarPost(post, comentariosPorPost));

  return sucesso(res, { posts: postsComComentarios });
};
