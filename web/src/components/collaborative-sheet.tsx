/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
} from './ui/sheet';
import { 
  IconPlus, 
  IconEdit,
  IconDatabase,
  IconUsers
} from '@tabler/icons-react';
import { type Column, type UserCursor, type EnrichmentProgress } from '@/services/sheet-websocket.service';

interface CollaborativeSheetProps {
  columns: Column[];
  rows: Record<string, any>[];
  activeUsers: UserCursor[];
  isEnriching: boolean;
  enrichmentProgress: EnrichmentProgress | null;
  onCellChange: (rowIndex: number, columnId: string, value: any) => void;
  onAddRow: (data: Record<string, any>) => void;
  onAddColumn: (column: {
    name: string;
    type: Column['type'];
    editable: boolean;
    enrichmentType?: Column['enrichmentType'];
  }) => void;
  onStartEnrichment: (enrichmentType: string, options?: any) => void;
  editableFields: string[];
}

export function CollaborativeSheet({
  columns,
  rows,
  activeUsers,
  isEnriching,
  enrichmentProgress,
  onCellChange,
  onAddRow,
  onAddColumn,
  onStartEnrichment,
  editableFields,
}: CollaborativeSheetProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; column: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedCell, setSelectedCell] = useState<{ row: number; column: string } | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState<Column['type']>('text');

  // Scroll to cell function
  const scrollToCell = useCallback((rowIndex: number, columnId: string) => {
    // Use setTimeout to ensure DOM is updated
    setTimeout(() => {
      const cellElement = document.querySelector(
        `[data-cell-row="${rowIndex}"][data-cell-column="${columnId}"]`
      ) as HTMLElement;
      
      if (cellElement) {
        cellElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }
    }, 10);
  }, []);

  // Navigate to cell with auto-scroll
  const navigateToCell = useCallback((rowIndex: number, columnId: string) => {
    setSelectedCell({ row: rowIndex, column: columnId });
    scrollToCell(rowIndex, columnId);
  }, [scrollToCell]);

  // Handle cell selection and editing
  const handleCellClick = useCallback((rowIndex: number, columnId: string, currentValue: any) => {
    if (!editableFields.includes(columnId)) return;
    
    setSelectedCell({ row: rowIndex, column: columnId });
    scrollToCell(rowIndex, columnId);
    // Don't start editing immediately, wait for user input
  }, [editableFields, scrollToCell]);

  const startEditing = useCallback((rowIndex: number, columnId: string, currentValue: any, initialChar?: string) => {
    if (!editableFields.includes(columnId)) return;
    
    setEditingCell({ row: rowIndex, column: columnId });
    // Handle both direct values and wrapped values
    const actualValue = currentValue?.value !== undefined ? currentValue.value : currentValue;
    const existingText = String(actualValue || '');
    
    if (initialChar) {
      // Append the new character to existing text
      setEditValue(existingText + initialChar);
    } else {
      // No initial character, just use existing value
      setEditValue(existingText);
    }
  }, [editableFields]);

  const handleCellSave = useCallback(() => {
    if (!editingCell) return;
    
    onCellChange(editingCell.row, editingCell.column, editValue);
    setEditingCell(null);
    setEditValue('');
  }, [editingCell, editValue, onCellChange]);

  const handleCellCancel = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  // Add new row
  const handleAddRow = useCallback(() => {
    const newRowData: Record<string, any> = {};
    columns.forEach(col => {
      if (col.editable) {
        newRowData[col.id] = '';
      }
    });
    onAddRow(newRowData);
  }, [columns, onAddRow]);

  // Use refs to avoid re-renders
  const editingCellRef = useRef(editingCell);
  const selectedCellRef = useRef(selectedCell);
  const rowsRef = useRef(rows);
  const columnsRef = useRef(columns);
  const editableFieldsRef = useRef(editableFields);

  // Update refs when values change
  useEffect(() => { editingCellRef.current = editingCell; }, [editingCell]);
  useEffect(() => { selectedCellRef.current = selectedCell; }, [selectedCell]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { columnsRef.current = columns; }, [columns]);
  useEffect(() => { editableFieldsRef.current = editableFields; }, [editableFields]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentEditingCell = editingCellRef.current;
      const currentSelectedCell = selectedCellRef.current;
      const currentRows = rowsRef.current;
      const currentColumns = columnsRef.current;
      const currentEditableFields = editableFieldsRef.current;

      // If we're editing a cell
      if (currentEditingCell) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleCellSave();
          // Move to next row
          const nextRow = currentEditingCell.row + 1;
          if (nextRow < currentRows.length) {
            navigateToCell(nextRow, currentEditingCell.column);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleCellCancel();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          handleCellSave();
          // Move to next column
          const currentColIndex = currentColumns.findIndex(col => col.id === currentEditingCell.column);
          const nextColIndex = e.shiftKey ? currentColIndex - 1 : currentColIndex + 1;
          if (nextColIndex >= 0 && nextColIndex < currentColumns.length) {
            const nextColumn = currentColumns[nextColIndex];
            if (currentEditableFields.includes(nextColumn.id)) {
              navigateToCell(currentEditingCell.row, nextColumn.id);
            }
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          handleCellSave();
          // Move to previous row
          if (currentEditingCell.row > 0) {
            navigateToCell(currentEditingCell.row - 1, currentEditingCell.column);
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          handleCellSave();
          // Move to next row
          const nextRow = currentEditingCell.row + 1;
          if (nextRow < currentRows.length) {
            navigateToCell(nextRow, currentEditingCell.column);
          } else {
            // Add new row if at the end
            handleAddRow();
            navigateToCell(currentRows.length, currentEditingCell.column);
          }
        } else if (e.key === 'ArrowLeft') {
          // Check if cursor is at the beginning of input
          const input = e.target as HTMLInputElement;
          if (input && input.selectionStart === 0) {
            e.preventDefault();
            handleCellSave();
            // Move to previous column
            const currentColIndex = currentColumns.findIndex(col => col.id === currentEditingCell.column);
            if (currentColIndex > 0) {
              const prevColumn = currentColumns[currentColIndex - 1];
              if (currentEditableFields.includes(prevColumn.id)) {
                navigateToCell(currentEditingCell.row, prevColumn.id);
              }
            }
          }
        } else if (e.key === 'ArrowRight') {
          // Check if cursor is at the end of input
          const input = e.target as HTMLInputElement;
          if (input && input.selectionStart === input.value.length) {
            e.preventDefault();
            handleCellSave();
            // Move to next column
            const currentColIndex = currentColumns.findIndex(col => col.id === currentEditingCell.column);
            if (currentColIndex < currentColumns.length - 1) {
              const nextColumn = currentColumns[currentColIndex + 1];
              if (currentEditableFields.includes(nextColumn.id)) {
                navigateToCell(currentEditingCell.row, nextColumn.id);
              }
            }
          }
        }
        // Allow normal paste behavior during editing (don't prevent default for Ctrl+V)
        return;
      }

      // If we have a selected cell but not editing
      if (currentSelectedCell) {
        const { row, column } = currentSelectedCell;
        const cellData = currentRows[row]?.[column];
        const currentValue = cellData?.value !== undefined ? cellData.value : cellData;

        if (e.key === 'Enter' || e.key === 'F2') {
          e.preventDefault();
          startEditing(row, column, currentValue);
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          onCellChange(row, column, '');
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setSelectedCell(null);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          // Navigate to next/previous column
          const currentColIndex = currentColumns.findIndex(col => col.id === column);
          const nextColIndex = e.shiftKey ? currentColIndex - 1 : currentColIndex + 1;
          if (nextColIndex >= 0 && nextColIndex < currentColumns.length) {
            const nextColumn = currentColumns[nextColIndex];
            if (currentEditableFields.includes(nextColumn.id)) {
              navigateToCell(row, nextColumn.id);
            }
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (row > 0) {
            navigateToCell(row - 1, column);
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (row < currentRows.length - 1) {
            navigateToCell(row + 1, column);
          } else {
            // Add new row if at the end
            handleAddRow();
            navigateToCell(currentRows.length, column);
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const currentColIndex = currentColumns.findIndex(col => col.id === column);
          if (currentColIndex > 0) {
            const prevColumn = currentColumns[currentColIndex - 1];
            if (currentEditableFields.includes(prevColumn.id)) {
              navigateToCell(row, prevColumn.id);
            }
          }
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          const currentColIndex = currentColumns.findIndex(col => col.id === column);
          if (currentColIndex < currentColumns.length - 1) {
            const nextColumn = currentColumns[currentColIndex + 1];
            if (currentEditableFields.includes(nextColumn.id)) {
              navigateToCell(row, nextColumn.id);
            }
          }
        } else if (e.ctrlKey && e.key === 'v') {
          // Handle paste
          e.preventDefault();
          navigator.clipboard.readText().then(text => {
            if (text) {
              onCellChange(row, column, text);
            }
          }).catch(err => {
            console.warn('Failed to read clipboard:', err);
          });
        } else if (e.ctrlKey && e.key === 'c') {
          // Handle copy
          e.preventDefault();
          if (currentValue) {
            navigator.clipboard.writeText(String(currentValue)).catch(err => {
              console.warn('Failed to write to clipboard:', err);
            });
          }
        } else if (e.ctrlKey && e.key === 'x') {
          // Handle cut
          e.preventDefault();
          if (currentValue) {
            navigator.clipboard.writeText(String(currentValue)).then(() => {
              onCellChange(row, column, '');
            }).catch(err => {
              console.warn('Failed to write to clipboard:', err);
            });
          }
        } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          // Start editing with the typed character
          e.preventDefault();
          startEditing(row, column, currentValue, e.key);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleCellSave, handleCellCancel, startEditing, onCellChange, handleAddRow, navigateToCell]);

  // Add new column
  const handleAddColumn = useCallback(() => {
    if (!newColumnName.trim()) return;
    
    onAddColumn({
      name: newColumnName.trim(),
      type: newColumnType,
      editable: true,
    });
    
    setNewColumnName('');
    setNewColumnType('text');
    setShowAddColumn(false);
  }, [newColumnName, newColumnType, onAddColumn]);

  // Get cell display value - memoized to avoid re-renders
  const getCellDisplayValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Get cell background color based on enrichment status - memoized
  const getCellStyle = (columnId: string, value: any) => {
    const column = columns.find(col => col.id === columnId);
    if (column?.enrichmentType && value) {
      return { backgroundColor: '#f0f9ff', borderLeft: '3px solid #3b82f6' };
    }
    return {};
  };

  return (
    <div className="h-full flex flex-col table-container overflow-hidden">
      {/* Header with Actions */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button onClick={handleAddRow} size="sm">
            <IconPlus className="h-4 w-4 mr-1" />
            Adicionar Linha
          </Button>
          
          <Button onClick={() => setShowAddColumn(true)} variant="outline" size="sm">
            <IconPlus className="h-4 w-4 mr-1" />
            Adicionar Coluna
          </Button>
          
          <Button 
            onClick={() => {
              console.log('Enriquecimento button clicked');
              onStartEnrichment('company');
            }} 
            variant="outline" 
            size="sm"
            disabled={isEnriching}
          >
            <IconDatabase className="h-4 w-4 mr-1" />
            {isEnriching ? 'Enriquecendo...' : 'Enriquecer Dados'}
          </Button>

          {/* Estatísticas de Enriquecimento */}
          {rows && rows.length > 0 && (
            <div className="text-xs text-gray-600 ml-2 flex items-center gap-2">
              {(() => {
                const enriched = rows.filter(row => row._enriched?.value === true).length;
                const withCnpj = rows.filter(row => row.cnpj?.value && row.cnpj.value.toString().trim() !== '').length;
                const loading = rows.filter(row => 
                  Object.values(row).some((cell: any) => cell?.isLoading === true)
                ).length;
                const unenriched = withCnpj - enriched - loading;
                
                return (
                  <span>
                    📊 {enriched} enriquecidos | {loading > 0 ? `${loading} processando | ` : ''}{unenriched} pendentes | {withCnpj} com CNPJ
                  </span>
                );
              })()}
            </div>
          )}
        </div>

        {/* Active Users */}
        {activeUsers.length > 0 && (
          <div className="flex items-center gap-2">
            <IconUsers className="h-4 w-4 text-gray-500" />
            <div className="flex gap-1">
              {activeUsers.map((user) => (
                <Badge
                  key={user.userId}
                  variant="outline"
                  style={{ borderColor: user.color, color: user.color }}
                  className="text-xs"
                >
                  {user.userName}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>


      {/* Sheet Table */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="table-scroll border">
          <table className="w-full border-collapse">
            {/* Header */}
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-r">
                  #
                </th>
                {columns.map((column) => (
                  <th
                    key={column.id}
                    className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-r min-w-[120px]"
                  >
                    <div className="flex items-center gap-2">
                      <span>{column.name}</span>
                      {column.enrichmentType && (
                        <Badge variant="secondary" className="text-xs">
                          Enriquecido
                        </Badge>
                      )}
                      {!column.editable && (
                        <IconEdit className="h-3 w-3 text-gray-400" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            
            {/* Body */}
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500 border-r font-medium">
                    {rowIndex + 1}
                  </td>
                  {columns.map((column) => {
                    const cellData = row[column.id];
                    // Handle both direct values and wrapped values
                    const cellValue = cellData?.value !== undefined ? cellData.value : cellData;
                    const isLoading = cellData?.isLoading || false;
                    const isEditing = editingCell?.row === rowIndex && editingCell?.column === column.id;
                    const isEditable = editableFields.includes(column.id);
                    
                    
                    return (
                      <td
                        key={column.id}
                        data-cell-row={rowIndex}
                        data-cell-column={column.id}
                        className={`px-4 py-3 text-sm border-r cursor-pointer hover:bg-gray-100 ${
                          selectedCell?.row === rowIndex && selectedCell?.column === column.id
                            ? 'bg-blue-50 ring-2 ring-blue-500 ring-inset'
                            : ''
                        } ${isEditing ? 'editing-cell' : ''}`}
                        style={getCellStyle(column.id, cellValue)}
                        onClick={() => !isLoading && handleCellClick(rowIndex, column.id, cellValue)}
                        tabIndex={isEditable ? 0 : -1}
                      >
                        {isLoading ? (
                          <Skeleton className="h-4 w-full" />
                        ) : isEditing ? (
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-8 text-sm border-0 p-0 focus:ring-0 focus:border-0 bg-transparent text-gray-900 w-full min-w-0 cell-input"
                            autoFocus
                            onBlur={handleCellSave}
                            style={{ outline: 'none', boxShadow: 'none' }}
                            onFocus={(e) => {
                              // Position cursor at the end when focusing
                              const input = e.target;
                              setTimeout(() => {
                                input.setSelectionRange(input.value.length, input.value.length);
                              }, 0);
                            }}
                          />
                        ) : (
                          <div className="flex items-center justify-between group">
                            <span className={isEditable ? 'cursor-text' : 'cursor-default'}>
                              {getCellDisplayValue(cellValue)}
                            </span>
                            {isEditable && (
                              <IconEdit className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100" />
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              
              {/* Empty rows for better UX */}
              {Array.from({ length: 5 }, (_, index) => (
                <tr key={`empty-${index}`} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-300 border-r">
                    {rows.length + index + 1}
                  </td>
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className="px-4 py-3 text-sm border-r cursor-pointer hover:bg-gray-100"
                      onClick={() => {
                        if (editableFields.includes(column.id)) {
                          // Add new row when clicking on empty cell
                          const newRowData: Record<string, any> = {};
                          columns.forEach(col => {
                            newRowData[col.id] = col.id === column.id ? '' : '';
                          });
                          onAddRow(newRowData);
                        }
                      }}
                    >
                      <span className="text-gray-300">—</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sheet for Adding Column */}
      <Sheet open={showAddColumn} onOpenChange={setShowAddColumn}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px] p-6">
          <SheetHeader>
            <SheetTitle>Adicionar Nova Coluna</SheetTitle>
            <SheetDescription>
              Configure os detalhes da nova coluna que será adicionada à planilha.
            </SheetDescription>
          </SheetHeader>
          
          <div className="grid gap-6 py-6">
            <div className="grid gap-2">
              <label htmlFor="column-name" className="text-sm font-medium">
                Nome da Coluna
              </label>
              <Input
                id="column-name"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="Digite o nome da coluna"
                className="w-full"
              />
            </div>
            
            <div className="grid gap-2">
              <label htmlFor="column-type" className="text-sm font-medium">
                Tipo de Dados
              </label>
              <select
                id="column-type"
                value={newColumnType}
                onChange={(e) => setNewColumnType(e.target.value as Column['type'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="text">📝 Texto</option>
                <option value="number">🔢 Número</option>
                <option value="email">📧 Email</option>
                <option value="phone">📞 Telefone</option>
                <option value="date">📅 Data</option>
                <option value="cnpj">🏢 CNPJ</option>
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Configurações</label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="editable"
                    defaultChecked
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="editable" className="text-sm">
                    Coluna editável
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="required"
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="required" className="text-sm">
                    Campo obrigatório
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 pt-6 border-t">
            <Button 
              onClick={handleAddColumn} 
              disabled={!newColumnName.trim()}
              className="flex-1"
            >
              <IconPlus className="h-4 w-4 mr-2" />
              Criar Coluna
            </Button>
            <Button 
              onClick={() => setShowAddColumn(false)} 
              variant="outline"
              className="flex-1"
            >
              Cancelar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
