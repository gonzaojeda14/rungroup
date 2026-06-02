export default function PageLoader() {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      width: '100vw', height: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0a',
      zIndex: 100,
    }}>
      <img src="/logo-flama.png" alt="Flama Run" style={{ height: 36, width: 'auto', opacity: 0.75, animation: 'pulse 1.2s ease-in-out infinite' }} />
    </div>
  )
}
