import React from 'react';

type Props = {
  open: boolean;
  documentNumber?: string;
  onClose: () => void;
  onSelect: (printerType: 'physical' | 'pdf' | 'slyce') => void;
};

const PrintModal = ({ open, documentNumber, onClose, onSelect }: Props) => {
  if (!open) return null;

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalCard" onClick={(e) => e.stopPropagation()}>
        <h3>Seleziona destinazione stampa</h3>
        <p>Documento: <strong>{documentNumber ?? '-'}</strong></p>
        <div className="modalActions">
          <button onClick={() => onSelect('physical')}>Stampante fisica (simulata)</button>
          <button onClick={() => onSelect('pdf')}>Salva PDF</button>
          <button className="primary" onClick={() => onSelect('slyce')}>Slyce Virtual Printer</button>
        </div>
        <button className="linkBtn" onClick={onClose}>Chiudi</button>
      </div>
    </div>
  );
};

export default PrintModal;
