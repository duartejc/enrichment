/**
 * Tipos para o sistema de planilhas colaborativas
 */

export interface Cell {
  value: any;
  formula?: string;
  isLoading?: boolean;
  style?: {
    backgroundColor?: string;
    textColor?: string;
    fontWeight?: 'normal' | 'bold';
    textAlign?: 'left' | 'center' | 'right';
  };
  metadata?: Record<string, any>;
}

export interface CellFormat {
  type?: 'text' | 'number' | 'date' | 'email' | 'phone' | 'cnpj' | 'currency';
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  alignment?: 'left' | 'center' | 'right';
}

export interface Column {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'email' | 'phone' | 'cnpj' | 'select' | 'enriched';
  editable: boolean;
  width?: number;
  options?: string[]; // Para tipo 'select'
  enrichmentType?: 'address' | 'email' | 'phone' | 'company'; // Para colunas enriquecidas
}

export interface Sheet {
  id: string;
  name: string;
  description?: string;
  columns: Column[];
  rows: Record<string, Cell>[]; // Array de objetos, cada objeto é uma linha
  metadata: {
    totalRows: number;
    totalColumns: number;
    lastModified: Date;
    version: number;
    editableFields: string[];
  };
  permissions: {
    owner: string;
    editors: string[];
    viewers: string[];
    public: boolean;
  };
  settings: {
    autoSave: boolean;
    enableCollaboration: boolean;
    enableEnrichment: boolean;
  };
}

export interface SheetOperation {
  type: 'cell_update' | 'row_insert' | 'row_delete' | 'column_insert' | 'column_delete' | 'enrichment_update' | 'enrichment_progress' | 'sheet_updated';
  sheetId: string;
  userId: string;
  timestamp: number;
  data: any;
  version: number;
}

export interface EnrichmentResult {
  rowIndex: number;
  columnId: string;
  enrichedData: Record<string, any>;
  source: string;
  success: boolean;
  error?: string;
}

export interface CollaborationEvent {
  type: 'user_joined' | 'user_left' | 'cursor_moved' | 'cell_selected' | 'operation_applied';
  sheetId: string;
  userId: string;
  userName: string;
  data?: any;
  timestamp: number;
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
