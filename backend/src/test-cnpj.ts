/**
 * Script de teste para o sistema de enriquecimento CNPJ
 * Execute com: npx ts-node src/test-cnpj.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { OpenCNPJService } from './services/opencnpj.service';

async function testCNPJEnrichment() {
  console.log('🚀 Iniciando teste do sistema de enriquecimento CNPJ...\n');

  try {
    // Criar aplicação NestJS
    const app = await NestFactory.createApplicationContext(AppModule);
    const openCNPJService = app.get(OpenCNPJService);

    // Teste 1: CNPJ válido (exemplo da documentação)
    console.log('📋 Teste 1: CNPJ válido');
    console.log('CNPJ: 11.222.333/0001-81');
    
    try {
      const result = await openCNPJService.enrichCNPJ('11.222.333/0001-81');
      console.log('✅ Sucesso!');
      console.log(`Razão Social: ${result.razaoSocial}`);
      console.log(`Nome Fantasia: ${result.nomeFantasia}`);
      console.log(`Situação: ${result.situacaoCadastral}`);
      console.log(`Cidade: ${result.endereco.municipio}/${result.endereco.uf}`);
      console.log(`Email: ${result.contato.email}`);
    } catch (error: any) {
      console.log(`❌ Erro esperado: ${error.message}`);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Teste 2: CNPJ inválido
    console.log('📋 Teste 2: CNPJ inválido');
    console.log('CNPJ: 12.345.678/0001-99');
    
    try {
      const result = await openCNPJService.enrichCNPJ('12.345.678/0001-99');
      console.log('✅ Sucesso inesperado!');
      console.log(`Razão Social: ${result.razaoSocial}`);
    } catch (error: any) {
      console.log(`❌ Erro esperado: ${error.message}`);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Teste 3: CNPJ com formato diferente
    console.log('📋 Teste 3: CNPJ sem formatação');
    console.log('CNPJ: 11222333000181');
    
    try {
      const result = await openCNPJService.enrichCNPJ('11222333000181');
      console.log('✅ Sucesso!');
      console.log(`Razão Social: ${result.razaoSocial}`);
    } catch (error: any) {
      console.log(`❌ Erro: ${error.message}`);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Teste 4: CNPJ com formato inválido
    console.log('📋 Teste 4: CNPJ com formato inválido');
    console.log('CNPJ: 123.456.789');
    
    try {
      const result = await openCNPJService.enrichCNPJ('123.456.789');
      console.log('✅ Sucesso inesperado!');
    } catch (error: any) {
      console.log(`❌ Erro esperado: ${error.message}`);
    }

    await app.close();
    console.log('\n🎉 Teste concluído!');

  } catch (error) {
    console.error('💥 Erro durante o teste:', error);
  }
}

// Executar teste
testCNPJEnrichment().catch(console.error);
