import { useState, useEffect, useCallback, useRef } from 'react';
import { sheetWebSocketService, type SheetData, type Column, type UserCursor, type EnrichmentProgress } from '@/services/sheet-websocket.service';

export interface UseSheetOptions {
  sheetId: string;
  userId: string;
  userName: string;
  autoConnect?: boolean;
}

export interface UseSheetReturn {
  // Sheet data
  sheetData: SheetData | null;
  columns: Column[];
  rows: Record<string, any>[];
  metadata: SheetData['metadata'] | null;
  
  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Collaboration
  activeUsers: UserCursor[];
  currentUser: { userId: string; userName: string } | null;
  
  // Enrichment
  isEnriching: boolean;
  enrichmentProgress: EnrichmentProgress | null;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  updateCell: (rowIndex: number, columnId: string, value: any) => void;
  addRow: (data: Record<string, any>) => void;
  addColumn: (column: {
    name: string;
    type: Column['type'];
    editable: boolean;
    enrichmentType?: Column['enrichmentType'];
  }) => void;
  startEnrichment: (enrichmentType: string, options?: any) => void;
  updateCursor: (position: { row: number; column: string }, selection?: UserCursor['selection']) => void;
  
  // Utilities
  getColumnById: (id: string) => Column | undefined;
  isColumnEditable: (columnId: string) => boolean;
  getCellValue: (rowIndex: number, columnId: string) => any;
}

