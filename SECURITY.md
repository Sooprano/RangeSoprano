# Seguridad — Range Soprano

Range Soprano es una **SPA 100% estática** (React + Vite) servida desde GitHub
Pages, con el DNS del dominio gestionado por Cloudflare. **No hay backend, base de datos, cuentas ni API
keys**: todo corre en el navegador y los datos del usuario viven solo en su
`localStorage`. Esto reduce mucho la superficie de ataque (no hay servidor que
comprometer ni credenciales que filtrar).

## Postura de seguridad (implementado en el repo)

- **Sin secretos en el cliente.** No se usan API keys, tokens ni credenciales
  (no hay servicios externos). Nada de datos personales en el código. `.env*`
  está en `.gitignore`.
- **Sin sinks de XSS.** No se usa `dangerouslySetInnerHTML`, `innerHTML`,
  `eval`, `new Function` ni `document.write`. Todo el texto dinámico (incluido
  lo que el usuario pega) se renderiza vía React, que escapa por defecto.
- **Entrada del usuario validada y saneada.**
  - Import de rangos / perfil `.json`: se valida con **Zod** (`src/store/schemas.ts`)
    con límites de tamaño, y `sanitizeText` elimina caracteres de control.
    Tope de import de ~3.8 MB.
  - Parsers de rangos (`handRangeParser.ts`) e historiales `.txt`
    (`handHistory.ts`): tolerantes a error, sin ejecutar nada; su salida solo
    alimenta React (auto-escapado).
  - `localStorage` con cap de tamaño y re-validación con Zod al hidratar.
- **Enlaces externos** con `rel="noopener noreferrer"` (evita `window.opener`
  hijacking).
- **Content-Security-Policy** inyectada en el build (ver `vite.config.ts`,
  plugin `inject-csp-meta`) y propagada a cada ruta por `scripts/prerender.mjs`:

  ```
  default-src 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;
  font-src 'self' data:; connect-src 'self' data: blob:;
  object-src 'none'; base-uri 'self'; form-action 'self'
  ```

  Bloquea scripts/estilos/imagenes remotos, plugins (`object-src 'none'`),
  secuestro de `<base>` y envíos de formulario a otros orígenes. `'unsafe-inline'`
  es necesario por el script de tema inline y los estilos inline de React/Tailwind;
  `data:`/`blob:` por el QR de donación y la exportación a PNG (html-to-image).
  Se inyecta solo en el build para no romper el HMR del dev server.
- **Referrer-Policy** `strict-origin-when-cross-origin` vía `<meta>`.
- **Dependencias**: `npm audit` en verde (0 vulnerabilidades). Correr
  `npm audit` periódicamente y `npm audit fix` ante avisos.

## Transporte y hosting

El sitio se sirve **directamente desde GitHub Pages** sobre HTTPS. El dominio usa
Cloudflare **solo para DNS** (registros en modo "Solo DNS" / nube gris): esto es
un requisito para que GitHub Pages pueda emitir y renovar su certificado
Let's Encrypt; el proxy de Cloudflare (nube naranja) interfiere con ese proceso.
GitHub Pages ya envía **HSTS** (`Strict-Transport-Security`) en cada respuesta.

Como GitHub Pages no permite headers HTTP personalizados y Cloudflare no está en
la ruta del tráfico, las cabeceras de seguridad del sitio se entregan por
**`<meta>` desde el build** (CSP y `Referrer-Policy`, ver arriba). Esta cobertura
es la adecuada para un SPA estático sin backend, sin cuentas y sin datos de
usuario en servidor: la superficie que de verdad importa (inyección de scripts /
estilos, filtrado de referer, forzado de HTTPS) queda cubierta.

Si en el futuro la app sumara backend, autenticación o pagos, correspondería
mover las cabeceras al nivel de transporte (por ejemplo migrando el hosting a una
plataforma que permita headers custom) para poder fijar también las directivas
que `<meta>` no soporta.

## Reportar una vulnerabilidad

Abrí un issue en el repositorio de GitHub describiendo el problema (sin publicar
un exploit funcional). Al no haber backend ni datos de usuarios en servidor, el
impacto de la mayoría de hallazgos se limita al propio navegador del usuario.
