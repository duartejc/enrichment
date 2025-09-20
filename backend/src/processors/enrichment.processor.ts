import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger, Injectable } from '@nestjs/common';
import { OpenCNPJService } from '../services/opencnpj.service';
import { CNPJEnrichmentResult, CNPJValidationError } from '../types/opencnpj.types';

@Processor('enrichment')
@Injectable()
export class EnrichmentProcessor {
  private readonly logger = new Logger(EnrichmentProcessor.name);

  constructor(private readonly openCNPJService: OpenCNPJService) {}

  @Process('enrich-batch')
  async handleEnrichBatch(job: Job) {
    const { batch, enrichmentType, options, sessionId } = job.data;
    
    this.logger.log(`Processing enrichment batch for session ${sessionId}`);
    
    try {
      // Simulate batch processing
      const results = await this.processBatchData(batch, enrichmentType, options);
      
      this.logger.log(`Batch processed successfully for session ${sessionId}`);
      
      return {
        sessionId,
        results,
        batchIndex: job.data.batchIndex,
        processedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Batch processing failed for session ${sessionId}: ${error.message}`);
      throw error;
    }
  }

  private async processBatchData(batch: any[], enrichmentType: string, options: any) {
    const results: any[] = [];
    
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      
      try {
        let enrichedFields: any = {};
        
        if (enrichmentType === 'cnpj' || enrichmentType === 'company') {
          enrichedFields = await this.enrichWithCNPJ(item, options);
        } else {
          // Fallback para outros tipos de enriquecimento
          enrichedFields = this.generateEnrichedData(item, enrichmentType);
        }
        
        results.push({
          rowIndex: item.originalIndex || i,
          data: item,
          enrichedFields,
          success: true,
        });
        
      } catch (error: any) {
        this.logger.error(`Error enriching item at index ${i}:`, error.message);
        
        results.push({
          rowIndex: item.originalIndex || i,
          data: item,
          enrichedFields: {},
          success: false,
          error: {
            message: error.message,
            code: error.response?.data?.code || 'UNKNOWN_ERROR',
          },
        });
      }
    }
    
    return results;
  }

  /**
   * Enriquece dados usando a API OpenCNPJ
   */
  private async enrichWithCNPJ(item: any, options: any): Promise<any> {
    // Tenta encontrar o CNPJ no item
    const cnpj = this.extractCNPJFromItem(item, options);
    
    if (!cnpj) {
      throw new Error('CNPJ não encontrado no item para enriquecimento');
    }

    this.logger.log(`Enriching CNPJ: ${cnpj}`);
    
    const enrichmentResult = await this.openCNPJService.enrichCNPJ(cnpj);
    
    // Transforma o resultado em um formato mais simples para o frontend
    return {
      cnpj: enrichmentResult.cnpj,
      razaoSocial: enrichmentResult.razaoSocial,
      nomeFantasia: enrichmentResult.nomeFantasia,
      situacaoCadastral: enrichmentResult.situacaoCadastral,
      dataSituacaoCadastral: enrichmentResult.dataSituacaoCadastral,
      matrizFilial: enrichmentResult.matrizFilial,
      dataInicioAtividade: enrichmentResult.dataInicioAtividade,
      cnaePrincipal: enrichmentResult.cnaePrincipal,
      naturezaJuridica: enrichmentResult.naturezaJuridica,
      endereco: {
        logradouro: enrichmentResult.endereco.logradouro,
        numero: enrichmentResult.endereco.numero,
        complemento: enrichmentResult.endereco.complemento,
        bairro: enrichmentResult.endereco.bairro,
        cep: enrichmentResult.endereco.cep,
        cidade: enrichmentResult.endereco.municipio,
        uf: enrichmentResult.endereco.uf,
      },
      contato: {
        email: enrichmentResult.contato.email,
        telefones: enrichmentResult.contato.telefones.map(tel => ({
          numero: `(${tel.ddd}) ${tel.numero}`,
          tipo: tel.is_fax ? 'fax' : 'telefone',
        })),
      },
      capitalSocial: enrichmentResult.capitalSocial,
      porteEmpresa: enrichmentResult.porteEmpresa,
      quantidadeSocios: enrichmentResult.socios.length,
      socios: enrichmentResult.socios.map(socio => ({
        nome: socio.nome_socio,
        qualificacao: socio.qualificacao_socio,
        dataEntrada: socio.data_entrada_sociedade,
        tipo: socio.identificador_socio,
      })),
      enrichedAt: enrichmentResult.enrichedAt,
    };
  }

  /**
   * Extrai o CNPJ do item baseado nas opções de configuração
   */
  private extractCNPJFromItem(item: any, options: any): string | null {
    // Se as opções especificam qual campo contém o CNPJ
    if (options?.cnpjField && item[options.cnpjField]) {
      return item[options.cnpjField];
    }

    // Tenta campos comuns que podem conter CNPJ
    const commonCNPJFields = ['cnpj', 'CNPJ', 'document', 'documento', 'registration', 'registro'];
    
    for (const field of commonCNPJFields) {
      if (item[field]) {
        return item[field];
      }
    }

    // Procura por qualquer campo que pareça ser um CNPJ (14 dígitos)
    for (const [key, value] of Object.entries(item)) {
      if (typeof value === 'string') {
        const cleanValue = value.replace(/\D/g, '');
        if (cleanValue.length === 14) {
          return value;
        }
      }
    }

    return null;
  }

  private generateEnrichedData(item: any, enrichmentType: string) {
    const enriched: any = {};
    
    switch (enrichmentType) {
      case 'address':
        enriched.address = `${Math.floor(Math.random() * 10000)} Main St`;
        enriched.city = `City ${Math.floor(Math.random() * 100)}`;
        enriched.state = ['CA', 'NY', 'TX', 'FL'][Math.floor(Math.random() * 4)];
        enriched.zip = String(Math.floor(Math.random() * 90000) + 10000);
        break;
        
      case 'email':
        enriched.email = `${item.name?.toLowerCase().replace(/\s+/g, '.') || 'user'}@company.com`;
        enriched.emailVerified = Math.random() > 0.2;
        enriched.emailDomain = 'company.com';
        break;
        
      case 'phone':
        enriched.phone = `+1 ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`;
        enriched.phoneType = Math.random() > 0.5 ? 'mobile' : 'landline';
        enriched.phoneValid = Math.random() > 0.1;
        break;
        
      case 'company':
      case 'cnpj':
        // Para casos de CNPJ/empresa, este método só é chamado como fallback
        // A lógica principal está no enrichWithCNPJ
        enriched.note = 'Enriquecimento de CNPJ requer dados válidos';
        break;
        
      default:
        enriched.enrichedData = `Custom enrichment for ${enrichmentType}`;
    }
    
    return enriched;
  }
}
