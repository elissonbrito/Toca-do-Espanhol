import { api } from './client';
import type { ItemSector } from './menu';
import type { ItemStatus, OrderItem } from './orders';

export async function fetchKitchenItems(sector: ItemSector): Promise<OrderItem[]> {
  const { data } = await api.get<OrderItem[]>('/kitchen/orders/', { params: { sector } });
  return data;
}

export async function updateKitchenItemStatus(itemId: number, status: ItemStatus): Promise<OrderItem> {
  const { data } = await api.patch<OrderItem>(`/kitchen/items/${itemId}/status/`, { status });
  return data;
}
