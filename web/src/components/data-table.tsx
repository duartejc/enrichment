"use client"
import { useState, useEffect, memo, useCallback } from "react"
import {
  IconChevronDown,
  IconLayoutColumns,
  IconPlus,
  IconLoader2,
  IconX,
} from "@tabler/icons-react"

import { type Cell, NonEditableCell, TextCell, ReactGrid } from '@silevis/reactgrid'
import { websocketService, type EnrichmentProgress, type EnrichmentResult } from '@/services/websocket.service'

// Custom cell component that supports click events - optimized with memo
const ClickableCell = memo(({ value, onClick, style }: { value: string; onClick?: () => void; style?: React.CSSProperties }) => {
  return (
    <div 
      style={style}
      onClick={onClick}
      className="w-full h-full flex items-center justify-center cursor-pointer"
    >
      {value}
    </div>
  );
});

ClickableCell.displayName = 'ClickableCell';

// Custom cell component that shows loading skeleton
const LoadingSkeletonCell = memo(() => {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-50">
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
});

LoadingSkeletonCell.displayName = 'LoadingSkeletonCell';

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"

export interface DataTableMetadata {
  editableFields?: string[];
  [key: string]: any;
}

export interface DataTableProps {
  data?: Record<string, string | number>[];
  metadata?: DataTableMetadata;
}

// Mapeamento de colunas retornadas por cada tipo de enriquecimento
const ENRICHMENT_COLUMNS = {
  address: [
    'address',
    'zip_code',
    'country'
  ],
  email: [
    'email_domain',
    'email_valid'
  ],
  phone: [
    'phone',
    'phone_valid',
    'phone_type',
  ],
  company: [
    'company_name',
    'company_size',
    'company_industry'
  ]
};


