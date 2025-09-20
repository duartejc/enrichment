/**
 * Exemplo de como usar o sistema de enriquecimento de CNPJ
 * 
 * Este arquivo demonstra como configurar e usar o enriquecimento
 * de dados de empresas brasileiras usando a API OpenCNPJ.
 */

import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

@Injectable()
export class CNPJEnrichmentExample {
  constructor(
    @InjectQueue('enrichment') private enrichmentQueue: Queue,
  ) {}

  /**
   * Exemplo 1: Enriquecimento de um único CNPJ
   */
  async enrichSingleCNPJ() {
    const sampleData = [
      {
        originalIndex: 0,
        cnpj: '11.222.333/0001-81', // CNPJ de exemplo
        nomeEmpresa: 'Empresa Exemplo',
      }
    ];

    const job = await this.enrichmentQueue.add('enrich-batch', {
      batch: sampleData,
      enrichmentType: 'cnpj',
      options: {
        cnpjField: 'cnpj', // Campo que contém o CNPJ
      },
      sessionId: 'example-session-1',
      batchIndex: 0,
    });

    console.log(`Job criado com ID: ${job.id}`);
    return job;
  }

  /**
   * Exemplo 2: Enriquecimento em lote de múltiplos CNPJs
   */
  async enrichMultipleCNPJs() {
    const sampleData = [
      {
        originalIndex: 0,
        documento: '11.222.333/0001-81',
        nome: 'Empresa A',
      },
      {
        originalIndex: 1,
        documento: '44.555.666/0001-77',
        nome: 'Empresa B',
      },
      {
        originalIndex: 2,
        documento: '77.888.999/0001-33',
        nome: 'Empresa C',
      }
    ];

    const job = await this.enrichmentQueue.add('enrich-batch', {
      batch: sampleData,
      enrichmentType: 'cnpj',
      options: {
        cnpjField: 'documento', // Campo personalizado que contém o CNPJ
      },
      sessionId: 'example-session-2',
      batchIndex: 0,
    });

    console.log(`Job em lote criado com ID: ${job.id}`);
    return job;
  }

  /**
   * Exemplo 3: Enriquecimento com detecção automática de CNPJ
   */
  async enrichWithAutoDetection() {
    const sampleData = [
      {
        originalIndex: 0,
        // O sistema tentará detectar automaticamente qual campo contém o CNPJ
        cnpj: '11.222.333/0001-81',
        razaoSocial: 'Empresa Exemplo LTDA',
        setor: 'Tecnologia',
      }
    ];

    const job = await this.enrichmentQueue.add('enrich-batch', {
      batch: sampleData,
      enrichmentType: 'company', // Pode usar 'company' ou 'cnpj'
      options: {}, // Sem especificar cnpjField - detecção automática
      sessionId: 'example-session-3',
      batchIndex: 0,
    });

    console.log(`Job com detecção automática criado com ID: ${job.id}`);
    return job;
  }

  /**
   * Exemplo 4: Como processar o resultado do enriquecimento
   */
  async processEnrichmentResult(jobResult: any) {
    console.log('Resultado do enriquecimento:');
    console.log(`Session ID: ${jobResult.sessionId}`);
    console.log(`Processado em: ${jobResult.processedAt}`);
    
    jobResult.results.forEach((result: any, index: number) => {
      console.log(`\n--- Item ${index + 1} ---`);
      
      if (result.success) {
        const enriched = result.enrichedFields;
        console.log(`CNPJ: ${enriched.cnpj}`);
        console.log(`Razão Social: ${enriched.razaoSocial}`);
        console.log(`Nome Fantasia: ${enriched.nomeFantasia}`);
        console.log(`Situação: ${enriched.situacaoCadastral}`);
        console.log(`Endereço: ${enriched.endereco.logradouro}, ${enriched.endereco.numero}`);
        console.log(`Cidade: ${enriched.endereco.cidade}/${enriched.endereco.uf}`);
        console.log(`Email: ${enriched.contato.email}`);
        console.log(`Porte: ${enriched.porteEmpresa}`);
        console.log(`Sócios: ${enriched.quantidadeSocios}`);
      } else {
        console.log(`Erro: ${result.error.message}`);
        console.log(`Código: ${result.error.code}`);
      }
    });
  }
}

/**
 * Estrutura esperada do resultado do enriquecimento:
 * 
 * {
 *   sessionId: string,
 *   results: [
 *     {
 *       rowIndex: number,
 *       data: any, // Dados originais
 *       enrichedFields: {
 *         cnpj: string,
 *         razaoSocial: string,
 *         nomeFantasia: string,
 *         situacaoCadastral: string,
 *         dataSituacaoCadastral: string,
 *         matrizFilial: string,
 *         dataInicioAtividade: string,
 *         cnaePrincipal: string,
 *         naturezaJuridica: string,
 *         endereco: {
 *           logradouro: string,
 *           numero: string,
 *           complemento: string,
 *           bairro: string,
 *           cep: string,
 *           cidade: string,
 *           uf: string,
 *         },
 *         contato: {
 *           email: string,
 *           telefones: Array<{
 *             numero: string,
 *             tipo: 'telefone' | 'fax',
 *           }>,
 *         },
 *         capitalSocial: string,
 *         porteEmpresa: string,
 *         quantidadeSocios: number,
 *         socios: Array<{
 *           nome: string,
 *           qualificacao: string,
 *           dataEntrada: string,
 *           tipo: string,
 *         }>,
 *         enrichedAt: Date,
 *       },
 *       success: boolean,
 *       error?: {
 *         message: string,
 *         code: string,
 *       }
 *     }
 *   ],
 *   batchIndex: number,
 *   processedAt: Date,
 * }
 */
