/**
 * Teste do enriquecimento de empresas com CNPJ real
 * Execute com: npx ts-node src/test-company-enrichment.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataEnrichmentService } from './services/data-enrichment.service';

async function testCompanyEnrichment() {
  console.log('🚀 Testando enriquecimento de empresas com CNPJ real...\n');

  try {
    // Criar aplicação NestJS
    const app = await NestFactory.createApplicationContext(AppModule);
    const dataEnrichmentService = app.get(DataEnrichmentService);

    // Dados de teste com CNPJs reais
    const testData = [
      {
        id: 1,
        nome: "José da Silva",
        empresa: "Empresa A",
        cnpj: "48.888.581/0001-76", // CNPJ válido
        email: "jose@empresa.com",
      },
      {
        id: 2,
        nome: "Maria Silva", 
        empresa: "Empresa B",
        cnpj: "05.206.246/0001-38", // CNPJ válido
        email: "maria@empresa.com",
      },
      {
        id: 3,
        nome: "João Santos",
        empresa: "Empresa C", 
        cnpj: "12.345.678/0001-99", // CNPJ inválido
        email: "joao@empresa.com",
      }
    ];

    console.log('📋 Dados de teste:');
    testData.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.nome} - ${item.empresa} (CNPJ: ${item.cnpj})`);
    });

    console.log('\n⏳ Iniciando enriquecimento...\n');

    // Gerar ID de sessão
    const sessionId = dataEnrichmentService.generateSessionId(testData, 'company');
    console.log(`📊 Session ID: ${sessionId}`);

    // Configurar callbacks
    const onProgress = (progress: any) => {
      console.log(`📈 Progresso: ${progress.percentage}% (${progress.processed}/${progress.total}) - Batch ${progress.currentBatch}`);
    };

    const onPartialResult = (results: any[]) => {
      console.log(`\n✅ Resultados parciais recebidos (${results.length} itens):`);
      
      results.forEach((result, index) => {
        console.log(`\n--- Item ${result.rowIndex + 1} ---`);
        console.log(`📊 Dados originais: ${result.data.nome} - ${result.data.empresa}`);
        
        if (result.enrichedFields.error) {
          console.log(`❌ Erro: ${result.enrichedFields.error_message}`);
          console.log(`🔍 Código: ${result.enrichedFields.error_code}`);
        } else if (result.enrichedFields.success) {
          const enriched = result.enrichedFields;
          console.log(`🏢 Razão Social: ${enriched.company_name}`);
          console.log(`🏷️  Nome Fantasia: ${enriched.trade_name || 'N/A'}`);
          console.log(`📋 Situação: ${enriched.company_status}`);
          console.log(`🏭 Tipo: ${enriched.company_type}`);
          console.log(`📍 Endereço: ${enriched.address.street}, ${enriched.address.number}`);
          console.log(`🌆 Cidade: ${enriched.address.city}/${enriched.address.state}`);
          console.log(`📞 Email: ${enriched.contact.email || 'N/A'}`);
          console.log(`👥 Sócios: ${enriched.partners_count}`);
          console.log(`💰 Capital: R$ ${enriched.share_capital}`);
          console.log(`📏 Porte: ${enriched.company_size}`);
          console.log(`🔍 Fonte: ${enriched.data_source}`);
        }
      });
    };

    // Executar enriquecimento
    await dataEnrichmentService.startEnrichment(
      testData,
      'company',
      {
        batchSize: 2,
        concurrency: 1,
        cnpjField: 'cnpj', // Especifica qual campo contém o CNPJ
      },
      sessionId,
      onProgress,
      onPartialResult
    );

    // Obter sessão final
    const finalSession = dataEnrichmentService.getSession(sessionId);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO FINAL');
    console.log('='.repeat(60));
    console.log(`🎯 Status: ${finalSession?.status}`);
    console.log(`📈 Progresso: ${finalSession?.progress.percentage}%`);
    console.log(`⏱️  Tempo total: ${finalSession?.endTime ? 
      Math.round((finalSession.endTime.getTime() - finalSession.startTime.getTime()) / 1000) : 'N/A'} segundos`);
    console.log(`📋 Total de resultados: ${finalSession?.results.length}`);
    
    // Estatísticas
    const successCount = finalSession?.results.filter(r => r.enrichedFields.success).length || 0;
    const errorCount = finalSession?.results.filter(r => r.enrichedFields.error).length || 0;
    
    console.log(`✅ Sucessos: ${successCount}`);
    console.log(`❌ Erros: ${errorCount}`);

    await app.close();
    console.log('\n🎉 Teste concluído!');

  } catch (error) {
    console.error('💥 Erro durante o teste:', error);
  }
}

// Executar teste
testCompanyEnrichment().catch(console.error);
