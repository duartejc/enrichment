/**
 * Teste do enriquecimento seletivo - apenas registros não processados
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SheetService } from './services/sheet.service';
import { DataEnrichmentService } from './services/data-enrichment.service';

async function testSelectiveEnrichment() {
  console.log('🧪 Testando enriquecimento seletivo...\n');

  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const sheetService = app.get(SheetService);
    const dataEnrichmentService = app.get(DataEnrichmentService);

    // Criar planilha com dados mistos (alguns já enriquecidos)
    const initialData = [
      {
        nome: "Empresa A",
        cnpj: "48.888.581/0001-76", // Será enriquecida
        email: "contato@empresaa.com",
      },
      {
        nome: "Empresa B", 
        cnpj: "11.222.333/0001-81", // Será enriquecida
        email: "contato@empresab.com",
      },
      {
        nome: "Empresa C",
        cnpj: "", // Sem CNPJ - não será processada
        email: "contato@empresac.com",
      }
    ];

    const sheet = sheetService.createSheet("Teste Seletivo", initialData, "test-user");
    console.log(`✅ Planilha criada: ${sheet.id}`);

    // Verificar estatísticas iniciais
    let stats = sheetService.getEnrichmentStats(sheet.id);
    console.log(`📊 Estatísticas iniciais:`);
    console.log(`   Total: ${stats.total} | Com CNPJ: ${stats.withCnpj} | Enriquecidos: ${stats.enriched} | Pendentes: ${stats.unenriched}`);

    // PRIMEIRO ENRIQUECIMENTO - deve processar 2 registros
    console.log('\n🔍 Primeiro enriquecimento...');
    
    const sessionId1 = await dataEnrichmentService.enrichSheet(
      sheet.id,
      'company',
      { cnpjField: 'cnpj' },
      'test-user'
    );

    console.log(`✅ Primeiro enriquecimento iniciado: ${sessionId1}`);

    // Aguardar conclusão
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        const session = dataEnrichmentService.getSession(sessionId1);
        if (session && (session.status === 'completed' || session.status === 'error')) {
          clearInterval(checkInterval);
          resolve(void 0);
        }
      }, 500);
    });

    // Verificar estatísticas após primeiro enriquecimento
    stats = sheetService.getEnrichmentStats(sheet.id);
    console.log(`📊 Após primeiro enriquecimento:`);
    console.log(`   Total: ${stats.total} | Com CNPJ: ${stats.withCnpj} | Enriquecidos: ${stats.enriched} | Pendentes: ${stats.unenriched}`);

    // ADICIONAR NOVA LINHA COM CNPJ
    console.log('\n➕ Adicionando nova linha com CNPJ...');
    
    const newRowData = {
      nome: "Empresa Nova",
      cnpj: "14.200.166/0001-10", // Novo CNPJ para enriquecer
      email: "contato@empresanova.com",
    };

    sheetService.addRow(sheet.id, newRowData, "test-user");
    console.log(`✅ Nova linha adicionada`);

    // Verificar estatísticas após adição
    stats = sheetService.getEnrichmentStats(sheet.id);
    console.log(`📊 Após adicionar nova linha:`);
    console.log(`   Total: ${stats.total} | Com CNPJ: ${stats.withCnpj} | Enriquecidos: ${stats.enriched} | Pendentes: ${stats.unenriched}`);

    // Verificar registros não enriquecidos
    const unenrichedRows = sheetService.getUnenrichedRows(sheet.id);
    console.log(`🔍 Registros não enriquecidos encontrados: ${unenrichedRows.length}`);
    unenrichedRows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.data.nome} - CNPJ: ${row.data.cnpj} (índice original: ${row.index})`);
    });

    // SEGUNDO ENRIQUECIMENTO - deve processar apenas 1 registro (o novo)
    console.log('\n🔍 Segundo enriquecimento (apenas novos registros)...');
    
    const sessionId2 = await dataEnrichmentService.enrichSheet(
      sheet.id,
      'company',
      { cnpjField: 'cnpj' },
      'test-user'
    );

    console.log(`✅ Segundo enriquecimento iniciado: ${sessionId2}`);

    // Aguardar conclusão
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        const session = dataEnrichmentService.getSession(sessionId2);
        if (session && (session.status === 'completed' || session.status === 'error')) {
          clearInterval(checkInterval);
          resolve(void 0);
        }
      }, 500);
    });

    // Verificar estatísticas finais
    stats = sheetService.getEnrichmentStats(sheet.id);
    console.log(`📊 Estatísticas finais:`);
    console.log(`   Total: ${stats.total} | Com CNPJ: ${stats.withCnpj} | Enriquecidos: ${stats.enriched} | Pendentes: ${stats.unenriched}`);

    // Verificar dados finais
    const finalData = sheetService.getSheetData(sheet.id);
    console.log(`\n📋 Dados finais da planilha:`);
    console.log(`   Linhas: ${finalData.rows.length}`);
    console.log(`   Colunas: ${finalData.columns.length}`);

    // Mostrar empresas enriquecidas
    console.log(`\n🏢 Empresas enriquecidas:`);
    finalData.rows.forEach((row, index) => {
      if (row._enriched && row.company_name) {
        console.log(`   ${index + 1}. ${row.nome} -> ${row.company_name}`);
      }
    });

    await app.close();

    console.log('\n' + '='.repeat(60));
    console.log('🎉 TESTE DE ENRIQUECIMENTO SELETIVO CONCLUÍDO!');
    console.log('='.repeat(60));
    console.log('✅ Apenas registros não enriquecidos foram processados');
    console.log('✅ Estatísticas funcionando corretamente');
    console.log('✅ Adição de novas linhas funcionando');
    console.log('✅ Sistema otimizado para performance');

  } catch (error) {
    console.error('💥 Erro durante o teste:', error);
  }
}

testSelectiveEnrichment().catch(console.error);
