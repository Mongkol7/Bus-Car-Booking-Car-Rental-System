//Footer.jsx
export default function Footer({ children }) {
  return (
    <footer
      className="app-footer"
      style={{
        borderTop: '0.5px solid var(--glass-border)',
        color: 'var(--text-3)',
        fontSize: 11,
        padding: '18px 0',
      }}
    >
      <style>{`
        .app-footer {
          border-top: 0.5px solid var(--glass-border);
          --footer-gap: 20px;
        }
        .app-footer .footer-inner {
          width: 100%;
        }
        @media (max-width: 700px) {
          .app-footer {
            padding: 12px 0 10px;
            --footer-gap: 0px;
          }
          .app-footer .footer-inner {
            flex-direction: column;
            align-items: flex-start;
            gap: 0;
            justify-content: flex-start;
          }
          .app-footer .footer-brand,
          .app-footer .footer-contact,
          .app-footer .footer-links-block {
            min-width: 0;
            width: 100%;
            flex: unset !important;
            padding: 6px 0;
            border-bottom: 0.5px solid var(--glass-border, rgba(255,255,255,0.08));
          }
          .app-footer .footer-links-block {
            border-bottom: none;
          }
          .app-footer .footer-brand > div,
          .app-footer .footer-contact > div,
          .app-footer .footer-links-block > div {
            margin-top: 2px !important;
            margin-bottom: 2px !important;
          }
          .app-footer .footer-links {
            justify-content: flex-start;
            gap: 6px !important;
          }
        }
        @media (max-width: 520px) {
          .app-footer {
            padding: 10px 0 6px;
          }
          .app-footer .footer-brand,
          .app-footer .footer-contact,
          .app-footer .footer-links-block {
            padding: 5px 0;
          }
          .app-footer .footer-brand > div,
          .app-footer .footer-contact > div,
          .app-footer .footer-links-block > div {
            margin-top: 1px !important;
            margin-bottom: 1px !important;
          }
          .app-footer .footer-links button {
            font-size: 10px;
            padding: 4px 10px;
          }
          .app-footer .footer-extra {
            margin-top: 4px !important;
          }
        }
      `}</style>
      <div
        className="footer-inner"
        style={{
          maxWidth: 980,
          margin: '0 auto',
          padding: '0 18px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--footer-gap, 20px)',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div
          className="footer-brand"
          style={{ flex: '1 1 220px', minWidth: 200 }}
        >
          <div style={{ fontSize: 14, color: 'var(--text)' }}>
            Book<span style={{ color: 'var(--accent)' }}>.</span>
            <span style={{ color: 'var(--accent)' }}>Ride</span>
          </div>
          <div style={{ marginTop: 4, color: 'var(--text-2)', fontSize: 12 }}>
            Cambodia travel made smooth, fast, and trusted.
          </div>
          <div style={{ marginTop: 4, color: 'var(--text-3)' }}>
            Developed by Sereymongkol Thoeung
          </div>
        </div>

        <div
          className="footer-contact"
          style={{ flex: '1 1 200px', minWidth: 180 }}
        >
          <div
            style={{ color: 'var(--text-2)', fontSize: 12, marginBottom: 4 }}
          >
            Contact
          </div>
          <div>support@bookride.app</div>
          <div>+855 12 345 678</div>
          <div>Phnom Penh, Cambodia</div>
        </div>

        <div
          className="footer-links-block"
          style={{ flex: '1 1 220px', minWidth: 200 }}
        >
          <div
            style={{ color: 'var(--text-2)', fontSize: 12, marginBottom: 4 }}
          >
            Quick links
          </div>
          <div
            className="footer-links"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
          >
            {['Help Center', 'Terms', 'Privacy', 'Support'].map((label) => (
              <button
                key={label}
                style={{
                  background: 'var(--glass)',
                  border: '0.5px solid var(--glass-border)',
                  color: 'var(--text-2)',
                  borderRadius: 999,
                  padding: '6px 12px',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {children && (
        <div
          className="footer-extra"
          style={{ textAlign: 'center', marginTop: 12 }}
        >
          {children}
        </div>
      )}
    </footer>
  );
}
