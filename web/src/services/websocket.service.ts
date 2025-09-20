import { io, Socket } from 'socket.io-client';

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

export interface WebSocketCallbacks {
  onConnected?: () => void;
  onProgress?: (progress: EnrichmentProgress) => void;
  onPartialResult?: (results: EnrichmentResult[]) => void;
  onEnrichmentStarted?: (sessionId: string) => void;
  onEnrichmentError?: (error: string) => void;
  onEnrichmentCancelled?: () => void;
}

export class WebSocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private currentSessionId: string | null = null;

  constructor(private baseUrl: string = 'http://localhost:3000') {}

  connect(callbacks: WebSocketCallbacks = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(`${this.baseUrl}/data`, {
          transports: ['websocket', 'polling'],
          timeout: 5000,
        });

        this.socket.on('connect', () => {
          this.isConnected = true;
          console.log('Connected to WebSocket server');
          callbacks.onConnected?.();
          resolve();
        });

        this.socket.on('disconnect', () => {
          this.isConnected = false;
          console.log('Disconnected from WebSocket server');
        });

        this.socket.on('connected', (data) => {
          console.log('Server connection confirmed:', data);
        });

        this.socket.on('enrichment-progress', (data) => {
          console.log('Progress update:', data);
          callbacks.onProgress?.(data.progress);
        });

        this.socket.on('enrichment-partial-result', (data) => {
          console.log('Partial results received:', data);
          callbacks.onPartialResult?.(data.results);
        });

        this.socket.on('enrichment-started', (data) => {
          console.log('Enrichment started:', data);
          this.currentSessionId = data.sessionId;
          callbacks.onEnrichmentStarted?.(data.sessionId);
        });

        this.socket.on('enrichment-error', (data) => {
          console.error('Enrichment error:', data);
          callbacks.onEnrichmentError?.(data.error);
        });

        this.socket.on('enrichment-cancelled', (data) => {
          console.log('Enrichment cancelled:', data);
          callbacks.onEnrichmentCancelled?.();
        });

        this.socket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          reject(error);
        });

      } catch (error) {
        console.error('Failed to create socket connection:', error);
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentSessionId = null;
    }
  }

  isConnectedToServer(): boolean {
    return this.isConnected;
  }

  startEnrichment(
    data: any[],
    enrichmentType: string,
    options: any = {}
  ): string {
    if (!this.socket || !this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    const sessionId = this.generateSessionId(data, enrichmentType);
    
    this.socket.emit('enrich-data', {
      data,
      enrichmentType,
      options,
      sessionId,
    });

    return sessionId;
  }

  cancelEnrichment(sessionId: string) {
    if (!this.socket || !this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    this.socket.emit('cancel-enrichment', { sessionId });
  }

  private generateSessionId(data: any[], enrichmentType: string): string {
    const dataHash = this.simpleHash(JSON.stringify(data));
    const typeHash = this.simpleHash(enrichmentType);
    const timestamp = Date.now();
    return `${dataHash}-${typeHash}-${timestamp}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }
}

// Singleton instance for easy access
export const websocketService = new WebSocketService();
