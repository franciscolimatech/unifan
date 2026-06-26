'use strict';

const { verificarSessaoReq } = require('../../lib/auth');
const { sucesso, metodaNaoPermitido } = require('../../lib/resposta');

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

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return metodaNaoPermitido(res, ['GET']);
  }

  const { usuario } = verificarSessaoReq(req, res);
  if (!usuario) return;

  return sucesso(res, {
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
  });
};
