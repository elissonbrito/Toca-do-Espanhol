import { api } from './client';

export type ItemSector = 'COZINHA' | 'PARRILLA' | 'BAR';

export interface MenuCategory {
  id: number;
  name: string;
  slug: string;
  display_order: number;
  is_active: boolean;
  item_count: number;
}

export interface MenuItemSummary {
  id: number;
  category: number;
  category_name: string;
  name: string;
  description: string;
  sector: ItemSector;
  sector_display: string;
  price: string;
  preparation_minutes: number | null;
  is_active: boolean;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

async function fetchPage<T>(url: string): Promise<PaginatedResponse<T> | T[]> {
  const response = await api.get<PaginatedResponse<T> | T[]>(url);
  return response.data;
}

async function fetchAllPages<T>(url: string): Promise<T[]> {
  const results: T[] = [];
  let next: string | null = url;
  while (next !== null) {
    const page: PaginatedResponse<T> | T[] = await fetchPage<T>(next);
    if (Array.isArray(page)) {
      results.push(...page);
      break;
    }
    results.push(...page.results);
    next = page.next;
  }
  return results;
}

export async function fetchMenuCategories(): Promise<MenuCategory[]> {
  return fetchAllPages<MenuCategory>('/menu/categories/?is_active=true');
}

export async function fetchMenuItems(): Promise<MenuItemSummary[]> {
  return fetchAllPages<MenuItemSummary>('/menu/items/?is_active=true');
}
