import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banknote, RefreshCw, Receipt, ShieldCheck, Trash2, Download } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-toastify'
import { cashAPI, fiscalAPI, ordersAPI } from '../../services/api'
import { Modal, StatusBadge, LoadingSpinner, PageHeader, FormField } from '../../components/ui/index.jsx'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

const METHODS = [
  { v: 'DINHEIRO', l: 'Dinheiro' }, { v: 'PIX', l: 'PIX' },
  { v: 'DEBITO', l: 'Débito' }, { v: 'CREDITO', l: 'Crédito' },
]
const INVOICE_TONE = {
  RASCUNHO: 'text-blue-400', ASSINADA: 'text-blue-400',
  AUTORIZADA: 'text-green-400', REJEITADA: 'text-red-400',
  NAO_CONFIGURADO: 'text-yellow-400',
}

export default function CashPage() {
  const navigate = useNavigate()
  const [register, setRegister] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState([])
  const [payments, setPayments] = useState([])
  const [showOpen, setShowOpen] = useState(false)
  const [showClose, setShowClose] = useState(false)

  // dar baixa
  const [baixa, setBaixa] = useState(null)         // order sendo recebida
  const [method, setMethod] = useState('DINHEIRO')
  const [amount, setAmount] = useState('')
  const [processing, setProcessing] = useState(false)
  const [lastInvoice, setLastInvoice] = useState(null)

  const { register: reg, handleSubmit, reset, formState: { errors } } = useForm()
  const { register: regC, handleSubmit: handleC, reset: resetC } = useForm()

  const load = useCallback((opts = {}) => {
    if (!opts.silent) setLoading(true)
    Promise.all([
      cashAPI.getCurrent().catch(() => ({ data: null })),
      cashAPI.pendingOrders().catch(() => ({ data: [] })),
      cashAPI.listPayments({ page_size: 30 }).catch(() => ({ data: { results: [] } })),
    ]).then(([regRes, pendRes, payRes]) => {
      setRegister(regRes.data)
      setPending(pendRes.data.results || pendRes.data || [])
      setPayments(payRes.data.results || payRes.data || [])
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])
  // Outro caixa/garçom fechou uma conta ou deu baixa -> atualiza sozinho aqui.
  useAutoRefresh(useCallback(() => load({ silent: true }), [load]), { interval: 5000 })

  const openRegister = async (data) => {
    try {
      await cashAPI.open({ initial_amount: Number(data.initial_amount) })
      toast.success('Caixa aberto!'); reset(); setShowOpen(false); load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro ao abrir caixa') }
  }

  const closeRegister = async (data) => {
    try {
      await cashAPI.close(register.id, { final_amount: Number(data.final_amount), observations: data.observations })
      toast.success('Caixa fechado!'); resetC(); setShowClose(false); load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro ao fechar caixa') }
  }

  const openBaixa = (order) => {
    setBaixa(order)
    setMethod('DINHEIRO')
    setAmount(Number(order.total_amount).toFixed(2))
    setLastInvoice(null)
  }

  const confirmBaixa = async () => {
    if (!register) return toast.error('Abra o caixa primeiro.')
    setProcessing(true)
    try {
      const r = await cashAPI.createPayment({
        order: baixa.id, amount: Number(amount), payment_method: method,
      })
      const inv = r.data.invoice
      toast.success(`Baixa registrada — Mesa ${baixa.table?.number || '—'}`)
      if (inv) {
        setLastInvoice(inv)
        toast.info(`NFC-e: ${inv.status_display}${inv.status === 'NAO_CONFIGURADO' ? ' (configure o emitente em Conferência Fiscal)' : ''}`)
      }
      setBaixa(null); load()
    } catch (e) {
      toast.error(e.response?.data?.order || e.response?.data?.detail || 'Erro ao dar baixa.')
    } finally {
      setProcessing(false)
    }
  }

  const cancelConta = async (order) => {
    if (!confirm(`Cancelar a conta da Mesa ${order.table?.number || '—'}? A mesa fica livre e nada é cobrado.`)) return
    try {
      await ordersAPI.cancelBill(order.id)
      toast.success('Conta cancelada.'); load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao cancelar a conta.')
    }
  }

  if (loading) return <LoadingSpinner size="lg" className="h-64" />

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Caixa" subtitle="Contas fechadas, baixa e lançamento fiscal" actions={
        <button onClick={load} className="btn-ghost p-2"><RefreshCw size={16} /></button>
      } />

      {/* Register status */}
      <div className="card p-6">
        {!register ? (
          <div className="text-center py-4">
            <Banknote size={40} className="text-brand-border mx-auto mb-3" />
            <p className="text-brand-muted mb-4">Nenhum caixa aberto no momento.</p>
            <button onClick={() => setShowOpen(true)} className="btn-gold">Abrir Caixa</button>
          </div>
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-display text-lg font-bold text-brand-white">Caixa #{register.id}</h2>
                <StatusBadge status={register.status} label={register.status_display} />
              </div>
              <p className="text-brand-muted text-sm">Aberto por {register.opened_by_name} às {new Date(register.opened_at).toLocaleTimeString('pt-BR')}</p>
              <p className="text-brand-muted text-sm">Fundo inicial: <span className="text-brand-gold">R$ {Number(register.initial_amount).toFixed(2)}</span></p>
            </div>
            <button onClick={() => setShowClose(true)} className="btn-danger">Fechar Caixa</button>
          </div>
        )}
      </div>

      {/* Contas para receber */}
      <div>
        <h3 className="font-display text-base font-semibold text-brand-white mb-3 flex items-center gap-2">
          <Receipt size={18} /> Contas para receber
          <span className="text-xs text-brand-muted font-normal">({pending.length})</span>
        </h3>
        {pending.length === 0 ? (
          <div className="card p-8 text-center text-brand-muted">
            Nenhuma conta fechada aguardando pagamento.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pending.map(o => (
              <div key={o.id} className="card border-2 border-purple-700/50 bg-purple-950/20 p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-lg font-bold text-brand-white">
                      {o.table ? `Mesa ${o.table.number}` : `Senha ${o.queue_ticket_code || ''}`}
                    </p>
                    <p className="text-brand-muted text-xs">
                      {o.customer_name || 'Sem nome'} · {o.items?.filter(i => i.status !== 'CANCELADO').length || 0} itens
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-brand-muted text-[10px]">Total</div>
                    <div className="font-display text-xl font-bold text-brand-gold">R$ {Number(o.total_amount).toFixed(2)}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-gold text-xs py-1.5 px-3 flex-1" onClick={() => openBaixa(o)}>
                    Dar baixa
                  </button>
                  <button className="btn-ghost text-xs py-1.5 px-2" title="Ver comanda"
                    onClick={() => navigate(`/orders/${o.id}`)}>ver</button>
                  <button className="btn-ghost text-xs py-1.5 px-2 text-red-400" title="Cancelar conta"
                    onClick={() => cancelConta(o)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NFC-e da última baixa */}
      {lastInvoice && (
        <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm flex items-center gap-2">
            <ShieldCheck size={16} className="text-brand-gold" />
            NFC-e nº {lastInvoice.numero || '—'} —
            <span className={INVOICE_TONE[lastInvoice.status] || 'text-brand-muted'}>{lastInvoice.status_display}</span>
          </p>
          {lastInvoice.chave_acesso && (
            <span className="text-brand-muted text-xs font-mono">{lastInvoice.chave_acesso}</span>
          )}
          <button type="button" onClick={() => fiscalAPI.downloadXml(lastInvoice.id).catch(() => toast.error('Erro ao baixar o XML'))}
            className="text-brand-gold text-xs inline-flex items-center gap-1 hover:underline">
            <Download size={12} /> XML
          </button>
        </div>
      )}

      {/* Pagamentos do dia */}
      <div className="card overflow-x-auto">
        <div className="p-4 border-b border-brand-border">
          <h3 className="font-display text-base font-semibold text-brand-white">Pagamentos registrados</h3>
        </div>
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="border-b border-brand-border">
              <th className="table-header text-left p-4">Mesa</th>
              <th className="table-header text-left p-4">Método</th>
              <th className="table-header text-right p-4">Valor</th>
              <th className="table-header text-left p-4">Recebido por</th>
              <th className="table-header text-left p-4">Horário</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {payments.map(p => (
              <tr key={p.id} className="hover:bg-brand-dark/50">
                <td className="p-4 text-brand-white">{p.order_table ? `Mesa ${p.order_table}` : `#${p.order}`}</td>
                <td className="p-4"><span className="text-xs bg-brand-border px-2 py-0.5 rounded text-brand-muted">{p.payment_method_display}</span></td>
                <td className="p-4 text-right font-bold text-brand-gold">R$ {Number(p.amount).toFixed(2)}</td>
                <td className="p-4 text-brand-muted text-sm">{p.received_by_name}</td>
                <td className="p-4 text-brand-muted text-sm">{new Date(p.paid_at).toLocaleTimeString('pt-BR')}</td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-brand-muted">Nenhum pagamento registrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Abrir caixa */}
      <Modal open={showOpen} onClose={() => setShowOpen(false)} title="Abrir Caixa">
        <form onSubmit={handleSubmit(openRegister)} className="space-y-4">
          <FormField label="Fundo de Caixa (R$)" error={errors.initial_amount?.message}>
            <input {...reg('initial_amount', { required: 'Obrigatório', min: 0 })} type="number" step="0.01" className="input" placeholder="0.00" />
          </FormField>
          <div className="flex gap-3 justify-end">
            <button type="button" className="btn-ghost" onClick={() => setShowOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-gold">Abrir Caixa</button>
          </div>
        </form>
      </Modal>

      {/* Fechar caixa */}
      <Modal open={showClose} onClose={() => setShowClose(false)} title="Fechar Caixa">
        <form onSubmit={handleC(closeRegister)} className="space-y-4">
          <FormField label="Valor Final em Caixa (R$)">
            <input {...regC('final_amount', { required: true })} type="number" step="0.01" className="input" placeholder="0.00" />
          </FormField>
          <FormField label="Observações">
            <textarea {...regC('observations')} className="input resize-none" rows={2} />
          </FormField>
          <div className="flex gap-3 justify-end">
            <button type="button" className="btn-ghost" onClick={() => setShowClose(false)}>Cancelar</button>
            <button type="submit" className="btn-danger">Fechar Caixa</button>
          </div>
        </form>
      </Modal>

      {/* Dar baixa */}
      <Modal open={!!baixa} onClose={() => setBaixa(null)}
        title={`Dar baixa — ${baixa?.table ? `Mesa ${baixa.table.number}` : `Senha ${baixa?.queue_ticket_code || ''}`}`}>
        {baixa && (
          <div className="space-y-4">
            <div className="max-h-48 overflow-y-auto border border-brand-border rounded-lg divide-y divide-brand-border">
              {baixa.items.filter(i => i.status !== 'CANCELADO').map(i => (
                <div key={i.id} className="flex justify-between px-3 py-2 text-sm">
                  <span className="text-brand-white">{i.quantity}× {i.product_name}</span>
                  <span className="text-brand-muted">R$ {Number(i.total_price).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-brand-white font-semibold">
              <span>Total</span><span className="text-brand-gold">R$ {Number(baixa.total_amount).toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Forma de pagamento">
                <select className="input" value={method} onChange={e => setMethod(e.target.value)}>
                  {METHODS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                </select>
              </FormField>
              <FormField label="Valor recebido (R$)">
                <input className="input" type="number" step="0.01" value={amount}
                  onChange={e => setAmount(e.target.value)} />
              </FormField>
            </div>
            <p className="text-brand-muted text-xs">
              Ao confirmar: a comanda é finalizada e a NFC-e é lançada automaticamente. A mesa continua
              ocupada até o garçom atualizar o status (limpeza → livre).
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button className="btn-ghost" onClick={() => setBaixa(null)}>Cancelar</button>
              <button className="btn-gold disabled:opacity-50" disabled={processing || !amount}
                onClick={confirmBaixa}>
                {processing ? 'Processando…' : 'Confirmar baixa'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
