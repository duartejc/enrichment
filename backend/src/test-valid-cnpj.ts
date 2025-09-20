/**
 * Teste com CNPJ real válido
 * Execute com: npx ts-node src/test-valid-cnpj.ts
 */

import axios from 'axios';

async function testValidCNPJ() {
  console.log('🚀 Testando com CNPJ real válido...\n');

  // CNPJ da Petrobras (público e conhecido)
  const testCNPJ = '33.000.167/0001-01';
  const url = `https://api.opencnpj.org/${testCNPJ}`;

  console.log(`📋 Testando CNPJ: ${testCNPJ}`);
  console.log(`🌐 URL: ${url}\n`);

  try {
    console.log('⏳ Fazendo requisição...');
    
    const response = await axios.get(url, {
      timeout: 15000, // 15 segundos para dar tempo
      headers: {
        'User-Agent': 'Prospectiza-Test/1.0',
      },
    });

    console.log('✅ Sucesso! Dados recebidos da API OpenCNPJ:');
    console.log('=' .repeat(60));
    console.log(`📊 CNPJ: ${response.data.cnpj}`);
    console.log(`🏢 Razão Social: ${response.data.razao_social}`);
    console.log(`🏷️  Nome Fantasia: ${response.data.nome_fantasia || 'N/A'}`);
    console.log(`📋 Situação: ${response.data.situacao_cadastral}`);
    console.log(`📅 Data Situação: ${response.data.data_situacao_cadastral}`);
    console.log(`🏭 Tipo: ${response.data.matriz_filial}`);
    console.log(`📅 Início Atividade: ${response.data.data_inicio_atividade}`);
    console.log(`🔢 CNAE Principal: ${response.data.cnae_principal}`);
    console.log(`⚖️  Natureza Jurídica: ${response.data.natureza_juridica}`);
    
    console.log('\n📍 Endereço:');
    console.log(`   ${response.data.logradouro}, ${response.data.numero}`);
    if (response.data.complemento) {
      console.log(`   ${response.data.complemento}`);
    }
    console.log(`   ${response.data.bairro}`);
    console.log(`   ${response.data.municipio}/${response.data.uf}`);
    console.log(`   CEP: ${response.data.cep}`);
    
    console.log('\n📞 Contato:');
    console.log(`   Email: ${response.data.email || 'N/A'}`);
    if (response.data.telefones && response.data.telefones.length > 0) {
      response.data.telefones.forEach((tel: any, index: number) => {
        const tipo = tel.is_fax ? 'Fax' : 'Telefone';
        console.log(`   ${tipo}: (${tel.ddd}) ${tel.numero}`);
      });
    }
    
    console.log('\n💰 Informações Financeiras:');
    console.log(`   Capital Social: R$ ${response.data.capital_social}`);
    console.log(`   Porte: ${response.data.porte_empresa}`);
    console.log(`   Simples Nacional: ${response.data.opcao_simples || 'N/A'}`);
    console.log(`   MEI: ${response.data.opcao_mei || 'N/A'}`);
    
    console.log('\n👥 Quadro Societário:');
    if (response.data.QSA && response.data.QSA.length > 0) {
      console.log(`   Total de sócios: ${response.data.QSA.length}`);
      response.data.QSA.slice(0, 3).forEach((socio: any, index: number) => {
        console.log(`   ${index + 1}. ${socio.nome_socio}`);
        console.log(`      Qualificação: ${socio.qualificacao_socio}`);
        console.log(`      Tipo: ${socio.identificador_socio}`);
        console.log(`      Entrada: ${socio.data_entrada_sociedade}`);
      });
      if (response.data.QSA.length > 3) {
        console.log(`   ... e mais ${response.data.QSA.length - 3} sócio(s)`);
      }
    } else {
      console.log('   Nenhum sócio encontrado');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Teste bem-sucedido! A API está funcionando perfeitamente.');

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
    } else if (error.code === 'ECONNABORTED') {
      console.log('❌ Timeout: A API demorou mais que 15 segundos para responder');
    } else {
      console.log(`❌ Erro: ${error.message}`);
    }
  }
}

// Executar teste
testValidCNPJ().catch(console.error);
