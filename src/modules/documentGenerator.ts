import dayjs from 'dayjs';
import { AppData, DocumentLine, DocumentRecord, DocumentType } from '../shared/types';

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export const computeTotals = (lines: DocumentLine[]) => {
  const totalNet = lines.reduce((acc, line) => acc + line.lineTotal, 0);
  const totalVat = lines.reduce((acc, line) => acc + line.lineTotal * (line.vatRate / 100), 0);
  return { totalNet: Number(totalNet.toFixed(2)), totalVat: Number(totalVat.toFixed(2)), totalGross: Number((totalNet + totalVat).toFixed(2)) };
};

export const generateRandomDocument = (
  data: AppData,
  options: {
    type: DocumentType | 'random';
    supplierId: string | 'random';
    customerId: string | 'random';
    lines: number;
    layout: string | 'random';
    dateFrom: string;
    dateTo: string;
    amountBand: 'low' | 'medium' | 'high';
  }
): DocumentRecord => {
  const supplier = options.supplierId === 'random' ? pick(data.suppliers) : data.suppliers.find((s) => s.id === options.supplierId)!;
  const customer = options.customerId === 'random' ? pick(data.customers) : data.customers.find((c) => c.id === options.customerId)!;
  const type = options.type === 'random' ? pick(['fattura', 'ddt'] as DocumentType[]) : options.type;
  const layoutId = options.layout === 'random' ? pick(data.layouts).id : options.layout;

  const mul = options.amountBand === 'low' ? 0.6 : options.amountBand === 'high' ? 2.5 : 1.2;
  const generatedLines: DocumentLine[] = Array.from({ length: options.lines }).map((_, i) => {
    const p = pick(data.products);
    const qty = Math.max(1, Math.floor(Math.random() * 8 + 1));
    const price = Number((p.basePrice * mul * (0.8 + Math.random() * 0.6)).toFixed(2));
    return {
      lineNo: i + 1,
      sku: p.sku,
      description: p.description,
      quantity: qty,
      unit: p.unit,
      unitPrice: price,
      vatRate: p.vatRate,
      lineTotal: Number((qty * price).toFixed(2))
    };
  });
  const totals = computeTotals(generatedLines);
  const dateFrom = dayjs(options.dateFrom);
  const dateTo = dayjs(options.dateTo);
  const diff = Math.max(1, dateTo.diff(dateFrom, 'day'));
  const date = dateFrom.add(Math.floor(Math.random() * diff), 'day').format('YYYY-MM-DD');
  const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const progressive = data.documents.length + 1;

  return {
    id,
    type,
    number: `${type === 'fattura' ? 'FT' : 'DDT'}-2026-${String(progressive).padStart(4, '0')}`,
    date,
    supplierId: supplier.id,
    customerId: customer.id,
    layoutId,
    notes: `Documento generato automaticamente - ${supplier.companyName}`,
    lines: generatedLines,
    ...totals,
    creationMode: 'random',
    status: 'created',
    createdAt: dayjs().toISOString()
  };
};
