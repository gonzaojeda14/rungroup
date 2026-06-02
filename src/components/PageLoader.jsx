export default function PageLoader() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
      zIndex: 40,
      animation: 'fadeIn .15s ease',
    }}>
      <img src="/logo-flama.png" alt="Flama Run" style={{ height: 36, width: 'auto', opacity: 0.8, animation: 'pulse 1.2s ease-in-out infinite' }} />
    </div>
  )
}
