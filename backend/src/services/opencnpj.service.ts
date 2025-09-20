import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { 
  OpenCNPJResponse, 
  CNPJEnrichmentResult, 
  CNPJValidationError 
} from '../types/opencnpj.types';

@Injectable()
export class OpenCNPJService {
  private readonly logger = new Logger(OpenCNPJService.name);
  private readonly baseUrl = 'https://api.opencnpj.org';
  private readonly requestQueue: Map<string, Promise<CNPJEnrichmentResult>> = new Map();

  constructor(private readonly httpService: HttpService) {}

  /**
   * Valida o formato do CNPJ
   */
  private validateCNPJFormat(cnpj: string): boolean {
    // Remove todos os caracteres não numéricos
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    
    // Verifica se tem 14 dígitos
    if (cleanCNPJ.length !== 14) {
      return false;
    }

    // Verifica se não são todos dígitos iguais
    if (/^(\d)\1{13}$/.test(cleanCNPJ)) {
      return false;
    }

    // Validação dos dígitos verificadores
    return this.validateCNPJCheckDigits(cleanCNPJ);
  }

  /**
   * Valida os dígitos verificadores do CNPJ
   */
  private validateCNPJCheckDigits(cnpj: string): boolean {
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    // Primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cnpj[i]) * weights1[i];
    }
    const digit1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);

    if (digit1 !== parseInt(cnpj[12])) {
      return false;
    }

    // Segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cnpj[i]) * weights2[i];
    }
    const digit2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);

    return digit2 === parseInt(cnpj[13]);
  }

  /**
   * Formata o CNPJ para o padrão aceito pela API
   */
  private formatCNPJForAPI(cnpj: string): string {
    // Remove todos os caracteres não numéricos
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    
    // Retorna no formato com pontuação completa: 00.000.000/0000-00
    return `${cleanCNPJ.slice(0, 2)}.${cleanCNPJ.slice(2, 5)}.${cleanCNPJ.slice(5, 8)}/${cleanCNPJ.slice(8, 12)}-${cleanCNPJ.slice(12, 14)}`;
  }

  /**
   * Transforma a resposta da API em um formato mais amigável
   */
  private transformResponse(response: OpenCNPJResponse): CNPJEnrichmentResult {
    return {
      cnpj: response.cnpj,
      razaoSocial: response.razao_social,
      nomeFantasia: response.nome_fantasia,
      situacaoCadastral: response.situacao_cadastral,
      dataSituacaoCadastral: response.data_situacao_cadastral,
      matrizFilial: response.matriz_filial,
      dataInicioAtividade: response.data_inicio_atividade,
      cnaePrincipal: response.cnae_principal,
      cnaesSecundarios: response.cnaes_secundarios,
      cnaesSecundariosCount: response.cnaes_secundarios_count,
      naturezaJuridica: response.natureza_juridica,
      endereco: {
        logradouro: response.logradouro,
        numero: response.numero,
        complemento: response.complemento,
        bairro: response.bairro,
        cep: response.cep,
        uf: response.uf,
        municipio: response.municipio,
      },
      contato: {
        email: response.email,
        telefones: response.telefones,
      },
      capitalSocial: response.capital_social,
      porteEmpresa: response.porte_empresa,
      opcaoSimples: response.opcao_simples,
      dataOpcaoSimples: response.data_opcao_simples,
      opcaoMei: response.opcao_mei,
      dataOpcaoMei: response.data_opcao_mei,
      socios: response.QSA,
      enrichedAt: new Date(),
    };
  }

  /**
   * Busca dados de uma empresa pelo CNPJ
   */
  async enrichCNPJ(cnpj: string): Promise<CNPJEnrichmentResult> {
    // Valida o formato do CNPJ
    if (!this.validateCNPJFormat(cnpj)) {
      const error: CNPJValidationError = {
        code: 'INVALID_FORMAT',
        message: 'CNPJ inválido. Verifique o formato e os dígitos verificadores.',
      };
      throw new HttpException(error, HttpStatus.BAD_REQUEST);
    }

    const formattedCNPJ = this.formatCNPJForAPI(cnpj);
    
    // Verifica se já existe uma requisição em andamento para este CNPJ
    if (this.requestQueue.has(formattedCNPJ)) {
      this.logger.log(`Reusing existing request for CNPJ: ${formattedCNPJ}`);
      return this.requestQueue.get(formattedCNPJ)!;
    }

    // Cria uma nova requisição
    const requestPromise = this.performCNPJRequest(formattedCNPJ);
    this.requestQueue.set(formattedCNPJ, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Remove da fila após completar
      this.requestQueue.delete(formattedCNPJ);
    }
  }

  /**
   * Executa a requisição para a API OpenCNPJ
   */
  private async performCNPJRequest(formattedCNPJ: string): Promise<CNPJEnrichmentResult> {
    const url = `${this.baseUrl}/${(formattedCNPJ)}`;
    
    this.logger.log(`Fetching CNPJ data from: ${url}`);

    try {
      const response = await firstValueFrom(
        this.httpService.get<OpenCNPJResponse>(url, {
          timeout: 10000, // 10 segundos de timeout
          headers: {
            'User-Agent': 'Enrichment-Backend/1.0',
          },
        })
      );

      this.logger.log(`Successfully fetched data for CNPJ: ${formattedCNPJ}`);
      return this.transformResponse(response.data);

    } catch (error: any) {
      this.logger.error(`Error fetching CNPJ data for ${formattedCNPJ}:`, error.message);

      if (error.response?.status === 404) {
        const validationError: CNPJValidationError = {
          code: 'NOT_FOUND',
          message: 'CNPJ não encontrado na base de dados da Receita Federal.',
        };
        throw new HttpException(validationError, HttpStatus.NOT_FOUND);
      }

      if (error.response?.status === 429) {
        const validationError: CNPJValidationError = {
          code: 'RATE_LIMIT',
          message: 'Limite de requisições excedido. Tente novamente em alguns segundos.',
        };
        throw new HttpException(validationError, HttpStatus.TOO_MANY_REQUESTS);
      }

      const validationError: CNPJValidationError = {
        code: 'API_ERROR',
        message: 'Erro interno ao consultar dados do CNPJ. Tente novamente mais tarde.',
      };
      throw new HttpException(validationError, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Processa múltiplos CNPJs com controle de rate limiting
   */
  async enrichMultipleCNPJs(cnpjs: string[]): Promise<(CNPJEnrichmentResult | CNPJValidationError)[]> {
    const results: (CNPJEnrichmentResult | CNPJValidationError)[] = [];
    const batchSize = 10; // Processa 10 CNPJs por vez para respeitar rate limit
    const delayBetweenBatches = 1000; // 1 segundo entre batches

    for (let i = 0; i < cnpjs.length; i += batchSize) {
      const batch = cnpjs.slice(i, i + batchSize);
      
      this.logger.log(`Processing CNPJ batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cnpjs.length / batchSize)}`);

      const batchPromises = batch.map(async (cnpj) => {
        try {
          return await this.enrichCNPJ(cnpj);
        } catch (error: any) {
          if (error.response?.data) {
            return error.response.data as CNPJValidationError;
          }
          return {
            code: 'API_ERROR' as const,
            message: `Erro ao processar CNPJ ${cnpj}: ${error.message}`,
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            code: 'API_ERROR',
            message: `Erro inesperado: ${result.reason}`,
          });
        }
      });

      // Delay entre batches para respeitar rate limit
      if (i + batchSize < cnpjs.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    return results;
  }
}
