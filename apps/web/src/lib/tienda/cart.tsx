'use client';
// Carrito del lado cliente: estado en React, persistido en localStorage y, si hay sesión,
// sincronizado con la cuenta (GET/PUT /carrito). El drawer se abre desde cualquier componente.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { site } from '@/config/site';
import type { Producto, Variante } from '@/lib/types';
import { tiendaApi } from './client';
import type { CartItem, CuponAplicado } from './types';

const STORAGE_KEY = 'vedere_carrito_v1';
const MAX_POR_ITEM = 10;

interface CartState {
  items: CartItem[];
  cupon: CuponAplicado | null;
  hidratado: boolean;
}

type Action =
  | { type: 'hidratar'; state: Partial<CartState> }
  | { type: 'agregar'; item: CartItem }
  | { type: 'cantidad'; varianteId: string; cantidad: number }
  | { type: 'quitar'; varianteId: string }
  | { type: 'receta'; varianteId: string; conReceta: boolean }
  | { type: 'cupon'; cupon: CuponAplicado | null }
  | { type: 'vaciar' };

function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case 'hidratar':
      return { ...state, ...action.state, hidratado: true };
    case 'agregar': {
      const existente = state.items.find((i) => i.varianteId === action.item.varianteId);
      if (existente) {
        const cantidad = Math.min(
          existente.cantidad + action.item.cantidad,
          MAX_POR_ITEM,
          Math.max(existente.stock, 1),
        );
        return {
          ...state,
          items: state.items.map((i) =>
            i.varianteId === action.item.varianteId ? { ...i, ...action.item, cantidad } : i,
          ),
        };
      }
      return { ...state, items: [...state.items, action.item] };
    }
    case 'cantidad': {
      if (action.cantidad <= 0) {
        return { ...state, items: state.items.filter((i) => i.varianteId !== action.varianteId) };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.varianteId === action.varianteId
            ? { ...i, cantidad: Math.min(action.cantidad, MAX_POR_ITEM, Math.max(i.stock, 1)) }
            : i,
        ),
      };
    }
    case 'quitar':
      return { ...state, items: state.items.filter((i) => i.varianteId !== action.varianteId) };
    case 'receta':
      return {
        ...state,
        items: state.items.map((i) =>
          i.varianteId === action.varianteId ? { ...i, conReceta: action.conReceta } : i,
        ),
      };
    case 'cupon':
      return { ...state, cupon: action.cupon };
    case 'vaciar':
      return { ...state, items: [], cupon: null };
  }
}

export interface CartTotales {
  cantidad: number;
  subtotal: number;
  descuento: number;
  total: number;
  envioGratis: boolean;
  faltaParaEnvioGratis: number;
  progresoEnvio: number;
}

