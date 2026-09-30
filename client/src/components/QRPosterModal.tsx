import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Copy, Check, X, QrCode } from 'lucide-react';

interface QRPosterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QRPosterModal: React.FC<QRPosterModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const scanUrl = `${window.location.origin}/scan`;

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(scanUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }} className="no-print">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <QrCode size={22} />
            Entrance QR Code Poster
          </h2>
          <button onClick={onClose} style={{ padding: '0.35rem', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Printable Poster Container */}
        <div className="poster-card" style={{ margin: '0 auto', textAlign: 'center', border: '2px solid var(--border)' }}>
          <img
            src="/logo.png"
            alt="مدرسة الياسمين"
            style={{ width: '68px', height: '68px', borderRadius: '50%', objectFit: 'cover', margin: '0 auto 0.75rem', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)' }}
          />
          <div style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--primary)', textTransform: 'uppercase' }}>
            Official Entrance Station — ELyassamine School
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-main)', margin: '0.5rem 0' }}>
            SCHOOL WORKER ATTENDANCE
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '380px', margin: '0 auto 1.25rem' }}>
            Point your phone camera at this QR code to quickly Check In or Check Out. No login needed.
          </p>

          <div className="qr-code-wrapper">
            <QRCodeSVG
              value={scanUrl}
              size={220}
              level="H"
              includeMargin={true}
            />
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Entrance Link: <strong>{scanUrl}</strong>
          </div>
        </div>

        {/* Controls (hidden during print) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', gap: '0.75rem' }} className="no-print">
          <button className="btn btn-secondary" onClick={handleCopy}>
            {copied ? <Check size={16} color="green" /> : <Copy size={16} />}
            {copied ? 'Link Copied!' : 'Copy Link'}
          </button>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button className="btn btn-primary" onClick={handlePrint}>
              <Printer size={16} />
              Print Poster
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
