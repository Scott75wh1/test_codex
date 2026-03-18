import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Customer, DocumentRecord, Supplier } from '../shared/types';

const palette = {
  layout_a: rgb(0.12, 0.3, 0.47),
  layout_b: rgb(0, 0.43, 0.46),
  layout_c: rgb(0.16, 0.62, 0.56),
  layout_d: rgb(0.52, 0.22, 0.92),
  layout_e: rgb(0.22, 0.04, 0.64)
};

export const generatePdfBytes = async (doc: DocumentRecord, supplier: Supplier, customer: Customer): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const color = palette[doc.layoutId as keyof typeof palette] ?? rgb(0.2, 0.2, 0.2);
  page.drawRectangle({ x: 20, y: 790, width: 555, height: doc.layoutId === 'layout_c' ? 30 : 48, color });
  page.drawText(`${supplier.logoText} | ${supplier.companyName}`, { x: 30, y: 810, font: bold, size: doc.layoutId === 'layout_b' ? 14 : 12, color: rgb(1, 1, 1) });

  const leftFirst = doc.layoutId === 'layout_d' || doc.layoutId === 'layout_e';
  const boxY = 730;
  page.drawText(`Documento: ${doc.type.toUpperCase()} ${doc.number}`, { x: 30, y: 760, size: 11, font: bold });
  page.drawText(`Data: ${doc.date}`, { x: 380, y: 760, size: 11, font });

  page.drawText(`Fornitore:\n${supplier.companyName}\n${supplier.address}\nP.IVA ${supplier.vat}`, { x: leftFirst ? 30 : 310, y: boxY, size: 9, font, lineHeight: 12 });
  page.drawText(`Cliente:\n${customer.companyName}\n${customer.address}\nP.IVA ${customer.vat}`, { x: leftFirst ? 310 : 30, y: boxY, size: 9, font, lineHeight: 12 });

  const startY = doc.layoutId === 'layout_c' ? 640 : 620;
  page.drawRectangle({ x: 20, y: startY, width: 555, height: 20, color: rgb(0.94, 0.94, 0.94) });
  page.drawText('SKU', { x: 30, y: startY + 6, size: 9, font: bold });
  page.drawText('Descrizione', { x: 90, y: startY + 6, size: 9, font: bold });
  page.drawText('Q.ta', { x: 330, y: startY + 6, size: 9, font: bold });
  page.drawText('Prezzo', { x: 390, y: startY + 6, size: 9, font: bold });
  page.drawText('IVA', { x: 470, y: startY + 6, size: 9, font: bold });
  page.drawText('Totale', { x: 520, y: startY + 6, size: 9, font: bold });

  doc.lines.slice(0, 14).forEach((l, idx) => {
    const y = startY - 20 - idx * (doc.layoutId === 'layout_c' ? 14 : 18);
    const rowBg = doc.layoutId === 'layout_b' && idx % 2 === 0;
    if (rowBg) page.drawRectangle({ x: 20, y: y - 2, width: 555, height: 16, color: rgb(0.98, 0.98, 0.98) });
    page.drawText(l.sku, { x: 30, y, size: 8, font });
    page.drawText(l.description.slice(0, 35), { x: 90, y, size: 8, font });
    page.drawText(String(l.quantity), { x: 330, y, size: 8, font });
    page.drawText(l.unitPrice.toFixed(2), { x: 390, y, size: 8, font });
    page.drawText(`${l.vatRate}%`, { x: 470, y, size: 8, font });
    page.drawText(l.lineTotal.toFixed(2), { x: 520, y, size: 8, font });
  });

  const totalsY = doc.layoutId === 'layout_d' ? 230 : 250;
  if (doc.layoutId === 'layout_e') page.drawRectangle({ x: 350, y: totalsY - 20, width: 225, height: 80, color: rgb(0.96, 0.96, 0.99) });
  page.drawText(`Totale Netto: € ${doc.totalNet.toFixed(2)}`, { x: 370, y: totalsY + 40, size: 10, font: bold });
  page.drawText(`Totale IVA: € ${doc.totalVat.toFixed(2)}`, { x: 370, y: totalsY + 24, size: 10, font: bold });
  page.drawText(`Totale Lordo: € ${doc.totalGross.toFixed(2)}`, { x: 370, y: totalsY + 8, size: 12, font: bold });

  const notesY = doc.layoutId === 'layout_a' ? 180 : doc.layoutId === 'layout_b' ? 160 : 140;
  page.drawText(`Note: ${doc.notes || supplier.defaultNotes}`, { x: 30, y: notesY, size: 9, font, maxWidth: 520 });

  return pdf.save();
};
