/**
 * lib/schemas.js
 *
 * Documentação dos schemas do MongoDB e função de setup de índices.
 *
 * MongoDB é schema-less, mas documentamos a estrutura esperada em JSDoc
 * para consistência e autocomplete. Os índices são criados via
 * `criarIndices()` chamado no primeiro deploy (ex: script de seed) ou
 * garantido a cada Cold Start com `{ background: true }`.
 *
 * ─── Coleções ──────────────────────────────────────────────────────────
 *
 * users:
 *   _id           ObjectId   (gerado automaticamente pelo MongoDB)
 *   nome          String     (nome completo, 2-100 chars)
 *   email         String     (único, indexado, lowercase)
 *   senhaHash     String     (bcrypt, 12 rounds)
 *   perguntaRecuperacao      String
 *   respostaRecuperacaoHash  String (bcrypt)
 *   versaoTermosAceita       String | null  ("1.0.0" após aceite)
 *   dataAceiteTermos         Date   | null
 *   avatar        String     (URL ou base64, opcional)
 *   criadoEm     Date
 *   atualizadoEm Date
 *
 * posts:
 *   _id           ObjectId
 *   autorId       ObjectId  (ref: users._id, indexado)
 *   autorNome     String    (desnormalizado para evitar JOIN)
 *   imagemUrl     String    (URL ou base64)
 *   legenda       String
 *   criadoEm     Date
 *
 * comments:
 *   _id           ObjectId
 *   postId        ObjectId  (ref: posts._id, indexado)
 *   autorId       ObjectId  (ref: users._id, indexado)
 *   autorNome     String
 *   texto         String
 *   criadoEm     Date
 *
 * notifications:
 *   _id           ObjectId
 *   userId        ObjectId  (ref: users._id, indexado)
 *   tipo          String    ("comentario" | "curtida" | "sistema")
 *   mensagem      String
 *   lida          Boolean   (default: false)
 *   criadoEm     Date
 */

'use strict';

const { getDb } = require('./mongodb');

/**
 * Cria todos os índices necessários nas coleções.
 * Seguro para chamar múltiplas vezes (createIndex é idempotente).
 * Execute via: node -e "require('./lib/schemas').criarIndices().then(console.log)"
 */
async function criarIndices() {
  const db = await getDb();

  // ── users ──
  await db.collection('users').createIndex(
    { email: 1 },
    { unique: true, name: 'idx_users_email_unique' }
  );
  await db.collection('users').createIndex(
    { criadoEm: -1 },
    { name: 'idx_users_criadoEm' }
  );

  // ── posts ──
  await db.collection('posts').createIndex(
    { autorId: 1, criadoEm: -1 },
    { name: 'idx_posts_autor_data' }
  );
  await db.collection('posts').createIndex(
    { criadoEm: -1 },
    { name: 'idx_posts_data' }
  );

  // ── comments ──
  await db.collection('comments').createIndex(
    { postId: 1, criadoEm: 1 },
    { name: 'idx_comments_post_data' }
  );
  await db.collection('comments').createIndex(
    { autorId: 1 },
    { name: 'idx_comments_autor' }
  );

  // ── notifications ──
  await db.collection('notifications').createIndex(
    { userId: 1, lida: 1, criadoEm: -1 },
    { name: 'idx_notifications_user_lida' }
  );
  // TTL: notificações lidas somem após 30 dias
  await db.collection('notifications').createIndex(
    { criadoEm: 1 },
    {
      expireAfterSeconds: 30 * 24 * 60 * 60,
      partialFilterExpression: { lida: true },
      name: 'idx_notifications_ttl_lidas',
    }
  );

  console.log('[schemas] Índices criados/verificados com sucesso.');
}

module.exports = { criarIndices };
