import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Sheet, Column, Cell, SheetOperation } from '../types/sheet.types';
import { EnrichmentResult } from './data-enrichment.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SheetService {
  private readonly logger = new Logger(SheetService.name);
  private readonly sheets = new Map<string, Sheet>(); // In-memory storage para performance
  private readonly operations = new Map<string, SheetOperation[]>(); // Histórico de operações

  /**
   * Cria uma nova planilha
   */
  createSheet(
    name: string,
    initialData?: Record<string, any>[],
    userId: string = 'system'
  ): Sheet {
    const sheetId = uuidv4();
    
    // Detectar colunas automaticamente dos dados iniciais
    const columns = this.detectColumns(initialData || []);
    
    // Converter dados iniciais para formato de células
    const rows = this.convertDataToRows(initialData || [], columns);

    const sheet: Sheet = {
      id: sheetId,
      name,
      description: `Planilha criada em ${new Date().toLocaleString('pt-BR')}`,
      columns,
      rows,
      metadata: {
        totalRows: rows.length,
        totalColumns: columns.length,
        lastModified: new Date(),
        version: 1,
        editableFields: columns.filter(col => col.editable).map(col => col.id),
      },
      permissions: {
        owner: userId,
        editors: [],
        viewers: [],
        public: false,
      },
      settings: {
        autoSave: true,
        enableCollaboration: true,
        enableEnrichment: true,
      },
    };

    this.sheets.set(sheetId, sheet);
    this.operations.set(sheetId, []);

    this.logger.log(`Created new sheet: ${name} (ID: ${sheetId}) with ${rows.length} rows and ${columns.length} columns`);
    
    return sheet;
  }

  /**
   * Busca uma planilha por ID
   */
  getSheet(sheetId: string): Sheet {
    const sheet = this.sheets.get(sheetId);
    if (!sheet) {
      throw new NotFoundException(`Sheet with ID ${sheetId} not found`);
    }
    return sheet;
  }

  /**
   * Lista todas as planilhas (com paginação)
   */
  listSheets(page: number = 1, limit: number = 20): {
    sheets: Partial<Sheet>[];
    total: number;
    page: number;
    limit: number;
  } {
    const allSheets = Array.from(this.sheets.values());
    const start = (page - 1) * limit;
    const end = start + limit;
    
    const sheets = allSheets
      .slice(start, end)
      .map(sheet => ({
        id: sheet.id,
        name: sheet.name,
        description: sheet.description,
        metadata: sheet.metadata,
        permissions: sheet.permissions,
      }));

    return {
      sheets,
      total: allSheets.length,
      page,
      limit,
    };
  }

  /**
   * Atualiza uma célula específica
   */
  updateCell(
    sheetId: string,
    rowIndex: number,
    columnId: string,
    value: any,
    userId: string = 'system'
  ): Sheet {
    const sheet = this.getSheet(sheetId);
    
    // Garantir que a linha existe
    while (sheet.rows.length <= rowIndex) {
      sheet.rows.push({});
    }

    // Atualizar célula
    if (!sheet.rows[rowIndex]) {
      sheet.rows[rowIndex] = {};
    }

    const oldValue = sheet.rows[rowIndex][columnId]?.value;
    
    sheet.rows[rowIndex][columnId] = {
      value,
      metadata: {
        lastModified: new Date(),
        modifiedBy: userId,
      },
    };

    // Atualizar metadados
    sheet.metadata.lastModified = new Date();
    sheet.metadata.version++;
    sheet.metadata.totalRows = Math.max(sheet.metadata.totalRows, rowIndex + 1);

    // Registrar operação
    this.recordOperation(sheetId, {
      type: 'cell_update',
      sheetId,
      userId,
      timestamp: Date.now(),
      data: {
        rowIndex,
        columnId,
        oldValue,
        newValue: value,
      },
      version: sheet.metadata.version,
    });

    this.logger.debug(`Updated cell [${rowIndex}, ${columnId}] in sheet ${sheetId}`);
    
    return sheet;
  }

  /**
   * Adiciona uma nova linha
   */
  addRow(sheetId: string, data: Record<string, any> = {}, userId: string = 'system'): Sheet {
    const sheet = this.getSheet(sheetId);
    
    // Converter dados para formato de células
    const rowData: Record<string, Cell> = {};
    
    for (const [key, value] of Object.entries(data)) {
      rowData[key] = {
        value,
        metadata: {
          lastModified: new Date(),
          modifiedBy: userId,
        },
      };
    }

    sheet.rows.push(rowData);
    
    // Atualizar metadados
    sheet.metadata.totalRows = sheet.rows.length;
    sheet.metadata.lastModified = new Date();
    sheet.metadata.version++;

    // Registrar operação
    this.recordOperation(sheetId, {
      type: 'row_insert',
      sheetId,
      userId,
      timestamp: Date.now(),
      data: {
        rowIndex: sheet.rows.length - 1,
        rowData: data,
      },
      version: sheet.metadata.version,
    });

    this.logger.debug(`Added new row to sheet ${sheetId} (total: ${sheet.metadata.totalRows})`);
    
    return sheet;
  }

  /**
   * Adiciona uma nova coluna
   */
  addColumn(
    sheetId: string,
    column: Omit<Column, 'id'>,
    userId: string = 'system'
  ): Sheet {
    const sheet = this.getSheet(sheetId);
    
    const newColumn: Column = {
      ...column,
      id: column.name.toLowerCase().replace(/\s+/g, '_'),
    };

    sheet.columns.push(newColumn);
    
    // Atualizar metadados
    sheet.metadata.totalColumns = sheet.columns.length;
    sheet.metadata.lastModified = new Date();
    sheet.metadata.version++;
    
    if (newColumn.editable) {
      sheet.metadata.editableFields.push(newColumn.id);
    }

    // Registrar operação
    this.recordOperation(sheetId, {
      type: 'column_insert',
      sheetId,
      userId,
      timestamp: Date.now(),
      data: {
        column: newColumn,
      },
      version: sheet.metadata.version,
    });

    this.logger.debug(`Added new column '${newColumn.name}' to sheet ${sheetId}`);
    
    return sheet;
  }

  /**
   * Aplica resultados de enriquecimento à planilha
   */
  applyEnrichmentResults(sheetId: string, results: EnrichmentResult[], userId: string): Sheet {
    const sheet = this.sheets.get(sheetId);
    if (!sheet) {
      throw new Error(`Sheet ${sheetId} not found`);
    }

    this.logger.debug(`Applying ${results.length} enrichment results to sheet ${sheetId}`);

    // Aplicar dados enriquecidos às células
    results.forEach(result => {
      const { rowIndex, enrichedFields } = result;
      
      if (rowIndex >= 0 && rowIndex < sheet.rows.length) {
        const row = sheet.rows[rowIndex];
        
        // Aplicar cada campo enriquecido
        Object.keys(enrichedFields).forEach(key => {
          if (enrichedFields[key] !== undefined && enrichedFields[key] !== null) {
            // Adicionar coluna se não existir
            if (!sheet.columns.find(col => col.id === key)) {
              // Criar coluna manualmente para manter o ID original
              const newColumn: Column = {
                id: key,
                name: this.formatColumnName(key),
                type: 'enriched',
                editable: false,
              };
              
              sheet.columns.push(newColumn);
              sheet.metadata.totalColumns = sheet.columns.length;
            }
            
            // Aplicar valor à célula (removendo estado de loading)
            row[key] = { value: enrichedFields[key], isLoading: false };
          }
        });

        // Marcar linha como enriquecida
        row['_enriched'] = { value: true };
        row['_enriched_at'] = { value: new Date().toISOString() };
      }
    });

    // Atualizar metadados
    sheet.metadata.lastModified = new Date();
    sheet.metadata.version++;

    // Registrar operação
    this.recordOperation(sheetId, {
      type: 'enrichment_update',
      sheetId,
      userId: 'enrichment_system',
      timestamp: Date.now(),
      data: {
        affectedRows: results.map(r => r.rowIndex),
      },
      version: sheet.metadata.version,
    });

    this.logger.log(`Applied enrichment to ${results.length} rows in sheet ${sheetId}`);
    
    return sheet;
  }

  /**
   * Obtém dados da planilha em formato simples para o frontend
   */
  getSheetData(sheetId: string): {
    columns: Column[];
    rows: Record<string, any>[];
    metadata: Sheet['metadata'];
  } {
    const sheet = this.getSheet(sheetId);
    
    // Converter células para formato simples
    const rows = sheet.rows.map(row => {
      const simpleRow: Record<string, any> = {};
      for (const [key, cell] of Object.entries(row)) {
        simpleRow[key] = {
          value: cell.value,
          isLoading: cell.isLoading || false
        };
      }
      return simpleRow;
    });

    return {
      columns: sheet.columns,
      rows,
      metadata: sheet.metadata,
    };
  }

  /**
   * Obtém histórico de operações
   */
  getOperationHistory(sheetId: string, limit: number = 100): SheetOperation[] {
    const operations = this.operations.get(sheetId) || [];
    return operations.slice(-limit).reverse(); // Mais recentes primeiro
  }

  /**
   * Detecta colunas automaticamente dos dados
   */
  private detectColumns(data: Record<string, any>[]): Column[] {
    if (data.length === 0) {
      // Colunas padrão se não há dados
      return [
        { id: 'nome', name: 'Nome', type: 'text', editable: true },
        { id: 'empresa', name: 'Empresa', type: 'text', editable: true },
        { id: 'cnpj', name: 'CNPJ', type: 'cnpj', editable: true },
        { id: 'email', name: 'Email', type: 'email', editable: true },
        { id: 'telefone', name: 'Telefone', type: 'phone', editable: true },
        { id: 'status', name: 'Status', type: 'select', editable: true, options: ['Ativo', 'Pendente', 'Inativo'] },
      ];
    }

    const columns: Column[] = [];
    const firstRow = data[0];
    
    for (const [key, value] of Object.entries(firstRow)) {
      columns.push({
        id: key,
        name: this.formatColumnName(key),
        type: this.detectColumnType(value),
        editable: this.isEditableField(key),
      });
    }

    return columns;
  }

  /**
   * Converte dados para formato de células
   */
  private convertDataToRows(data: Record<string, any>[], columns: Column[]): Record<string, Cell>[] {
    return data.map(row => {
      const cellRow: Record<string, Cell> = {};
      
      for (const column of columns) {
        const value = row[column.id];
        if (value !== undefined) {
          cellRow[column.id] = {
            value,
            metadata: {
              lastModified: new Date(),
              modifiedBy: 'system',
            },
          };
        }
      }
      
      return cellRow;
    });
  }

  /**
   * Detecta o tipo de uma coluna baseado no valor
   */
  private detectColumnType(value: any): Column['type'] {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') {
      if (value.includes('@')) return 'email';
      if (/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(value)) return 'cnpj';
      if (/^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(value)) return 'phone';
      if (!isNaN(Date.parse(value))) return 'date';
    }
    return 'text';
  }

  /**
   * Determina se um campo é editável
   */
  private isEditableField(key: string): boolean {
    const editableFields = ['nome', 'email', 'telefone', 'empresa', 'status', 'cnpj'];
    return editableFields.includes(key.toLowerCase());
  }

  /**
   * Formata nome da coluna para exibição
   */
  private formatColumnName(id: string): string {
    return id
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Obtém registros não enriquecidos de uma planilha
   */
  getUnenrichedRows(sheetId: string, cnpjField: string = 'cnpj'): { index: number; data: Record<string, any> }[] {
    const sheet = this.sheets.get(sheetId);
    if (!sheet) {
      throw new Error(`Sheet ${sheetId} not found`);
    }

    const unenrichedRows: { index: number; data: Record<string, any> }[] = [];

    sheet.rows.forEach((row, index) => {
      // Converter células para formato simples
      const simpleRow: Record<string, any> = {};
      for (const [key, cell] of Object.entries(row)) {
        simpleRow[key] = cell.value;
      }

      // Verificar se a linha tem CNPJ e não foi enriquecida
      const hasCnpj = simpleRow[cnpjField] && simpleRow[cnpjField].toString().trim() !== '';
      const isEnriched = simpleRow['_enriched'] === true;
      
      if (hasCnpj && !isEnriched) {
        unenrichedRows.push({
          index,
          data: simpleRow
        });
      }
    });

    this.logger.debug(`Found ${unenrichedRows.length} unenriched rows in sheet ${sheetId}`);
    return unenrichedRows;
  }

  /**
   * Conta registros enriquecidos vs não enriquecidos
   */
  getEnrichmentStats(sheetId: string, cnpjField: string = 'cnpj'): {
    total: number;
    enriched: number;
    unenriched: number;
    withCnpj: number;
  } {
    const sheet = this.sheets.get(sheetId);
    if (!sheet) {
      throw new Error(`Sheet ${sheetId} not found`);
    }

    let enriched = 0;
    let withCnpj = 0;
    let unenriched = 0;

    sheet.rows.forEach(row => {
      // Converter células para formato simples
      const simpleRow: Record<string, any> = {};
      for (const [key, cell] of Object.entries(row)) {
        simpleRow[key] = cell.value;
      }

      const hasCnpj = simpleRow[cnpjField] && simpleRow[cnpjField].toString().trim() !== '';
      const isEnriched = simpleRow['_enriched'] === true;

      if (hasCnpj) {
        withCnpj++;
        if (isEnriched) {
          enriched++;
        } else {
          unenriched++;
        }
      }
    });

    return {
      total: sheet.rows.length,
      enriched,
      unenriched,
      withCnpj
    };
  }

  /**
   * Marca células como "loading" durante o enriquecimento
   */
  markCellsAsLoading(sheetId: string, rowIndices: number[], columnIds: string[]): void {
    const sheet = this.sheets.get(sheetId);
    if (!sheet) {
      throw new Error(`Sheet ${sheetId} not found`);
    }

    rowIndices.forEach(rowIndex => {
      if (rowIndex >= 0 && rowIndex < sheet.rows.length) {
        const row = sheet.rows[rowIndex];
        columnIds.forEach(columnId => {
          row[columnId] = { value: 'loading', isLoading: true };
        });
      }
    });

    // Atualizar versão
    sheet.metadata.version++;
    sheet.metadata.lastModified = new Date();

    this.logger.debug(`Marked ${rowIndices.length} rows with loading state for ${columnIds.length} columns`);
  }

  /**
   * Obtém tipo de enriquecimento baseado na chave
   */
  private getEnrichmentTypeFromKey(key: string): Column['enrichmentType'] {
    if (key.includes('address') || key.includes('endereco')) return 'address';
    if (key.includes('email')) return 'email';
    if (key.includes('phone') || key.includes('telefone')) return 'phone';
    if (key.includes('company') || key.includes('empresa')) return 'company';
    return undefined;
  }

  /**
   * Registra uma operação no histórico
   */
  private recordOperation(sheetId: string, operation: SheetOperation): void {
    const operations = this.operations.get(sheetId) || [];
    operations.push(operation);
    
    // Manter apenas as últimas 1000 operações
    if (operations.length > 1000) {
      operations.splice(0, operations.length - 1000);
    }
    
    this.operations.set(sheetId, operations);
  }
}
