'use client';
// Store de favoritos compartido por todos los corazones (sin Provider en el árbol: módulo + useSyncExternalStore).
// Carga los ids una sola vez por sesión del navegador (GET /cuenta/favoritos/ids); sin sesión queda vacío.
import { useCallback, useSyncExternalStore } from 'react';
import { cuentaApi } from '@/lib/tienda/cuenta';

type Estado = 'inicial' | 'cargando' | 'listo' | 'anonimo';

interface Store {
  estado: Estado;
  ids: ReadonlySet<string>;
}

let store: Store = { estado: 'inicial', ids: new Set() };
const listeners = new Set<() => void>();

function emit(next: Partial<Store>) {
  store = { ...store, ...next };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const getSnapshot = () => store;
const SERVER: Store = { estado: 'inicial', ids: new Set() };
const getServerSnapshot = () => SERVER;

async function haySesion(): Promise<boolean> {
  try {
    const res = await fetch('/api/session', { credentials: 'same-origin' });
    if (!res.ok) return false;
    const data = (await res.json()) as { user: unknown };
    return !!data.user;
  } catch {
    return false;
  }
}

/** Carga los favoritos si todavía no se hizo (idempotente). */
export async function cargarFavoritos(force = false) {
  if (!force && store.estado !== 'inicial') return;
  emit({ estado: 'cargando' });
  if (!(await haySesion())) {
    emit({ estado: 'anonimo', ids: new Set() });
    return;
  }
  try {
    const { ids } = await cuentaApi.favoritosIds();
    emit({ estado: 'listo', ids: new Set(ids) });
  } catch {
    // La API puede no tener /cuenta todavía o la sesión venció: tratamos como sin favoritos.
    emit({ estado: 'anonimo', ids: new Set() });
  }
}

/** Marca localmente (optimista) y sincroniza con la API; revierte si falla. */
export async function alternarFavorito(productoId: string): Promise<boolean> {
  const estaba = store.ids.has(productoId);
  const next = new Set(store.ids);
  if (estaba) next.delete(productoId);
  else next.add(productoId);
  emit({ ids: next, estado: 'listo' });
  try {
    if (estaba) await cuentaApi.quitarFavorito(productoId);
    else await cuentaApi.agregarFavorito(productoId);
    return !estaba;
  } catch (err) {
    const revert = new Set(store.ids);
    if (estaba) revert.add(productoId);
    else revert.delete(productoId);
    emit({ ids: revert });
    throw err;
  }
}

export function olvidarFavoritos() {
  emit({ estado: 'anonimo', ids: new Set() });
}

export function useFavoritos() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const esFavorito = useCallback((id: string) => s.ids.has(id), [s.ids]);
  return { estado: s.estado, ids: s.ids, esFavorito, cargar: cargarFavoritos, alternar: alternarFavorito };
}
