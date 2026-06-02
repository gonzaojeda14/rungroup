export default function ConfirmModal({ mensaje, onConfirm, onCancel }) {
  return (
    <>
      <div
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200 }}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: 'var(--bg2)', borderRadius: '16px 16px 0 0',
        padding: '24px 20px', borderTop: '1px solid var(--border)',
      }}>
        <p style={{ fontSize: '15px', color: 'var(--text)', marginBottom: '20px', lineHeight: 1.5 }}>
          {mensaje}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={onConfirm}
            style={{
              width: '100%', height: '44px', borderRadius: '10px',
              background: 'rgba(248,113,113,0.15)', color: '#f87171',
              border: '1px solid rgba(248,113,113,0.3)',
              fontSize: '15px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Eliminar
          </button>
          <button
            onClick={onCancel}
            className="btn-ghost"
            style={{ width: '100%', height: '44px', fontSize: '15px' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </>
  )
}
