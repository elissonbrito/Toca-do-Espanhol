import type { User } from '@/api/auth';

export type Role = User['role'];

// Espelha apps/users/permissions.py do backend — usado só pra UI (mostrar/
// esconder ações); a permissão real é sempre aplicada pelo backend.
const MANAGER: Role[] = ['ADM_MAXIMO', 'GERENTE'];
const FLOOR_STAFF: Role[] = ['GARCOM', 'RECEPCAO', 'ADM_MAXIMO', 'GERENTE'];
const CAIXA: Role[] = ['CAIXA', 'ADM_MAXIMO', 'GERENTE'];
const CAIXA_OR_ADMIN: Role[] = ['CAIXA', 'ADM_MAXIMO'];
const RECEPCAO: Role[] = ['RECEPCAO', 'ADM_MAXIMO', 'GERENTE'];

export function isManager(role?: Role | null) {
  return !!role && MANAGER.includes(role);
}

export function isFloorStaff(role?: Role | null) {
  return !!role && FLOOR_STAFF.includes(role);
}

export function isCaixa(role?: Role | null) {
  return !!role && CAIXA.includes(role);
}

export function isCaixaOrAdmin(role?: Role | null) {
  return !!role && CAIXA_OR_ADMIN.includes(role);
}

export function isRecepcao(role?: Role | null) {
  return !!role && RECEPCAO.includes(role);
}

export function preparationSectorForRole(role?: Role | null): 'COZINHA' | 'PARRILLA' | 'BAR' {
  if (role === 'PARRILLA') return 'PARRILLA';
  return 'COZINHA';
}
