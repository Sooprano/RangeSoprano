# Seguridad — Range Soprano

Range Soprano es una **SPA 100% estática** (React + Vite) servida desde GitHub
Pages detrás de Cloudflare. **No hay backend, base de datos, cuentas ni API
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

## Pendiente: headers a nivel edge (Cloudflare)

Algunas protecciones **no se pueden fijar por `<meta>`** y hay que ponerlas como
**HTTP response headers**. GitHub Pages no permite headers custom, pero el sitio
está detrás de **Cloudflare** → configurarlas ahí (Rules → **Transform Rules** →
*HTTP Response Header Modification*, o el toggle de HSTS en SSL/TLS → Edge
Certificates):

| Header | Valor recomendado | Para qué |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Fuerza HTTPS (anti-downgrade). Activable en SSL/TLS → Edge Certificates → HSTS. |
| `X-Frame-Options` | `DENY` | Anti-clickjacking (complementa `frame-ancestors`). |
| `X-Content-Type-Options` | `nosniff` | Evita MIME-sniffing. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Refuerza el `<meta>` a nivel header. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` | Desactiva APIs que la web no usa. |
| `Content-Security-Policy` | igual que la meta **+** `frame-ancestors 'none'` | La CSP por header sí soporta `frame-ancestors` y `report-uri`. |

Opcional: activar en Cloudflare el **Bot Fight Mode** y reglas de rate-limiting
básicas, aunque al ser un sitio estático el riesgo es bajo.

## Reportar una vulnerabilidad

Abrí un issue en el repositorio de GitHub describiendo el problema (sin publicar
un exploit funcional). Al no haber backend ni datos de usuarios en servidor, el
impacto de la mayoría de hallazgos se limita al propio navegador del usuario.
