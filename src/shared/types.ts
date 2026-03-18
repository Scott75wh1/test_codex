export type DocumentType = 'fattura' | 'ddt';

export type Supplier = {
  id: string;
  companyName: string;
  vat: string;
  address: string;
  phone: string;
  email: string;
  logoText: string;
  preferredLayout: string;
  defaultNotes: string;
  accentColor: string;
};

export type Customer = {
  id: string;
  companyName: string;
  vat: string;
  address: string;
  phone: string;
  email: string;
};

export type Product = {
  id: string;
  sku: string;
  description: string;
  unit: string;
  vatRate: number;
  basePrice: number;
};

export type DocumentLine = {
  lineNo: number;
  sku: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
  lineTotal: number;
};

export type SimulationMode =
  | 'success'
  | 'validation_error'
  | 'duplicate'
  | 'slow'
  | 'json_error'
  | 'pdf_error'
  | 'delivery_failure'
  | 'retry_success';

export type DocumentRecord = {
  id: string;
  type: DocumentType;
  number: string;
  date: string;
  supplierId: string;
  customerId: string;
  layoutId: string;
  notes: string;
  lines: DocumentLine[];
  totalNet: number;
  totalVat: number;
  totalGross: number;
  creationMode: 'manual' | 'random';
  pdfPath?: string;
  jsonPath?: string;
  status: string;
  transmissionId?: string;
  createdAt: string;
};

export type TransmissionRecord = {
  id: string;
  jobId: string;
  documentId: string;
  status: string;
  timestamp: string;
  message: string;
  rawLogPath?: string;
};

export type InboxRecord = {
  id: string;
  documentId: string;
  status: 'received' | 'processed' | 'review_required' | 'imported' | 'duplicate' | 'error';
  transmittedAt: string;
};

export type LogEntry = {
  id: string;
  timestamp: string;
  jobId: string;
  documentNumber: string;
  supplier: string;
  layout: string;
  step: string;
  status: string;
  message: string;
};

export type LayoutTemplate = {
  id: string;
  name: string;
  styleHint: string;
  description: string;
};

export type AppData = {
  suppliers: Supplier[];
  customers: Customer[];
  products: Product[];
  layouts: LayoutTemplate[];
  documents: DocumentRecord[];
  transmissions: TransmissionRecord[];
  inbox: InboxRecord[];
  logs: LogEntry[];
  simulationMode: SimulationMode;
};
