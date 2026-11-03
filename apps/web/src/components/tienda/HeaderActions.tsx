'use client';
// Acciones del header que necesitan estado: menú móvil, buscador y botón del carrito.
import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Drawer, IconButton, IconCart, IconMenu, IconSearch, IconWhatsApp } from '@vedere/ui';
import { site, whatsappLink } from '@/config/site';
import { useCart } from '@/lib/tienda/cart';

const SearchDialog = dynamic(() => import('./SearchDialog').then((m) => m.SearchDialog), {
  ssr: false,
});

export function MenuButton({ nav }: { nav: ReadonlyArray<{ label: string; href: string }> }) {
  const [open, setOpen] = useState(false);
  const wa = whatsappLink('Hola Vedere, tengo una consulta');
  return (
    <>
      <IconButton label="Abrir menú" className="-ml-2 md:hidden" onClick={() => setOpen(true)}>
        <IconMenu />
      </IconButton>
      <Drawer open={open} onClose={() => setOpen(false)} title="Menú" side="left" hideTitle>
        <nav aria-label="Principal (móvil)" className="flex flex-col">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="font-campaign border-b border-negro/10 py-4 text-3xl"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <ul className="font-text mt-6 space-y-3 text-base">
          <li>
            <Link href="/mi-cuenta" onClick={() => setOpen(false)} className="underline-offset-4 hover:underline">
              Mi cuenta
            </Link>
          </li>
          <li>
            <Link href="/como-funciona" onClick={() => setOpen(false)} className="underline-offset-4 hover:underline">
              Cómo funciona
            </Link>
          </li>
          <li>
            <Link href="/faq" onClick={() => setOpen(false)} className="underline-offset-4 hover:underline">
              Preguntas frecuentes
            </Link>
          </li>
          <li>
            <Link href="/contacto" onClick={() => setOpen(false)} className="underline-offset-4 hover:underline">
              Contacto
            </Link>
          </li>
          {wa && (
            <li>
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
              >
                <IconWhatsApp size={18} /> WhatsApp
              </a>
            </li>
          )}
        </ul>
        <p className="font-text mt-8 text-sm text-gris-texto">{site.tagline}</p>
      </Drawer>
    </>
  );
}

export function SearchButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton label="Buscar" onClick={() => setOpen(true)}>
        <IconSearch />
      </IconButton>
      {open && <SearchDialog open={open} onClose={() => setOpen(false)} />}
    </>
  );
}

export function CartButton() {
  const { totales, abrir, hidratado } = useCart();
  return (
    <IconButton label="Carrito" badge={hidratado ? totales.cantidad : 0} onClick={abrir}>
      <IconCart />
    </IconButton>
  );
}

