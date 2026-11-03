// Imagen Open Graph por defecto (1200×630) para páginas sin imagen propia. Las fichas de producto
// definen la suya en generateMetadata.
import { ImageResponse } from 'next/og';
import { site } from '@/config/site';

export const alt = `${site.name} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0A0A0A',
          color: '#FFFFFF',
          padding: '72px 80px',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, letterSpacing: '-0.04em' }}>VEDERE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', fontSize: 56, lineHeight: 1.1, maxWidth: 900 }}>{site.tagline}</div>
          <div style={{ display: 'flex', fontSize: 28, color: 'rgba(255,255,255,0.7)' }}>
            Sol · Recetados · Multifocales · Accesorios
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {['#F2B33D', '#7FD1C1', '#3A5BD9', '#B7712F'].map((c) => (
              <div key={c} style={{ width: 72, height: 14, borderRadius: 999, background: c }} />
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
