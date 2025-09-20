// Test data generator for performance testing
export interface TestDataRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  city: string;
  state: string;
  country: string;
}

// Sample data for realistic test records
const sampleNames = [
  'João Silva', 'Maria Santos', 'Pedro Oliveira', 'Ana Costa', 'Carlos Pereira',
  'Fernanda Lima', 'Ricardo Gomes', 'Patricia Rocha', 'Roberto Almeida', 'Camila Ferreira',
  'Eduardo Martins', 'Juliana Castro', 'Marcelo Ribeiro', 'Aline Mendes', 'Gustavo Barbosa',
  'Luciana Carvalho', 'Rafael Correia', 'Daniela Pinto', 'Bruno Moraes', 'Tatiana Monteiro'
];

const sampleCompanies = [
  'Tech Solutions Ltda', 'Digital Innovation SA', 'Cloud Computing Brasil', 'Data Systems RH',
  'Software Development Co', 'IT Consulting Group', 'Web Services Pro', 'Mobile Apps Brasil',
  'Cyber Security Tech', 'AI Solutions SA', 'Blockchain Innovation', 'IoT Systems Ltda',
  'Machine Learning Co', 'DevOps Solutions', 'Cloud Native Brasil', 'Microservices Tech',
  'API Development SA', 'Frontend Solutions', 'Backend Systems Ltda', 'Full Stack Dev Co'
];

const sampleCities = [
  'São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza',
  'Belo Horizonte', 'Manaus', 'Curitiba', 'Recife', 'Goiânia',
  'Porto Alegre', 'Belém', 'Guarulhos', 'Campinas', 'São Luís'
];

const sampleStates = [
  'SP', 'RJ', 'DF', 'BA', 'CE', 'MG', 'AM', 'PR', 'PE', 'GO',
  'RS', 'PA', 'SP', 'SP', 'MA'
];

const countries = ['Brasil', 'Argentina', 'Chile', 'Colômbia', 'Peru', 'Uruguai', 'Paraguai', 'Bolívia', 'Equador', 'Venezuela'];

// Generate random number within range
const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Generate random email
const generateEmail = (name: string): string => {
  const [firstName, lastName] = name.toLowerCase().split(' ');
  const domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'empresa.com.br'];
  const domain = domains[randomInt(0, domains.length - 1)];
  return `${firstName}.${lastName}${randomInt(1, 999)}@${domain}`;
};

// Generate random phone
const generatePhone = (): string => {
  const ddd = randomInt(11, 99);
  const number = randomInt(900000000, 999999999);
  return `(${ddd}) ${number.toString().slice(0, 5)}-${number.toString().slice(5)}`;
};

// Generate random address
const generateAddress = (): string => {
  const streets = [
    'Rua das Flores', 'Avenida Paulista', 'Rua Augusta', 'Avenida Brasil', 'Rua XV de Novembro',
    'Avenida Ipiranga', 'Rua Oscar Freire', 'Avenida Faria Lima', 'Rua da Consolação', 'Avenida Rebouças'
  ];
  const street = streets[randomInt(0, streets.length - 1)];
  const number = randomInt(100, 9999);
  return `${street}, ${number}`;
};

// Generate single test record
export const generateTestRecord = (index: number): TestDataRecord => {
  const name = sampleNames[randomInt(0, sampleNames.length - 1)];
  const city = sampleCities[randomInt(0, sampleCities.length - 1)];
  const state = sampleStates[randomInt(0, sampleStates.length - 1)];
  const country = countries[randomInt(0, countries.length - 1)];
  
  return {
    id: `test_${index + 1}`,
    name,
    email: generateEmail(name),
    phone: generatePhone(),
    company: sampleCompanies[randomInt(0, sampleCompanies.length - 1)],
    address: generateAddress(),
    city,
    state,
    country
  };
};

// Generate multiple test records
export const generateTestData = (count: number): TestDataRecord[] => {
  return Array.from({ length: count }, (_, index) => generateTestRecord(index));
};

// Performance test utilities
export class PerformanceTester {
  private startTime: number = 0;
  private measurements: number[] = [];

  startTimer(): void {
    this.startTime = performance.now();
  }

  endTimer(): number {
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    this.measurements.push(duration);
    return duration;
  }

  getAverageTime(): number {
    if (this.measurements.length === 0) return 0;
    const sum = this.measurements.reduce((acc, time) => acc + time, 0);
    return sum / this.measurements.length;
  }

  getMaxTime(): number {
    return Math.max(...this.measurements);
  }

  getMinTime(): number {
    return Math.min(...this.measurements);
  }

  getTotalTime(): number {
    return this.measurements.reduce((acc, time) => acc + time, 0);
  }

  reset(): void {
    this.measurements = [];
  }

  getReport(): string {
    return `
Performance Test Report:
========================
Total Measurements: ${this.measurements.length}
Average Time: ${this.getAverageTime().toFixed(2)}ms
Min Time: ${this.getMinTime().toFixed(2)}ms
Max Time: ${this.getMaxTime().toFixed(2)}ms
Total Time: ${this.getTotalTime().toFixed(2)}ms
    `.trim();
  }
}

// WebSocket performance test helper
export const testWebSocketPerformance = async (data: TestDataRecord[], batchSize: number = 50) => {
  const tester = new PerformanceTester();
  
  console.log(`Starting WebSocket performance test with ${data.length} records...`);
  console.log(`Batch size: ${batchSize}`);
  
  // Simulate WebSocket connection time
  tester.startTimer();
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate connection delay
  const connectionTime = tester.endTimer();
  
  console.log(`WebSocket connection time: ${connectionTime.toFixed(2)}ms`);
  
  // Simulate enrichment batches
  const batches = Math.ceil(data.length / batchSize);
  console.log(`Processing ${batches} batches...`);
  
  for (let i = 0; i < batches; i++) {
    const startIndex = i * batchSize;
    const endIndex = Math.min(startIndex + batchSize, data.length);
    const batch = data.slice(startIndex, endIndex);
    
    tester.startTimer();
    
    // Simulate batch processing time
    await new Promise(resolve => setTimeout(resolve, randomInt(50, 200)));
    
    const batchTime = tester.endTimer();
    console.log(`Batch ${i + 1}/${batches} (${batch.length} records): ${batchTime.toFixed(2)}ms`);
  }
  
  console.log(tester.getReport());
  
  return {
    connectionTime,
    averageBatchTime: tester.getAverageTime(),
    maxBatchTime: tester.getMaxTime(),
    minBatchTime: tester.getMinTime(),
    totalTime: tester.getTotalTime(),
    report: tester.getReport()
  };
};
