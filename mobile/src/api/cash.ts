import { api } from './client';
import type { Order } from './orders';

export type PaymentMethod = 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO';

export interface CashRegisterSession {
  id: number;
  opened_by: number;
  opened_by_name: string;
  closed_by: number | null;
  closed_by_name: string | null;
  initial_amount: string;
  final_amount: string | null;
  status: 'ABERTO' | 'FECHADO';
  status_display: string;
  observations: string;
  opened_at: string;
  closed_at: string | null;
}

export async function fetchCurrentRegister(): Promise<CashRegisterSession | null> {
  try {
    const { data } = await api.get<CashRegisterSession>('/cash-register/registers/current/');
    return data;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

export async function openRegister(input: { initial_amount: number; observations?: string }) {
  const { data } = await api.post<CashRegisterSession>('/cash-register/registers/', input);
  return data;
}

export async function closeRegister(id: number, input: { final_amount: number; observations?: string }) {
  const { data } = await api.post<CashRegisterSession>(`/cash-register/registers/${id}/close/`, input);
  return data;
}

export async function fetchPendingOrders(): Promise<Order[]> {
  const { data } = await api.get<Order[]>('/cash-register/registers/pending-orders/');
  return data;
}

export async function registerPayment(input: {
  order: number;
  amount: number;
  payment_method: PaymentMethod;
  observations?: string;
}) {
  const { data } = await api.post('/cash-register/payments/', input);
  return data;
}
