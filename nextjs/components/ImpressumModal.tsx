'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

function ImpressumDialog({ onClose }: { onClose: () => void }) {
  const emailUser = 'jomsen';
  const emailDomain = 'gmx.net';
  const backdropRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return createPortal(
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-label="Impressum"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        backgroundColor: 'rgba(0, 0, 0, 0.92)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff',
          color: '#334155',
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '32rem',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '2rem',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '0.875rem',
          lineHeight: '1.5',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>
          Impressum
        </h2>

        <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Angaben gemäß § 5 TMG</p>
        <p style={{ marginBottom: '1rem' }}>
          Jens Möller<br />
          {/* Address required by law — add yours */}
          [Straße, PLZ, Ort]
        </p>

        <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Kontakt</p>
        <p style={{ marginBottom: '1rem' }}>
          E-Mail:{' '}
          <a
            href={`mailto:${emailUser}@${emailDomain}`}
            style={{ color: '#6366f1', textDecoration: 'underline' }}
          >
            {emailUser}&#64;{emailDomain}
          </a>
        </p>

        <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Haftungsausschluss</p>
        <p style={{ marginBottom: '1.5rem', color: '#64748b', fontSize: '0.75rem', lineHeight: '1.6' }}>
          Diese Website wurde mit größtmöglicher Sorgfalt erstellt. Für die
          Richtigkeit, Vollständigkeit und Aktualität der Inhalte wird keine
          Gewähr übernommen. Externe Links wurden zum Zeitpunkt der Verlinkung
          geprüft — für deren Inhalte sind die jeweiligen Betreiber
          verantwortlich.
        </p>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            backgroundColor: '#f1f5f9',
            color: '#334155',
            borderRadius: '0.5rem',
            padding: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Schließen
        </button>
      </div>
    </div>,
    document.body
  );
}

export function ImpressumLink() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="underline hover:opacity-70"
      >
        Impressum
      </button>
      {open && <ImpressumDialog onClose={() => setOpen(false)} />}
    </>
  );
}
