import { useState, useEffect } from 'react'
import { CollaborativeSheet } from './components/collaborative-sheet'
import { useSheet } from './hooks/useSheet'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Skeleton } from './components/ui/skeleton'
import { Plus, RefreshCw } from 'lucide-react'
import { SidebarInset, SidebarProvider } from './components/ui/sidebar'
import { AppSidebar } from './components/app-sidebar'
import { SiteHeader } from './components/site-header'

// Mock data for creating initial sheet
const initialData = [
  {
    nome: 'José da Silva',
    empresa: 'Empresa A',
    cnpj: '48.888.581/0001-76',
    email: 'jose@empresa.com',
    telefone: '(11) 9999-8888',
    status: 'Ativo'
  },
  {
    nome: 'Maria Silva',
    empresa: 'Empresa B',
    cnpj: '05.206.246/0001-38',
    email: 'maria@empresa.com',
    telefone: '(11) 9777-6666',
    status: 'Pendente'
  },
  {
    nome: 'João Santos',
    empresa: 'Empresa C',
    cnpj: '12.345.678/0001-99',
    email: 'joao@empresa.com',
    telefone: '(11) 9555-4444',
    status: 'Ativo'
  }
];

function App() {
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  
  // Generate user info (in a real app, this would come from auth)
  const userId = 'user-demo-1';
  const userName = 'Demo User';

  // Use sheet hook only when we have a sheetId
  const sheet = useSheet({
    sheetId: sheetId || '',
    userId,
    userName,
    autoConnect: !!sheetId,
  });

  // Create initial sheet
  const createSheet = async () => {
    setIsCreatingSheet(true);
    try {
      const apiUrl = 'http://56.124.127.185:3002/api/sheets';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Planilha de Prospects - Demo',
          initialData,
          userId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create sheet');
      }

      const result = await response.json();
      if (result.success) {
        setSheetId(result.data.id);
      } else {
        throw new Error(result.message || 'Failed to create sheet');
      }
    } catch (error) {
      console.error('Error creating sheet:', error);
      alert('Erro ao criar planilha. Verifique se o backend está rodando.');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  // Auto-create sheet on first load
  useEffect(() => {
    if (!sheetId && !isCreatingSheet) {
      createSheet();
    }
  });

  if (!sheetId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Prospectiza</CardTitle>
            <CardDescription>
              Sistema de Planilhas Colaborativas com Enriquecimento de Dados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isCreatingSheet ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="text-center text-sm text-gray-600">
                  Criando planilha demo...
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <p className="text-gray-600">
                  Clique no botão abaixo para criar uma planilha demo com dados de exemplo.
                </p>
                <Button onClick={createSheet} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Planilha Demo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sheet.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="text-center text-sm text-gray-600">
                Conectando à planilha...
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sheet.error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Erro de Conexão</CardTitle>
            <CardDescription>
              Não foi possível conectar à planilha
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              {sheet.error}
            </p>
            <div className="flex gap-2">
              <Button onClick={sheet.connect} variant="outline" className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar Novamente
              </Button>
              <Button onClick={() => setSheetId(null)} variant="outline" className="flex-1">
                Nova Planilha
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset className="sidebar-inset">
        <SiteHeader />
        <div className="flex flex-1 flex-col bg-gray-50">
          <div className="flex flex-1 flex-col p-4 overflow-hidden">
            {/* Collaborative Sheet */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <CollaborativeSheet
                columns={sheet.columns}
                rows={sheet.rows}
                activeUsers={sheet.activeUsers}
                isEnriching={sheet.isEnriching}
                enrichmentProgress={sheet.enrichmentProgress}
                onCellChange={sheet.updateCell}
                onAddRow={sheet.addRow}
                onAddColumn={sheet.addColumn}
                onStartEnrichment={sheet.startEnrichment}
                editableFields={sheet.metadata?.editableFields || []}
              />
            </div>
          </div>
        </div>
        </SidebarInset>
    </SidebarProvider>
  )
}

export default App
