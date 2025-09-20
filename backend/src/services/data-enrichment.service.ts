import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { createHash } from 'crypto';
import { OpenCNPJService } from './opencnpj.service';
import { SheetService } from './sheet.service';
import { CollaborationService } from './collaboration.service';
import { EnrichmentResult as SheetEnrichmentResult } from '../types/sheet.types';

export interface EnrichmentProgress {
  processed: number;
  total: number;
  percentage: number;
  currentBatch: number;
}

export interface EnrichmentResult {
  rowIndex: number;
  data: any;
  enrichedFields: Record<string, any>;
}

export interface EnrichmentSession {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'error';
  progress: EnrichmentProgress;
  results: EnrichmentResult[];
  startTime: Date;
  endTime?: Date;
  error?: string;
}

@Injectable()
export class DataEnrichmentService {
  private readonly logger = new Logger(DataEnrichmentService.name);
  private readonly sessions = new Map<string, EnrichmentSession>();

  constructor(
    @InjectQueue('enrichment') private enrichmentQueue: Queue,
    private readonly openCNPJService: OpenCNPJService,
    private readonly sheetService: SheetService,
    private readonly collaborationService: CollaborationService,
  ) {}

  async startEnrichment(
    data: any[],
    enrichmentType: string,
    options: any = {},
    sessionId: string,
    onProgress: (progress: EnrichmentProgress) => void,
    onPartialResult: (results: EnrichmentResult[]) => void,
  ) {
    const session: EnrichmentSession = {
      id: sessionId,
      status: 'pending',
      progress: {
        processed: 0,
        total: data.length,
        percentage: 0,
        currentBatch: 0,
      },
      results: [],
      startTime: new Date(),
    };

    this.sessions.set(sessionId, session);

    try {
      // Split data into batches for processing
      const batchSize = options.batchSize || 50;
      const batches = this.createBatches(data, batchSize);

      this.logger.log(`Starting enrichment for ${data.length} items in ${batches.length} batches`);

      // Process batches in parallel with controlled concurrency
      const concurrency = options.concurrency || 3;
      await this.processBatchesInParallel(
        batches,
        concurrency,
        enrichmentType,
        options,
        sessionId,
        onProgress,
        onPartialResult,
      );

      // Mark session as completed
      const completedSession = this.sessions.get(sessionId);
      if (completedSession) {
        completedSession.status = 'completed';
        completedSession.endTime = new Date();
        completedSession.progress.percentage = 100;
      }

      this.logger.log(`Enrichment completed for session: ${sessionId}`);
    } catch (error) {
      const errorSession = this.sessions.get(sessionId);
      if (errorSession) {
        errorSession.status = 'error';
        errorSession.error = error.message;
        errorSession.endTime = new Date();
      }
      this.logger.error(`Enrichment failed for session ${sessionId}: ${error.message}`);
      throw error;
    }
  }

  private createBatches(data: any[], batchSize: number): any[][] {
    const batches: any[][] = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    return batches;
  }

  private async processBatchesInParallel(
    batches: any[][],
    concurrency: number,
    enrichmentType: string,
    options: any,
    sessionId: string,
    onProgress: (progress: EnrichmentProgress) => void,
    onPartialResult: (results: EnrichmentResult[]) => void,
  ) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.status = 'processing';

    // Process batches with controlled concurrency
    const processingPromises: Promise<void>[] = [];
    
    for (let i = 0; i < batches.length; i++) {
      if ((session.status as 'pending' | 'processing' | 'completed' | 'cancelled' | 'error') === 'cancelled') {
        this.logger.log(`Session ${sessionId} cancelled, stopping processing`);
        return;
      }

      const batch = batches[i];
      const batchNumber = i + 1;

      // Wait if we have too many concurrent processes
      if (processingPromises.length >= concurrency) {
        await Promise.race(processingPromises);
        // Remove completed promises
        processingPromises.splice(0, 1);
      }

      const batchPromise = this.processBatch(
        batch,
        batchNumber,
        enrichmentType,
        options,
        sessionId,
        onProgress,
        onPartialResult,
      );

      processingPromises.push(batchPromise);
    }

