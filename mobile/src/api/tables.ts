import { api } from './client';

export type TableStatus = 'LIVRE' | 'OCUPADA' | 'CONTA' | 'RESERVADA' | 'LIMPEZA';

export interface RestaurantTable {
  id: number;
  number: number;
  seats: number;
  status: TableStatus;
  status_display: string;
  observation: string | null;
  active_order_id: number | null;
  active_order_status: string | null;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export async function fetchTables(): Promise<RestaurantTable[]> {
  const { data } = await api.get<PaginatedResponse<RestaurantTable> | RestaurantTable[]>('/tables/');
  return Array.isArray(data) ? data : data.results;
}

export async function setTableStatus(id: number, status: TableStatus): Promise<RestaurantTable> {
  const { data } = await api.post<RestaurantTable>(`/tables/${id}/status/`, { status });
  return data;
}
