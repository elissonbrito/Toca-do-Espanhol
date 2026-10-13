import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-toastify'
import {
  ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle, XCircle,
  FileText, Send, PenLine, Download, Building2,
} from 'lucide-react'
import { menuAPI, fiscalAPI } from '../../services/api'
import { LoadingSpinner, PageHeader, FormField, StatCard } from '../../components/ui/index.jsx'

function IssueList({ title, rows, tone }) {
  if (!rows?.length) return null
  const color = tone === 'err' ? 'text-red-400' : 'text-yellow-400'
  return (
    <div className="card p-4">
      <h3 className={`text-sm font-semibold mb-3 ${color}`}>{title} ({rows.length})</h3>
      <ul className="space-y-2">
        {rows.map(r => (
          <li key={r.item_id} className="text-sm border-b border-brand-border pb-2 last:border-0">
            <span className="text-brand-white">{r.name}</span>
            <span className="text-brand-muted"> · {r.sku}</span>
            <ul className="mt-1 ml-3 list-disc text-xs text-brand-muted">
              {[...(r.errors || []), ...(r.warnings || [])].map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}

const STATUS_TONE = {
  RASCUNHO: 'bg-gray-800 text-gray-300 border-gray-700',
  ASSINADA: 'bg-blue-900/40 text-blue-400 border-blue-800',
  AUTORIZADA: 'bg-green-900/40 text-green-400 border-green-800',
  REJEITADA: 'bg-red-900/40 text-red-400 border-red-800',
  CANCELADA: 'bg-red-950 text-red-500 border-red-900',
  NAO_CONFIGURADO: 'bg-yellow-900/40 text-yellow-400 border-yellow-800',
}

export default function FiscalConferencePage() {
  const [report, setReport] = useState(null)
  const [settings, setSettings] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [orderId, setOrderId] = useState('')
  const [busy, setBusy] = useState(false)
  const { register, handleSubmit, reset } = useForm()

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      menuAPI.fiscalReport(),
      fiscalAPI.getSettings(),
      fiscalAPI.listInvoices({ page_size: 20 }),
    ]).then(([rep, st, inv]) => {
      setReport(rep.data)
      setSettings(st.data)
      reset(st.data)
      setInvoices(inv.data.results || inv.data)
    }).catch(() => toast.error('Erro ao carregar a conferência fiscal'))
      .finally(() => setLoading(false))
  }, [reset])

  useEffect(() => { load() }, [load])

  const saveSettings = async (data) => {
    try {
      const r = await fiscalAPI.saveSettings(data)
      setSettings(r.data); reset(r.data)
      toast.success('Configuração fiscal salva.')
    } catch { toast.error('Erro ao salvar a configuração.') }
  }

  const generate = async () => {
    if (!orderId) return
    setBusy(true)
    try {
      const r = await fiscalAPI.buildFromOrder(orderId)
      toast[r.data.status === 'RASCUNHO' ? 'success' : 'warning'](
        `NFC-e: ${r.data.status}${r.data.motivo ? ' — ' + r.data.motivo : ''}`)
      setOrderId(''); load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao gerar a NFC-e.')
    } finally { setBusy(false) }
  }

  const act = async (fn, id, label) => {
    setBusy(true)
    try {
      const r = await fn(id)
      const res = r.data.resultado || r.data
      toast.info(`${label}: ${res.status || r.data.status}${res.mensagem ? ' — ' + res.mensagem : ''}`)
      if (r.data.faltando || res.faltando) {
        toast.warning('Falta: ' + (r.data.faltando || res.faltando).join(', '))
      }
      load()
    } catch { toast.error(`Erro em ${label}.`) }
    finally { setBusy(false) }
  }

  if (loading) return <LoadingSpinner size="lg" className="h-64" />

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Conferência Fiscal"
        subtitle="Validação fiscal do cardápio e emissão de NFC-e (modelo 65)"
        actions={<button onClick={load} className="btn-ghost p-2"><RefreshCw size={16} /></button>}
      />

      {/* Resumo do catálogo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Itens no catálogo" value={report?.total ?? 0} />
        <StatCard icon={CheckCircle2} label="Conformes" value={report?.conformes ?? 0} accent />
        <StatCard icon={XCircle} label="Com pendência" value={report?.com_pendencias ?? 0} />
        <StatCard icon={AlertTriangle} label="Com alerta" value={report?.com_alertas ?? 0} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <IssueList title="Pendências (bloqueiam a NFC-e)" rows={report?.pendencias} tone="err" />
        <IssueList title="Alertas (revisar)" rows={report?.alertas} tone="warn" />
      </div>
      {report && !report.pendencias?.length && (
        <div className="card p-4 flex items-center gap-3 text-green-400">
          <CheckCircle2 size={18} /> Todos os itens ativos estão fiscalmente conformes.
        </div>
      )}

      {/* Configuração do emitente */}
      <div className="card p-5">
        <h3 className="font-display text-brand-white font-semibold flex items-center gap-2 mb-1">
          <Building2 size={16} /> Emitente e credenciais NFC-e
        </h3>
        <p className="text-xs text-brand-muted mb-4">
          {settings?.pronto_para_transmitir
            ? 'Pronto para transmitir à SEFAZ.'
            : `Falta configurar: ${(settings?.faltando || []).join(', ') || '—'}`}
        </p>
        <form onSubmit={handleSubmit(saveSettings)} className="grid md:grid-cols-3 gap-3">
          <FormField label="Razão social"><input {...register('razao_social')} className="input" /></FormField>
          <FormField label="Nome fantasia"><input {...register('nome_fantasia')} className="input" /></FormField>
          <FormField label="CNPJ"><input {...register('cnpj')} className="input font-mono" placeholder="somente números" /></FormField>
          <FormField label="Inscrição Estadual"><input {...register('inscricao_estadual')} className="input font-mono" /></FormField>
          <FormField label="UF"><input {...register('uf')} className="input" maxLength={2} placeholder="SP" /></FormField>
          <FormField label="Cód. IBGE do município"><input {...register('municipio_ibge')} className="input font-mono" /></FormField>
          <FormField label="Ambiente">
            <select {...register('environment')} className="input">
              <option value="2">Homologação</option>
              <option value="1">Produção</option>
            </select>
          </FormField>
          <FormField label="Série NFC-e"><input {...register('serie_nfce')} type="number" className="input" /></FormField>
          <FormField label="Próximo número"><input {...register('proximo_numero')} type="number" className="input" /></FormField>
          <FormField label="CSC ID (idToken)"><input {...register('csc_id')} className="input font-mono" /></FormField>
          <FormField label="CSC token"><input {...register('csc_token')} className="input font-mono" placeholder="não exibido após salvar" /></FormField>
          <FormField label="Certificado A1 (caminho .pfx)"><input {...register('certificado_path')} className="input font-mono" /></FormField>
          <FormField label="Senha do certificado"><input {...register('certificado_senha')} type="password" className="input" /></FormField>
          <div className="md:col-span-3 flex justify-end">
            <button type="submit" className="btn-primary">Salvar configuração</button>
          </div>
        </form>
      </div>

      {/* NFC-e */}
      <div className="card p-5">
        <h3 className="font-display text-brand-white font-semibold flex items-center gap-2 mb-3">
          <ShieldCheck size={16} /> NFC-e por pedido
        </h3>
        <div className="flex items-end gap-3 mb-4">
          <FormField label="Nº do pedido">
            <input value={orderId} onChange={e => setOrderId(e.target.value)} type="number"
              className="input w-40" placeholder="ex.: 12" />
          </FormField>
          <button onClick={generate} disabled={busy || !orderId} className="btn-primary flex items-center gap-2">
            <FileText size={15} /> Gerar rascunho
          </button>
        </div>

        {invoices.length === 0 ? (
          <p className="text-brand-muted text-sm">Nenhuma NFC-e gerada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="table-header text-left p-2">Nº</th>
                  <th className="table-header text-left p-2">Pedido</th>
                  <th className="table-header text-left p-2">Chave de acesso</th>
                  <th className="table-header text-center p-2">Status</th>
                  <th className="table-header text-right p-2">Valor</th>
                  <th className="table-header p-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-brand-dark/50">
                    <td className="p-2 text-brand-white">{inv.numero || '—'}<span className="text-brand-muted text-xs">/{inv.serie}</span></td>
                    <td className="p-2 text-brand-muted text-sm">#{inv.order_id} · mesa {inv.table_number}</td>
                    <td className="p-2 text-brand-muted text-xs font-mono">{inv.chave_acesso || '—'}</td>
                    <td className="p-2 text-center">
                      <span className={`badge border ${STATUS_TONE[inv.status] || ''}`}>{inv.status_display}</span>
                    </td>
                    <td className="p-2 text-right text-brand-white">R$ {Number(inv.valor_total).toFixed(2)}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2 justify-end">
                        <button type="button" onClick={() => fiscalAPI.downloadXml(inv.id).catch(() => toast.error('Erro ao baixar o XML'))}
                          className="text-brand-muted hover:text-brand-gold" title="Baixar XML"><Download size={15} /></button>
                        <button disabled={busy} onClick={() => act(fiscalAPI.sign, inv.id, 'Assinar')}
                          className="text-brand-muted hover:text-brand-gold" title="Assinar"><PenLine size={15} /></button>
                        <button disabled={busy} onClick={() => act(fiscalAPI.transmit, inv.id, 'Transmitir')}
                          className="text-brand-muted hover:text-brand-gold" title="Transmitir à SEFAZ"><Send size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-brand-muted mt-3">
          Assinatura e transmissão exigem certificado A1 e CSC cadastrados acima. Sem eles, as ações
          retornam o checklist do que falta — nenhuma nota é enviada.
        </p>
      </div>
    </div>
  )
}
