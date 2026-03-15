interface LogoProps {
  variant?: 'primary' | 'compact';
  showTagline?: boolean;
  className?: string;
}

export default function Logo({ variant = 'primary', showTagline = false, className = '' }: LogoProps) {
  const isPrimary = variant === 'primary';

  const fontSize = isPrimary ? '48px' : '26px';
  const barWidth = isPrimary ? '6px' : '4px';
  const barHeight = isPrimary ? '52px' : '28px';

  return (
    <div className={className} style={{ display: 'inline-flex', flexDirection: 'column', gap: showTagline ? '6px' : undefined }}>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: isPrimary ? '14px' : '8px' }}>
        {/* Accent bar */}
        <div
          aria-hidden="true"
          style={{
            width: barWidth,
            height: barHeight,
            backgroundColor: 'var(--accent)',
            flexShrink: 0,
          }}
        />

        {/* Wordmark */}
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          <span style={{ color: 'var(--text-primary)' }}>SET</span>
          <span style={{ color: 'var(--accent)' }}>CASH</span>
        </span>
      </div>

      {showTagline && (
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: isPrimary ? '11px' : '9px',
            fontWeight: 500,
            color: 'var(--text-tertiary)',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            paddingLeft: isPrimary ? '20px' : '12px',
            margin: 0,
          }}
        >
          expense tracking
        </p>
      )}
    </div>
  );
}
