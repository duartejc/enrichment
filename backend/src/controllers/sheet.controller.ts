import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  HttpException, 
  HttpStatus, 
  BadRequestException 
} from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { SheetService } from '../services/sheet.service';
import { CollaborationService } from '../services/collaboration.service';
import { DataEnrichmentService } from '../services/data-enrichment.service';

@Controller('api/sheets')
export class SheetController {
  private readonly logger = new Logger(SheetController.name);

  constructor(
    private readonly sheetService: SheetService,
    private readonly collaborationService: CollaborationService,
    private readonly dataEnrichmentService: DataEnrichmentService,
  ) {}

  /**
   * Lista todas as planilhas
   */
  @Get()
  async listSheets(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    try {
      const result = this.sheetService.listSheets(page, limit);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Cria uma nova planilha
   */
  @Post()
  async createSheet(
    @Body() body: {
      name: string;
      initialData?: Record<string, any>[];
      userId?: string;
    }
  ) {
    try {
      const { name, initialData, userId = 'system' } = body;
      
      const sheet = this.sheetService.createSheet(name, initialData, userId);
      
      return {
        success: true,
        data: {
          id: sheet.id,
          name: sheet.name,
          description: sheet.description,
          metadata: sheet.metadata,
        },
        message: 'Planilha criada com sucesso',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Obtém dados de uma planilha específica
   */
  @Get(':id')
  async getSheet(@Param('id') id: string) {
    try {
      const sheetData = this.sheetService.getSheetData(id);
      const activeUsers = this.collaborationService.getActiveUsers(id);
      
      return {
        success: true,
        data: {
          sheetId: id,
          ...sheetData,
          activeUsers,
        },
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new HttpException('Planilha não encontrada', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Atualiza uma célula específica
   */
  @Put(':id/cells')
  async updateCell(
    @Param('id') id: string,
    @Body() body: {
      rowIndex: number;
      columnId: string;
      value: any;
      userId?: string;
    }
  ) {
    try {
      const { rowIndex, columnId, value, userId = 'system' } = body;
      
      const updatedSheet = this.sheetService.updateCell(id, rowIndex, columnId, value, userId);
      
      return {
        success: true,
        data: {
          sheetId: id,
          rowIndex,
          columnId,
          value,
          version: updatedSheet.metadata.version,
        },
        message: 'Célula atualizada com sucesso',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Adiciona uma nova linha
   */
  @Post(':id/rows')
  async addRow(
    @Param('id') id: string,
    @Body() body: {
      data: Record<string, any>;
      userId?: string;
    }
  ) {
    try {
      const { data, userId = 'system' } = body;
      
      const updatedSheet = this.sheetService.addRow(id, data, userId);
      
      return {
        success: true,
        data: {
          sheetId: id,
          rowIndex: updatedSheet.metadata.totalRows - 1,
          data,
          version: updatedSheet.metadata.version,
        },
        message: 'Linha adicionada com sucesso',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Adiciona uma nova coluna
   */
  @Post(':id/columns')
  async addColumn(
    @Param('id') id: string,
    @Body() body: {
      name: string;
      type: 'text' | 'number' | 'date' | 'email' | 'phone' | 'cnpj' | 'select' | 'enriched';
      editable: boolean;
      enrichmentType?: 'address' | 'email' | 'phone' | 'company';
      userId?: string;
    }
  ) {
    try {
      const { name, type, editable, enrichmentType, userId = 'system' } = body;
      
      const updatedSheet = this.sheetService.addColumn(
        id, 
        { name, type, editable, enrichmentType }, 
        userId
      );
      
      const newColumn = updatedSheet.columns[updatedSheet.columns.length - 1];
      
      return {
        success: true,
        data: {
          sheetId: id,
          column: newColumn,
          version: updatedSheet.metadata.version,
        },
        message: 'Coluna adicionada com sucesso',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Inicia enriquecimento de dados
   */
  @Post(':id/enrich')
  async enrichSheet(
    @Param('id') id: string,
    @Body() body: {
      enrichmentType: string;
      options?: any;
      userId?: string;
    }
  ) {
    try {
      const { enrichmentType, options = {}, userId = 'system' } = body;
      
      const sessionId = await this.dataEnrichmentService.enrichSheet(
        id,
        enrichmentType,
        options,
        userId
      );
      
      return {
        success: true,
        data: {
          sheetId: id,
          sessionId,
          enrichmentType,
        },
        message: 'Enriquecimento iniciado com sucesso',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Cancela enriquecimento em andamento
   */
  @Delete(':id/enrich/:sessionId')
  async cancelEnrichment(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string
  ) {
    try {
      this.dataEnrichmentService.cancelSheetEnrichment(id, sessionId);
      
      return {
        success: true,
        message: 'Enriquecimento cancelado com sucesso',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
  @Get(':id/collaboration/stats')
  async getCollaborationStats(@Param('id') id: string) {
    try {
      const activeUsers = this.collaborationService.getActiveUsers(id);
      const globalStats = this.collaborationService.getCollaborationStats();
      
      return {
        success: true,
        data: {
          sheetId: id,
          activeUsers: activeUsers.length,
          users: activeUsers,
          globalStats,
        },
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Exporta dados da planilha
   */
  @Get(':id/export')
  async exportSheet(
    @Param('id') id: string,
    @Query('format') format: 'json' | 'csv' = 'json'
  ) {
    try {
      const sheetData = this.sheetService.getSheetData(id);
      
      if (format === 'csv') {
        // Converter para CSV
        const headers = sheetData.columns.map(col => col.name).join(',');
        const rows = sheetData.rows.map(row => 
          sheetData.columns.map(col => row[col.id] || '').join(',')
        ).join('\n');
        
        return {
          success: true,
          data: `${headers}\n${rows}`,
          format: 'csv',
        };
      }
      
      return {
        success: true,
        data: sheetData,
        format: 'json',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id/enrichment/stats')
  async getEnrichmentStats(
    @Param('id') id: string,
    @Query('cnpjField') cnpjField: string = 'cnpj'
  ) {
    try {
      const stats = this.sheetService.getEnrichmentStats(id, cnpjField);
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get(':id/enrichment/unenriched')
  async getUnenrichedRows(
    @Param('id') id: string,
    @Query('cnpjField') cnpjField: string = 'cnpj'
  ) {
    try {
      const unenrichedRows = this.sheetService.getUnenrichedRows(id, cnpjField);
      return {
        success: true,
        data: unenrichedRows,
        count: unenrichedRows.length,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
