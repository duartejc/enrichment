import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { CollaborationEvent, UserCursor, SheetOperation } from '../types/sheet.types';

@Injectable()
export class CollaborationService {
  private readonly logger = new Logger(CollaborationService.name);
  private broadcastCallback: ((operation: SheetOperation) => void) | null = null;
  
  // Armazenamento em memória para colaboração em tempo real
  private readonly activeUsers = new Map<string, Map<string, UserCursor>>(); // sheetId -> userId -> cursor
  private readonly userSessions = new Map<string, string[]>(); // userId -> sheetIds[]
  private readonly sheetSessions = new Map<string, Set<string>>(); // sheetId -> userIds[]
  private readonly sheetUsers = new Map<string, Set<string>>(); // sheetId -> userIds[]
  private readonly userCursors = new Map<string, Map<string, UserCursor>>(); // sheetId -> userId -> cursor
  private readonly operationHistory = new Map<string, SheetOperation[]>(); // sheetId -> operations[]

  /**
   * Usuário entra em uma planilha
   */
  userJoinSheet(sheetId: string, userId: string, userName: string, socketId: string): CollaborationEvent {
    // Inicializar estruturas se necessário
    if (!this.activeUsers.has(sheetId)) {
      this.activeUsers.set(sheetId, new Map());
    }
    if (!this.sheetSessions.has(sheetId)) {
      this.sheetSessions.set(sheetId, new Set());
    }
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, []);
    }

    // Adicionar usuário à sessão
    this.sheetSessions.get(sheetId)!.add(userId);
    const userSheets = this.userSessions.get(userId)!;
    if (!userSheets.includes(sheetId)) {
      userSheets.push(sheetId);
    }

    // Criar cursor inicial
    const cursor: UserCursor = {
      userId,
      userName,
      color: this.generateUserColor(userId),
      position: { row: 0, column: 'nome' },
    };

    this.activeUsers.get(sheetId)!.set(userId, cursor);

    this.logger.log(`User ${userName} (${userId}) joined sheet ${sheetId}`);

    return {
      type: 'user_joined',
      sheetId,
      userId,
      userName,
      data: {
        cursor,
        activeUsers: this.getActiveUsers(sheetId),
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Usuário sai de uma planilha
   */
  userLeaveSheet(sheetId: string, userId: string): CollaborationEvent | null {
    const sheetUsers = this.sheetSessions.get(sheetId);
    const userSheets = this.userSessions.get(userId);
    const activeUsers = this.activeUsers.get(sheetId);

    if (!sheetUsers || !userSheets || !activeUsers) {
      return null;
    }

    const cursor = activeUsers.get(userId);
    const userName = cursor?.userName || 'Unknown User';

    // Remover usuário
    sheetUsers.delete(userId);
    activeUsers.delete(userId);
    const sheetIndex = userSheets.indexOf(sheetId);
    if (sheetIndex > -1) {
      userSheets.splice(sheetIndex, 1);
    }
    this.sheetUsers.get(sheetId)!.delete(userId);
    this.userCursors.get(sheetId)!.delete(userId);

    // Limpar estruturas vazias
    if (sheetUsers.size === 0) {
      this.sheetSessions.delete(sheetId);
      this.activeUsers.delete(sheetId);
      this.sheetUsers.delete(sheetId);
      this.userCursors.delete(sheetId);
    }
    if (userSheets.length === 0) {
      this.userSessions.delete(userId);
    }

    this.logger.log(`User ${userName} (${userId}) left sheet ${sheetId}`);

    return {
      type: 'user_left',
      sheetId,
      userId,
      userName,
      data: {
        activeUsers: this.getActiveUsers(sheetId),
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Atualiza posição do cursor do usuário
   */
  updateUserCursor(
    sheetId: string,
    userId: string,
    position: { row: number; column: string },
    selection?: UserCursor['selection']
  ): CollaborationEvent | null {
    const activeUsers = this.activeUsers.get(sheetId);
    if (!activeUsers || !activeUsers.has(userId)) {
      return null;
    }

    const cursor = activeUsers.get(userId)!;
    cursor.position = position;
    if (selection) {
      cursor.selection = selection;
    }

    return {
      type: 'cursor_moved',
      sheetId,
      userId,
      userName: cursor.userName,
      data: {
        cursor,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Processa uma operação na planilha
   */
  processOperation(operation: SheetOperation): CollaborationEvent {
    this.logger.debug(`Processing operation: ${operation.type} on sheet ${operation.sheetId} by user ${operation.userId}`);

    return {
      type: 'operation_applied',
      sheetId: operation.sheetId,
      userId: operation.userId,
      userName: this.getUserName(operation.sheetId, operation.userId),
      data: {
        operation,
      },
      timestamp: operation.timestamp,
    };
  }

  /**
   * Obtém usuários ativos em uma planilha
   */
  getActiveUsers(sheetId: string): UserCursor[] {
    const activeUsers = this.activeUsers.get(sheetId);
    if (!activeUsers) {
      return [];
    }

    return Array.from(activeUsers.values());
  }

  /**
   * Obtém planilhas ativas para um usuário
   */
  getUserActiveSheets(userId: string): string[] {
    return this.userSessions.get(userId) || [];
  }

  /**
   * Obtém estatísticas de colaboração
   */
  getCollaborationStats(): {
    totalActiveUsers: number;
    totalActiveSheets: number;
    sheetsWithMultipleUsers: number;
    averageUsersPerSheet: number;
  } {
    const totalActiveUsers = this.userSessions.size;
    const totalActiveSheets = this.sheetSessions.size;
    
    let sheetsWithMultipleUsers = 0;
    let totalUsersInSheets = 0;

    for (const [sheetId, users] of this.sheetSessions.entries()) {
      if (users.size > 1) {
        sheetsWithMultipleUsers++;
      }
      totalUsersInSheets += users.size;
    }

    const averageUsersPerSheet = totalActiveSheets > 0 ? totalUsersInSheets / totalActiveSheets : 0;

    return {
      totalActiveUsers,
      totalActiveSheets,
      sheetsWithMultipleUsers,
      averageUsersPerSheet: Math.round(averageUsersPerSheet * 100) / 100,
    };
  }

  /**
   * Limpa sessões inativas (chamado periodicamente)
   */
  cleanupInactiveSessions(): void {
    const now = Date.now();
    const inactivityThreshold = 30 * 60 * 1000; // 30 minutos

    // Esta implementação é simplificada
    // Em produção, você manteria timestamps de última atividade
    this.logger.debug('Cleanup inactive sessions (placeholder)');
  }

  /**
   * Gera uma cor única para o usuário baseada no ID
   */
  private generateUserColor(userId: string): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D2B4DE'
    ];
    
    // Hash simples do userId para escolher cor consistente
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
    }
    
    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Obtém nome do usuário
   */
  private getUserName(sheetId: string, userId: string): string {
    const activeUsers = this.activeUsers.get(sheetId);
    const cursor = activeUsers?.get(userId);
    return cursor?.userName || 'Unknown User';
  }

  /**
   * Valida se operação pode ser aplicada (controle de conflitos simples)
   */
  validateOperation(operation: SheetOperation, currentVersion: number): boolean {
    // Implementação simples - em produção usaria OT (Operational Transformation)
    return operation.version >= currentVersion;
  }

  /**
   * Resolve conflitos entre operações concorrentes
   */
  resolveConflict(operation1: SheetOperation, operation2: SheetOperation): SheetOperation[] {
    // Implementação simplificada - em produção usaria algoritmos OT mais sofisticados
    this.logger.warn(`Conflict detected between operations, applying last-write-wins`);
    
    // Por simplicidade, aplicamos a operação mais recente
    return operation1.timestamp > operation2.timestamp ? [operation1] : [operation2];
  }

  /**
   * Configura callback para broadcast via WebSocket
   */
  setBroadcastCallback(callback: (operation: SheetOperation) => void): void {
    this.broadcastCallback = callback;
  }

  /**
   * Broadcast progresso de enriquecimento
   */
  broadcastEnrichmentProgress(sheetId: string, sessionId: string, progress: any): void {
    const operation: SheetOperation = {
      type: 'enrichment_progress',
      sheetId,
      userId: 'enrichment_system',
      timestamp: Date.now(),
      data: { progress, sessionId },
      version: this.getNextVersion(sheetId),
    };

    this.processOperation(operation);
    
    // Broadcast via WebSocket se callback estiver configurado
    if (this.broadcastCallback) {
      this.broadcastCallback(operation);
    }
    
    this.logger.debug(`Broadcasted enrichment progress: ${progress.percentage}% for sheet ${sheetId}`);
  }

  /**
   * Broadcast atualização completa da planilha após enriquecimento
   */
  broadcastSheetUpdate(sheetId: string, sheetData: any, userId: string): void {
    const operation: SheetOperation = {
      type: 'sheet_updated',
      sheetId,
      userId,
      timestamp: Date.now(),
      data: { sheetData },
      version: sheetData.metadata.version,
    };

    this.processOperation(operation);
    
    // Broadcast via WebSocket se callback estiver configurado
    if (this.broadcastCallback) {
      this.broadcastCallback(operation);
    }
    
    this.logger.debug(`Broadcasted sheet update for sheet ${sheetId} with ${sheetData.metadata.totalRows} rows`);
  }

  /**
   * Obtém a próxima versão para uma planilha
   */
  private getNextVersion(sheetId: string): number {
    const history = this.operationHistory.get(sheetId) || [];
    return history.length + 1;
  }
}
