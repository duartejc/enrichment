/**
 * Teste com a API real do OpenCNPJ
 * Execute com: npx ts-node src/test-real-api.ts
 */

import axios from 'axios';

async function testRealAPI() {
  console.log('🚀 Testando API OpenCNPJ real...\n');

  // CNPJ de exemplo da documentação
  const testCNPJ = '11.222.333/0001-81';
  const url = `https://api.opencnpj.org/${testCNPJ}`;

  console.log(`📋 Testando CNPJ: ${testCNPJ}`);
  console.log(`🌐 URL: ${url}\n`);

  try {
    console.log('⏳ Fazendo requisição...');
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Prospectiza-Test/1.0',
      },
    });

    console.log('✅ Sucesso!');
    console.log('📊 Dados recebidos:');
    console.log(`   CNPJ: ${response.data.cnpj}`);
    console.log(`   Razão Social: ${response.data.razao_social}`);
    console.log(`   Nome Fantasia: ${response.data.nome_fantasia}`);
    console.log(`   Situação: ${response.data.situacao_cadastral}`);
    console.log(`   Endereço: ${response.data.logradouro}, ${response.data.numero}`);
    console.log(`   Cidade: ${response.data.municipio}/${response.data.uf}`);
    console.log(`   Email: ${response.data.email}`);
    console.log(`   Porte: ${response.data.porte_empresa}`);
    console.log(`   Sócios: ${response.data.QSA?.length || 0}`);

  } catch (error: any) {
    if (error.response) {
      console.log(`❌ Erro HTTP ${error.response.status}: ${error.response.statusText}`);
      
      if (error.response.status === 404) {
        console.log('   💡 CNPJ não encontrado na base da Receita Federal');
      } else if (error.response.status === 429) {
        console.log('   💡 Rate limit excedido (50 req/s)');
      }
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.log('❌ Erro de conexão: Verifique sua conexão com a internet');
    } else {
      console.log(`❌ Erro: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📝 Informações sobre a API OpenCNPJ:');
  console.log('   • API gratuita e pública');
  console.log('   • Não requer autenticação');
  console.log('   • Rate limit: 50 requisições/segundo por IP');
  console.log('   • Servida pela Cloudflare com cache');
  console.log('   • Dados oficiais da Receita Federal');
  console.log('   • Suporte a múltiplos formatos de CNPJ');
  console.log('\n🎉 Teste concluído!');
}

// Executar teste
testRealAPI().catch(console.error);
