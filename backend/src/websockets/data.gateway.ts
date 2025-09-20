import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { DataEnrichmentService } from '../services/data-enrichment.service';
import { SheetService } from '../services/sheet.service';
import { CollaborationService } from '../services/collaboration.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'data',
})
export class DataGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DataGateway.name);

  constructor(
    private readonly sheetService: SheetService,
    private readonly collaborationService: CollaborationService,
    private readonly dataEnrichmentService: DataEnrichmentService,
  ) {
    // Configurar callback para broadcast automático
    this.collaborationService.setBroadcastCallback((operation) => {
      this.broadcastOperation(operation);
    });
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit('connected', { message: 'Connected to data enrichment server' });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Remover usuário de todas as planilhas ativas
    // Em uma implementação real, você manteria um mapeamento socket -> userId
    // Por simplicidade, vamos apenas logar a desconexão
  }

  @SubscribeMessage('enrich-data')
  async handleEnrichData(
    client: Socket,
    payload: {
      data: any[];
      enrichmentType: string;
      options?: any;
      sessionId: string;
    },
  ) {
    try {
      this.logger.log(`Starting data enrichment for session: ${payload.sessionId}`);
      
      // Start async enrichment process
      await this.dataEnrichmentService.startEnrichment(
        payload.data,
        payload.enrichmentType,
        payload.options,
        payload.sessionId,
        (progress) => {
          // Send progress updates to client
          client.emit('enrichment-progress', {
            sessionId: payload.sessionId,
            progress,
          });
        },
        (results) => {
          // Send partial results when batch is completed
          client.emit('enrichment-partial-result', {
            sessionId: payload.sessionId,
            results,
          });
        },
      );

      client.emit('enrichment-started', {
        sessionId: payload.sessionId,
        message: 'Enrichment process started',
      });
    } catch (error) {
      this.logger.error(`Error in enrichment: ${error.message}`);
      client.emit('enrichment-error', {
        sessionId: payload.sessionId,
        error: error.message,
      });
    }
  }

  @SubscribeMessage('cancel-enrichment')
  handleCancelEnrichment(client: Socket, payload: { sessionId: string }) {
    this.dataEnrichmentService.cancelEnrichment(payload.sessionId);
    client.emit('enrichment-cancelled', {
      sessionId: payload.sessionId,
      message: 'Enrichment process cancelled',
    });
  }

  // ===== NOVOS MÉTODOS PARA COLABORAÇÃO EM TEMPO REAL =====

  @SubscribeMessage('join-sheet')
  async handleJoinSheet(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sheetId: string; userId: string; userName: string }
  ) {
    try {
      const { sheetId, userId, userName } = payload;
      
      // Adicionar cliente à sala da planilha
      client.join(`sheet-${sheetId}`);
      
      // Registrar usuário na colaboração
      const event = this.collaborationService.userJoinSheet(sheetId, userId, userName, client.id);
      
      // Broadcast para outros usuários da planilha
      client.to(`sheet-${sheetId}`).emit('user-joined', event);
      
      // Enviar dados da planilha para o cliente
      const sheetData = this.sheetService.getSheetData(sheetId);
      client.emit('sheet-data', {
        sheetId,
        ...sheetData,
        activeUsers: this.collaborationService.getActiveUsers(sheetId),
      });

      this.logger.log(`User ${userName} joined sheet ${sheetId}`);
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('leave-sheet')
  async handleLeaveSheet(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sheetId: string; userId: string }
  ) {
    try {
      const { sheetId, userId } = payload;
      
      // Remover cliente da sala
      client.leave(`sheet-${sheetId}`);
      
      // Registrar saída na colaboração
      const event = this.collaborationService.userLeaveSheet(sheetId, userId);
      
      if (event) {
        // Broadcast para outros usuários
        client.to(`sheet-${sheetId}`).emit('user-left', event);
      }

      this.logger.log(`User ${userId} left sheet ${sheetId}`);
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('update-cell')
  async handleUpdateCell(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: {
      sheetId: string;
      rowIndex: number;
      columnId: string;
      value: any;
      userId: string;
    }
  ) {
    try {
      const { sheetId, rowIndex, columnId, value, userId } = payload;
      
      // Atualizar célula no serviço de planilhas
      const updatedSheet = this.sheetService.updateCell(sheetId, rowIndex, columnId, value, userId);

      // Processar operação através do serviço de colaboração
      const result = this.collaborationService.processOperation({
        type: 'cell_update',
        sheetId,
        userId,
        timestamp: Date.now(),
        data: { rowIndex, columnId, value },
        version: updatedSheet.metadata.version,
      });

      // Broadcast para outros usuários na planilha
      client.to(`sheet-${sheetId}`).emit('cell-updated', {
        sheetId,
        rowIndex,
        columnId,
        value,
        userId,
        version: updatedSheet.metadata.version,
        timestamp: Date.now(),
      });

      // Confirmar atualização para o cliente
      client.emit('cell-update-confirmed', {
        sheetId,
        rowIndex,
        columnId,
        value,
        version: updatedSheet.metadata.version,
      });

    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('add-row')
  async handleAddRow(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: {
      sheetId: string;
      data: Record<string, any>;
      userId: string;
    }
  ) {
    try {
      const { sheetId, data, userId } = payload;
      
      // Adicionar linha à planilha
      const updatedSheet = this.sheetService.addRow(sheetId, data, userId);
      
      // Broadcast para outros usuários
      this.server.to(`sheet-${sheetId}`).emit('row-added', {
        sheetId,
        rowIndex: updatedSheet.metadata.totalRows - 1,
        data,
        userId,
        version: updatedSheet.metadata.version,
        timestamp: Date.now(),
      });

    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('add-column')
  async handleAddColumn(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: {
      sheetId: string;
      column: {
        name: string;
        type: 'text' | 'number' | 'date' | 'email' | 'phone' | 'cnpj' | 'select' | 'enriched';
        editable: boolean;
        enrichmentType?: 'address' | 'email' | 'phone' | 'company';
      };
      userId: string;
    }
  ) {
    try {
      const { sheetId, column, userId } = payload;
      
      // Adicionar coluna à planilha
      const updatedSheet = this.sheetService.addColumn(sheetId, column, userId);
      
      // Broadcast para outros usuários
      this.server.to(`sheet-${sheetId}`).emit('column-added', {
        sheetId,
        column: updatedSheet.columns[updatedSheet.columns.length - 1],
        userId,
        version: updatedSheet.metadata.version,
        timestamp: Date.now(),
      });

    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('enrich-sheet')
  async handleEnrichSheet(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: {
      sheetId: string;
      enrichmentType: string;
      options?: any;
      userId: string;
    }
  ) {
    this.logger.log(`Received enrich-sheet request: ${JSON.stringify(payload)}`);
    try {
      const { sheetId, enrichmentType, options, userId } = payload;
      
      // Gerar sessionId primeiro
      const sheetData = this.sheetService.getSheetData(sheetId);
      const sessionId = this.dataEnrichmentService.generateSessionId(sheetData.rows, enrichmentType);
      
      // Confirmar início do enriquecimento
      this.server.to(`sheet-${sheetId}`).emit('enrichment-started', {
        sheetId,
        sessionId,
        enrichmentType,
        userId,
      });
      
      // Iniciar enriquecimento da planilha (sem callbacks diretos)
      // O enriquecimento será aplicado em memória e sincronizado via CollaborationService
      await this.dataEnrichmentService.enrichSheet(
        sheetId,
        enrichmentType,
        options,
        userId
      );

      this.logger.log(`Enrichment completed for sheet ${sheetId} with session ${sessionId}`);

    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('update-cursor')
  async handleUpdateCursor(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: {
      sheetId: string;
      userId: string;
      position: { row: number; column: string };
      selection?: { startRow: number; endRow: number; startColumn: string; endColumn: string };
    }
  ) {
    try {
      const { sheetId, userId, position, selection } = payload;
      
      // Atualizar cursor no serviço de colaboração
      this.collaborationService.updateUserCursor(sheetId, userId, position, selection);

      // Broadcast para outros usuários na planilha
      client.to(`sheet-${sheetId}`).emit('cursor-updated', {
        sheetId,
        userId,
        position,
        selection,
        timestamp: Date.now(),
      });

    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  /**
   * Broadcast uma operação para todos os usuários da planilha
   */
  private broadcastOperation(operation: any): void {
    const { sheetId, type, data } = operation;

    switch (type) {
      case 'cell_update':
        this.server.to(`sheet-${sheetId}`).emit('cell-updated', {
          sheetId,
          rowIndex: data.rowIndex,
          columnId: data.columnId,
          value: data.value,
          userId: operation.userId,
          version: operation.version,
          timestamp: operation.timestamp,
        });
        break;

      case 'enrichment_progress':
        this.server.to(`sheet-${sheetId}`).emit('enrichment-progress', {
          sheetId,
          sessionId: data.sessionId,
          progress: data.progress,
        });
        break;

      case 'sheet_updated':
        this.server.to(`sheet-${sheetId}`).emit('sheet-data', data.sheetData);
        break;

      default:
        this.logger.warn(`Unknown operation type: ${type}`);
    }
  }

  // Method to join client to a session room
  joinSessionRoom(client: Socket, sessionId: string) {
    client.join(sessionId);
    this.logger.log(`Client ${client.id} joined session room: ${sessionId}`);
  }

  // Broadcast para todos os usuários de uma planilha
  broadcastToSheet(sheetId: string, event: string, data: any) {
    this.server.to(`sheet-${sheetId}`).emit(event, data);
  }
}
