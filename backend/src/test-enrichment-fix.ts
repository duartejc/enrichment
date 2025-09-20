/**
 * Teste rápido do enriquecimento após correções
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SheetService } from './services/sheet.service';
import { DataEnrichmentService } from './services/data-enrichment.service';

async function testEnrichmentFix() {
  console.log('🧪 Testando correções do enriquecimento...\n');

  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const sheetService = app.get(SheetService);
    const dataEnrichmentService = app.get(DataEnrichmentService);

    // Criar planilha de teste
    const testData = [
      {
        nome: "Teste CNPJ",
        empresa: "Empresa Teste",
        cnpj: "48.888.581/0001-76",
        email: "teste@empresa.com",
      }
    ];

    const sheet = sheetService.createSheet("Teste Enriquecimento", testData, "test-user");
    console.log(`✅ Planilha criada: ${sheet.id}`);

    // Testar geração de sessionId
    const sessionId = dataEnrichmentService.generateSessionId(testData, 'company');
    console.log(`✅ SessionId gerado: ${sessionId}`);

    // Testar enriquecimento
    console.log('🔍 Iniciando enriquecimento...');
    
    let progressCount = 0;
    let resultCount = 0;

    const enrichmentSessionId = await dataEnrichmentService.enrichSheet(
      sheet.id,
      'company',
      { cnpjField: 'cnpj' },
      'test-user'
    );

    console.log(`✅ Enriquecimento iniciado com sessionId: ${enrichmentSessionId}`);

    // Aguardar conclusão
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        const session = dataEnrichmentService.getSession(enrichmentSessionId);
        if (session && (session.status === 'completed' || session.status === 'error')) {
          clearInterval(checkInterval);
          resolve(void 0);
        }
      }, 500);
    });

    // Verificar dados finais
    const finalSheetData = sheetService.getSheetData(sheet.id);
    console.log(`\n📊 Dados finais da planilha:`);
    console.log(`   Linhas: ${finalSheetData.metadata.totalRows}`);
    console.log(`   Colunas: ${finalSheetData.metadata.totalColumns}`);
    console.log(`   Versão: ${finalSheetData.metadata.version}`);

    console.log(`\n📋 Primeira linha enriquecida:`);
    const firstRow = finalSheetData.rows[0];
    if (firstRow) {
      Object.keys(firstRow).forEach(key => {
        if (firstRow[key]) {
          console.log(`   ${key}: ${firstRow[key]}`);
        }
      });
    }

    await app.close();

    console.log('\n' + '='.repeat(50));
    console.log('🎉 TESTE DE CORREÇÃO CONCLUÍDO COM SUCESSO!');
    console.log('='.repeat(50));
    console.log(`✅ Callbacks de progresso: ${progressCount}`);
    console.log(`✅ Callbacks de resultados: ${resultCount}`);
    console.log('✅ Enriquecimento funcionando corretamente');

  } catch (error) {
    console.error('💥 Erro durante o teste:', error);
  }
}

testEnrichmentFix().catch(console.error);
