import axios from 'axios'

// Produção: VITE_API_URL (ex.: https://SEU-BACKEND.onrender.com/api).
// Dev sem variável definida: backend local em :8001.
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

// Auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        if (!refresh) throw new Error('No refresh token')
        const { data } = await axios.post(`${BASE_URL}/auth/refresh/`, { refresh })
        localStorage.setItem('access_token', data.access)
        original.headers.Authorization = `Bearer ${data.access}`
        return api(original)
      } catch {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('user')
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

// ─── Auth ──────────────────────────────────────────────
export const authAPI = {
  login: (credentials) => api.post('/auth/login/', credentials),
  logout: (refresh) => api.post('/auth/logout/', { refresh }),
  me: () => api.get('/auth/me/'),
}

// ─── Users ─────────────────────────────────────────────
export const usersAPI = {
  list: (params) => api.get('/users/', { params }),
  get: (id) => api.get(`/users/${id}/`),
  create: (data) => api.post('/users/', data),
  update: (id, data) => api.patch(`/users/${id}/`, data),
  delete: (id) => api.delete(`/users/${id}/`),
  me: () => api.get('/users/me/'),
}

// ─── Tables ────────────────────────────────────────────
export const tablesAPI = {
  list: (params) => api.get('/tables/', { params }),
  get: (id) => api.get(`/tables/${id}/`),
  create: (data) => api.post('/tables/', data),
  update: (id, data) => api.patch(`/tables/${id}/`, data),
  setStatus: (id, status) => api.post(`/tables/${id}/status/`, { status }),
  delete: (id) => api.delete(`/tables/${id}/`),
}

// ─── Orders ────────────────────────────────────────────
export const ordersAPI = {
  list: (params) => api.get('/orders/', { params }),
  get: (id) => api.get(`/orders/${id}/`),
  create: (data) => api.post('/orders/', data),
  addItem: (orderId, data) => api.post(`/orders/${orderId}/add_item/`, data),
  removeItem: (orderId, itemId) => api.delete(`/orders/${orderId}/items/${itemId}/`),
  updateStatus: (orderId, status) => api.post(`/orders/${orderId}/update_status/`, { status }),
  closeBill: (orderId) => api.post(`/orders/${orderId}/close_bill/`),
  reopenBill: (orderId) => api.post(`/orders/${orderId}/reopen_bill/`),
  cancelBill: (orderId) => api.delete(`/orders/${orderId}/`),
  transferTable: (orderId, tableId) => api.post(`/orders/${orderId}/transfer-table/`, { table: tableId }),
  transferItems: (orderId, targetOrderId, items) =>
    api.post(`/orders/${orderId}/transfer-items/`, { target_order: targetOrderId, items }),
}

// ─── Kitchen ───────────────────────────────────────────
export const kitchenAPI = {
  getOrders: (sector) => api.get('/kitchen/orders/', { params: { sector } }),
  updateItemStatus: (itemId, status) => api.patch(`/kitchen/items/${itemId}/status/`, { status }),
}

// ─── Queue ─────────────────────────────────────────────
export const queueAPI = {
  list: (params) => api.get('/queue/', { params }),
  create: (data) => api.post('/queue/', data),
  publicDisplay: () => api.get('/queue/public_display/'),
  callNext: (group) => api.post('/queue/call_next/', group ? { group } : {}),
  finalize: (id) => api.post(`/queue/${id}/finalize/`),
  cancel: (id) => api.post(`/queue/${id}/cancel/`),
  edit: (id, data) => api.patch(`/queue/${id}/edit/`, data),
  assignTable: (id, data) => api.post(`/queue/${id}/assign-table/`, data),
  openOrder: (id) => api.post(`/queue/${id}/open-order/`),
}

// ─── Cash Register ─────────────────────────────────────
export const cashAPI = {
  getCurrent: () => api.get('/cash-register/registers/current/'),
  open: (data) => api.post('/cash-register/registers/', data),
  close: (id, data) => api.post(`/cash-register/registers/${id}/close/`, data),
  report: (id) => api.get(`/cash-register/registers/${id}/report/`),
  listRegisters: () => api.get('/cash-register/registers/'),
  createPayment: (data) => api.post('/cash-register/payments/', data),
  listPayments: (params) => api.get('/cash-register/payments/', { params }),
  pendingOrders: () => api.get('/cash-register/registers/pending-orders/'),
}

// ─── Menu / Cardápio ───────────────────────────────────
export const menuAPI = {
  listCategories: (params) => api.get('/menu/categories/', { params }),
  createCategory: (data) => api.post('/menu/categories/', data),
  updateCategory: (id, data) => api.patch(`/menu/categories/${id}/`, data),
  listItems: (params) => api.get('/menu/items/', { params }),
  getItem: (id) => api.get(`/menu/items/${id}/`),
  createItem: (data) => api.post('/menu/items/', data),
  updateItem: (id, data) => api.patch(`/menu/items/${id}/`, data),
  deleteItem: (id) => api.delete(`/menu/items/${id}/`),
  fiscalCheck: (id) => api.get(`/menu/items/${id}/fiscal_check/`),
  fiscalReport: (params) => api.get('/menu/items/fiscal_report/', { params }),
  fiscalChoices: () => api.get('/menu/items/fiscal_choices/'),
  ncmSuggestions: () => api.get('/menu/items/ncm_suggestions/'),
}

// ─── Fiscal / NFC-e ────────────────────────────────────
export const fiscalAPI = {
  getSettings: () => api.get('/fiscal/settings/'),
  saveSettings: (data) => api.put('/fiscal/settings/', data),
  listInvoices: (params) => api.get('/fiscal/nfce/', { params }),
  buildFromOrder: (orderId) => api.post(`/fiscal/nfce/from-order/${orderId}/`),
  sign: (id) => api.post(`/fiscal/nfce/${id}/sign/`),
  transmit: (id) => api.post(`/fiscal/nfce/${id}/transmit/`),
  // Baixa via axios (leva o JWT no header) — um <a href> direto daria 401.
  downloadXml: async (id) => {
    const { data } = await api.get(`/fiscal/nfce/${id}/xml/`, { responseType: 'blob' })
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = `nfce-${id}.xml`
    a.click()
    URL.revokeObjectURL(url)
  },
}

// ─── Dashboard ─────────────────────────────────────────
export const dashboardAPI = {
  stats: () => api.get('/dashboard/'),
}

// ─── Audit ─────────────────────────────────────────────
export const auditAPI = {
  list: (params) => api.get('/audit/', { params }),
}

// ─── Impressão ─────────────────────────────────────────
export const printingAPI = {
  listPrinters: () => api.get('/printing/printers/'),
  createPrinter: (data) => api.post('/printing/printers/', data),
  updatePrinter: (id, data) => api.patch(`/printing/printers/${id}/`, data),
  deletePrinter: (id) => api.delete(`/printing/printers/${id}/`),
  getSettings: () => api.get('/printing/settings/'),
  saveSettings: (data) => api.put('/printing/settings/', data),
  pendingJobs: () => api.get('/printing/jobs/pending/'),
  listJobs: (params) => api.get('/printing/jobs/', { params }),
  markPrinted: (id) => api.post(`/printing/jobs/${id}/mark-printed/`),
  markError: (id, message) => api.post(`/printing/jobs/${id}/mark-error/`, { message }),
  reprint: (id) => api.post(`/printing/jobs/${id}/reprint/`),
}

// ─── Relatórios ────────────────────────────────────────
export const reportsAPI = {
  salesByWaiter: (params) => api.get('/reports/sales-by-waiter/', { params }),
  waiterDetail: (params) => api.get('/reports/waiter-detail/', { params }),
  itemRanking: (params) => api.get('/reports/item-ranking/', { params }),
}

export default api
