// Valores por defecto compartidos entre el seed y la API (prompt 6): plantillas de email editables y páginas legales.
// El admin puede editar asunto, título y cuerpo; las variables se escriben {{asi}} y se reemplazan al enviar.

export interface PlantillaEmailDefault {
  tipo: string;
  nombre: string;
  descripcion: string;
  variables: string[];
  asunto: string;
  titulo: string;
  /** Texto plano con párrafos separados por línea en blanco. Admite **negrita** y variables {{x}}. */
  cuerpo: string;
  ctaLabel?: string;
}

const PEDIDO_VARS = ['nombre', 'numero', 'total', 'optica', 'opticaDireccion', 'url'];

export const PLANTILLAS_EMAIL_DEFAULT: PlantillaEmailDefault[] = [
  {
    tipo: 'BIENVENIDA',
    nombre: 'Bienvenida',
    descripcion: 'Al crear la cuenta (email y contraseña o Google).',
    variables: ['nombre', 'url', 'urlReferidos'],
    asunto: 'Bienvenido/a a Vedere, {{nombre}}',
    titulo: 'Ya tenés tu cuenta Vedere',
    cuerpo:
      'Hola {{nombre}}, gracias por sumarte. Desde Mi cuenta vas a poder seguir tus pedidos, guardar tus recetas y direcciones, y armar tu lista de favoritos.\n\nCompartí tu link de referidos: cuando un amigo compra, los dos reciben un cupón.',
    ctaLabel: 'Ir a Mi cuenta',
  },
  {
    tipo: 'RECUPERAR_PASSWORD',
    nombre: 'Recuperar contraseña',
    descripcion: 'Link para restablecer la contraseña (vence en 1 hora).',
    variables: ['nombre', 'url'],
    asunto: 'Restablecé tu contraseña de Vedere',
    titulo: 'Restablecer contraseña',
    cuerpo: 'Hola {{nombre}}, recibimos un pedido para cambiar tu contraseña. El link vence en 1 hora. Si no fuiste vos, ignorá este email.',
    ctaLabel: 'Elegir una contraseña nueva',
  },
  {
    tipo: 'PEDIDO_CONFIRMADO',
    nombre: 'Confirmación de pedido',
    descripcion: 'Apenas se crea el pedido (antes del pago).',
    variables: PEDIDO_VARS,
    asunto: 'Recibimos tu pedido {{numero}}',
    titulo: 'Pedido {{numero}} recibido',
    cuerpo: 'Hola {{nombre}}, tu pedido por {{total}} quedó registrado. Te avisamos por email cada vez que avance.',
    ctaLabel: 'Ver mi pedido',
  },
  {
    tipo: 'ESTADO_PAGADO',
    nombre: 'Pago aprobado',
    descripcion: 'Cuando se aprueba el pago (Mercado Pago o transferencia confirmada).',
    variables: PEDIDO_VARS,
    asunto: 'Recibimos tu pago · Pedido {{numero}}',
    titulo: 'Pago aprobado',
    cuerpo: 'Hola {{nombre}}, tu pago de {{total}} fue aprobado. Ya estamos asignando tu pedido a la óptica socia más cercana.',
    ctaLabel: 'Ver mi pedido',
  },
  {
    tipo: 'PAGO_RECHAZADO',
    nombre: 'Pago rechazado',
    descripcion: 'Cuando Mercado Pago rechaza el pago o el admin rechaza la transferencia.',
    variables: PEDIDO_VARS,
    asunto: 'No pudimos procesar tu pago · Pedido {{numero}}',
    titulo: 'Pago rechazado',
    cuerpo: 'Hola {{nombre}}, el pago del pedido {{numero}} no pudo procesarse. Podés intentar de nuevo con otro medio de pago; tu pedido queda reservado por unas horas.',
    ctaLabel: 'Reintentar el pago',
  },
  {
    tipo: 'ESTADO_ASIGNADO',
    nombre: 'Pedido asignado a la óptica',
    descripcion: 'Cuando el pedido se asigna a una óptica socia.',
    variables: PEDIDO_VARS,
    asunto: 'Tu pedido {{numero}} ya tiene óptica asignada',
    titulo: 'Tu óptica: {{optica}}',
    cuerpo: 'Hola {{nombre}}, tu pedido {{numero}} lo va a armar y ajustar {{optica}} ({{opticaDireccion}}). Te avisamos cuando esté listo.',
    ctaLabel: 'Ver mi pedido',
  },
  {
    tipo: 'ESTADO_ACEPTADO',
    nombre: 'La óptica confirmó el pedido',
    descripcion: 'Cuando la óptica acepta el pedido.',
    variables: PEDIDO_VARS,
    asunto: 'La óptica confirmó tu pedido {{numero}}',
    titulo: '{{optica}} confirmó tu pedido',
    cuerpo: 'Hola {{nombre}}, {{optica}} ya tiene tu pedido {{numero}} y empieza a trabajar en él.',
    ctaLabel: 'Ver mi pedido',
  },
  {
    tipo: 'ESTADO_EN_ARMADO',
    nombre: 'En armado',
    descripcion: 'Cuando la óptica marca el pedido en armado.',
    variables: PEDIDO_VARS,
    asunto: 'Estamos armando tus anteojos · {{numero}}',
    titulo: 'Tus anteojos están en armado',
    cuerpo: 'Hola {{nombre}}, {{optica}} está armando tus anteojos. En breve te avisamos que están listos.',
    ctaLabel: 'Ver mi pedido',
  },
  {
    tipo: 'ESTADO_LISTO',
    nombre: 'Listo para retirar',
    descripcion: 'Cuando el pedido está listo en la óptica (retiro) o para despachar (envío).',
    variables: PEDIDO_VARS,
    asunto: 'Tus anteojos están listos · {{numero}}',
    titulo: '¡Listos!',
    cuerpo: 'Hola {{nombre}}, tus anteojos del pedido {{numero}} ya están listos en {{optica}} ({{opticaDireccion}}). Pasá a retirarlos y ajustarlos cuando quieras.',
    ctaLabel: 'Ver mi pedido',
  },
  {
    tipo: 'ESTADO_ENVIADO',
    nombre: 'Enviado',
    descripcion: 'Cuando la óptica despacha el pedido (incluye el número de seguimiento).',
    variables: [...PEDIDO_VARS, 'seguimiento'],
    asunto: 'Tu pedido {{numero}} está en camino',
    titulo: 'En camino',
    cuerpo: 'Hola {{nombre}}, tu pedido {{numero}} salió de {{optica}}. Número de seguimiento: {{seguimiento}}.',
    ctaLabel: 'Ver mi pedido',
  },
  {
    tipo: 'ESTADO_ENTREGADO',
    nombre: 'Entregado y ajustado',
    descripcion: 'Cuando la óptica entrega y ajusta los anteojos.',
    variables: PEDIDO_VARS,
    asunto: 'Pedido {{numero}} entregado y ajustado',
    titulo: '¡Que los disfrutes!',
    cuerpo: 'Hola {{nombre}}, tu pedido {{numero}} fue entregado y ajustado por {{optica}}. El ajuste en la óptica es gratis, siempre. Si algo no quedó perfecto, tenés 30 días para cambiarlo.',
    ctaLabel: 'Ver mi pedido',
  },
  {
    tipo: 'ESTADO_CANCELADO',
    nombre: 'Pedido cancelado',
    descripcion: 'Cuando el pedido se cancela.',
    variables: PEDIDO_VARS,
    asunto: 'Tu pedido {{numero}} fue cancelado',
    titulo: 'Pedido cancelado',
    cuerpo: 'Hola {{nombre}}, cancelamos tu pedido {{numero}}. Si corresponde un reintegro, lo vas a ver reflejado en el mismo medio de pago.',
  },
  {
    tipo: 'CARRITO_ABANDONADO_1H',
    nombre: 'Carrito abandonado (1 hora)',
    descripcion: 'Una hora después de dejar productos en el carrito sin comprar (clientes con cuenta).',
    variables: ['nombre', 'items', 'url'],
    asunto: '¿Te ayudamos a terminar tu compra?',
    titulo: 'Tu carrito te espera',
    cuerpo: 'Hola {{nombre}}, dejaste esto en tu carrito: {{items}}. Retomá la compra cuando quieras; el stock se reserva recién al pagar.',
    ctaLabel: 'Volver al carrito',
  },
  {
    tipo: 'CARRITO_ABANDONADO_24H',
    nombre: 'Carrito abandonado (24 horas)',
    descripcion: 'Un día después, si el carrito sigue sin comprarse.',
    variables: ['nombre', 'items', 'url'],
    asunto: 'Todavía están disponibles: {{items}}',
    titulo: '¿Seguimos?',
    cuerpo: 'Hola {{nombre}}, tus anteojos siguen en el carrito: {{items}}. Comprás online y los ajustás gratis en tu óptica socia más cercana.',
    ctaLabel: 'Terminar la compra',
  },
  {
    tipo: 'VOLVIO_STOCK',
    nombre: 'Volvió el stock',
    descripcion: 'Cuando vuelve a haber stock de una variante con avisos pendientes.',
    variables: ['producto', 'color', 'url'],
    asunto: 'Volvió: {{producto}} {{color}}',
    titulo: '¡Volvió el stock!',
    cuerpo: 'Ya hay stock de {{producto}} en {{color}}. Suele volar: si lo querés, no lo dejes para después.',
    ctaLabel: 'Ver el producto',
  },
  {
    tipo: 'PLAN_RIVEDERE',
    nombre: 'Plan Rivedere',
    descripcion: 'Cada 2 años desde la última compra de recetado o multifocal: control de la vista con cupón de recambio.',
    variables: ['nombre', 'cupon', 'descuento', 'vigencia', 'url'],
    asunto: '{{nombre}}, ¿cuándo fue tu último control de la vista?',
    titulo: 'Plan Rivedere: es momento de controlarte',
    cuerpo:
      'Hola {{nombre}}, pasaron 2 años desde tus últimos anteojos recetados. Te recomendamos un control de la vista: la graduación suele cambiar.\n\nPara renovarlos tenés el cupón **{{cupon}}** con {{descuento}} de descuento, válido hasta {{vigencia}}.',
    ctaLabel: 'Elegir mis nuevos anteojos',
  },
  {
    tipo: 'REFERIDO_RECOMPENSA',
    nombre: 'Cupón por referido',
    descripcion: 'Al que refiere y al referido, cuando el referido hace su primera compra.',
    variables: ['nombre', 'cupon', 'descuento', 'vigencia', 'url'],
    asunto: 'Tenés un cupón de {{descuento}} por referir a un amigo',
    titulo: 'Gracias por recomendarnos',
    cuerpo: 'Hola {{nombre}}, tu cupón **{{cupon}}** de {{descuento}} ya está activo, válido hasta {{vigencia}}. Usalo en tu próxima compra.',
    ctaLabel: 'Usar mi cupón',
  },
  {
    tipo: 'ARREPENTIMIENTO_RECIBIDO',
    nombre: 'Arrepentimiento recibido',
    descripcion: 'Confirmación al cliente con el número de trámite (Res. 424/2020).',
    variables: ['nombre', 'tramite', 'pedido', 'url'],
    asunto: 'Recibimos tu solicitud de arrepentimiento · Trámite {{tramite}}',
    titulo: 'Trámite {{tramite}}',
    cuerpo:
      'Hola {{nombre}}, registramos tu solicitud de revocación de la compra {{pedido}} con el número de trámite {{tramite}}. Te respondemos dentro de las 24 horas hábiles con las instrucciones para la devolución; el reintegro se acredita en el mismo medio de pago.',
  },
  {
    tipo: 'NEWSLETTER_ALTA',
    nombre: 'Alta en el newsletter',
    descripcion: 'Confirmación de suscripción con link de baja.',
    variables: ['url', 'urlBaja'],
    asunto: 'Ya estás en la lista de Vedere',
    titulo: 'Gracias por sumarte',
    cuerpo: 'Vas a recibir novedades, lanzamientos y promos. Sin spam. Podés darte de baja cuando quieras desde el link al pie de cada email.',
    ctaLabel: 'Ver novedades',
  },
  // ---------- B2B: alta de ópticas socias ----------
  {
    tipo: 'SOLICITUD_OPTICA_RECIBIDA',
    nombre: 'Óptica: solicitud recibida',
    descripcion: 'A la óptica, apenas envía la solicitud desde /opticas/sumate.',
    variables: ['nombre', 'optica', 'razonSocial', 'cuit'],
    asunto: 'Recibimos la solicitud de {{optica}}',
    titulo: 'Recibimos tu solicitud',
    cuerpo:
      'Hola {{nombre}}, gracias por querer sumar **{{optica}}** a la red de ópticas socias Vedere.\n\nVamos a revisar los datos y la habilitación en los próximos días hábiles. Cuando la aprobemos te llega un email con el acceso al panel.',
  },
  {
    tipo: 'SOLICITUD_OPTICA_APROBADA',
    nombre: 'Óptica: solicitud aprobada (acceso)',
    descripcion: 'Al aprobar la solicitud: usuario y contraseña provisoria del panel /optica.',
    variables: ['nombre', 'optica', 'email', 'password', 'url'],
    asunto: '{{optica}} ya es óptica socia Vedere',
    titulo: '¡Bienvenidos a la red Vedere!',
    cuerpo:
      'Hola {{nombre}}, aprobamos la solicitud de **{{optica}}**. Ya podés entrar al panel de ópticas socias.\n\n- Usuario: {{email}}\n- Contraseña provisoria: {{password}}\n\nAl ingresar por primera vez te vamos a pedir que elijas una contraseña nueva. Desde el panel también podés dar de alta a las personas de tu equipo.',
    ctaLabel: 'Entrar al panel',
  },
  {
    tipo: 'SOLICITUD_OPTICA_RECHAZADA',
    nombre: 'Óptica: solicitud rechazada',
    descripcion: 'Al rechazar la solicitud, con el motivo.',
    variables: ['nombre', 'optica', 'motivo', 'url'],
    asunto: 'Sobre la solicitud de {{optica}}',
    titulo: 'No pudimos aprobar la solicitud',
    cuerpo:
      'Hola {{nombre}}, revisamos la solicitud de **{{optica}}** y por ahora no pudimos aprobarla.\n\nMotivo: {{motivo}}\n\nSi podés resolverlo, mandá una solicitud nueva o respondé este email.',
    ctaLabel: 'Enviar una solicitud nueva',
  },
  {
    tipo: 'OPTICA_USUARIO_NUEVO',
    nombre: 'Óptica: alta de usuario del equipo',
    descripcion: 'Cuando el dueño de la óptica da de alta a otra persona desde /optica/usuarios.',
    variables: ['nombre', 'optica', 'email', 'password', 'url'],
    asunto: 'Tu acceso al panel de {{optica}} en Vedere',
    titulo: 'Ya tenés acceso al panel',
    cuerpo:
      'Hola {{nombre}}, te dieron acceso al panel de ópticas socias de **{{optica}}**.\n\n- Usuario: {{email}}\n- Contraseña provisoria: {{password}}\n\nAl ingresar por primera vez te vamos a pedir que elijas una contraseña nueva.',
    ctaLabel: 'Entrar al panel',
  },
];