interface CartContextValue extends CartState {
  abierto: boolean;
  abrir: () => void;
  cerrar: () => void;
  agregar: (producto: Producto, variante: Variante, opts?: { cantidad?: number; conReceta?: boolean }) => void;
  setCantidad: (varianteId: string, cantidad: number) => void;
  quitar: (varianteId: string) => void;
  setReceta: (varianteId: string, conReceta: boolean) => void;
  aplicarCupon: (codigo: string) => Promise<void>;
  quitarCupon: () => void;
  vaciar: () => void;
  totales: CartTotales;
  sincronizado: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

function calcularDescuento(subtotal: number, cupon: CuponAplicado | null): number {
  if (!cupon) return 0;
  if (cupon.minimoCompra && subtotal < cupon.minimoCompra) return 0;
  if (cupon.tipo === 'PORCENTAJE') return Math.round((subtotal * cupon.valor) / 100);
  return Math.min(cupon.valor, subtotal);
}

function leerStorage(): Partial<CartState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { items?: CartItem[]; cupon?: CuponAplicado | null };
    return {
      items: Array.isArray(parsed.items) ? parsed.items.filter((i) => i && i.varianteId) : [],
      cupon: parsed.cupon ?? null,
    };
  } catch {
    return {};
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [], cupon: null, hidratado: false });
  const [abierto, setAbierto] = useState(false);
  const [sincronizado, setSincronizado] = useState(false);
  const logueado = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1) Hidratar desde localStorage y, si hay sesión, fusionar con el carrito de la cuenta.
  useEffect(() => {
    const local = leerStorage();
    dispatch({ type: 'hidratar', state: local });
    let cancelado = false;
    (async () => {
      try {
        const me = await fetch('/api/session', { credentials: 'same-origin' });
        const sesion = me.ok ? ((await me.json()) as { user: unknown }) : { user: null };
        if (!sesion.user || cancelado) return;
        logueado.current = true;
        const remoto = await tiendaApi.get<{ items: CartItem[]; cupon: string | null }>('/carrito');
        if (cancelado) return;
        const localItems = local.items ?? [];
        const ids = new Set(localItems.map((i) => i.varianteId));
        const fusion = [
          ...localItems,
          ...(Array.isArray(remoto.items) ? remoto.items : []).filter(
            (i) => i && i.varianteId && !ids.has(i.varianteId),
          ),
        ];
        dispatch({ type: 'hidratar', state: { items: fusion } });
        setSincronizado(true);
      } catch {
        /* sin sesión o API caída: el carrito sigue local */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  // 2) Persistir cada cambio en localStorage y (debounce) en la cuenta.
  useEffect(() => {
    if (!state.hidratado) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items, cupon: state.cupon }));
    } catch {
      /* ignorar */
    }
    if (!logueado.current) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      tiendaApi
        .put('/carrito', { items: state.items, cupon: state.cupon?.codigo ?? null })
        .then(() => setSincronizado(true))
        .catch(() => setSincronizado(false));
    }, 800);
  }, [state.items, state.cupon, state.hidratado]);

  // 3) Sincronizar entre pestañas.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) dispatch({ type: 'hidratar', state: leerStorage() });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const abrir = useCallback(() => setAbierto(true), []);
  const cerrar = useCallback(() => setAbierto(false), []);

  const agregar = useCallback<CartContextValue['agregar']>((producto, variante, opts = {}) => {
    const img = variante.imagenes[0] ?? producto.variantes.flatMap((v) => v.imagenes)[0];
    dispatch({
      type: 'agregar',
      item: {
        varianteId: variante.id,
        productoId: producto.id,
        slug: producto.slug,
        nombre: producto.nombre,
        sku: variante.sku,
        color: variante.colorArmazon,
        colorHex: variante.colorArmazonHex,
        precio: producto.precio,
        precioLista: producto.precioLista,
        imagen: img?.urlMiniatura ?? img?.urlMediana ?? img?.url ?? null,
        cantidad: Math.max(1, opts.cantidad ?? 1),
        stock: variante.stock,
        conReceta: !!opts.conReceta,
        linea: producto.linea,
      },
    });
    setAbierto(true);
  }, []);

  const setCantidad = useCallback(
    (varianteId: string, cantidad: number) => dispatch({ type: 'cantidad', varianteId, cantidad }),
    [],
  );
  const quitar = useCallback((varianteId: string) => dispatch({ type: 'quitar', varianteId }), []);
  const setReceta = useCallback(
    (varianteId: string, conReceta: boolean) => dispatch({ type: 'receta', varianteId, conReceta }),
    [],
  );
  const vaciar = useCallback(() => dispatch({ type: 'vaciar' }), []);
  const quitarCupon = useCallback(() => dispatch({ type: 'cupon', cupon: null }), []);

  const subtotal = state.items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);

  const aplicarCupon = useCallback(
    async (codigo: string) => {
      const res = await tiendaApi.post<{ valido: boolean; cupon: CuponAplicado; descuento: number }>(
        '/catalogo/cupones/validar',
        { codigo: codigo.trim().toUpperCase(), subtotal },
      );
      dispatch({ type: 'cupon', cupon: res.cupon });
    },
    [subtotal],
  );

  const totales = useMemo<CartTotales>(() => {
    const descuento = calcularDescuento(subtotal, state.cupon);
    const umbral = site.comercial.envioGratisDesde;
    const total = Math.max(0, subtotal - descuento);
    return {
      cantidad: state.items.reduce((acc, i) => acc + i.cantidad, 0),
      subtotal,
      descuento,
      total,
      envioGratis: total >= umbral,
      faltaParaEnvioGratis: Math.max(0, umbral - total),
      progresoEnvio: umbral > 0 ? Math.min(1, total / umbral) : 1,
    };
  }, [state.items, state.cupon, subtotal]);

  const value = useMemo<CartContextValue>(
    () => ({
      ...state,
      abierto,
      abrir,
      cerrar,
      agregar,
      setCantidad,
      quitar,
      setReceta,
      aplicarCupon,
      quitarCupon,
      vaciar,
      totales,
      sincronizado,
    }),
    [state, abierto, abrir, cerrar, agregar, setCantidad, quitar, setReceta, aplicarCupon, quitarCupon, vaciar, totales, sincronizado],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>');
  return ctx;
}
