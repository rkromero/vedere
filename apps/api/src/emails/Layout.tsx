// Layout de los emails transaccionales (prompt 6) con React Email: branding Vedere (negro/blanco, tipografía
// del sistema), CTA, bloque extra (ítems del pedido, óptica) y pie con datos fiscales y link de baja.
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { render } from '@react-email/render';

export interface DatosFiscales {
  razonSocial: string | null;
  cuit: string | null;
  domicilioFiscal: string | null;
  condicionIva: string | null;
  ingresosBrutos: string | null;
  inicioActividades: string | null;
  emailContacto: string | null;
}

export interface LayoutEmailProps {
  webUrl: string;
  titulo: string;
  /** HTML ya escapado (párrafos, listas). */
  cuerpoHtml: string;
  /** HTML ya escapado que va debajo del cuerpo (detalle de ítems, óptica, datos de transferencia). */
  extraHtml?: string;
  cta?: { label: string; href: string } | null;
  preview?: string;
  fiscal?: DatosFiscales | null;
  /** Link de baja (newsletter / marketing). Los transaccionales no lo llevan. */
  urlBaja?: string | null;
}

const colores = { negro: '#0A0A0A', fondo: '#F2F2F0', gris: '#8A8A86', linea: '#E5E5E2' };

const estilos = {
  body: { margin: 0, backgroundColor: colores.fondo, fontFamily: 'Arial, Helvetica, sans-serif', color: colores.negro },
  container: { maxWidth: 560, width: '100%', backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden', margin: '24px auto' },
  logo: { fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: colores.negro, textDecoration: 'none' },
  h1: { margin: '0 0 12px', fontSize: 22, lineHeight: 1.25, fontWeight: 700 },
  cuerpo: { fontSize: 15, lineHeight: 1.55 },
  boton: { display: 'inline-block', backgroundColor: colores.negro, color: '#ffffff', textDecoration: 'none', padding: '12px 20px', borderRadius: 8, fontWeight: 600, fontSize: 15 },
  pie: { fontSize: 12, color: colores.gris, lineHeight: 1.5, margin: 0 },
  link: { color: colores.gris, textDecoration: 'underline' },
};

export function LayoutEmail(props: LayoutEmailProps) {
  const f = props.fiscal;
  const fiscalLinea = f
    ? [f.razonSocial, f.cuit ? `CUIT ${f.cuit}` : null, f.condicionIva, f.ingresosBrutos ? `IIBB ${f.ingresosBrutos}` : null, f.inicioActividades ? `Inicio de actividades ${f.inicioActividades}` : null]
        .filter(Boolean)
        .join(' · ')
    : '';
  return (
    <Html lang="es">
      <Head />
      {props.preview ? <Preview>{props.preview}</Preview> : null}
      <Body style={estilos.body}>
        <Container style={estilos.container}>
          <Section style={{ padding: '24px 28px 8px' }}>
            <Link href={props.webUrl} style={estilos.logo}>
              VEDERE
            </Link>
          </Section>
          <Section style={{ padding: '8px 28px 0' }}>
            <Text style={estilos.h1}>{props.titulo}</Text>
          </Section>
          <Section style={{ padding: '0 28px 8px', ...estilos.cuerpo }}>
            <div dangerouslySetInnerHTML={{ __html: props.cuerpoHtml }} />
            {props.extraHtml ? <div dangerouslySetInnerHTML={{ __html: props.extraHtml }} /> : null}
          </Section>
          {props.cta ? (
            <Section style={{ padding: '12px 28px 24px' }}>
              <Button href={props.cta.href} style={estilos.boton}>
                {props.cta.label}
              </Button>
            </Section>
          ) : (
            <Section style={{ padding: '0 0 16px' }} />
          )}
          <Hr style={{ borderColor: colores.linea, margin: 0 }} />
          <Section style={{ padding: '16px 28px 20px' }}>
            <Text style={estilos.pie}>
              Vedere · Anteojos online, ajustados en tu óptica más cercana.
              <br />
              Si tenés dudas, respondé este email{f?.emailContacto ? ` o escribinos a ${f.emailContacto}` : ''}.
            </Text>
            {fiscalLinea ? (
              <Text style={{ ...estilos.pie, marginTop: 8 }}>
                {fiscalLinea}
                {f?.domicilioFiscal ? (
                  <>
                    <br />
                    {f.domicilioFiscal}
                  </>
                ) : null}
              </Text>
            ) : null}
            <Text style={{ ...estilos.pie, marginTop: 8 }}>
              <Link href={`${props.webUrl}/legal/privacidad`} style={estilos.link}>
                Privacidad
              </Link>
              {' · '}
              <Link href={`${props.webUrl}/legal/arrepentimiento`} style={estilos.link}>
                Botón de arrepentimiento
              </Link>
              {props.urlBaja ? (
                <>
                  {' · '}
                  <Link href={props.urlBaja} style={estilos.link}>
                    Darme de baja
                  </Link>
                </>
              ) : null}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** HTML final del email (React Email → HTML compatible con clientes de correo). */
export function renderLayoutEmail(props: LayoutEmailProps): Promise<string> {
  return render(<LayoutEmail {...props} />);
}
