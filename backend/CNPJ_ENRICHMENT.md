# Sistema de Enriquecimento de CNPJ

Este sistema utiliza a API OpenCNPJ para enriquecer dados de empresas brasileiras com informações oficiais da Receita Federal.

## Funcionalidades

- ✅ **Validação de CNPJ**: Validação completa incluindo dígitos verificadores
- ✅ **API Gratuita**: Utiliza a API OpenCNPJ (sem necessidade de chaves)
- ✅ **Rate Limiting**: Controle automático de taxa de requisições (50/segundo)
- ✅ **Processamento em Lote**: Suporte a múltiplos CNPJs com controle de batch
- ✅ **Detecção Automática**: Identifica automaticamente campos que contêm CNPJ
- ✅ **Tratamento de Erros**: Gerenciamento robusto de erros e timeouts
- ✅ **Cache de Requisições**: Evita requisições duplicadas simultâneas

## Dados Enriquecidos

O sistema retorna as seguintes informações para cada CNPJ válido:

### Informações Básicas
- CNPJ formatado
- Razão Social
- Nome Fantasia
- Situação Cadastral
- Data da Situação Cadastral
- Matriz/Filial
- Data de Início de Atividade

### Atividade Econômica
- CNAE Principal
- CNAEs Secundários
- Natureza Jurídica

### Endereço Completo
- Logradouro
- Número
- Complemento
- Bairro
- CEP
- Cidade
- UF

### Informações de Contato
- Email
- Telefones (com DDD e tipo)

### Informações Societárias
- Capital Social
- Porte da Empresa
- Opção pelo Simples Nacional
- Opção pelo MEI
- Quadro Societário (QSA)

## Como Usar

### 1. Instalação das Dependências

```bash
npm install @nestjs/axios axios
```

### 2. Configuração do Job

```typescript
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

// Injetar a fila de enriquecimento
constructor(
  @InjectQueue('enrichment') private enrichmentQueue: Queue,
) {}

// Criar job de enriquecimento
const job = await this.enrichmentQueue.add('enrich-batch', {
  batch: [
    {
      originalIndex: 0,
      cnpj: '11.222.333/0001-81',
      nomeEmpresa: 'Empresa Exemplo',
    }
  ],
  enrichmentType: 'cnpj', // ou 'company'
  options: {
    cnpjField: 'cnpj', // Campo que contém o CNPJ (opcional)
  },
  sessionId: 'unique-session-id',
  batchIndex: 0,
});
```

### 3. Formatos de CNPJ Aceitos

A API aceita CNPJs nos seguintes formatos:
- `00000000000000` (apenas números)
- `00.000.000/0000-00` (formatação completa)
- `00.000.000/000000` (sem hífen)

### 4. Detecção Automática de CNPJ

Se não especificar o campo `cnpjField`, o sistema tentará detectar automaticamente:

1. Campos comuns: `cnpj`, `CNPJ`, `document`, `documento`, `registration`, `registro`
2. Qualquer campo string com 14 dígitos numéricos

### 5. Processamento do Resultado

```typescript
// Resultado do job
{
  sessionId: string,
  results: [
    {
      rowIndex: number,
      data: any, // Dados originais
      enrichedFields: {
        cnpj: string,
        razaoSocial: string,
        nomeFantasia: string,
        // ... outros campos enriquecidos
      },
      success: boolean,
      error?: {
        message: string,
        code: 'INVALID_FORMAT' | 'NOT_FOUND' | 'RATE_LIMIT' | 'API_ERROR',
      }
    }
  ],
  batchIndex: number,
  processedAt: Date,
}
```

## Tratamento de Erros

### Códigos de Erro

- `INVALID_FORMAT`: CNPJ com formato inválido ou dígitos verificadores incorretos
- `NOT_FOUND`: CNPJ não encontrado na base da Receita Federal
- `RATE_LIMIT`: Limite de 50 requisições/segundo excedido
- `API_ERROR`: Erro interno da API ou timeout

### Rate Limiting

O sistema implementa controle automático de rate limiting:
- Máximo de 10 CNPJs processados simultaneamente
- Delay de 1 segundo entre batches
- Timeout de 10 segundos por requisição

## Exemplo Completo

```typescript
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class MeuServico {
  constructor(
    @InjectQueue('enrichment') private enrichmentQueue: Queue,
  ) {}

  async enriquecerEmpresas(empresas: any[]) {
    // Preparar dados
    const batch = empresas.map((empresa, index) => ({
      originalIndex: index,
      cnpj: empresa.documento,
      nome: empresa.razaoSocial,
    }));

    // Criar job
    const job = await this.enrichmentQueue.add('enrich-batch', {
      batch,
      enrichmentType: 'cnpj',
      options: {
        cnpjField: 'cnpj',
      },
      sessionId: `enriquecimento-${Date.now()}`,
      batchIndex: 0,
    });

    console.log(`Job criado: ${job.id}`);
    return job;
  }

  // Processar resultado (via WebSocket ou callback)
  processarResultado(resultado: any) {
    resultado.results.forEach((item: any) => {
      if (item.success) {
        console.log(`✅ ${item.enrichedFields.razaoSocial}`);
        console.log(`   CNPJ: ${item.enrichedFields.cnpj}`);
        console.log(`   Situação: ${item.enrichedFields.situacaoCadastral}`);
        console.log(`   Endereço: ${item.enrichedFields.endereco.cidade}/${item.enrichedFields.endereco.uf}`);
      } else {
        console.log(`❌ Erro: ${item.error.message}`);
      }
    });
  }
}
```

## Limitações e Considerações

1. **Rate Limit**: 50 requisições por segundo por IP
2. **Disponibilidade**: API servida pela Cloudflare com alta disponibilidade
3. **Cache**: Resultados são cacheados pela CDN (MISS ~150ms, HIT ~40ms)
4. **Validação**: CNPJs inválidos são rejeitados antes da consulta à API
5. **Timeout**: Requisições têm timeout de 10 segundos

## Monitoramento

O sistema inclui logs detalhados para monitoramento:
- Início e fim de processamento de batches
- Requisições individuais à API
- Erros e timeouts
- Performance e timing

## Próximos Passos

- [ ] Implementar cache local para CNPJs consultados recentemente
- [ ] Adicionar métricas de performance
- [ ] Implementar retry automático para falhas temporárias
- [ ] Adicionar suporte a webhooks para notificações de conclusão