    // Wait for all remaining batches to complete
    await Promise.all(processingPromises);
  }

  private async processBatch(
    batch: any[],
    batchNumber: number,
    enrichmentType: string,
    options: any,
    sessionId: string,
    onProgress: (progress: EnrichmentProgress) => void,
    onPartialResult: (results: EnrichmentResult[]) => void,
  ) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === 'cancelled') return;

    try {
      this.logger.log(`Processing batch ${batchNumber} with ${batch.length} items`);

      // Simulate enrichment process (replace with actual enrichment logic)
      const enrichedResults: EnrichmentResult[] = [];

      for (let i = 0; i < batch.length; i++) {
        if ((session.status as 'pending' | 'processing' | 'completed' | 'cancelled' | 'error') === 'cancelled') break;

        const item = batch[i];
        // Usar índices originais se disponíveis, senão calcular
        const originalIndex = options.originalIndices 
          ? options.originalIndices[(batchNumber - 1) * (options.batchSize || 50) + i]
          : (batchNumber - 1) * (options.batchSize || 50) + i;

        // Perform real or simulated enrichment based on type
        const enrichedData = await this.performEnrichment(item, enrichmentType, options);

        enrichedResults.push({
          rowIndex: originalIndex,
          data: item,
          enrichedFields: enrichedData,
        });

        // Update progress
        session.progress.processed++;
        session.progress.percentage = Math.round((session.progress.processed / session.progress.total) * 100);
        session.progress.currentBatch = batchNumber;

        onProgress({ ...session.progress });
      }

      // Send partial results for this batch
      if (enrichedResults.length > 0) {
        session.results.push(...enrichedResults);
        onPartialResult(enrichedResults);
      }

      this.logger.log(`Batch ${batchNumber} completed with ${enrichedResults.length} results`);
    } catch (error) {
      this.logger.error(`Error processing batch ${batchNumber}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Performs enrichment using real APIs or simulation based on type
   */
  private async performEnrichment(
    item: any,
    enrichmentType: string,
    options: any,
  ): Promise<Record<string, any>> {
    try {
      if (enrichmentType === 'company') {
        this.logger.log(`Enriching company by CNPJ`);
        return await this.enrichCompanyWithCNPJ(item, options);
      } else {
        this.logger.log(`Enriching ${enrichmentType}`);
        return await this.simulateEnrichment(item, enrichmentType, options);
      }
    } catch (error) {
      this.logger.error(`Error enriching item: ${error.message}`);
      // Return error information instead of throwing
      return {
        error: true,
        error_message: error.message,
        error_code: error.response?.data?.code || 'ENRICHMENT_ERROR',
      };
    }
  }

  /**
   * Enriches company data using OpenCNPJ API
   */
  private async enrichCompanyWithCNPJ(item: any, options: any): Promise<Record<string, any>> {
    // Extract CNPJ from item
    const cnpj = this.extractCNPJFromItem(item, options);
    
    if (!cnpj) {
      this.logger.warn(`No CNPJ found for item: ${JSON.stringify(item)}`);
      return {
        error: true,
        error_message: 'CNPJ não encontrado no item',
        error_code: 'CNPJ_NOT_FOUND',
      };
    }

    this.logger.log(`Enriching company with CNPJ: ${cnpj}`);
    
    const enrichmentResult = await this.openCNPJService.enrichCNPJ(cnpj);
    
    // Transform the result to match the expected format
    return {
      cnpj: enrichmentResult.cnpj,
      company_name: enrichmentResult.razaoSocial,
      trade_name: enrichmentResult.nomeFantasia,
      company_status: enrichmentResult.situacaoCadastral,
      company_status_date: enrichmentResult.dataSituacaoCadastral,
      company_type: enrichmentResult.matrizFilial,
      activity_start_date: enrichmentResult.dataInicioAtividade,
      main_activity: enrichmentResult.cnaePrincipal,
      legal_nature: enrichmentResult.naturezaJuridica,
      
      // Address information
      address: {
        street: enrichmentResult.endereco.logradouro,
        number: enrichmentResult.endereco.numero,
        complement: enrichmentResult.endereco.complemento,
        neighborhood: enrichmentResult.endereco.bairro,
        zip_code: enrichmentResult.endereco.cep,
        city: enrichmentResult.endereco.municipio,
        state: enrichmentResult.endereco.uf,
      },
      
      // Contact information
      contact: {
        email: enrichmentResult.contato.email,
        phones: enrichmentResult.contato.telefones.map(tel => ({
          number: `(${tel.ddd}) ${tel.numero}`,
          type: tel.is_fax ? 'fax' : 'phone',
        })),
      },
      
      // Financial information
      share_capital: enrichmentResult.capitalSocial,
      company_size: enrichmentResult.porteEmpresa,
      partners_count: enrichmentResult.socios.length,
      
      // Partners information (first 3 for summary)
      partners: enrichmentResult.socios.slice(0, 3).map(socio => ({
        name: socio.nome_socio,
        qualification: socio.qualificacao_socio,
        entry_date: socio.data_entrada_sociedade,
        type: socio.identificador_socio,
      })),
      
      // Metadata
      enriched_at: enrichmentResult.enrichedAt,
      data_source: 'OpenCNPJ API',
      success: true,
    };
  }

  /**
   * Extracts CNPJ from item based on configuration options
   */
  private extractCNPJFromItem(item: any, options: any): string | null {
    // If options specify which field contains the CNPJ
    if (options?.cnpjField && item[options.cnpjField]) {
      return item[options.cnpjField];
    }

    // Try common CNPJ fields
    const commonCNPJFields = ['cnpj', 'CNPJ', 'document', 'documento', 'registration', 'registro'];
    
    for (const field of commonCNPJFields) {
      if (item[field]) {
        return item[field];
      }
    }

    // Look for any field that looks like a CNPJ (14 digits)
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

  /**
   * Simulates enrichment for non-company types
   */
  private async simulateEnrichment(
    item: any,
    enrichmentType: string,
    options: any,
  ): Promise<Record<string, any>> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

    const enriched: Record<string, any> = {};

    switch (enrichmentType) {
      case 'address':
        enriched.address = `${Math.floor(Math.random() * 10000)} Main St, City ${Math.floor(Math.random() * 100)}`;
        enriched.zip_code = String(Math.floor(Math.random() * 90000) + 10000);
        enriched.country = 'Country';
        break;
      
      case 'email':
        enriched.email = `${item.name?.toLowerCase().replace(/\s+/g, '.') || 'user'}@example.com`;
        enriched.email_valid = Math.random() > 0.1;
        enriched.email_domain = 'example.com';
        break;
      
      case 'phone':
        enriched.phone = `+1 ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`;
        enriched.phone_valid = Math.random() > 0.1;
        enriched.phone_type = Math.random() > 0.5 ? 'mobile' : 'landline';
        break;
      
      default:
        enriched.enriched_data = `Enriched ${enrichmentType} data for ${JSON.stringify(item)}`;
    }

    return enriched;
  }

  cancelEnrichment(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'cancelled';
      session.endTime = new Date();
      this.logger.log(`Enrichment cancelled for session: ${sessionId}`);
    }
  }

  getSession(sessionId: string): EnrichmentSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): EnrichmentSession[] {
    return Array.from(this.sessions.values());
  }

  public generateSessionId(data: any[], enrichmentType: string): string {
    const dataHash = createHash('md5').update(JSON.stringify(data)).digest('hex');
    const typeHash = createHash('md5').update(enrichmentType).digest('hex');
    const timestamp = Date.now();
    return `${dataHash.substring(0, 8)}-${typeHash.substring(0, 8)}-${timestamp}`;
  }

  /**
   * Colunas padrão para enriquecimento de empresas
   */
  private getEnrichmentColumns(enrichmentType: string): Array<{id: string, name: string, type: string}> {
    if (enrichmentType === 'company') {
      return [
        { id: 'company_name', name: 'Company Name', type: 'text' },
        { id: 'trade_name', name: 'Trade Name', type: 'text' },
        { id: 'company_status', name: 'Company Status', type: 'text' },
        { id: 'company_status_date', name: 'Company Status Date', type: 'date' },
        { id: 'company_type', name: 'Company Type', type: 'text' },
        { id: 'activity_start_date', name: 'Activity Start Date', type: 'date' },
        { id: 'main_activity', name: 'Main Activity', type: 'text' },
        { id: 'legal_nature', name: 'Legal Nature', type: 'text' },
        { id: 'address', name: 'Address', type: 'text' },
        { id: 'contact', name: 'Contact', type: 'text' },
        { id: 'share_capital', name: 'Share Capital', type: 'text' },
        { id: 'company_size', name: 'Company Size', type: 'text' },
        { id: 'partners_count', name: 'Partners Count', type: 'number' },
        { id: 'partners', name: 'Partners', type: 'text' },
      ];
    }
    return [];
  }

  /**
   * Enriquece dados de uma planilha específica
   * Aplica os dados diretamente em memória e sincroniza via WebSocket
   * Processa apenas registros não enriquecidos
   */
  async enrichSheet(
    sheetId: string,
    enrichmentType: string,
    options: any = {},
    userId: string = 'system',
  ): Promise<string> {
    this.logger.log(`Starting sheet enrichment: ${sheetId} with type ${enrichmentType}`);

    // Obter apenas registros não enriquecidos
    const cnpjField = options.cnpjField || 'cnpj';
    const unenrichedRows = this.sheetService.getUnenrichedRows(sheetId, cnpjField);
    
    if (unenrichedRows.length === 0) {
      this.logger.log(`No unenriched rows found in sheet ${sheetId}`);
      throw new Error('Não há registros com CNPJ para enriquecer');
    }

    this.logger.log(`Found ${unenrichedRows.length} unenriched rows to process`);
    const sessionId = this.generateSessionId(unenrichedRows.map(r => r.data), enrichmentType);

    // Criar colunas de enriquecimento previamente
    const enrichmentColumns = this.getEnrichmentColumns(enrichmentType);
    for (const column of enrichmentColumns) {
      // Verificar se a coluna já existe
      const sheetData = this.sheetService.getSheetData(sheetId);
      const columnExists = sheetData.columns.find(col => col.id === column.id);
      
      if (!columnExists) {
        // Adicionar coluna
        this.sheetService.addColumn(sheetId, {
          name: column.name,
          type: column.type as any,
          editable: true,
        }, userId);
      }
    }

    // Marcar células como "loading" para as linhas que serão enriquecidas
    this.sheetService.markCellsAsLoading(sheetId, unenrichedRows.map(r => r.index), enrichmentColumns.map(c => c.id));

    // Broadcast inicial com colunas criadas e células em loading
    const updatedSheetData = this.sheetService.getSheetData(sheetId);
    this.collaborationService.broadcastSheetUpdate(sheetId, updatedSheetData, userId);

    // Configurar callbacks para atualizar a planilha em memória
    const sheetOnProgress = (progress: EnrichmentProgress) => {
      // Broadcast progresso via WebSocket através do CollaborationService
      this.collaborationService.broadcastEnrichmentProgress(sheetId, sessionId, progress);
      this.logger.debug(`Enrichment progress: ${progress.percentage}% for sheet ${sheetId}`);
    };

    const sheetOnPartialResult = (results: EnrichmentResult[]) => {
      // Converter resultados para formato da planilha
      const sheetResults: EnrichmentResult[] = results.map(result => ({
        rowIndex: result.rowIndex,
        data: result.data,
        enrichedFields: result.enrichedFields,
      }));

      // Aplicar resultados à planilha em memória
      this.sheetService.applyEnrichmentResults(sheetId, sheetResults, userId);

      // Obter dados atualizados da planilha
      const updatedSheetData = this.sheetService.getSheetData(sheetId);

      // Broadcast dados atualizados via WebSocket
      this.collaborationService.broadcastSheetUpdate(sheetId, updatedSheetData, userId);

      this.logger.debug(`Applied ${results.length} enrichment results to sheet ${sheetId}`);
    };

    // Iniciar enriquecimento usando apenas registros não enriquecidos
    await this.startEnrichment(
      unenrichedRows.map(r => r.data),
      enrichmentType,
      {
        ...options,
        sheetId, // Adicionar ID da planilha às opções
        originalIndices: unenrichedRows.map(r => r.index), // Manter índices originais
      },
      sessionId,
      sheetOnProgress,
      sheetOnPartialResult,
    );

    return sessionId;
  }

  /**
   * Obtém dados de uma planilha para enriquecimento
   */
  getSheetForEnrichment(sheetId: string): {
    data: any[];
    metadata: any;
  } {
    const sheetData = this.sheetService.getSheetData(sheetId);
    
    return {
      data: sheetData.rows,
      metadata: {
        sheetId,
        columns: sheetData.columns,
        totalRows: sheetData.metadata.totalRows,
        editableFields: sheetData.metadata.editableFields,
      },
    };
  }

  /**
   * Cancela enriquecimento de uma planilha
   */
  cancelSheetEnrichment(sheetId: string, sessionId: string): void {
    this.cancelEnrichment(sessionId);
    
    // Broadcast cancelamento via WebSocket
    const event = this.collaborationService.processOperation({
      type: 'enrichment_update',
      sheetId,
      userId: 'enrichment_system',
      timestamp: Date.now(),
      data: { 
        sessionId,
        type: 'cancelled'
      },
      version: 0, // Não altera versão da planilha
    });

    this.logger.log(`Cancelled enrichment session ${sessionId} for sheet ${sheetId}`);
  }
}
