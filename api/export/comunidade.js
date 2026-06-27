'use strict';

const { getDb } = require('../../lib/mongodb');
const { verificarSessaoReq } = require('../../lib/auth');
const { sucesso, erro, metodaNaoPermitido } = require('../../lib/resposta');

const LIMITE_POSTS_EXPORTACAO = 200;
const CAMPOS_EXPORTACAO_JSON = [
  { nome: 'id', tipo: 'string', descricao: 'Identificador da publicacao.' },
  { nome: 'autor', tipo: 'string', descricao: 'Nome publico do autor da publicacao.' },
  { nome: 'legenda', tipo: 'string', descricao: 'Texto da publicacao.' },
  { nome: 'imagemUrl', tipo: 'string', descricao: 'URL ou data URL base64 da imagem, quando existir.' },
  { nome: 'criadoEm', tipo: 'string ISO-8601', descricao: 'Data de criacao da publicacao.' },
  { nome: 'quantidadeComentarios', tipo: 'number', descricao: 'Total de comentarios exportados no post.' },
  { nome: 'comentarios', tipo: 'array', descricao: 'Comentarios com autor, texto e data de criacao.' },
];

function endpoint({
  caminho,
  metodos,
  descricao,
  autenticado = true,
  parametros = [],
  corpo = null,
  resposta = '',
}) {
  return {
    caminho,
    metodos,
    descricao,
    autenticado,
    parametros,
    corpo,
    resposta,
  };
}

function manifestoIntegracoes() {
  return {
    sistema: 'UNIFAN',
    apiVersion: '1.0',
    schemaVersion: 'integracoes.v1',
    geradoEm: new Date().toISOString(),
    autenticacao: {
      tipo: 'sessao',
      observacao: 'Endpoints protegidos exigem sessao autenticada via cookie httpOnly.',
    },
    endpoints: [
      endpoint({
        caminho: '/api/integracoes',
        metodos: ['GET'],
        descricao: 'Retorna este manifesto simples da API para intercambio de dados.',
        resposta: 'JSON com endpoints disponiveis, metodos, parametros e observacoes de autenticacao.',
      }),
      endpoint({
        caminho: '/api/export/comunidade?formato=json',
        metodos: ['GET'],
        descricao: 'Exporta publicacoes da Comunidade em JSON para intercambio de dados.',
        parametros: [
          {
            nome: 'formato',
            local: 'query',
            obrigatorio: false,
            valores: ['json'],
            padrao: 'json',
          },
        ],
        resposta: 'JSON com metadados, campos documentados, total e ate 200 posts com comentarios.',
      }),
      endpoint({
        caminho: '/api/export/comunidade?formato=csv',
        metodos: ['GET'],
        descricao: 'Exporta publicacoes da Comunidade em CSV para download.',
        parametros: [
          {
            nome: 'formato',
            local: 'query',
            obrigatorio: true,
            valores: ['csv'],
          },
        ],
        resposta: 'Arquivo text/csv com Content-Disposition para download.',
      }),
      endpoint({
        caminho: '/api/compartilhamentos',
        metodos: ['POST'],
        descricao: 'Compartilha uma publicacao da Comunidade com outro usuario cadastrado.',
        corpo: {
          postId: 'string ObjectId da publicacao',
          destinatarioEmail: 'string com e-mail de usuario cadastrado',
          mensagem: 'string opcional de ate 180 caracteres',
        },
        resposta: 'JSON com o registro resumido do compartilhamento criado.',
      }),
      endpoint({
        caminho: '/api/posts',
        metodos: ['GET', 'POST'],
        descricao: 'Lista publicacoes da Comunidade ou cria uma nova publicacao.',
        parametros: [
          {
            nome: 'q',
            local: 'query',
            obrigatorio: false,
            descricao: 'Busca por legenda, autor ou comentario.',
          },
        ],
        corpo: {
          imagemUrl: 'string opcional com URL http(s) ou data URL base64 de imagem',
          legenda: 'string opcional de ate 280 caracteres',
        },
        resposta: 'JSON com posts normalizados e comentarios, ou o post criado.',
      }),
      endpoint({
        caminho: '/api/posts/{id}/comentarios',
        metodos: ['POST'],
        descricao: 'Cria um comentario em uma publicacao da Comunidade.',
        parametros: [
          {
            nome: 'id',
            local: 'path',
            obrigatorio: true,
            descricao: 'ObjectId da publicacao.',
          },
        ],
        corpo: {
          texto: 'string de ate 240 caracteres',
        },
        resposta: 'JSON com o comentario criado.',
      }),
      endpoint({
        caminho: '/api/notificacoes',
        metodos: ['GET', 'PUT'],
        descricao: 'Lista notificacoes do usuario logado ou marca notificacoes como lidas.',
        corpo: {
          lida: 'boolean opcional usado pelo frontend ao marcar notificacoes como lidas',
        },
        resposta: 'JSON com notificacoes do usuario logado ou confirmacao de leitura.',
      }),
    ],
    observacoes: [
      'Este manifesto documenta apenas endpoints JSON e exportacoes ja existentes.',
      'Nao ha integracao externa real, webhook ou token de API dedicado nesta fase.',
      'OS, pedidos e notas fiscais dependem de entidades futuras persistidas no banco.',
      'Dados sensiveis como senhas, hashes, cookies e tokens nao fazem parte dos contratos de intercambio.',
    ],
  };
}

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

  const tipo = String(req.query?.tipo || '').trim().toLowerCase();
  if (tipo === 'integracoes') {
    return sucesso(res, manifestoIntegracoes());
  }

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
      schemaVersion: 'comunidade.export.v1',
      origem: 'unifan.comunidade',
      formato: 'json',
      geradoEm: formatarData(new Date()),
      limite: LIMITE_POSTS_EXPORTACAO,
      totalPosts: dados.length,
      campos: CAMPOS_EXPORTACAO_JSON,
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