export function DataTable({
  data: tableData = [],
  metadata = {},
}: DataTableProps) {
  // If no data, use empty array
  const initialData = tableData || [];
  const editableFields = metadata.editableFields || [];
  
  // State to manage the data
  const [data, setData] = useState(initialData);
  
  // State to manage Sheet
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedColumnType, setSelectedColumnType] = useState<'estatica' | 'api' | 'enriquecer' | null>(null);
  const [columnName, setColumnName] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  
  // State to manage WebSocket enrichment
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState<EnrichmentProgress | null>(null);
  const [currentEnrichmentSession, setCurrentEnrichmentSession] = useState<string | null>(null);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState<Set<string>>(new Set());
  
  // Initialize WebSocket connection
  useEffect(() => {
    const connectWebSocket = async () => {
      try {
        await websocketService.connect({
          onConnected: () => setIsWebSocketConnected(true),
          onProgress: (progress: EnrichmentProgress) => {
            setEnrichmentProgress(progress);
          },
          onPartialResult: (results: EnrichmentResult[]) => {
            // Update data with partial results efficiently using batch updates
            setData(prevData => {
              // Create a copy only if there are actual changes
              let hasChanges = false;
              const newData = [...prevData];
              
              // Process results in batches to optimize performance
              results.forEach(result => {
                if (result.rowIndex < newData.length) {
                  const existingRow = newData[result.rowIndex];
                  const enrichedRow = {
                    ...existingRow,
                    ...result.enrichedFields
                  };
                  
                  // Check if there are actual changes
                  const hasRowChanges = Object.keys(result.enrichedFields).some(
                    key => existingRow[key] !== result.enrichedFields[key]
                  );
                  
                  if (hasRowChanges) {
                    newData[result.rowIndex] = enrichedRow;
                    hasChanges = true;
                  }
                }
              });
              
              // Only update state if there are actual changes
              return hasChanges ? newData : prevData;
            });
            
            // Remove loading columns that were updated in this batch
            if (results.length > 0) {
              const updatedColumns = new Set<string>();
              results.forEach(result => {
                Object.keys(result.enrichedFields).forEach(col => {
                  updatedColumns.add(col);
                });
              });
              
              setLoadingColumns(prev => {
                const newSet = new Set(prev);
                updatedColumns.forEach(col => newSet.delete(col));
                return newSet;
              });
            }
          },
          onEnrichmentStarted: (sessionId: string) => {
            setCurrentEnrichmentSession(sessionId);
            setIsEnriching(true);
          },
          onEnrichmentError: (error: string) => {
            console.error('Enrichment error:', error);
            setIsEnriching(false);
            setCurrentEnrichmentSession(null);
            setEnrichmentProgress(null);
            // Clear all loading columns on error
            setLoadingColumns(new Set());
          },
          onEnrichmentCancelled: () => {
            setIsEnriching(false);
            setCurrentEnrichmentSession(null);
            setEnrichmentProgress(null);
            // Clear all loading columns on cancel
            setLoadingColumns(new Set());
          },
        });
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
      }
    };

    connectWebSocket();

    // Cleanup on component unmount
    return () => {
      websocketService.disconnect();
    };
  }, []);
  
  // Handler for WebSocket enrichment - optimized with useCallback
  const handleWebSocketEnrichment = useCallback((enrichmentType: string, options: any = {}) => {
    if (!isWebSocketConnected) {
      alert('WebSocket não está conectado. Por favor, aguarde a conexão.');
      return;
    }

    try {
      setIsEnriching(true);
      setEnrichmentProgress(null);
      
      // Get the columns for this enrichment type
      const columns = ENRICHMENT_COLUMNS[enrichmentType as keyof typeof ENRICHMENT_COLUMNS] || [];
      
      // Add loading columns to track which ones are loading
      setLoadingColumns(prev => {
        const newSet = new Set(prev);
        columns.forEach(col => newSet.add(col));
        return newSet;
      });
      
      // Create columns with loading state
      setData(prevData => prevData.map(row => {
        const newRow = { ...row };
        columns.forEach(col => {
          if (!(col in newRow)) {
            newRow[col] = 'loading'; // Special value to indicate loading state
          }
        });
        return newRow;
      }));
      
      const sessionId = websocketService.startEnrichment(data, enrichmentType, {
        batchSize: 50,
        concurrency: 3,
        ...options
      });
      
      console.log(`Started enrichment session: ${sessionId}`);
    } catch (error) {
      console.error('Failed to start enrichment:', error);
      setIsEnriching(false);
      // Remove loading columns on error
      setLoadingColumns(prev => {
        const newSet = new Set(prev);
        const columns = ENRICHMENT_COLUMNS[enrichmentType as keyof typeof ENRICHMENT_COLUMNS] || [];
        columns.forEach(col => newSet.delete(col));
        return newSet;
      });
      alert('Falha ao iniciar enriquecimento. Tente novamente.');
    }
  }, [isWebSocketConnected, data]);
  
  const handleCancelEnrichment = useCallback(() => {
    if (currentEnrichmentSession) {
      websocketService.cancelEnrichment(currentEnrichmentSession);
    }
  }, [currentEnrichmentSession]);
  
  // Handler for adding new column
  const handleAddColumn = (type: 'estatica' | 'api' | 'enriquecer') => {
    setSelectedColumnType(type);
    setColumnName('');
    setApiEndpoint('');
  };
  
  const handleCreateColumn = () => {
    if (!selectedColumnType) return;
    
    // For 'enriquecer' type, the action is handled by individual buttons
    if (selectedColumnType === 'enriquecer') {
      return;
    }
    
    if (!columnName.trim()) return;
    
    if (selectedColumnType === 'estatica') {
      // Add new static column to all rows
      setData(prevData => prevData.map(row => ({
        ...row,
        [columnName.trim()]: ''
      })));
    } else if (selectedColumnType === 'api') {
      // Add new API column to all rows
      setData(prevData => prevData.map(row => ({
        ...row,
        [columnName.trim()]: apiEndpoint ? `API: ${apiEndpoint}` : 'API'
      })));
    }
    
    // Reset and close
    setSelectedColumnType(null);
    setColumnName('');
    setApiEndpoint('');
    setIsSheetOpen(false);
  };
  
  
  
  // Handler for cell value changes
  const handleCellChange = (rowIndex: number, header: string, newValue: string) => {
    setData(prevData => {
      const newData = [...prevData];
      newData[rowIndex] = {
        ...newData[rowIndex],
        [header]: newValue
      };
      return newData;
    });
  };
  
  // Get dynamic headers from the first data object (excluding 'id')
  const getHeaders = () => {
    if (data.length === 0) return ['Nome', 'Empresa', 'Email'];
    const firstItem = data[0];
    return Object.keys(firstItem).filter(key => key !== 'id');
  };
  
  const headers = getHeaders();

  const cells: Cell[] = [
    // Header cells
    { rowIndex: 0, colIndex: 0, Template: NonEditableCell, props: { value: "#" } },
    ...headers.map((header, colIndex) => ({
      rowIndex: 0,
      colIndex: colIndex + 1,
      Template: NonEditableCell,
      props: { value: header },
    })),
    { 
      rowIndex: 0, 
      colIndex: headers.length + 1, 
      Template: ClickableCell, 
      props: { 
        value: "+ Adicionar coluna",
        style: { cursor: 'pointer', backgroundColor: '#f3f4f6' },
        onClick: () => setIsSheetOpen(true)
      } 
    },
    
    // Data rows
    ...data.map((row, rowIndex) => [
      { rowIndex: rowIndex + 1, colIndex: 0, Template: NonEditableCell, props: { value: rowIndex + 1 } },
      ...headers.map((header, colIndex) => {
        const isEditable = editableFields.includes(header);
        const cellValue = String(row[header] || '');
        const isLoading = loadingColumns.has(header) && cellValue === 'loading';
        
        if (isLoading) {
          return {
            rowIndex: rowIndex + 1,
            colIndex: colIndex + 1,
            Template: LoadingSkeletonCell,
            props: {},
          };
        } else if (isEditable) {
          return {
            rowIndex: rowIndex + 1,
            colIndex: colIndex + 1,
            Template: TextCell,
            props: {
              text: cellValue,
              onChange: (newValue: string) => {
                handleCellChange(rowIndex, header, newValue);
              },
            },
          };
        } else {
          return {
            rowIndex: rowIndex + 1,
            colIndex: colIndex + 1,
            Template: NonEditableCell,
            props: { value: cellValue },
          };
        }
      }),
      { 
        rowIndex: rowIndex + 1, 
        colIndex: headers.length + 1, 
        Template: NonEditableCell, 
        props: { 
          value: "", 
          disabled: true,
          style: { backgroundColor: '#f3f4f6' }
        } 
      },
    ]).flat(),
    
    // Extra empty rows for Google Sheets-like UX
    ...Array.from({ length: 10 }, (_, emptyRowIndex) => [
      { 
        rowIndex: data.length + emptyRowIndex + 1, 
        colIndex: 0, 
        Template: NonEditableCell, 
        props: { 
          value: data.length + emptyRowIndex + 1,
          style: { color: '#9ca3af' }
        } 
      },
      ...headers.map((header, colIndex) => ({
        rowIndex: data.length + emptyRowIndex + 1,
        colIndex: colIndex + 1,
        Template: TextCell,
        props: {
          text: "",
          onChange: (newValue: string) => {
            if (newValue.trim() !== "") {
              // Add new row when user starts typing
              const newRow: Record<string, string> = { id: String(Date.now() + emptyRowIndex) };
              headers.forEach(h => {
                newRow[h] = h === header ? newValue : "";
              });
              setData(prev => [...prev, newRow]);
            }
          },
        },
      })),
      { 
        rowIndex: data.length + emptyRowIndex + 1, 
        colIndex: headers.length + 1, 
        Template: NonEditableCell, 
        props: { 
          value: "", 
          disabled: true,
          style: { backgroundColor: '#f3f4f6' }
        } 
      },
    ]).flat(),
  ];
  
  // Calculate styled ranges dynamically based on data
  const styledRanges = [];
  
  // Header styling - only if we have headers
  if (headers.length > 0) {
    styledRanges.push({
      range: { start: { rowIndex: 0, columnIndex: 0 }, end: { rowIndex: 0, columnIndex: headers.length + 1 } },
      styles: { background: "gray", fontWeight: "bold" },
    });
  }
  
  // Last column styling - include both data rows and empty rows
  if (headers.length > 0) {
    styledRanges.push({
      range: { start: { rowIndex: 1, columnIndex: headers.length + 1 }, end: { rowIndex: data.length + 10, columnIndex: headers.length + 1 } },
      styles: { background: "#f3f4f6", fontWeight: "normal" },
    });
  }
  
  // Empty rows styling - light gray text for row numbers
  if (data.length > 0 && headers.length > 0) {
    styledRanges.push({
      range: { start: { rowIndex: data.length + 1, columnIndex: 0 }, end: { rowIndex: data.length + 10, columnIndex: 0 } },
      styles: { color: "#9ca3af", fontWeight: "normal" },
    });
  }
  
  return (
    <Tabs
      defaultValue="outline"
      className="w-full flex-col justify-start gap-6"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <label htmlFor="view-selector" className="sr-only">
          View
        </label>
        <Select defaultValue="outline">
          <SelectTrigger size="sm" />
          <SelectContent>
            <SelectItem value="outline">Outline</SelectItem>
            <SelectItem value="past-performance">Past Performance</SelectItem>
            <SelectItem value="key-personnel">Key Personnel</SelectItem>
            <SelectItem value="focus-documents">Focus Documents</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="outline">Outline</TabsTrigger>
          <TabsTrigger value="past-performance">
            Past Performance <Badge variant="secondary">3</Badge>
          </TabsTrigger>
          <TabsTrigger value="key-personnel">
            Key Personnel <Badge variant="secondary">2</Badge>
          </TabsTrigger>
          <TabsTrigger value="focus-documents">Focus Documents</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <IconLayoutColumns />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <IconChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm">
            <IconPlus />
            <span className="hidden lg:inline">Add Section</span>
          </Button>
        </div>
      </div>
      <TabsContent
        value="outline"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
          <div className="relative">
            <ReactGrid cells={cells} styledRanges={styledRanges} />
            
            {/* Sheet for Add Column Options */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                  <SheetTitle>Adicionar Nova Coluna</SheetTitle>
                  <SheetDescription>
                    Escolha o tipo de coluna que deseja adicionar à sua tabela
                  </SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 p-6">
                  {!selectedColumnType ? (
                    <div className="grid gap-2">
                      <h3 className="text-lg font-medium">Tipos de Coluna</h3>
                      <div className="grid gap-3">
                        <button
                          onClick={() => handleAddColumn('estatica')}
                          className="flex flex-col items-start gap-2 rounded-lg border p-4 text-left hover:bg-gray-50"
                        >
                          <div className="font-semibold">Coluna Estática</div>
                          <div className="text-sm text-gray-500">
                            Adiciona uma coluna simples com valores estáticos que podem ser editados manualmente
                          </div>
                        </button>
                        <button
                          onClick={() => handleAddColumn('api')}
                          className="flex flex-col items-start gap-2 rounded-lg border p-4 text-left hover:bg-gray-50"
                        >
                          <div className="font-semibold">Consulta de API</div>
                          <div className="text-sm text-gray-500">
                            Adiciona uma coluna que pode ser preenchida com dados de uma API externa
                          </div>
                        </button>
                        <button
                          onClick={() => handleAddColumn('enriquecer')}
                          className="flex flex-col items-start gap-2 rounded-lg border p-4 text-left hover:bg-gray-50"
                        >
                          <div className="font-semibold">Enriquecimento de Dados</div>
                          <div className="text-sm text-gray-500">
                            Adiciona colunas pré-definidas para enriquecer seus dados com score, categorias e prioridades
                          </div>
                        </button>
                        
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      <button
                        onClick={() => setSelectedColumnType(null)}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
                      >
                        ← Voltar para tipos de coluna
                      </button>
                      
                      <div className="grid gap-4">
                        <h3 className="text-lg font-medium">
                          {selectedColumnType === 'estatica' && 'Coluna Estática'}
                          {selectedColumnType === 'api' && 'Consulta de API'}
                          {selectedColumnType === 'enriquecer' && 'Enriquecimento de Dados'}
                        </h3>
                        
                        {selectedColumnType !== 'enriquecer' && (
                          <div className="grid gap-2">
                            <label className="text-sm font-medium">Nome da Coluna</label>
                            <input
                              type="text"
                              value={columnName}
                              onChange={(e) => setColumnName(e.target.value)}
                              placeholder="Digite o nome da coluna"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}
                        
                        {selectedColumnType === 'api' && (
                          <div className="grid gap-2">
                            <label className="text-sm font-medium">Endpoint da API (opcional)</label>
                            <input
                              type="text"
                              value={apiEndpoint}
                              onChange={(e) => setApiEndpoint(e.target.value)}
                              placeholder="https://api.exemplo.com/endpoint"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-gray-500">
                              Deixe em branco para usar configuração padrão
                            </p>
                          </div>
                        )}
                        
                        {selectedColumnType === 'enriquecer' && (
                          <div className="grid gap-3">
                            <p className="text-sm text-gray-600 mb-3">
                              Escolha o tipo de enriquecimento que deseja aplicar aos seus dados:
                            </p>
                            
                            <div className="grid gap-2">
                              <button
                                onClick={() => {
                                  // Add predefined enrichment columns
                                  const enriquecerColumns = ['score', 'categoria', 'prioridade', 'data_enriquecimento', 'fonte'];
                                  setData(prevData => prevData.map(row => {
                                    const newRow = { ...row };
                                    enriquecerColumns.forEach(col => {
                                      if (!(col in newRow)) {
                                        switch(col) {
                                          case 'score':
                                            newRow[col] = '0';
                                            break;
                                          case 'data_enriquecimento':
                                            newRow[col] = new Date().toLocaleDateString('pt-BR');
                                            break;
                                          default:
                                            newRow[col] = 'pendente';
                                        }
                                      }
                                    });
                                    return newRow;
                                  }));
                                  setIsSheetOpen(false);
                                  setSelectedColumnType(null);
                                }}
                                className="flex flex-col items-start gap-2 rounded-lg border p-4 text-left hover:bg-gray-50"
                              >
                                <div className="font-semibold">Enriquecimento Básico</div>
                                <div className="text-sm text-gray-500">
                                  Adiciona colunas pré-definidas: score, categoria, prioridade, data_enriquecimento e fonte
                                </div>
                              </button>
                              
                              <div className="border-t pt-3 mt-3">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Enriquecimento via WebSocket (Real-time)</h4>
                                <div className="grid gap-2">
                                  <button
                                    onClick={() => {
                                      handleWebSocketEnrichment('address');
                                      setIsSheetOpen(false);
                                      setSelectedColumnType(null);
                                    }}
                                    disabled={!isWebSocketConnected || isEnriching}
                                    className="flex flex-col items-start gap-2 rounded-lg border p-4 text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="font-semibold">Endereços</div>
                                      {!isWebSocketConnected && (
                                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Offline</span>
                                      )}
                                      {isWebSocketConnected && (
                                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Online</span>
                                      )}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      Enriquecer dados com endereços completos, CEP e país
                                    </div>
                                  </button>
                                  
                                  <button
                                    onClick={() => {
                                      handleWebSocketEnrichment('email');
                                      setIsSheetOpen(false);
                                      setSelectedColumnType(null);
                                    }}
                                    disabled={!isWebSocketConnected || isEnriching}
                                    className="flex flex-col items-start gap-2 rounded-lg border p-4 text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <div className="font-semibold">Emails</div>
                                    <div className="text-sm text-gray-500">
                                      Validar e enriquecer informações de email
                                    </div>
                                  </button>
                                  
                                  <button
                                    onClick={() => {
                                      handleWebSocketEnrichment('phone');
                                      setIsSheetOpen(false);
                                      setSelectedColumnType(null);
                                    }}
                                    disabled={!isWebSocketConnected || isEnriching}
                                    className="flex flex-col items-start gap-2 rounded-lg border p-4 text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <div className="font-semibold">Telefones</div>
                                    <div className="text-sm text-gray-500">
                                      Validar e formatar números de telefone
                                    </div>
                                  </button>
                                  
                                  <button
                                    onClick={() => {
                                      handleWebSocketEnrichment('company');
                                      setIsSheetOpen(false);
                                      setSelectedColumnType(null);
                                    }}
                                    disabled={!isWebSocketConnected || isEnriching}
                                    className="flex flex-col items-start gap-2 rounded-lg border p-4 text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <div className="font-semibold">Dados de Empresa</div>
                                    <div className="text-sm text-gray-500">
                                      Enriquecer com informações de empresa, setor e tamanho
                                    </div>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {selectedColumnType !== 'enriquecer' && (
                          <div className="flex gap-2 pt-4">
                            <button
                              onClick={() => setSelectedColumnType(null)}
                              className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={handleCreateColumn}
                              disabled={!columnName.trim()}
                              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Criar Coluna
                            </button>
                          </div>
                        )}
                        {selectedColumnType === 'enriquecer' && (
                          <div className="flex gap-2 pt-4">
                            <button
                              onClick={() => setSelectedColumnType(null)}
                              className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                              Voltar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
      </TabsContent>
      <TabsContent
        value="past-performance"
        className="flex flex-col px-4 lg:px-6"
      >
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
      <TabsContent value="key-personnel" className="flex flex-col px-4 lg:px-6">
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
      <TabsContent
        value="focus-documents"
        className="flex flex-col px-4 lg:px-6"
      >
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
    </Tabs>
  )
}

