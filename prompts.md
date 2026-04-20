# 📝 Prompts de Trabajo — Poker Range Study App

Colección de prompts reutilizables para trabajar con Claude Code durante el desarrollo del proyecto. Copia y pega el que corresponda según la situación.

---

## 📑 Índice

1. [✅ Checkpoint al terminar una fase](#-checkpoint-al-terminar-una-fase)
2. [🔄 Reanudar sesión tras perder contexto](#-reanudar-sesión-tras-perder-contexto)
3. [🐛 Reportar un bug encontrado al probar](#-reportar-un-bug-encontrado-al-probar)
4. [🎨 Solicitar un ajuste de diseño](#-solicitar-un-ajuste-de-diseño)
5. [🚀 Auditoría final del proyecto](#-auditoría-final-del-proyecto)

---

## ✅ Checkpoint al terminar una fase

> **Cuándo usarlo:** cuando Claude Code diga "terminé la Fase X". Cópialo y pégalo tal cual.

```
Antes de continuar, valida la fase completada:

1. Ejecuta `npm run build` y reporta si hay errores de TypeScript
2. Ejecuta `npm run lint` y reporta warnings/errores
3. Haz un resumen en bullets de:
   - Archivos creados/modificados
   - Decisiones de diseño o arquitectura que tomaste
   - Cualquier desviación respecto al plan original y por qué
4. Lista 3 cosas que podría probar yo manualmente en el navegador para verificar que la fase funciona
5. Haz commit con mensaje descriptivo siguiendo Conventional Commits (feat:, fix:, refactor:, etc.)
6. Espera mi confirmación antes de avanzar a la siguiente fase
```

---

## 🔄 Reanudar sesión tras perder contexto

> **Cuándo usarlo:** si cierras Visual Studio y vuelves al día siguiente, o si Claude Code parece "olvidar" lo que estaba haciendo.

```
Retomamos el proyecto de poker range study app.

1. Lee el archivo CLAUDE.md en la raíz
2. Ejecuta `git log --oneline -20` para ver los últimos commits
3. Ejecuta `git status` para ver el estado actual
4. Dime en qué fase estábamos según los commits y qué falta hacer
5. Espera mi confirmación antes de continuar escribiendo código
```

---

## 🐛 Reportar un bug encontrado al probar

> **Cuándo usarlo:** cuando pruebes la app y algo no funcione bien. Rellena los campos entre corchetes.

```
Encontré un problema al probar la Fase [X]:

**Qué hice:** [describe pasos exactos]
**Qué esperaba:** [comportamiento esperado]
**Qué pasó:** [comportamiento real]
**Consola del navegador:** [pega errores si los hay]

Antes de arreglarlo:
1. Reproduce el problema tú mismo
2. Identifica la causa raíz (no solo el síntoma)
3. Explícame en 2-3 líneas qué vas a cambiar y por qué
4. Luego aplica el fix
```

---

## 🎨 Solicitar un ajuste de diseño

> **Cuándo usarlo:** cuando algo visualmente no te convenza. Rellena los campos entre corchetes.

```
Ajuste de diseño en [componente/vista]:

**Problema:** [describe qué no te gusta, sé específico]
**Cambio deseado:** [qué quieres que se vea diferente]
**Referencia (opcional):** [sitio web o captura que te inspire]

Antes de cambiar:
1. Muéstrame qué archivos vas a tocar
2. Describe en palabras el resultado visual final
3. Aplica el cambio
4. Confirma que no rompiste nada más
```

---

## 🚀 Auditoría final del proyecto

> **Cuándo usarlo:** al terminar todas las fases, antes de considerar el proyecto producción-ready.

```
Proyecto completado. Ahora necesito una auditoría final antes de considerar esto producción-ready:

1. **Seguridad**: revisa todo el código buscando:
   - Inyecciones posibles en parsers
   - Datos sensibles en localStorage sin validar
   - Dependencias con vulnerabilidades (npm audit)

2. **Performance**:
   - Ejecuta `npm run build` y reporta el tamaño del bundle
   - Identifica los 3 componentes más pesados
   - Sugiere optimizaciones concretas

3. **Accesibilidad**:
   - Verifica navegación por teclado en cada módulo
   - Revisa contraste de colores
   - Lista problemas encontrados

4. **Código**:
   - Busca `any`, `TODO`, `console.log` y lístalos
   - Identifica código duplicado
   - Sugiere refactors

5. **Documentación**:
   - Verifica que el README esté completo
   - Añade instrucciones de deploy (Vercel/Netlify recomendado)
   - Documenta las decisiones arquitectónicas clave

Entrégame el reporte antes de hacer cualquier cambio.
```
