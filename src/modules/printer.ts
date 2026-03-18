import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { buildSlyceJson } from './json';
import { generatePdfBytes } from './pdf';
import { getDataPath } from './storage';
import { AppData, DocumentRecord, SimulationMode } from '../shared/types';

const appendLogFile = (line: string) => {
  const p = getDataPath();
  const file = path.join(p.logs, `system-${dayjs().format('YYYY-MM-DD')}.log`);
  fs.appendFileSync(file, `${line}\n`, 'utf8');
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const runVirtualPrinterPipeline = async (data: AppData, docId: string) => {
  const doc = data.documents.find((d) => d.id === docId) as DocumentRecord;
  const supplier = data.suppliers.find((s) => s.id === doc.supplierId)!;
  const customer = data.customers.find((c) => c.id === doc.customerId)!;
  const mode: SimulationMode = data.simulationMode;
  const jobId = `job_${Date.now()}`;

  const log = (step: string, status: string, message: string) => {
    data.logs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: dayjs().toISOString(),
      jobId,
      documentNumber: doc.number,
      supplier: supplier.companyName,
      layout: doc.layoutId,
      step,
      status,
      message
    });
    appendLogFile(`${dayjs().format('HH:mm:ss')}|${jobId}|${doc.number}|${step}|${status}|${message}`);
  };

  log('queue', 'queued', 'Job inserito in coda Slyce Virtual Printer');
  console.log('[PRINT] queued', doc.number, jobId);
  doc.status = 'queued';

  if (mode === 'pdf_error') {
    log('pdf', 'error', 'Errore simulato in generazione PDF');
    doc.status = 'error';
    return { ok: false, jobId, error: 'PDF generation error simulated' };
  }

  const pdfBytes = await generatePdfBytes(doc, supplier, customer);
  const paths = getDataPath();
  const pdfFile = `${doc.number.replace(/\//g, '_')}-${doc.id}.pdf`;
  fs.writeFileSync(path.join(paths.pdfs, pdfFile), pdfBytes);
  doc.pdfPath = path.join(paths.pdfs, pdfFile);
  doc.status = 'pdf_generated';
  log('pdf', 'ok', `PDF generato: ${pdfFile}`);
  console.log('[PRINT] pdf generated', pdfFile);

  if (mode === 'json_error') {
    log('json', 'error', 'Errore simulato in generazione JSON');
    doc.status = 'error';
    return { ok: false, jobId, error: 'JSON generation error simulated' };
  }

  const jsonPayload = buildSlyceJson(doc, supplier, customer);
  if (mode === 'validation_error') {
    jsonPayload.status.needs_review = true;
    jsonPayload.status.parse_confidence = 0.45;
  }
  const jsonFile = `${doc.number.replace(/\//g, '_')}-${doc.id}.json`;
  fs.writeFileSync(path.join(paths.json, jsonFile), JSON.stringify(jsonPayload, null, 2));
  doc.jsonPath = path.join(paths.json, jsonFile);
  doc.status = 'json_generated';
  log('json', 'ok', `JSON Slyce generato: ${jsonFile}`);
  console.log('[PRINT] json generated', jsonFile);

  const transmissionId = `tx_${Date.now()}`;
  doc.transmissionId = transmissionId;
  data.transmissions.unshift({ id: transmissionId, jobId, documentId: doc.id, status: 'sending', timestamp: dayjs().toISOString(), message: 'Invio simulato avviato' });
  doc.status = 'sending';
  log('transmission', 'sending', 'Trasmissione in corso verso Slyce');
  console.log('[PRINT] transmission sent', transmissionId);

  if (mode === 'slow') await sleep(1800);

  if (mode === 'delivery_failure') {
    data.transmissions[0].status = 'error';
    data.transmissions[0].message = 'Fallita consegna inbox simulata';
    doc.status = 'error';
    log('delivery', 'error', 'Delivery failure simulato');
    return { ok: false, jobId, error: 'Delivery failure simulated' };
  }

  if (mode === 'duplicate') {
    data.inbox.unshift({ id: `inb_${Date.now()}`, documentId: doc.id, status: 'duplicate', transmittedAt: dayjs().toISOString() });
    data.transmissions[0].status = 'delivered';
    data.transmissions[0].message = 'Ricevuto come duplicato';
    doc.status = 'delivered';
    log('delivery', 'duplicate', 'Documento duplicato rilevato in inbox');
    return { ok: true, jobId, warning: 'duplicate' };
  }

  data.inbox.unshift({
    id: `inb_${Date.now()}`,
    documentId: doc.id,
    status: mode === 'validation_error' ? 'review_required' : 'received',
    transmittedAt: dayjs().toISOString()
  });
  data.transmissions[0].status = 'delivered';
  data.transmissions[0].message = 'Consegna inbox interna completata';
  doc.status = 'delivered';
  log('delivery', 'ok', 'Documento consegnato in Slyce Inbox');
  console.log('[PRINT] delivered', doc.number);

  if (mode === 'retry_success') {
    log('retry', 'ok', 'Retry simulato completato con successo');
  }

  return { ok: true, jobId };
};


export const runPdfOnly = async (data: AppData, docId: string) => {
  const doc = data.documents.find((d) => d.id === docId) as DocumentRecord;
  const supplier = data.suppliers.find((s) => s.id === doc.supplierId)!;
  const customer = data.customers.find((c) => c.id === doc.customerId)!;
  const jobId = `job_pdf_${Date.now()}`;

  console.log('[PRINT] pdf-only start', doc.number, jobId);
  const pdfBytes = await generatePdfBytes(doc, supplier, customer);
  const paths = getDataPath();
  const pdfFile = `${doc.number.replace(/\//g, '_')}-${doc.id}.pdf`;
  fs.writeFileSync(path.join(paths.pdfs, pdfFile), pdfBytes);
  doc.pdfPath = path.join(paths.pdfs, pdfFile);
  doc.status = 'pdf_generated';

  data.logs.unshift({
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: dayjs().toISOString(),
    jobId,
    documentNumber: doc.number,
    supplier: supplier.companyName,
    layout: doc.layoutId,
    step: 'pdf_only',
    status: 'ok',
    message: `PDF-only generato: ${pdfFile}`
  });

  appendLogFile(`${dayjs().format('HH:mm:ss')}|${jobId}|${doc.number}|pdf_only|ok|PDF-only generato: ${pdfFile}`);
  return { ok: true, jobId, pdfPath: doc.pdfPath };
};
