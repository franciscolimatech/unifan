'use strict';

const { getDb } = require('../../lib/mongodb');
const { verificarSessaoReq } = require('../../lib/auth');
const { sucesso, erro, metodaNaoPermitido } = require('../../lib/resposta');

const LIMITE_POSTS_EXPORTACAO = 200;

function formatarData(valor) {
  if (!valor) return '';
  const data = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(data.getTime()) ? '' : data.toISOString();
}

function escaparCsv(valor) {
  const texto = String(valor ?? '');
  return `"${texto.replace(/"/g, '""')}"`;
}

function normalizarComentario(comentario) {
  return {
    autor: comentario.autorNome || 'Usuario',
    texto: comentario.texto || '',
    criadoEm: formatarData(comentario.criadoEm),
  };
}

function normalizarPost(post, comentariosPorPost) {
  const id = post._id.toString();
  const comentarios = comentariosPorPost.get(id) || [];

  return {
    id,
    autor: post.autorNome || 'Usuario',
    legenda: post.legenda || '',
    imagemUrl: post.imagemUrl || '',
    criadoEm: formatarData(post.criadoEm),
    quantidadeComentarios: comentarios.length,
    comentarios,
  };
}

function postsParaCsv(posts) {
  const cabecalho = [
    'post_id',
    'autor',
    'legenda',
    'imagem_url',
    'criado_em',
    'quantidade_comentarios',
    'comentarios',
  ];

  const linhas = posts.map((post) => {
    const comentarios = post.comentarios
      .map((comentario) => `${comentario.autor}: ${comentario.texto} (${comentario.criadoEm})`)
      .join(' | ');

    return [
      post.id,
      post.autor,
      post.legenda,
      post.imagemUrl,
      post.criadoEm,
      post.quantidadeComentarios,
      comentarios,
    ].map(escaparCsv).join(',');
  });

  return [cabecalho.join(','), ...linhas].join('\r\n');
}

function nomeArquivo(extensao) {
  const data = new Date().toISOString().slice(0, 10);
  return `comunidade-export-${data}.${extensao}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return metodaNaoPermitido(res, ['GET']);
  }

  const { usuario } = verificarSessaoReq(req, res);
  if (!usuario) return;

  const formato = String(req.query?.formato || 'json').trim().toLowerCase();
  if (!['json', 'csv'].includes(formato)) {
    return erro(res, 'Formato de exportacao invalido. Use json ou csv.', 400, 'FORMATO_INVALIDO');
  }

  const db = await getDb();
  const posts = await db.collection('posts')
    .find({})
    .sort({ criadoEm: -1 })
    .limit(LIMITE_POSTS_EXPORTACAO)
    .toArray();

  const postIds = posts.map((post) => post._id);
  const comentarios = postIds.length
    ? await db.collection('comments')
        .find({ postId: { $in: postIds } })
        .sort({ criadoEm: 1 })
        .toArray()
    : [];

  const comentariosPorPost = new Map();
  comentarios.forEach((comentario) => {
    const postId = comentario.postId.toString();
    const lista = comentariosPorPost.get(postId) || [];
    lista.push(normalizarComentario(comentario));
    comentariosPorPost.set(postId, lista);
  });

  const dados = posts.map((post) => normalizarPost(post, comentariosPorPost));

  if (formato === 'json') {
    return sucesso(res, {
      formato: 'json',
      geradoEm: formatarData(new Date()),
      limite: LIMITE_POSTS_EXPORTACAO,
      totalPosts: dados.length,
      posts: dados,
    });
  }

  const csv = `\uFEFF${postsParaCsv(dados)}`;
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${nomeArquivo('csv')}"`,
    'Cache-Control': 'no-store, no-cache',
    'Content-Length': Buffer.byteLength(csv),
  });
  return res.end(csv);
};
