import { Customer, DocumentRecord, Supplier } from '../shared/types';

export const buildSlyceJson = (doc: DocumentRecord, supplier: Supplier, customer: Customer) => ({
  version: '1.0',
  document_type: doc.type === 'fattura' ? 'invoice' : 'ddt',
  source: {
    channel: 'virtual_printer',
    connector_id: 'conn_demo_001',
    supplier_id: supplier.id,
    supplier_name: supplier.companyName,
    supplier_vat: supplier.vat
  },
  destination: {
    client_name: customer.companyName,
    client_vat: customer.vat,
    slyce_customer_id: customer.id
  },
  document: {
    number: doc.number,
    date: doc.date,
    currency: 'EUR',
    total_net: doc.totalNet,
    total_vat: doc.totalVat,
    total_gross: doc.totalGross,
    notes: doc.notes || 'Demo transmission'
  },
  lines: doc.lines.map((line) => ({
    line_no: line.lineNo,
    sku: line.sku,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unit_price: line.unitPrice,
    vat_rate: line.vatRate,
    line_total: line.lineTotal
  })),
  attachments: {
    pdf_filename: `${doc.number}.pdf`
  },
  raw: {
    text_excerpt: `${doc.number} ${supplier.companyName} -> ${customer.companyName}`
  },
  status: {
    parse_confidence: 0.98,
    needs_review: false
  }
});
