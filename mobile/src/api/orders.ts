import { api } from './client';
import type { ItemSector } from './menu';
import type { RestaurantTable } from './tables';
import type { User } from './auth';

export type OrderStatus = 'ABERTO' | 'PREPARANDO' | 'PRONTO' | 'FECHAMENTO' | 'FINALIZADO' | 'CANCELADO';
export type ItemStatus = 'PENDENTE' | 'PREPARANDO' | 'PRONTO' | 'ENTREGUE' | 'CANCELADO';

export interface OrderItem {
  id: number;
  menu_item: number | null;
  product_name: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  sector: ItemSector;
  sector_display: string;
  status: ItemStatus;
  status_display: string;
  observations: string;
  created_at: string;
  order_id: number;
  order_ref: string;
  created_by_name: string | null;
  removed_by_name: string | null;
  removed_at: string | null;
}

export interface Order {
  id: number;
  table: RestaurantTable | null;
  opened_by: User;
  status: OrderStatus;
  status_display: string;
  total_amount: string;
  customer_name: string;
  people_count: number;
  observations: string;
  queue_ticket: number | null;
  queue_ticket_code: string | null;
  items: OrderItem[];
  created_at: string;
  closed_at: string | null;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export async function fetchOrders(status?: OrderStatus): Promise<Order[]> {
  const { data } = await api.get<PaginatedResponse<Order>>('/orders/', {
    params: status ? { status } : undefined,
  });
  return data.results;
}

export async function fetchOrder(id: number): Promise<Order> {
  const { data } = await api.get<Order>(`/orders/${id}/`);
  return data;
}

export async function createOrder(input: {
  table: number;
  customer_name?: string;
  people_count?: number;
  observations?: string;
}): Promise<Order> {
  const { data } = await api.post<Order>('/orders/', input);
  return data;
}

export async function addOrderItem(
  orderId: number,
  input: { menu_item: number; quantity: number; observations?: string }
): Promise<OrderItem> {
  const { data } = await api.post<OrderItem>(`/orders/${orderId}/add_item/`, input);
  return data;
}

export async function removeOrderItem(orderId: number, itemId: number): Promise<void> {
  await api.delete(`/orders/${orderId}/items/${itemId}/`);
}

export async function closeBill(orderId: number): Promise<Order> {
  const { data } = await api.post<Order>(`/orders/${orderId}/close_bill/`);
  return data;
}

export async function reopenBill(orderId: number): Promise<Order> {
  const { data } = await api.post<Order>(`/orders/${orderId}/reopen_bill/`);
  return data;
}

export async function updateOrderStatus(orderId: number, status: OrderStatus): Promise<Order> {
  const { data } = await api.post<Order>(`/orders/${orderId}/update_status/`, { status });
  return data;
}

/** Cancela a conta (soft-cancel — nunca apaga do banco). Só caixa/gerência/admin. */
export async function cancelOrder(orderId: number): Promise<Order> {
  const { data } = await api.delete<Order>(`/orders/${orderId}/`);
  return data;
}

/** Troca a mesa inteira da comanda. Só caixa/admin. */
export async function transferOrderTable(orderId: number, tableId: number): Promise<Order> {
  const { data } = await api.post<Order>(`/orders/${orderId}/transfer-table/`, { table: tableId });
  return data;
}
