/**
 * lib/mongodb.js
 *
 * Padrão de conexão SINGLETON para MongoDB em ambiente Serverless (Vercel).
 *
 * Por que isso é necessário:
 *   - Cada Serverless Function é uma nova instância Node.js em cold start.
 *   - Sem cache, cada requisição abriria uma nova conexão ao MongoDB Atlas,
 *     esgotando rapidamente o pool de conexões do cluster (limite: 500 no M0).
 *   - A variável global `_mongoClientPromise` persiste entre invocações
 *     "warm" da mesma instância, reutilizando a conexão existente.
 *
 * Uso:
 *   const { getDb } = require('../../lib/mongodb');
 *   const db = await getDb();
 *   const users = await db.collection('users').findOne({ email });
 */

'use strict';

const { MongoClient, ServerApiVersion } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    '[MongoDB] A variável de ambiente MONGODB_URI não está definida.\n' +
    'Crie um arquivo .env.local com: MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/cristovao'
  );
}

const DB_NAME = process.env.MONGODB_DB_NAME || 'cristovao';

/**
 * Opções do cliente MongoDB.
 * ServerApiVersion.v1 garante compatibilidade estável com MongoDB Atlas.
 */
const clientOptions = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  // Limites conservadores para Serverless: evitar segurar conexões abertas
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 10_000,
  serverSelectionTimeoutMS: 5_000,
  connectTimeoutMS: 8_000,
};

/**
 * Cache global da Promise de conexão.
 *
 * Em desenvolvimento (NODE_ENV !== 'production'), usamos `global` para evitar
 * que o hot-reload do Next.js / Vercel Dev crie múltiplas conexões.
 * Em produção, a variável de módulo é suficiente pois cada instância é isolada.
 */
let _mongoClientPromise;

if (process.env.NODE_ENV !== 'production') {
  // Desenvolvimento: cache na variável global para sobreviver ao hot-reload
  if (!global._mongoClientPromise) {
    const client = new MongoClient(MONGODB_URI, clientOptions);
    global._mongoClientPromise = client.connect();
  }
  _mongoClientPromise = global._mongoClientPromise;
} else {
  // Produção (Vercel): cache no escopo do módulo
  const client = new MongoClient(MONGODB_URI, clientOptions);
  _mongoClientPromise = client.connect();
}

/**
 * Retorna a instância do banco de dados Cristóvão.
 * @returns {Promise<import('mongodb').Db>}
 */
async function getDb() {
  const client = await _mongoClientPromise;
  return client.db(DB_NAME);
}

/**
 * Retorna o MongoClient conectado (para transações ou operações avançadas).
 * @returns {Promise<import('mongodb').MongoClient>}
 */
async function getClient() {
  return _mongoClientPromise;
}

module.exports = { getDb, getClient };
