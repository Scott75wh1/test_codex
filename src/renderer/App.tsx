import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { DocumentLine } from '../shared/types';
import PrintModal from './components/PrintModal';

const sections = [
  'Dashboard', 'Fornitori', 'Clienti', 'Prodotti', 'Nuova Bolla / DDT', 'Nuova Fattura', 'Generatore Documenti Casuali',
  'Template Layout Documenti', 'Archivio Documenti', 'Slyce Virtual Printer', 'Trasmissioni', 'Slyce Inbox', 'Log di sistema', 'Pannello Simulazione'
] as const;

type Section = (typeof sections)[number];

type PrinterType = 'physical' | 'pdf' | 'slyce';

const emptyLine = (): DocumentLine => ({ lineNo: 1, sku: '', description: '', quantity: 1, unit: 'pz', unitPrice: 0, vatRate: 22, lineTotal: 0 });

const App = () => {
  const [state, setState] = useState<any>(null);
  const [active, setActive] = useState<Section>('Dashboard');
  const [form, setForm] = useState<any>(null);
  const [randomOpt, setRandomOpt] = useState<any>(null);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printMessage, setPrintMessage] = useState('');

  useEffect(() => {
    window.api.getState().then((s) => {
      setState(s);
      const sup = s.suppliers[0];
      const cus = s.customers[0];
      setForm({
        type: 'fattura', supplierId: sup.id, customerId: cus.id, number: `FT-2026-${String(s.documents.length + 1).padStart(4, '0')}`,
        date: dayjs().format('YYYY-MM-DD'), notes: sup.defaultNotes, layoutId: sup.preferredLayout,
        lines: [emptyLine()]
      });
      setRandomOpt({ type: 'random', supplierId: 'random', customerId: 'random', lines: 4, layout: 'random', dateFrom: dayjs().subtract(30, 'day').format('YYYY-MM-DD'), dateTo: dayjs().format('YYYY-MM-DD'), amountBand: 'medium', batch: 5 });
    });
  }, []);

  const refresh = async () => setState(await window.api.getState());

  const totals = useMemo(() => {
    if (!form) return { net: 0, vat: 0, gross: 0 };
    const net = form.lines.reduce((a: number, l: DocumentLine) => a + l.lineTotal, 0);
    const vat = form.lines.reduce((a: number, l: DocumentLine) => a + l.lineTotal * l.vatRate / 100, 0);
    return { net, vat, gross: net + vat };
  }, [form]);

  if (!state || !form || !randomOpt) return <div className="loading">Caricamento...</div>;

  const createManual = async (type: 'fattura' | 'ddt') => {
    const doc = {
      id: `doc_${Date.now()}`,
      type,
      number: form.number,
      date: form.date,
      supplierId: form.supplierId,
      customerId: form.customerId,
      layoutId: form.layoutId,
      notes: form.notes,
      lines: form.lines.map((l: DocumentLine, i: number) => ({ ...l, lineNo: i + 1, lineTotal: Number((l.quantity * l.unitPrice).toFixed(2)) })),
      totalNet: Number(totals.net.toFixed(2)), totalVat: Number(totals.vat.toFixed(2)), totalGross: Number(totals.gross.toFixed(2)),
      creationMode: 'manual', status: 'created', createdAt: dayjs().toISOString()
    };
    await window.api.createManualDocument(doc);
    await refresh();
    setPrintMessage(`${type.toUpperCase()} creato in archivio`);
  };

  const openPrintModal = (doc: any) => {
    console.log('[PRINT] click stampa', doc.id, doc.number);
    setSelectedDocument(doc);
    setPrintModalOpen(true);
    console.log('[PRINT] modal opened');
  };

  const handlePrinterChoice = async (printerType: PrinterType) => {
    if (!selectedDocument) return;

    console.log('[PRINT] printer selected', printerType, selectedDocument.id);

    if (printerType === 'physical') {
      console.log('[PRINT] physical printer simulation', selectedDocument.number);
      setPrintMessage(`Stampa fisica simulata avviata per ${selectedDocument.number}`);
    }

    if (printerType === 'pdf') {
      const res = await window.api.runPdfOnly(selectedDocument.id);
      if (res.ok) {
        console.log('[PRINT] pdf generated', res.pdfPath);
        setPrintMessage(`PDF generato correttamente per ${selectedDocument.number}`);
      } else {
        setPrintMessage(`Errore PDF: ${res.error}`);
      }
      await refresh();
    }

    if (printerType === 'slyce') {
      const res = await window.api.runPrinter(selectedDocument.id);
      if (res.ok) {
        console.log('[PRINT] pdf generated');
        console.log('[PRINT] json generated');
        console.log('[PRINT] transmission sent');
        console.log('[PRINT] delivered');
        setPrintMessage(`Pipeline Slyce completata (job ${res.jobId})`);
      } else {
        setPrintMessage(`Errore Slyce: ${res.error}`);
      }
      await refresh();
    }

    setPrintModalOpen(false);
    setSelectedDocument(null);
  };

  const renderDashboard = () => {
    const docs = state.documents;
    const transmitted = state.transmissions.filter((t: any) => t.status === 'delivered').length;
    const errors = docs.filter((d: any) => d.status === 'error').length;
    const randomCount = docs.filter((d: any) => d.creationMode === 'random').length;
    return <div className="cards">{
      [
        ['Documenti totali', docs.length], ['Random generati', randomCount], ['PDF generati', docs.filter((d: any) => d.pdfPath).length],
        ['JSON generati', docs.filter((d: any) => d.jsonPath).length], ['Trasmessi', state.transmissions.length], ['Consegnati', transmitted], ['Errori', errors]
      ].map(([k, v]) => <div key={String(k)} className="card"><h3>{k}</h3><strong>{String(v)}</strong></div>)
    }
      <div className="card full"><h3>Documenti per layout</h3>{state.layouts.map((l: any) => <div key={l.id}>{l.name}: {docs.filter((d: any) => d.layoutId === l.id).length}</div>)}</div>
      <div className="card full"><h3>Documenti per fornitore</h3>{state.suppliers.map((s: any) => <div key={s.id}>{s.companyName}: {docs.filter((d: any) => d.supplierId === s.id).length}</div>)}</div>
    </div>;
  };

  const simpleTable = (items: any[], cols: string[]) => <table><thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{items.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c}>{String(r[c] ?? '')}</td>)}</tr>)}</tbody></table>;

  const archive = () => {
    return <table><thead><tr><th>N.</th><th>Tipo</th><th>Data</th><th>Fornitore</th><th>Cliente</th><th>Layout</th><th>Origine</th><th>Stato</th><th>Azioni</th></tr></thead><tbody>{state.documents.map((d: any) => {
      const s = state.suppliers.find((x: any) => x.id === d.supplierId);
      const c = state.customers.find((x: any) => x.id === d.customerId);
      return <tr key={d.id}><td>{d.number}</td><td>{d.type}</td><td>{d.date}</td><td>{s?.companyName}</td><td>{c?.companyName}</td><td>{d.layoutId}</td><td>{d.creationMode}</td><td>{d.status}</td><td><button onClick={() => openPrintModal(d)}>Stampa</button>{d.pdfPath && <button onClick={() => window.api.openFile(d.pdfPath)}>PDF</button>}{d.jsonPath && <button onClick={() => window.api.openFile(d.jsonPath)}>JSON</button>}</td></tr>;
    })}</tbody></table>;
  };

  return <div className="app">
    <aside>{sections.map((s) => <button key={s} className={s === active ? 'active' : ''} onClick={() => setActive(s)}>{s}</button>)}</aside>
    <main>
      <header><h1>Slyce Virtual Printer Lab</h1><small>Simulatore gestionale + virtual printer end-to-end</small></header>
      {printMessage && <div className="statusBanner">{printMessage}</div>}
      {active === 'Dashboard' && renderDashboard()}
      {active === 'Fornitori' && simpleTable(state.suppliers, ['id', 'companyName', 'vat', 'address', 'phone', 'email', 'preferredLayout'])}
      {active === 'Clienti' && simpleTable(state.customers, ['id', 'companyName', 'vat', 'address', 'phone', 'email'])}
      {active === 'Prodotti' && simpleTable(state.products, ['id', 'sku', 'description', 'unit', 'vatRate', 'basePrice'])}
      {(active === 'Nuova Fattura' || active === 'Nuova Bolla / DDT') && <section>
        <h2>{active}</h2>
        <div className="grid2">
          <label>Fornitore<select value={form.supplierId} onChange={(e) => {
            const sup = state.suppliers.find((s: any) => s.id === e.target.value);
            setForm({ ...form, supplierId: e.target.value, layoutId: sup.preferredLayout, notes: sup.defaultNotes });
          }}>{state.suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.companyName}</option>)}</select></label>
          <label>Cliente<select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>{state.customers.map((c: any) => <option key={c.id} value={c.id}>{c.companyName}</option>)}</select></label>
          <label>Numero<input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></label>
          <label>Data<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label>Template<select value={form.layoutId} onChange={(e) => setForm({ ...form, layoutId: e.target.value })}>{state.layouts.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <label>Note<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        </div>
        <h3>Righe</h3>
        {form.lines.map((l: DocumentLine, idx: number) => <div key={idx} className="lineRow">
          <input placeholder="SKU" value={l.sku} onChange={(e) => { const lines = [...form.lines]; lines[idx].sku = e.target.value; setForm({ ...form, lines }); }} />
          <input placeholder="Descrizione" value={l.description} onChange={(e) => { const lines = [...form.lines]; lines[idx].description = e.target.value; setForm({ ...form, lines }); }} />
          <input type="number" placeholder="Qta" value={l.quantity} onChange={(e) => { const lines = [...form.lines]; lines[idx].quantity = Number(e.target.value); lines[idx].lineTotal = Number((lines[idx].quantity * lines[idx].unitPrice).toFixed(2)); setForm({ ...form, lines }); }} />
          <input placeholder="U.M." value={l.unit} onChange={(e) => { const lines = [...form.lines]; lines[idx].unit = e.target.value; setForm({ ...form, lines }); }} />
          <input type="number" step="0.01" placeholder="Prezzo" value={l.unitPrice} onChange={(e) => { const lines = [...form.lines]; lines[idx].unitPrice = Number(e.target.value); lines[idx].lineTotal = Number((lines[idx].quantity * lines[idx].unitPrice).toFixed(2)); setForm({ ...form, lines }); }} />
          <input type="number" placeholder="IVA" value={l.vatRate} onChange={(e) => { const lines = [...form.lines]; lines[idx].vatRate = Number(e.target.value); setForm({ ...form, lines }); }} />
          <span>Totale riga: €{l.lineTotal.toFixed(2)}</span>
        </div>)}
        <button onClick={() => setForm({ ...form, lines: [...form.lines, emptyLine()] })}>Aggiungi riga</button>
        <div className="totals">Totale Netto: €{totals.net.toFixed(2)} | IVA: €{totals.vat.toFixed(2)} | Lordo: €{totals.gross.toFixed(2)}</div>
        <button onClick={() => createManual(active.includes('Fattura') ? 'fattura' : 'ddt')}>Salva documento</button>
      </section>}
      {active === 'Generatore Documenti Casuali' && <section>
        <h2>Generatore Documenti Casuali</h2>
        <div className="grid2">
          <label>Tipo<select value={randomOpt.type} onChange={(e) => setRandomOpt({ ...randomOpt, type: e.target.value })}><option value="random">Random</option><option value="fattura">Fattura</option><option value="ddt">Bolla/DDT</option></select></label>
          <label>Fornitore<select value={randomOpt.supplierId} onChange={(e) => setRandomOpt({ ...randomOpt, supplierId: e.target.value })}><option value="random">Random</option>{state.suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.companyName}</option>)}</select></label>
          <label>Cliente<select value={randomOpt.customerId} onChange={(e) => setRandomOpt({ ...randomOpt, customerId: e.target.value })}><option value="random">Random</option>{state.customers.map((c: any) => <option key={c.id} value={c.id}>{c.companyName}</option>)}</select></label>
          <label>Righe<input type="number" min={1} max={15} value={randomOpt.lines} onChange={(e) => setRandomOpt({ ...randomOpt, lines: Number(e.target.value) })} /></label>
          <label>Layout<select value={randomOpt.layout} onChange={(e) => setRandomOpt({ ...randomOpt, layout: e.target.value })}><option value="random">Random</option>{state.layouts.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <label>Fascia importi<select value={randomOpt.amountBand} onChange={(e) => setRandomOpt({ ...randomOpt, amountBand: e.target.value })}><option value="low">Bassa</option><option value="medium">Media</option><option value="high">Alta</option></select></label>
          <label>Da<input type="date" value={randomOpt.dateFrom} onChange={(e) => setRandomOpt({ ...randomOpt, dateFrom: e.target.value })} /></label>
          <label>A<input type="date" value={randomOpt.dateTo} onChange={(e) => setRandomOpt({ ...randomOpt, dateTo: e.target.value })} /></label>
          <label>Batch<input type="number" value={randomOpt.batch} onChange={(e) => setRandomOpt({ ...randomOpt, batch: Number(e.target.value) })} /></label>
        </div>
        <button onClick={async () => { await window.api.generateRandomDocument(randomOpt); await refresh(); }}>Genera un documento</button>
        <button onClick={async () => { await window.api.generateBatchDocuments(randomOpt, randomOpt.batch); await refresh(); }}>Genera batch</button>
      </section>}
      {active === 'Template Layout Documenti' && <section>
        <h2>Template Layout Documenti</h2>
        {state.layouts.map((l: any) => <div key={l.id} className="card"><strong>{l.name}</strong><div>{l.description}</div><div>ID: {l.id}</div></div>)}
        <h3>Assegna layout predefinito fornitore</h3>
        {state.suppliers.map((s: any) => <div key={s.id} className="lineRow"><span>{s.companyName}</span><select value={s.preferredLayout} onChange={async (e) => {
          const next = { ...state, suppliers: state.suppliers.map((x: any) => x.id === s.id ? { ...x, preferredLayout: e.target.value } : x) };
          setState(next);
          await window.api.saveState(next);
        }}>{state.layouts.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}</select><button onClick={() => setPrintMessage(`Duplicazione config template ${s.preferredLayout} simulata`)}>Duplica config</button></div>)}
      </section>}
      {active === 'Archivio Documenti' && archive()}
      {active === 'Slyce Virtual Printer' && <section><h2>Slyce Virtual Printer</h2><p>Modulo interno software (nessun driver OS). Pipeline: queue → PDF → JSON → transmission → inbox.</p></section>}
      {active === 'Trasmissioni' && <table><thead><tr><th>ID</th><th>Job</th><th>Documento</th><th>Stato</th><th>Timestamp</th><th>Messaggio</th></tr></thead><tbody>{state.transmissions.map((t: any) => <tr key={t.id}><td>{t.id}</td><td>{t.jobId}</td><td>{state.documents.find((d: any) => d.id === t.documentId)?.number}</td><td>{t.status}</td><td>{t.timestamp}</td><td>{t.message}</td></tr>)}</tbody></table>}
      {active === 'Slyce Inbox' && <table><thead><tr><th>Stato</th><th>Fornitore</th><th>Cliente</th><th>Documento</th><th>Data</th><th>Totale</th><th>Layout</th><th>Trasmesso</th><th>Azioni</th></tr></thead><tbody>{state.inbox.map((i: any) => {
        const d = state.documents.find((x: any) => x.id === i.documentId);
        const s = state.suppliers.find((x: any) => x.id === d?.supplierId);
        const c = state.customers.find((x: any) => x.id === d?.customerId);
        return <tr key={i.id}><td>{i.status}</td><td>{s?.companyName}</td><td>{c?.companyName}</td><td>{d?.number}</td><td>{d?.date}</td><td>€{d?.totalGross?.toFixed?.(2)}</td><td>{d?.layoutId}</td><td>{i.transmittedAt}</td><td>{d?.pdfPath && <button onClick={() => window.api.openFile(d.pdfPath)}>PDF</button>}{d?.jsonPath && <button onClick={() => window.api.openFile(d.jsonPath)}>JSON</button>}</td></tr>;
      })}</tbody></table>}
      {active === 'Log di sistema' && <table><thead><tr><th>Timestamp</th><th>Job</th><th>Doc</th><th>Fornitore</th><th>Layout</th><th>Step</th><th>Stato</th><th>Messaggio</th></tr></thead><tbody>{state.logs.map((l: any) => <tr key={l.id}><td>{l.timestamp}</td><td>{l.jobId}</td><td>{l.documentNumber}</td><td>{l.supplier}</td><td>{l.layout}</td><td>{l.step}</td><td>{l.status}</td><td>{l.message}</td></tr>)}</tbody></table>}
      {active === 'Pannello Simulazione' && <section><h2>Pannello Simulazione</h2><div className="grid2">{
        ['success', 'validation_error', 'duplicate', 'slow', 'json_error', 'pdf_error', 'delivery_failure', 'retry_success'].map((m) => <button key={m} onClick={async () => { await window.api.setSimulationMode(m); await refresh(); }}>{m}{state.simulationMode === m ? ' ✅' : ''}</button>)
      }</div><p>Modalità attiva: <strong>{state.simulationMode}</strong></p></section>}
    </main>

    <PrintModal
      open={printModalOpen}
      documentNumber={selectedDocument?.number}
      onClose={() => {
        setPrintModalOpen(false);
        setSelectedDocument(null);
      }}
      onSelect={handlePrinterChoice}
    />
  </div>;
};

export default App;
