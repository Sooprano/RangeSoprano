# Sopranozilla — presets actuales (P2)

Peso inicial (0–100) de cada categoría en la fila de EV, según la calle, la respuesta del villano y el tamaño de tu apuesta en % del bote. **✗** = la categoría no sigue · **—** = la fila no existe en esa calle o no lleva valor (queda neutral).

Fuente: `src/features/sopranozilla/presets/default-presets.json`. Para cambiar un valor, edita esta tabla y pásala: se copia al JSON (se valida con Zod al cargar).

Los tamaños fuera de estos rangos no tienen preset y arrancan en **Todo ✓ 100** (P3 en `DECISIONS.md`).

## Cuando el villano paga (call)

| Categoría | Flop 25–45% | Flop 55–100% | Turn 40–60% | Turn 60–100% | River 25–45% | River 50–80% | River 100%+ |
|---|---|---|---|---|---|---|---|
| **Manos hechas** | | | | | | | |
| Escalera de color / póker | 100 | 100 | 100 | 100 | 100 | 100 | 100 |
| Full house | 100 | 100 | 100 | 100 | 100 | 100 | 100 |
| Color | 100 | 100 | 100 | 100 | 100 | 100 | 100 |
| Escalera | 60 | 70 | 70 | 75 | 100 | 100 | 100 |
| Set | 60 | 70 | 75 | 80 | 100 | 100 | 100 |
| Trío | 60 | 70 | 75 | 80 | 100 | 100 | 100 |
| Doble pareja | 60 | 70 | 75 | 80 | 100 | 100 | 100 |
| Overpair | 100 | 100 | 100 | 100 | 100 | 100 | 95 |
| Top pair | 100 | 100 | 100 | 95 | 100 | 100 | 85 |
| PP < top card | 100 | 85 | 70 | 50 | 85 | 60 | 30 |
| Middle pair | 100 | 80 | 70 | 45 | 85 | 60 | 30 |
| PP < 2nd card | 95 | 60 | 40 | 20 | 65 | 35 | 15 |
| Weak pair | 90 | 40 | 25 | 10 | 50 | 20 | 5 |
| PP < board | 70 | 20 | 10 | ✗ | 40 | 10 | ✗ |
| A-high | 50 | 15 | 10 | ✗ | 25 | 8 | ✗ |
| K-high | 30 | 5 | ✗ | ✗ | 10 | ✗ | ✗ |
| Nada | ✗ | ✗ | ✗ | ✗ | 5 | ✗ | ✗ |
| **Proyectos** | | | | | | | |
| FD 2 cartas | 85 | 90 | 100 | 95 | — | — | — |
| FD 1 carta | 70 | 75 | 85 | 75 | — | — | — |
| OESD 2 cartas | 100 | 100 | 100 | 95 | — | — | — |
| OESD 1 carta | 80 | 60 | 70 | 50 | — | — | — |
| Double gutshot | 100 | 80 | 90 | 70 | — | — | — |
| Gutshot 2 cartas | 85 | 50 | 60 | 35 | — | — | — |
| Gutshot 1 carta | 50 | 15 | 25 | 10 | — | — | — |
| BDFD 2 cartas | 40 | 10 | — | — | — | — | — |
| BDFD 1 carta | 20 | 0 | — | — | — | — | — |
| Dos overcards | 60 | 20 | 10 | ✗ | 25 | 8 | ✗ |
| Una overcard | 40 | 10 | ✗ | ✗ | 15 | 5 | ✗ |
| **Combo draws** | | | | | | | |
| BDSD + BDFD | 50 | 15 | — | — | — | — | — |
| Gutshot + BDFD | 60 | 20 | — | — | — | — | — |
| FD + OESD | 100 | 95 | 100 | 95 | — | — | — |
| FD + gutshot | 100 | 95 | 100 | 95 | — | — | — |
| FD + par | 100 | 95 | 100 | 95 | — | — | — |
| OESD + par | 100 | 95 | 100 | 95 | — | — | — |
| Gutshot + par | 100 | 95 | 100 | 95 | — | — | — |
| FD + overcards | 100 | 95 | 100 | 95 | — | — | — |

## Cuando el villano sube (check-raise)

| Categoría | Flop 25–45% | Flop 55–100% | Turn 40–100% | River 25%+ |
|---|---|---|---|---|
| **Manos hechas** | | | | |
| Escalera de color / póker | 70 | 70 | 60 | 60 |
| Full house | 70 | 70 | 60 | 60 |
| Color | 70 | 70 | 60 | 60 |
| Escalera | 60 | 60 | 60 | 60 |
| Set | 60 | 55 | 50 | 50 |
| Trío | 60 | 55 | 50 | 50 |
| Doble pareja | 60 | 55 | 50 | 50 |
| Overpair | 10 | 10 | 10 | 10 |
| Top pair | 10 | 5 | 5 | 5 |
| PP < top card | 5 | ✗ | ✗ | ✗ |
| Middle pair | 5 | ✗ | ✗ | ✗ |
| PP < 2nd card | ✗ | ✗ | ✗ | ✗ |
| Weak pair | ✗ | ✗ | ✗ | ✗ |
| PP < board | ✗ | ✗ | ✗ | ✗ |
| A-high | 5 | ✗ | ✗ | 5 |
| K-high | 5 | ✗ | ✗ | 5 |
| Nada | 5 | 3 | 3 | 8 |
| **Proyectos** | | | | |
| FD 2 cartas | 35 | 30 | 25 | — |
| FD 1 carta | 20 | 15 | 10 | — |
| OESD 2 cartas | 35 | 30 | 25 | — |
| OESD 1 carta | 15 | 10 | 5 | — |
| Double gutshot | 30 | 25 | 20 | — |
| Gutshot 2 cartas | 15 | 10 | 5 | — |
| Gutshot 1 carta | 5 | ✗ | ✗ | — |
| BDFD 2 cartas | 10 | 5 | — | — |
| BDFD 1 carta | ✗ | ✗ | — | — |
| Dos overcards | 5 | ✗ | ✗ | 5 |
| Una overcard | ✗ | ✗ | ✗ | ✗ |
| **Combo draws** | | | | |
| BDSD + BDFD | 50 | 40 | — | — |
| Gutshot + BDFD | 60 | 50 | — | — |
| FD + OESD | 60 | 55 | 45 | — |
| FD + gutshot | 60 | 55 | 45 | — |
| FD + par | 60 | 55 | 45 | — |
| OESD + par | 60 | 55 | 45 | — |
| Gutshot + par | 60 | 55 | 45 | — |
| FD + overcards | 60 | 55 | 45 | — |
