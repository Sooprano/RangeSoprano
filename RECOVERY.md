# 🆘 Plan de contingencia si Claude Code falla o se acaban los tokens

## Si Claude Code se detiene a mitad de una fase

1. NO cierres VS Code
2. Abre terminal y ejecuta:
   - `git status`
   - `git add .`
   - `git commit -m "wip: phase X partial progress"`
3. Espera a que vuelvan los tokens

## Cuando vuelvan los tokens, pega en Claude Code

Se interrumpió la fase anterior. Para retomar:

1. Lee CLAUDE.md en la raíz
2. Lee prompts.md
3. Ejecuta `git log --oneline -10` y `git status`
4. Revisa el estado del código actual
5. Preséntame un plan para completar la fase desde donde quedó
6. Espera mi confirmación antes de codificar

## Si todo falla, revertir al último commit estable

- `git log --oneline` → Ver commits
- `git reset --hard <hash>` → Volver a ese commit

## Commits importantes del proyecto

- `02f65ff` → Fase 1 completa (project setup, design tokens, routing, layout)
- [ir añadiendo aquí los hashes de cada fase completada]

## Buenas prácticas durante el desarrollo

- Hacer commits frecuentes, idealmente al terminar cada sub-fase
- No agregar features nuevas en medio de una fase, anotarlas en TODO.md
- Siempre probar en navegador antes de aprobar la siguiente fase
- Verificar consola sin errores antes de avanzar