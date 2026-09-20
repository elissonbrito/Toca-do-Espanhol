import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary capturou:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    const { error } = this.state
    return (
      <div style={{ padding: 24, color: '#F5F0E8', fontFamily: 'monospace', maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ color: '#C9A84C', fontSize: 20, marginBottom: 12 }}>Erro ao renderizar esta tela</h1>
        <p style={{ color: '#8B1A1A', fontWeight: 700, marginBottom: 12 }}>
          {error?.name}: {error?.message}
        </p>
        <pre style={{
          whiteSpace: 'pre-wrap', background: '#241A12', border: '1px solid #3C2C1E',
          borderRadius: 8, padding: 16, fontSize: 12, overflow: 'auto', maxHeight: 400,
        }}>
          {error?.stack}
        </pre>
        <button
          onClick={() => this.setState({ error: null })}
          style={{ marginTop: 16, padding: '8px 16px', background: '#8B1A1A', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer' }}
        >
          Tentar novamente
        </button>
      </div>
    )
  }
}
