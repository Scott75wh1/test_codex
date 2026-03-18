import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import dayjs from 'dayjs';
import { AppData, Customer, DocumentRecord, LayoutTemplate, Product, Supplier } from '../shared/types';

const dbName = 'app-data.json';

const demoSuppliers: Supplier[] = [
  { id: 'sup_001', companyName: 'Grossista Alimentare Nord Srl', vat: 'IT01234567890', address: 'Via Milano 10, Milano', phone: '02-5550101', email: 'ordini@grossistanord.it', logoText: 'GAN', preferredLayout: 'layout_a', defaultNotes: 'Consegna entro 48h', accentColor: '#1f4e79' },
  { id: 'sup_002', companyName: 'Forniture Horeca Italia Srl', vat: 'IT02234567891', address: 'Via Roma 44, Torino', phone: '011-883300', email: 'info@horeca-italia.it', logoText: 'FHI', preferredLayout: 'layout_b', defaultNotes: 'Pagamento a 30 giorni', accentColor: '#006d77' },
  { id: 'sup_003', companyName: 'Distribuzione Freschi Lombardia Srl', vat: 'IT03234567892', address: 'Viale Brianza 3, Monza', phone: '039-210045', email: 'commerciale@freschilombardia.it', logoText: 'DFL', preferredLayout: 'layout_c', defaultNotes: 'Catena del freddo garantita', accentColor: '#2a9d8f' },
  { id: 'sup_004', companyName: 'Beverage Trade Service Srl', vat: 'IT04234567893', address: 'Via Porto 19, Genova', phone: '010-332211', email: 'sales@beveragetrade.it', logoText: 'BTS', preferredLayout: 'layout_d', defaultNotes: 'Gestione vuoti a rendere inclusa', accentColor: '#8338ec' },
  { id: 'sup_005', companyName: 'Ufficio & Consumi Professionali Srl', vat: 'IT05234567894', address: 'Via Europa 7, Bologna', phone: '051-778899', email: 'contatti@ucp.it', logoText: 'UCP', preferredLayout: 'layout_e', defaultNotes: 'Confermare disponibilità stock', accentColor: '#3a0ca3' }
];

const demoCustomers: Customer[] = [
  'Ristorante La Piazza','Osteria del Naviglio','Bar Centrale','Pizzeria Due Forni','Hotel Aurora','Trattoria San Marco','Bistrot Verde','Caffè del Corso','Ristorante Il Portico','Locanda Stella'
].map((name, i) => ({
  id: `cus_${(i + 1).toString().padStart(3, '0')}`,
  companyName: name,
  vat: `IT9${(876543210 + i).toString().padStart(10, '0')}`,
  address: `Via Demo ${i + 1}, Italia`,
  phone: `0${i + 2}-12345${i}`,
  email: `amministrazione${i + 1}@example.it`
}));

const demoProducts: Product[] = Array.from({ length: 20 }).map((_, i) => ({
  id: `prd_${(i + 1).toString().padStart(3, '0')}`,
  sku: `SKU${(i + 1).toString().padStart(3, '0')}`,
  description: ['Pasta artigianale', 'Passata di pomodoro', 'Olio EVO', 'Caffè in grani', 'Mozzarella fior di latte'][i % 5] + ` ${i + 1}`,
  unit: i % 3 === 0 ? 'kg' : 'pz',
  vatRate: i % 2 === 0 ? 10 : 22,
  basePrice: 2.5 + i * 0.8
}));

const layouts: LayoutTemplate[] = [
  { id: 'layout_a', name: 'Layout A - Classico tabellare', styleHint: 'classic', description: 'Fattura classica con tabella estesa.' },
  { id: 'layout_b', name: 'Layout B - Moderno minimale', styleHint: 'modern', description: 'Stile pulito con spaziatura ampia.' },
  { id: 'layout_c', name: 'Layout C - Compatto grossista', styleHint: 'compact', description: 'Layout denso per molti articoli.' },
  { id: 'layout_d', name: 'Layout D - Food distributor', styleHint: 'food', description: 'Evidenza su consegna e lotti.' },
  { id: 'layout_e', name: 'Layout E - Monocolore amministrativo', styleHint: 'mono', description: 'Stile ufficio con blocchi formali.' }
];

export const getDataPath = () => {
  const root = app.getPath('userData');
  return {
    root,
    db: path.join(root, dbName),
    output: path.join(root, 'output'),
    pdfs: path.join(root, 'output', 'pdfs'),
    json: path.join(root, 'output', 'json'),
    transmissions: path.join(root, 'output', 'transmissions'),
    logs: path.join(root, 'output', 'logs')
  };
};

const ensureDirs = () => {
  const p = getDataPath();
  Object.values(p).forEach((v) => {
    if (!path.extname(v) && !fs.existsSync(v)) fs.mkdirSync(v, { recursive: true });
  });
};

const randomDoc = (type: 'fattura' | 'ddt', idx: number): DocumentRecord => ({
  id: `seed_doc_${type}_${idx}`,
  type,
  number: `${type === 'fattura' ? 'FT' : 'DDT'}-2026-${(idx + 1).toString().padStart(4, '0')}`,
  date: dayjs().subtract(idx, 'day').format('YYYY-MM-DD'),
  supplierId: demoSuppliers[idx % demoSuppliers.length].id,
  customerId: demoCustomers[idx % demoCustomers.length].id,
  layoutId: layouts[idx % layouts.length].id,
  notes: 'Documento seed demo',
  lines: [{ lineNo: 1, sku: demoProducts[idx].sku, description: demoProducts[idx].description, quantity: idx + 1, unit: 'pz', unitPrice: 10 + idx, vatRate: 10, lineTotal: (10 + idx) * (idx + 1) }],
  totalNet: (10 + idx) * (idx + 1),
  totalVat: (10 + idx) * (idx + 1) * 0.1,
  totalGross: (10 + idx) * (idx + 1) * 1.1,
  creationMode: 'random',
  status: 'created',
  createdAt: dayjs().subtract(idx, 'day').toISOString()
});

export const defaultData = (): AppData => ({
  suppliers: demoSuppliers,
  customers: demoCustomers,
  products: demoProducts,
  layouts,
  documents: [...Array.from({ length: 5 }).map((_, i) => randomDoc('fattura', i)), ...Array.from({ length: 5 }).map((_, i) => randomDoc('ddt', i + 5))],
  transmissions: [],
  inbox: [],
  logs: [],
  simulationMode: 'success'
});

export const loadData = (): AppData => {
  ensureDirs();
  const { db } = getDataPath();
  if (!fs.existsSync(db)) {
    const seed = defaultData();
    fs.writeFileSync(db, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }
  return JSON.parse(fs.readFileSync(db, 'utf8')) as AppData;
};

export const saveData = (data: AppData) => {
  ensureDirs();
  fs.writeFileSync(getDataPath().db, JSON.stringify(data, null, 2), 'utf8');
};
