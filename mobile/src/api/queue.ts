import { api } from './client';

export type TicketStatus = 'AGUARDANDO' | 'CHAMADO' | 'SENTADO' | 'FINALIZADO' | 'CANCELADO';
export type PriorityCategory =
  | 'NENHUMA'
  | 'IDOSO_80'
  | 'PCD'
  | 'IDOSO_60'
  | 'GESTANTE'
  | 'LACTANTE'
  | 'COLO'
  | 'OBESIDADE';

export interface QueueTicket {
  id: number;
  code: string;
  customer_name: string;
  people_count: number;
  status: TicketStatus;
  status_display: string;
  priority_category: PriorityCategory;
  priority_category_display: string;
  is_priority: boolean;
  priority_rank: number;
  table: number | null;
  table_number: number | null;
  active_order_id: number | null;
  created_at: string;
  called_at: string | null;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export async function fetchQueue(status?: TicketStatus): Promise<QueueTicket[]> {
  const { data } = await api.get<PaginatedResponse<QueueTicket> | QueueTicket[]>('/queue/', {
    params: status ? { status } : undefined,
  });
  return Array.isArray(data) ? data : data.results;
}

export async function createQueueTicket(input: {
  customer_name?: string;
  people_count?: number;
  priority_category?: PriorityCategory;
}): Promise<QueueTicket> {
  const { data } = await api.post<QueueTicket>('/queue/', input);
  return data;
}

export async function callNextTicket(group: 'all' | 'priority' | 'normal' = 'all'): Promise<QueueTicket> {
  const { data } = await api.post<QueueTicket>('/queue/call_next/', { group });
  return data;
}

/** Chama uma senha específica, fora da ordem da fila. */
export async function callTicket(id: number): Promise<QueueTicket> {
  const { data } = await api.post<QueueTicket>(`/queue/${id}/call/`);
  return data;
}

export async function finalizeTicket(id: number): Promise<QueueTicket> {
  const { data } = await api.post<QueueTicket>(`/queue/${id}/finalize/`);
  return data;
}

export async function cancelTicket(id: number): Promise<QueueTicket> {
  const { data } = await api.post<QueueTicket>(`/queue/${id}/cancel/`);
  return data;
}

export async function assignTicketToTable(
  id: number,
  tableId: number,
  openOrder = true
): Promise<QueueTicket & { order_id: number | null }> {
  const { data } = await api.post(`/queue/${id}/assign-table/`, { table: tableId, open_order: openOrder });
  return data;
}

export async function openOrderForTicket(id: number): Promise<{ id: number }> {
  const { data } = await api.post(`/queue/${id}/open-order/`);
  return data;
}