export function useSheet(options: UseSheetOptions): UseSheetReturn {
  const { sheetId, userId, userName, autoConnect = true } = options;
  
  // State
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState<UserCursor[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState<EnrichmentProgress | null>(null);
  
  // Refs para evitar re-renders desnecessários
  const sheetDataRef = useRef<SheetData | null>(null);
  const isConnectedRef = useRef(false);
  
  // Update refs when state changes
  useEffect(() => {
    sheetDataRef.current = sheetData;
  }, [sheetData]);
  
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Connect function
  const connect = useCallback(async () => {
    if (isConnectedRef.current) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await sheetWebSocketService.connect({
        onConnected: () => {
          console.log('Sheet WebSocket connected');
          setIsConnected(true);
          setError(null);
          
          // Join the sheet
          sheetWebSocketService.joinSheet(sheetId, userId, userName);
        },
        
        onDisconnected: () => {
          console.log('Sheet WebSocket disconnected');
          setIsConnected(false);
          setActiveUsers([]);
        },
        
        onError: (errorMessage: string) => {
          console.error('Sheet WebSocket error:', errorMessage);
          setError(errorMessage);
          setIsConnected(false);
        },
        
        // Sheet events
        onSheetData: (data: SheetData) => {
          console.log('🔄 Received sheet data update:', {
            rows: data.rows?.length,
            columns: data.columns?.length,
            version: data.metadata?.version
          });
          setSheetData(data);
          setActiveUsers(data.activeUsers || []);
        },
        
        onCellUpdated: (data) => {
          setSheetData(prev => {
            if (!prev || data.sheetId !== sheetId) return prev;
            
            const newRows = [...prev.rows];
            if (newRows[data.rowIndex]) {
              newRows[data.rowIndex] = {
                ...newRows[data.rowIndex],
                [data.columnId]: data.value,
              };
            }
            
            return {
              ...prev,
              rows: newRows,
              metadata: {
                ...prev.metadata,
                version: data.version,
                lastModified: new Date(data.timestamp),
              },
            };
          });
        },
        
        onRowAdded: (data) => {
          setSheetData(prev => {
            if (!prev || data.sheetId !== sheetId) return prev;
            
            const newRows = [...prev.rows];
            newRows[data.rowIndex] = data.data;
            
            return {
              ...prev,
              rows: newRows,
              metadata: {
                ...prev.metadata,
                totalRows: newRows.length,
                version: data.version,
                lastModified: new Date(data.timestamp),
              },
            };
          });
        },
        
        onColumnAdded: (data) => {
          setSheetData(prev => {
            if (!prev || data.sheetId !== sheetId) return prev;
            
            return {
              ...prev,
              columns: [...prev.columns, data.column],
              metadata: {
                ...prev.metadata,
                totalColumns: prev.columns.length + 1,
                version: data.version,
                lastModified: new Date(data.timestamp),
                editableFields: data.column.editable 
                  ? [...prev.metadata.editableFields, data.column.id]
                  : prev.metadata.editableFields,
              },
            };
          });
        },
        
        // Collaboration events
        onUserJoined: (event) => {
          if (event.data?.activeUsers) {
            setActiveUsers(event.data.activeUsers);
          }
        },
        
        onUserLeft: (event) => {
          if (event.data?.activeUsers) {
            setActiveUsers(event.data.activeUsers);
          }
        },
        
        onCursorUpdated: (event) => {
          if (event.data?.cursor) {
            setActiveUsers(prev => {
              const newUsers = prev.filter(user => user.userId !== event.userId);
              return [...newUsers, event.data.cursor];
            });
          }
        },
        
        // Enrichment events
        onEnrichmentStarted: (data) => {
          if (data.sheetId === sheetId) {
            setIsEnriching(true);
            setEnrichmentProgress(null);
          }
        },
        
        onEnrichmentProgress: (data) => {
          console.log('📈 Enrichment progress:', data);
          if (data.sheetId === sheetId) {
            setEnrichmentProgress(data.progress);
            
            // Se chegou a 100%, o enriquecimento terminou
            if (data.progress?.percentage === 100) {
              console.log('✅ Enrichment completed, should receive sheet data update soon...');
              setTimeout(() => {
                setIsEnriching(false);
              }, 1000); // Dar tempo para receber a atualização dos dados
            }
          }
        },
        
        onEnrichmentPartialResult: (data) => {
          if (data.sheetId === sheetId && data.results) {
            // Os resultados já foram aplicados no backend, 
            // apenas atualizamos o progresso
            console.log(`Received ${data.results.length} enrichment results`);
          }
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect';
      setError(errorMessage);
      console.error('Failed to connect to sheet:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sheetId, userId, userName]);

  // Disconnect function
  const disconnect = useCallback(() => {
    sheetWebSocketService.disconnect();
    setIsConnected(false);
    setSheetData(null);
    setActiveUsers([]);
    setIsEnriching(false);
    setEnrichmentProgress(null);
  }, []);

  // Actions
  const updateCell = useCallback((rowIndex: number, columnId: string, value: any) => {
    if (!isConnectedRef.current) {
      console.warn('Cannot update cell: not connected');
      return;
    }
    
    // Optimistic update
    setSheetData(prev => {
      if (!prev) return prev;
      
      const newRows = [...prev.rows];
      if (newRows[rowIndex]) {
        newRows[rowIndex] = {
          ...newRows[rowIndex],
          [columnId]: value,
        };
      }
      
      return {
        ...prev,
        rows: newRows,
      };
    });
    
    // Send to server
    sheetWebSocketService.updateCell(rowIndex, columnId, value);
  }, []);

  const addRow = useCallback((data: Record<string, any>) => {
    if (!isConnectedRef.current) {
      console.warn('Cannot add row: not connected');
      return;
    }
    
    sheetWebSocketService.addRow(data);
  }, []);

  const addColumn = useCallback((column: {
    name: string;
    type: Column['type'];
    editable: boolean;
    enrichmentType?: Column['enrichmentType'];
  }) => {
    if (!isConnectedRef.current) {
      console.warn('Cannot add column: not connected');
      return;
    }
    
    sheetWebSocketService.addColumn(column);
  }, []);

  const startEnrichment = useCallback((enrichmentType: string, options: any = {}) => {
    console.log('startEnrichment called:', { enrichmentType, options, connected: isConnectedRef.current });
    
    if (!isConnectedRef.current) {
      console.warn('Cannot start enrichment: not connected');
      return;
    }
    
    try {
      sheetWebSocketService.startEnrichment(enrichmentType, options);
      console.log('Enrichment request sent successfully');
    } catch (error) {
      console.error('Error starting enrichment:', error);
    }
  }, []);

  const updateCursor = useCallback((position: { row: number; column: string }, selection?: UserCursor['selection']) => {
    if (!isConnectedRef.current) {
      return; // Não é crítico
    }
    
    sheetWebSocketService.updateCursor(position, selection);
  }, []);

  // Utilities
  const getColumnById = useCallback((id: string): Column | undefined => {
    return sheetData?.columns.find(col => col.id === id);
  }, [sheetData?.columns]);

  const isColumnEditable = useCallback((columnId: string): boolean => {
    return sheetData?.metadata.editableFields.includes(columnId) ?? false;
  }, [sheetData?.metadata.editableFields]);

  const getCellValue = useCallback((rowIndex: number, columnId: string): any => {
    return sheetData?.rows[rowIndex]?.[columnId];
  }, [sheetData?.rows]);

  // Auto-connect effect
  useEffect(() => {
    if (autoConnect && !isConnectedRef.current && !isLoading) {
      connect();
    }
    
    // Cleanup on unmount
    return () => {
      if (isConnectedRef.current) {
        disconnect();
      }
    };
  }, [autoConnect, connect, disconnect, isLoading]);

  // Derived state
  const columns = sheetData?.columns || [];
  const rows = sheetData?.rows || [];
  const metadata = sheetData?.metadata || null;
  const currentUser = isConnected ? { userId, userName } : null;

  return {
    // Sheet data
    sheetData,
    columns,
    rows,
    metadata,
    
    // Connection state
    isConnected,
    isLoading,
    error,
    
    // Collaboration
    activeUsers,
    currentUser,
    
    // Enrichment
    isEnriching,
    enrichmentProgress,
    
    // Actions
    connect,
    disconnect,
    updateCell,
    addRow,
    addColumn,
    startEnrichment,
    updateCursor,
    
    // Utilities
    getColumnById,
    isColumnEditable,
    getCellValue,
  };
}
