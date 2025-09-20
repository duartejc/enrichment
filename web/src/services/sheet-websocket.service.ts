import { io, Socket } from 'socket.io-client';

export interface SheetData {
  sheetId: string;
  columns: Column[];
  rows: Record<string, any>[];
  metadata: {
    totalRows: number;
    totalColumns: number;
    lastModified: Date;
    version: number;
    editableFields: string[];
  };
  activeUsers: UserCursor[];
}

export interface Column {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'email' | 'phone' | 'cnpj' | 'select' | 'enriched';
  editable: boolean;
  width?: number;
  options?: string[];
  enrichmentType?: 'address' | 'email' | 'phone' | 'company';
}

export interface UserCursor {
  userId: string;
  userName: string;
  color: string;
  position: {
    row: number;
    column: string;
  };
  selection?: {
    startRow: number;
    endRow: number;
    startColumn: string;
    endColumn: string;
  };
}

export interface EnrichmentProgress {
  processed: number;
  total: number;
  percentage: number;
  currentBatch: number;
}

export interface CollaborationEvent {
  type: 'user_joined' | 'user_left' | 'cursor_moved' | 'cell_selected' | 'operation_applied';
  sheetId: string;
  userId: string;
  userName: string;
  data?: any;
  timestamp: number;
}

export interface SheetWebSocketCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
  
  // Sheet events
  onSheetData?: (data: SheetData) => void;
  onCellUpdated?: (data: {
    sheetId: string;
    rowIndex: number;
    columnId: string;
    value: any;
    userId: string;
    version: number;
    timestamp: number;
  }) => void;
  onRowAdded?: (data: {
    sheetId: string;
    rowIndex: number;
    data: Record<string, any>;
    userId: string;
    version: number;
    timestamp: number;
  }) => void;
  onColumnAdded?: (data: {
    sheetId: string;
    column: Column;
    userId: string;
    version: number;
    timestamp: number;
  }) => void;
  
  // Collaboration events
  onUserJoined?: (event: CollaborationEvent) => void;
  onUserLeft?: (event: CollaborationEvent) => void;
  onCursorUpdated?: (event: CollaborationEvent) => void;
  
  // Enrichment events
  onEnrichmentStarted?: (data: {
    sheetId: string;
    sessionId: string;
    enrichmentType: string;
    userId: string;
  }) => void;
  onEnrichmentProgress?: (data: {
    sheetId: string;
    sessionId: string;
    progress: EnrichmentProgress;
  }) => void;
  onEnrichmentPartialResult?: (data: {
    sheetId: string;
    sessionId: string;
    results: any[];
  }) => void;
}

class SheetWebSocketService {
  private socket: Socket | null = null;
  private callbacks: SheetWebSocketCallbacks = {};
  private currentSheetId: string | null = null;
  private currentUserId: string | null = null;
  private currentUserName: string | null = null;
  private isConnected = false;