export interface PaginaLegalDefault {
  slug: string;
  titulo: string;
  intro: string;
  contenido: string;
}

export const PAGINAS_LEGALES_DEFAULT: PaginaLegalDefault[] = [
  {
    slug: 'terminos',
    titulo: 'Términos y condiciones',
    intro: 'Condiciones de uso del sitio y de compra en Vedere.',
    contenido: `## 1. Generalidades

Estos términos regulan el uso del sitio y las compras realizadas en Vedere. Al comprar aceptás estas condiciones, la política de privacidad y la política de cambios y devoluciones.

## 2. Productos y precios

Los precios están expresados en pesos argentinos e incluyen IVA. Las fotos son ilustrativas; los colores pueden variar según la pantalla. Vedere puede modificar precios y stock sin previo aviso; el precio válido es el vigente al momento de confirmar el pedido.

## 3. Compra y pago

El pedido se confirma al aprobarse el pago (Mercado Pago o transferencia bancaria). El stock se reserva durante el proceso de pago por un tiempo limitado.

## 4. Armado, entrega y ajuste

Los anteojos los arma, entrega y ajusta una óptica socia cercana a tu domicilio, con un óptico técnico responsable. Los anteojos recetados requieren una receta vigente emitida por un profesional.

## 5. Cambios, devoluciones y garantía

Ver la política de cambios y devoluciones. Las garantías legales se rigen por la Ley 24.240 de Defensa del Consumidor.

## 6. Datos personales

Ver la política de privacidad.

## 7. Jurisdicción

Para cualquier controversia son competentes los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires, sin perjuicio de los derechos del consumidor de acudir a la autoridad de aplicación.`,
  },
  {
    slug: 'privacidad',
    titulo: 'Política de privacidad',
    intro: 'Qué datos recolectamos, para qué y cómo los protegemos (Ley 25.326).',
    contenido: `## Responsable

Vedere es responsable del tratamiento de los datos personales que recolecta a través del sitio.

## Qué datos recolectamos

Datos de contacto (nombre, email, teléfono, DNI), de entrega (dirección), de compra (pedidos y pagos), recetas oftalmológicas que cargás para fabricar tus anteojos y datos de navegación (cookies).

## Para qué

Procesar y entregar pedidos, asignarlos a la óptica socia, emitir facturas, responder consultas, enviar comunicaciones transaccionales y, si lo aceptaste, novedades y promociones.

## Con quién los compartimos

Con la óptica socia que arma y entrega tu pedido (sólo los datos necesarios), con el procesador de pagos (Mercado Pago), con el proveedor de envíos y con proveedores de infraestructura que nos prestan servicio.

## Tus derechos

Podés acceder, rectificar, actualizar o suprimir tus datos escribiéndonos desde la página de contacto. La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.

## Cookies

Usamos cookies necesarias para que el sitio funcione y, con tu consentimiento, cookies de medición y marketing (Google Analytics, Meta). Podés cambiar tu elección desde el banner de cookies.`,
  },
  {
    slug: 'cambios',
    titulo: 'Política de cambios y devoluciones',
    intro: 'Plazos y condiciones para cambios, devoluciones, garantía y ajustes.',
    contenido: `## Cambios

Tenés 30 días desde que recibís el pedido para cambiarlo por otro talle, color o modelo. El producto tiene que estar sin uso, con su estuche y etiquetas. El primer cambio es gratis; si el nuevo modelo cuesta más, abonás la diferencia; si cuesta menos, te damos una nota de crédito. Los lentes graduados a medida no se cambian por otro armazón, salvo defecto de fabricación.

## Devoluciones y reintegro

Dentro de los 10 días corridos desde la entrega podés devolver el producto y pedir el reintegro total, sin dar explicaciones (botón de arrepentimiento, art. 34 de la Ley 24.240 y Res. 424/2020). El reintegro se acredita en el mismo medio de pago en un plazo de hasta 10 días hábiles.

## Garantía

Los armazones tienen 6 meses de garantía por defectos de fabricación: bisagras, soldaduras, pintura o acetato. No cubre golpes, rayas ni uso indebido. Los lentes orgánicos con antirreflejo tienen 3 meses de garantía contra descascarado.

## Ajustes

El ajuste en la óptica socia es gratis, siempre, aunque hayan pasado los 30 días.`,
  },
  {
    slug: 'cookies',
    titulo: 'Política de cookies',
    intro: 'Qué cookies usa el sitio y cómo administrarlas.',
    contenido: `## Cookies necesarias

Sesión, carrito y preferencias. Sin ellas el sitio no funciona; no requieren consentimiento.

## Cookies de medición y marketing

Google Analytics 4, Google Tag Manager y Meta Pixel. Sólo se cargan si aceptás el banner de cookies. Podés cambiar tu elección en cualquier momento desde el pie de página.`,
  },
  {
    slug: 'programa-opticas',
    titulo: 'Términos del programa de ópticas socias',
    intro: 'Condiciones para sumarse a la red de ópticas socias Vedere y comprar al por mayor.',
    contenido: `## Quién puede sumarse

Ópticas habilitadas por la autoridad sanitaria de su jurisdicción, con un óptico técnico matriculado como responsable y CUIT activo. Vedere revisa cada solicitud y puede aprobarla o rechazarla indicando el motivo.

## Qué datos pedimos

Razón social, nombre comercial, CUIT y condición frente al IVA, dirección del local, teléfono, email, nombre y matrícula del óptico responsable y la habilitación del local. La óptica declara que los datos son verdaderos y se compromete a mantenerlos actualizados.

## Acceso al panel

Al aprobar la solicitud enviamos un usuario y una contraseña provisoria para el panel de ópticas socias, que hay que cambiar en el primer ingreso. El dueño de la cuenta puede dar de alta a las personas de su equipo y es responsable del uso que hagan del panel.

## Precios mayoristas

Los precios mayoristas se informan sin IVA, son confidenciales y pueden cambiar sin previo aviso. No se pueden publicar ni compartir con terceros.

## Pedidos de clientes de la tienda

Si la óptica recibe pedidos de la tienda web, se compromete a aceptarlos o rechazarlos dentro del plazo informado en el panel, armarlos con los lentes indicados en la receta y entregarlos y ajustarlos sin cargo para el cliente. Cobra la comisión acordada por cada pedido entregado, según la liquidación mensual.

## Datos de los clientes

La óptica usa los datos de los clientes de Vedere sólo para atender sus pedidos y cumple la Ley 25.326 de protección de datos personales.

## Baja

Cualquiera de las partes puede terminar la relación avisando por email. Vedere puede pausar o dar de baja a una óptica que no cumpla estos términos.`,
  },
];
