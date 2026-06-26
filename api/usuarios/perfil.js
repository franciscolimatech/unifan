'use strict';

const { ObjectId } = require('mongodb');
const { getDb } = require('../../lib/mongodb');
const {
  verificarSessaoReq,
  gerarToken,
  serializarCookieSessao,
  emailValido,
} = require('../../lib/auth');
const { sucesso, erro, metodaNaoPermitido } = require('../../lib/resposta');

function usuarioPublico(usuario) {
  return {
    id: usuario._id.toString(),
    nome: usuario.nome,
    email: usuario.email,
    avatar: usuario.avatar || null,
    versaoTermosAceita: usuario.versaoTermosAceita || null,
  };
}

module.exports = async function handler(req, res) {
  if (!['GET', 'PUT'].includes(req.method)) {
    return metodaNaoPermitido(res, ['GET', 'PUT']);
  }

  const { usuario } = verificarSessaoReq(req, res);
  if (!usuario) return;

  const db = await getDb();
  const users = db.collection('users');
  const userId = new ObjectId(usuario.sub);

  if (req.method === 'GET') {
    const atual = await users.findOne(
      { _id: userId },
      { projection: { nome: 1, email: 1, avatar: 1, versaoTermosAceita: 1 } }
    );
    if (!atual) return erro(res, 'Usuario nao encontrado.', 404, 'USUARIO_NAO_ENCONTRADO');
    return sucesso(res, { usuario: usuarioPublico(atual) });
  }

  const { nome, email, avatar } = req.body || {};
  const nomeLimpo = typeof nome === 'string' ? nome.trim() : '';
  const emailLimpo = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const avatarLimpo = typeof avatar === 'string' && avatar.trim() ? avatar.trim() : null;

  if (nomeLimpo.length < 2 || nomeLimpo.length > 100) {
    return erro(res, 'O nome deve ter entre 2 e 100 caracteres.', 400, 'NOME_INVALIDO');
  }

  if (!emailValido(emailLimpo)) {
    return erro(res, 'Informe um e-mail valido.', 400, 'EMAIL_INVALIDO');
  }

  const emailEmUso = await users.findOne(
    { email: emailLimpo, _id: { $ne: userId } },
    { projection: { _id: 1 } }
  );
  if (emailEmUso) {
    return erro(res, 'Ja existe uma conta usando este e-mail.', 409, 'EMAIL_DUPLICADO');
  }

  await users.updateOne(
    { _id: userId },
    { $set: { nome: nomeLimpo, email: emailLimpo, avatar: avatarLimpo, atualizadoEm: new Date() } }
  );

  await db.collection('posts').updateMany(
    { autorId: userId },
    { $set: { autorNome: nomeLimpo, autorAvatar: avatarLimpo } }
  );
  await db.collection('comments').updateMany(
    { autorId: userId },
    { $set: { autorNome: nomeLimpo } }
  );

  const atualizado = await users.findOne(
    { _id: userId },
    { projection: { nome: 1, email: 1, avatar: 1, versaoTermosAceita: 1 } }
  );

  const token = gerarToken({
    _id: atualizado._id,
    nome: atualizado.nome,
    email: atualizado.email,
    versaoTermosAceita: atualizado.versaoTermosAceita || null,
  });
  res.setHeader('Set-Cookie', serializarCookieSessao(token));

  return sucesso(res, {
    mensagem: 'Perfil atualizado com sucesso.',
    usuario: usuarioPublico(atualizado),
  });
};