  /**
   * Conecta ao WebSocket
   */
  async connect(callbacks: SheetWebSocketCallbacks): Promise<void> {
    this.callbacks = callbacks;

    return new Promise((resolve, reject) => {
      try {
        this.socket = io('http://56.124.127.185:3002/data', {
          transports: ['websocket'],
          autoConnect: true,
        });

        this.socket.on('connect', () => {
          console.log('Connected to sheet WebSocket');
          this.isConnected = true;
          this.callbacks.onConnected?.();
          resolve();
        });

        this.socket.on('disconnect', () => {
          console.log('Disconnected from sheet WebSocket');
          this.isConnected = false;
          this.callbacks.onDisconnected?.();
        });

        this.socket.on('error', (error: any) => {
          console.error('Sheet WebSocket error:', error);
          const errorMessage = typeof error === 'string' ? error : (error?.message || 'Unknown error');
          this.callbacks.onError?.(errorMessage);
          if (!this.isConnected) {
            reject(new Error(errorMessage));
          }
        });

        // Sheet data events
        this.socket.on('sheet-data', (data: SheetData) => {
          console.log('Received sheet data:', data);
          this.callbacks.onSheetData?.(data);
        });

        this.socket.on('cell-updated', (data: any) => {
          console.log('Cell updated:', data);
          this.callbacks.onCellUpdated?.(data);
        });

        this.socket.on('row-added', (data: any) => {
          console.log('Row added:', data);
          this.callbacks.onRowAdded?.(data);
        });

        this.socket.on('column-added', (data: any) => {
          console.log('Column added:', data);
          this.callbacks.onColumnAdded?.(data);
        });

        // Collaboration events
        this.socket.on('user-joined', (event: CollaborationEvent) => {
          console.log('User joined:', event);
          this.callbacks.onUserJoined?.(event);
        });

        this.socket.on('user-left', (event: CollaborationEvent) => {
          console.log('User left:', event);
          this.callbacks.onUserLeft?.(event);
        });

        this.socket.on('cursor-updated', (event: CollaborationEvent) => {
          this.callbacks.onCursorUpdated?.(event);
        });

        // Enrichment events
        this.socket.on('enrichment-started', (data: any) => {
          console.log('Enrichment started:', data);
          this.callbacks.onEnrichmentStarted?.(data);
        });

        this.socket.on('enrichment-progress', (data: any) => {
          console.log('Enrichment progress:', data);
          this.callbacks.onEnrichmentProgress?.(data);
        });

        this.socket.on('enrichment-partial-result', (data: any) => {
          console.log('Enrichment partial result:', data);
          this.callbacks.onEnrichmentPartialResult?.(data);
        });

        // Connection timeout
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Desconecta do WebSocket
   */
  disconnect(): void {
    if (this.currentSheetId && this.currentUserId) {
      this.leaveSheet();
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.currentSheetId = null;
    this.currentUserId = null;
    this.currentUserName = null;
  }

  /**
   * Entra em uma planilha
   */
  joinSheet(sheetId: string, userId: string, userName: string): void {
    if (!this.socket || !this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    // Sair da planilha atual se existir
    if (this.currentSheetId && this.currentSheetId !== sheetId) {
      this.leaveSheet();
    }

    this.currentSheetId = sheetId;
    this.currentUserId = userId;
    this.currentUserName = userName;

    this.socket.emit('join-sheet', {
      sheetId,
      userId,
      userName,
    });
  }

  /**
   * Sai de uma planilha
   */
  leaveSheet(): void {
    if (!this.socket || !this.currentSheetId || !this.currentUserId) {
      return;
    }

    this.socket.emit('leave-sheet', {
      sheetId: this.currentSheetId,
      userId: this.currentUserId,
    });

    this.currentSheetId = null;
    this.currentUserId = null;
    this.currentUserName = null;
  }

  /**
   * Atualiza uma célula
   */
  updateCell(rowIndex: number, columnId: string, value: any): void {
    if (!this.socket || !this.currentSheetId || !this.currentUserId) {
      throw new Error('Not connected to a sheet');
    }

    this.socket.emit('update-cell', {
      sheetId: this.currentSheetId,
      rowIndex,
      columnId,
      value,
      userId: this.currentUserId,
    });
  }

  /**
   * Adiciona uma nova linha
   */
  addRow(data: Record<string, any>): void {
    if (!this.socket || !this.currentSheetId || !this.currentUserId) {
      throw new Error('Not connected to a sheet');
    }

    this.socket.emit('add-row', {
      sheetId: this.currentSheetId,
      data,
      userId: this.currentUserId,
    });
  }

  /**
   * Adiciona uma nova coluna
   */
  addColumn(column: {
    name: string;
    type: Column['type'];
    editable: boolean;
    enrichmentType?: Column['enrichmentType'];
  }): void {
    if (!this.socket || !this.currentSheetId || !this.currentUserId) {
      throw new Error('Not connected to a sheet');
    }

    this.socket.emit('add-column', {
      sheetId: this.currentSheetId,
      column,
      userId: this.currentUserId,
    });
  }

  /**
   * Inicia enriquecimento de dados
   */
  startEnrichment(enrichmentType: string, options: any = {}): void {
    if (!this.socket || !this.currentSheetId || !this.currentUserId) {
      throw new Error('Not connected to a sheet');
    }

    console.log('Starting enrichment:', {
      sheetId: this.currentSheetId,
      enrichmentType,
      options,
      userId: this.currentUserId,
    });

    this.socket.emit('enrich-sheet', {
      sheetId: this.currentSheetId,
      enrichmentType,
      options,
      userId: this.currentUserId,
    });
  }

  /**
   * Atualiza posição do cursor
   */
  updateCursor(position: { row: number; column: string }, selection?: UserCursor['selection']): void {
    if (!this.socket || !this.currentSheetId || !this.currentUserId) {
      return; // Não é crítico, pode falhar silenciosamente
    }

    this.socket.emit('update-cursor', {
      sheetId: this.currentSheetId,
      userId: this.currentUserId,
      position,
      selection,
    });
  }

  /**
   * Verifica se está conectado
   */
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Obtém informações da sessão atual
   */
  getCurrentSession(): {
    sheetId: string | null;
    userId: string | null;
    userName: string | null;
  } {
    return {
      sheetId: this.currentSheetId,
      userId: this.currentUserId,
      userName: this.currentUserName,
    };
  }
}

// Singleton instance
export const sheetWebSocketService = new SheetWebSocketService();
export default sheetWebSocketService;
