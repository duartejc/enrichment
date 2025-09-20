export interface OpenCNPJTelefone {
  ddd: string;
  numero: string;
  is_fax: boolean;
}

export interface OpenCNPJSocio {
  nome_socio: string;
  cnpj_cpf_socio: string;
  qualificacao_socio: string;
  data_entrada_sociedade: string;
  identificador_socio: string;
  faixa_etaria: string;
}

export interface OpenCNPJResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: string;
  data_situacao_cadastral: string;
  matriz_filial: string;
  data_inicio_atividade: string;
  cnae_principal: string;
  cnaes_secundarios: string[];
  cnaes_secundarios_count: number;
  natureza_juridica: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  uf: string;
  municipio: string;
  email: string;
  telefones: OpenCNPJTelefone[];
  capital_social: string;
  porte_empresa: string;
  opcao_simples: string | null;
  data_opcao_simples: string | null;
  opcao_mei: string | null;
  data_opcao_mei: string | null;
  QSA: OpenCNPJSocio[];
}

export interface CNPJEnrichmentResult {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  situacaoCadastral: string;
  dataSituacaoCadastral: string;
  matrizFilial: string;
  dataInicioAtividade: string;
  cnaePrincipal: string;
  cnaesPrincipalDescricao?: string;
  cnaesSecundarios: string[];
  cnaesSecundariosCount: number;
  naturezaJuridica: string;
  endereco: {
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cep: string;
    uf: string;
    municipio: string;
  };
  contato: {
    email: string;
    telefones: OpenCNPJTelefone[];
  };
  capitalSocial: string;
  porteEmpresa: string;
  opcaoSimples: string | null;
  dataOpcaoSimples: string | null;
  opcaoMei: string | null;
  dataOpcaoMei: string | null;
  socios: OpenCNPJSocio[];
  enrichedAt: Date;
}

export interface CNPJValidationError {
  code: 'INVALID_FORMAT' | 'NOT_FOUND' | 'RATE_LIMIT' | 'API_ERROR';
  message: string;
}
