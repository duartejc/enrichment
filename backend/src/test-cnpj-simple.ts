/**
 * Teste simples do OpenCNPJService (sem dependências do Bull/Redis)
 * Execute com: npx ts-node src/test-cnpj-simple.ts
 */

import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { OpenCNPJService } from './services/opencnpj.service';

// Mock do HttpService para teste
class MockHttpService {
  get(url: string, config?: any) {
    // Simula uma resposta da API OpenCNPJ
    return {
      toPromise: () => Promise.resolve({
        data: {
          cnpj: "11222333000181",
          razao_social: "EMPRESA EXEMPLO LTDA",
          nome_fantasia: "EXEMPLO",
          situacao_cadastral: "Ativa",
          data_situacao_cadastral: "2000-01-01",
          matriz_filial: "Matriz",
          data_inicio_atividade: "2000-01-01",
          cnae_principal: "6201500",
          cnaes_secundarios: ["6202300", "6203100"],
          cnaes_secundarios_count: 2,
          natureza_juridica: "Sociedade Empresária Limitada",
          logradouro: "RUA EXEMPLO",
          numero: "123",
          complemento: "SALA 1",
          bairro: "BAIRRO EXEMPLO",
          cep: "01234567",
          uf: "SP",
          municipio: "SAO PAULO",
          email: "contato@exemplo.com",
          telefones: [
            {
              ddd: "11",
              numero: "900000000",
              is_fax: false
            }
          ],
          capital_social: "1000,00",
          porte_empresa: "Microempresa (ME)",
          opcao_simples: null,
          data_opcao_simples: null,
          opcao_mei: null,
          data_opcao_mei: null,
          QSA: [
            {
              nome_socio: "SOCIO EXEMPLO",
              cnpj_cpf_socio: "***000000**",
              qualificacao_socio: "Administrador",
              data_entrada_sociedade: "2000-01-01",
              identificador_socio: "Pessoa Física",
              faixa_etaria: "31 a 40 anos"
            }
          ]
        }
      })
    };
  }
}

async function testCNPJValidation() {
  console.log('🚀 Testando validação de CNPJ...\n');

  // Criar instância do serviço com mock
  const httpService = new MockHttpService() as any;
  const openCNPJService = new OpenCNPJService(httpService);

  // Testes de validação
  const testCases = [
    { cnpj: '11.222.333/0001-81', expected: true, description: 'CNPJ válido com formatação' },
    { cnpj: '11222333000181', expected: true, description: 'CNPJ válido sem formatação' },
    { cnpj: '12.345.678/0001-99', expected: false, description: 'CNPJ inválido (dígitos verificadores)' },
    { cnpj: '123.456.789', expected: false, description: 'CNPJ com formato inválido' },
    { cnpj: '11111111111111', expected: false, description: 'CNPJ com todos dígitos iguais' },
    { cnpj: '1122233300018', expected: false, description: 'CNPJ com 13 dígitos' },
  ];

  for (const testCase of testCases) {
    try {
      console.log(`📋 Testando: ${testCase.description}`);
      console.log(`   CNPJ: ${testCase.cnpj}`);
      
      const result = await openCNPJService.enrichCNPJ(testCase.cnpj);
      
      if (testCase.expected) {
        console.log(`   ✅ Sucesso! Razão Social: ${result.razaoSocial}`);
      } else {
        console.log(`   ❌ Erro: Deveria ter falhado mas passou`);
      }
    } catch (error: any) {
      if (!testCase.expected) {
        console.log(`   ✅ Erro esperado: ${error.message}`);
      } else {
        console.log(`   ❌ Erro inesperado: ${error.message}`);
      }
    }
    console.log('');
  }

  console.log('🎉 Teste de validação concluído!');
}

// Executar teste
testCNPJValidation().catch(console.error);
