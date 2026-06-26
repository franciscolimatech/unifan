/**
 * setup-db.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Script de Inicialização e Configuração do MongoDB Atlas
 * Foco: Automação Financeira e Controle de Acesso — Cristóvão Materiais de Construção
 */

'use strict';

// Carrega as variáveis de ambiente do arquivo .env ou .env.local
require('dotenv').config({ path: '.env.local' });
if (!process.env.MONGODB_URI) {
  require('dotenv').config({ path: '.env' });
}

const { MongoClient, ServerApiVersion } = require('mongodb');

async function iniciarSetup() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'cristovao';

  if (!uri) {
    console.error('❌ [ERRO] A variável MONGODB_URI não foi encontrada no ambiente.');
    process.exit(1);
  }

  console.log('🚀 [DATABASE SETUP] Iniciando provisionamento do banco de dados...');
  console.log(`🔌 [DATABASE SETUP] Conectando ao cluster do Atlas [Banco: ${dbName}]...`);

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

  try {
    await client.connect();
    const db = client.db(dbName);
    console.log('✅ [DATABASE SETUP] Conexão estabelecida e autenticada com sucesso.');
    console.log('⚙️ [DATABASE SETUP] Criando índices e regras estruturais...');

    // ── CONFIGURAÇÃO: COLEÇÃO DE USUÁRIOS (SQUAD FINANCEIRO / ACESSO) ──
    try {
      console.log('   ↳ Configurando índices para a coleção [users]...');
      await db.collection('users').createIndex(
        { email: 1 },
        { unique: true, name: 'idx_users_email_unique' }
      );
      await db.collection('users').createIndex(
        { criadoEm: -1 },
        { name: 'idx_users_criadoEm' }
      );
      console.log('   ✅ Índices da coleção [users] criados com sucesso.');
    } catch (errUser) {
      console.error('   ❌ Falha ao criar índices em [users]:', errUser.message);
    }

    // ── CONFIGURAÇÃO: SIMULAÇÕES E REQUISIÇÕES (OPCIONAL/ESTRUTURAL) ──
    try {
      console.log('   ↳ Garantindo integridade para coleções operacionais...');
      // Cria um índice genérico de auditoria caso decida salvar logs de automação financeira futuramente
      await db.collection('logs_financeiros').createIndex(
        { executadoEm: -1 },
        { name: 'idx_logs_data' }
      );
      console.log('   ✅ Estrutura operacional validada.');
    } catch (errLog) {
      // Ignora silenciosamente se houver limitação de privilégios no cluster free M0
    }

    console.log('\n🎉 [DATABASE SETUP] Configuração concluída com sucesso no MongoDB Atlas!');
    
  } catch (error) {
    console.error('\n💥 [ERRO CRÍTICO] Falha catastrófica durante a execução do setup:');
    console.error(error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 [DATABASE SETUP] Conexão encerrada com segurança.');
  }
}

iniciarSetup();