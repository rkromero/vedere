// Render de Markdown de las páginas legales (editadas en el admin) con los estilos de Prose.
import { marked } from 'marked';
import { cn } from '@vedere/ui';
import { Prose } from '@/components/tienda/Pagina';

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Markdown → HTML. El contenido lo escribe el staff; igual se neutralizan etiquetas crudas. */
export function markdownAHtml(md: string): string {
  const sinHtml = escapar(md.replace(/\r\n/g, '\n'));
  return marked.parse(sinHtml, { async: false, gfm: true, breaks: false }) as string;
}

export function Markdown({ contenido, className }: { contenido: string; className?: string }) {
  return (
    <Prose className={cn('[&>div>*+*]:mt-4', className)}>
      <div dangerouslySetInnerHTML={{ __html: markdownAHtml(contenido) }} />
    </Prose>
  );
}
