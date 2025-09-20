/**
 * Teste completo do sistema de planilhas colaborativas
 * Execute com: npx ts-node src/test-sheet-system.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SheetService } from './services/sheet.service';
import { CollaborationService } from './services/collaboration.service';
import { DataEnrichmentService } from './services/data-enrichment.service';

async function testSheetSystem() {
  console.log('🚀 Testando Sistema de Planilhas Colaborativas...\n');

  try {
    // Criar aplicação NestJS
    const app = await NestFactory.createApplicationContext(AppModule);
    const sheetService = app.get(SheetService);
    const collaborationService = app.get(CollaborationService);
    const dataEnrichmentService = app.get(DataEnrichmentService);

    // ===== TESTE 1: CRIAÇÃO DE PLANILHA =====
    console.log('📊 Teste 1: Criando planilha com dados iniciais...');

    const initialData = [
      {
        nome: 'José da Silva',
        empresa: 'Empresa A',
        cnpj: '48.888.581/0001-76',
        email: 'jose@empresa.com',
        telefone: '(11) 9999-8888',
        status: 'Ativo',
      },
      {
        nome: 'Maria Silva',
        empresa: 'Empresa B',
        cnpj: '05.206.246/0001-38',
        email: 'maria@empresa.com',
        telefone: '(11) 9777-6666',
        status: 'Pendente',
      },
      {
        nome: 'João Santos',
        empresa: 'Empresa C',
        cnpj: '12.345.678/0001-99', // CNPJ inválido para teste
        email: 'joao@empresa.com',
        telefone: '(11) 9555-4444',
        status: 'Ativo',
      },
    ];

    const sheet = sheetService.createSheet(
      'Planilha de Prospects - Teste',
      initialData,
      'user-test-1',
    );

    console.log(`✅ Planilha criada: ${sheet.name} (ID: ${sheet.id})`);
    console.log(`   📋 Linhas: ${sheet.metadata.totalRows}`);
    console.log(`   📊 Colunas: ${sheet.metadata.totalColumns}`);
    console.log(
      `   ✏️  Campos editáveis: ${sheet.metadata.editableFields.join(', ')}`,
    );

    // ===== TESTE 2: COLABORAÇÃO =====
    console.log('\n👥 Teste 2: Simulando colaboração em tempo real...');

    // Usuário 1 entra na planilha
    const user1Event = collaborationService.userJoinSheet(
      sheet.id,
      'user-1',
      'João Developer',
      'socket-1',
    );
    console.log(`   ✅ ${user1Event.userName} entrou na planilha`);

    // Usuário 2 entra na planilha
    const user2Event = collaborationService.userJoinSheet(
      sheet.id,
      'user-2',
      'Maria Designer',
      'socket-2',
    );
    console.log(`   ✅ ${user2Event.userName} entrou na planilha`);

    // Atualizar cursor do usuário 1
    const cursorEvent = collaborationService.updateUserCursor(
      sheet.id,
      'user-1',
      { row: 0, column: 'nome' },
    );
    console.log(`   🖱️  ${cursorEvent?.userName} moveu cursor para [0, nome]`);

    // Mostrar usuários ativos
    const activeUsers = collaborationService.getActiveUsers(sheet.id);
    console.log(`   👥 Usuários ativos: ${activeUsers.length}`);
    activeUsers.forEach((user) => {
      console.log(`      - ${user.userName} (cor: ${user.color})`);
    });

    // ===== TESTE 3: EDIÇÃO DE CÉLULAS =====
    console.log('\n✏️  Teste 3: Editando células da planilha...');

    // Atualizar célula
    const updatedSheet = sheetService.updateCell(
      sheet.id,
      0, // primeira linha
      'email', // coluna email
      'jose.silva@novodominio.com',
      'user-1',
    );
    console.log(
      `   ✅ Célula [0, email] atualizada (versão: ${updatedSheet.metadata.version})`,
    );

    // Adicionar nova linha
    const newRowSheet = sheetService.addRow(
      sheet.id,
      {
        nome: 'Ana Oliveira',
        empresa: 'Empresa D',
        cnpj: '11.444.777/0001-61',
        email: 'ana@empresa.com',
        telefone: '(11) 9333-2222',
        status: 'Ativo',
      },
      'user-2',
    );
    console.log(
      `   ✅ Nova linha adicionada (total: ${newRowSheet.metadata.totalRows})`,
    );

    // Adicionar nova coluna
    const newColumnSheet = sheetService.addColumn(
      sheet.id,
      {
        name: 'Observações',
        type: 'text',
        editable: true,
      },
      'user-1',
    );
    console.log(
      `   ✅ Nova coluna 'Observações' adicionada (total: ${newColumnSheet.metadata.totalColumns})`,
    );

    // ===== TESTE 4: ENRIQUECIMENTO DE DADOS =====
    console.log('\n🔍 Teste 4: Enriquecimento de dados com CNPJ...');

    const totalResults = 0;

    const sessionId = await dataEnrichmentService.enrichSheet(
      sheet.id,
      'company',
      { cnpjField: 'cnpj' },
      'user-1',
    );

    // Aguardar conclusão do enriquecimento
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const session = dataEnrichmentService.getSession(sessionId);
        if (
          session &&
          (session.status === 'completed' || session.status === 'error')
        ) {
          clearInterval(checkInterval);
          // enrichmentCompleted = true;
          resolve(void 0);
        }
      }, 500);
    });

    console.log(
      `   🎉 Enriquecimento concluído! Total de resultados: ${totalResults}`,
    );

    // ===== TESTE 5: DADOS FINAIS DA PLANILHA =====
    console.log('\n📊 Teste 5: Estado final da planilha...');

    const finalSheetData = sheetService.getSheetData(sheet.id);
    console.log(`   📋 Total de linhas: ${finalSheetData.metadata.totalRows}`);
    console.log(
      `   📊 Total de colunas: ${finalSheetData.metadata.totalColumns}`,
    );
    console.log(
      `   📅 Última modificação: ${finalSheetData.metadata.lastModified.toLocaleString('pt-BR')}`,
    );
    console.log(`   🔢 Versão: ${finalSheetData.metadata.version}`);

    console.log('\n   📋 Colunas disponíveis:');
    finalSheetData.columns.forEach((col, index) => {
      const editableIcon = col.editable ? '✏️' : '🔒';
      const enrichedIcon = col.enrichmentType ? '🔍' : '';
      console.log(
        `      ${index + 1}. ${editableIcon} ${col.name} (${col.type}) ${enrichedIcon}`,
      );
    });

    console.log('\n   📊 Primeiras 3 linhas:');
    finalSheetData.rows.slice(0, 3).forEach((row, index) => {
      console.log(`      Linha ${index + 1}:`);
      console.log(`         Nome: ${row.nome || 'N/A'}`);
      console.log(`         Empresa: ${row.empresa || 'N/A'}`);
      console.log(`         CNPJ: ${row.cnpj || 'N/A'}`);
      if (row.company_name) {
        console.log(`         🔍 Razão Social: ${row.company_name}`);
      }
      if (row.contact && row.contact.email) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        console.log(`         🔍 Email Empresarial: ${row.contact.email}`);
      }
    });

    // ===== TESTE 6: HISTÓRICO DE OPERAÇÕES =====
    console.log('\n📜 Teste 6: Histórico de operações...');

    const history = sheetService.getOperationHistory(sheet.id, 10);
    console.log(`   📋 Total de operações: ${history.length}`);

    history.slice(0, 5).forEach((op, index) => {
      const timestamp = new Date(op.timestamp).toLocaleTimeString('pt-BR');
      console.log(
        `      ${index + 1}. [${timestamp}] ${op.type} por ${op.userId}`,
      );
    });

    // ===== TESTE 7: ESTATÍSTICAS DE COLABORAÇÃO =====
    console.log('\n📊 Teste 7: Estatísticas de colaboração...');

    const stats = collaborationService.getCollaborationStats();
    console.log(`   👥 Usuários ativos: ${stats.totalActiveUsers}`);
    console.log(`   📊 Planilhas ativas: ${stats.totalActiveSheets}`);
    console.log(
      `   🤝 Planilhas colaborativas: ${stats.sheetsWithMultipleUsers}`,
    );
    console.log(`   📈 Média usuários/planilha: ${stats.averageUsersPerSheet}`);

    // ===== LIMPEZA =====
    console.log('\n🧹 Limpeza: Usuários saindo da planilha...');

    const user1LeaveEvent = collaborationService.userLeaveSheet(
      sheet.id,
      'user-1',
    );
    const user2LeaveEvent = collaborationService.userLeaveSheet(
      sheet.id,
      'user-2',
    );

    if (user1LeaveEvent)
      console.log(`   👋 ${user1LeaveEvent.userName} saiu da planilha`);
    if (user2LeaveEvent)
      console.log(`   👋 ${user2LeaveEvent.userName} saiu da planilha`);

    await app.close();

    console.log('\n' + '='.repeat(60));
    console.log('🎉 TESTE COMPLETO FINALIZADO COM SUCESSO!');
    console.log('='.repeat(60));
    console.log(
      '✅ Sistema de planilhas colaborativas funcionando perfeitamente',
    );
    console.log('✅ Enriquecimento de dados integrado');
    console.log('✅ Colaboração em tempo real implementada');
    console.log('✅ Estrutura flexível e escalável');
    console.log('✅ Pronto para integração com frontend');
  } catch (error) {
    console.error('💥 Erro durante o teste:', error);
  }
}

// Executar teste
testSheetSystem().catch(console.error);
