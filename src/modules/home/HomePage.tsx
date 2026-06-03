import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  ArrowRight,
  Bitcoin,
  Calculator,
  Check,
  ChevronDown,
  Copy,
  Dices,
  Download,
  Dumbbell,
  Eye,
  FileSearch,
  FolderInput,
  FolderOpen,
  HelpCircle,
  Pencil,
  Percent,
  PictureInPicture2,
  Save,
  Target,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { PageHeader } from '@/components/ui/PageHeader';
import { copyToClipboard } from '@/utils/exportRange';
import { pushToast } from '@/store/toastStore';
import {
  DONATION_YEAR,
  DONATION_GOAL_USD,
  DONATION_RECEIVED_USD,
  DONATION_RECEIVED_BTC,
} from '@/data/donations';
import { ImportProfileButton } from './ImportProfileButton';

const BTC_ADDRESS = 'bc1qyz4fd8msnedgjj9sv68qlu4theh7mdh57rea8w';

type ModuleCard = {
  to: string;
  command: string;
  label: string;
  icon: LucideIcon;
  description: string;
};

const MODULES: readonly ModuleCard[] = [
  {
    to: '/viewer',
    command: '/viewer',
    label: 'Visualizador',
    icon: Eye,
    description:
      'Tres vistas: Individual, Comparar (dos rangos en paralelo) y Resumen (mosaico de carpetas). Filtra por posición, situación, villano y acción. Exporta a PNG o imprime varias hojas a PDF con leyenda y etiquetas de stack/sizing.',
  },
  {
    to: '/trainer',
    command: '/trainer',
    label: 'Entrenador',
    icon: Target,
    description:
      'Entrena manos en mesa 6-max o Heads-Up. Modos Clásico (auto-avance 1.5 s), Velocidad (contrarreloj con tabla de líderes local), Dibujo (pintar el rango de memoria) y Pot Odds (fold equity al apostar y equity al pagar, con MC y fórmula explicada). Filtros por posición, situación y villano.',
  },
  {
    to: '/editor',
    command: '/editor',
    label: 'Editor',
    icon: Pencil,
    description:
      'Crea y edita rangos con paleta de acciones por rango, pesos mixtos, notas, deshacer/rehacer, carpetas y sub-carpetas. Importa/exporta rangos individuales o el perfil completo.',
  },
  {
    to: '/calculadoras',
    command: '/calculadoras',
    label: 'Calculadoras',
    icon: Calculator,
    description:
      'Diecisiete herramientas de EV y matemática de poker para analizar tus manos y decisiones: fold equity, all-in, doble barrel, value/bluff, EV de checkear y de raise, multi-calle, implied odds, raise sizing, floating y más. Cada una con la fórmula explicada y los valores sustituidos en vivo.',
  },
  {
    to: '/analisis',
    command: '/analisis',
    label: 'Análisis de manos',
    icon: FileSearch,
    description:
      'Pega el historial .txt de una mano real (el que exporta PokerTracker 4) y la web extrae el spot (board, pot y apuesta de cada decisión) y por cada jugada de hero te abre la calculadora de EV adecuada, ya cargada con los números. La equity la traes de Flopzilla y la ingresas: la web hace el razonamiento de EV y te enseña qué herramienta usar.',
  },
  {
    to: '/ejercicios',
    command: '/ejercicios',
    label: 'Ejercicios',
    icon: Dumbbell,
    description:
      'Drills de active recall para el postflop. "¿Qué calculadora?": te mostramos un spot real y eliges qué herramienta de EV usarías. "Conteo de combos": cuántos combos de una mano quedan tras los bloqueadores del board y tus cartas. "Value / Bluff": cuántos faroles para balancear tu rango de apuesta según el tamaño. "Fold equity": el % de fold mínimo para que un bluff sea rentable. Con puntaje, racha y atajos de teclado.',
  },
];

type Faq = { q: string; a: React.ReactNode; aPlain?: string };

const FAQS: readonly Faq[] = [
  {
    q: '¿Qué es Range Soprano?',
    a: 'Una herramienta web gratis para estudiar poker. Empezó con tres módulos para rangos preflop —Visualizador, Entrenador y Editor— y hoy suma Calculadoras de EV, Análisis de manos desde el historial .txt y Ejercicios para practicar. Pensada para repasar, memorizar y comparar tus propios rangos (o copiados de un libro/solver) en mesa 6-max o Heads-Up, y para estudiar la matemática de tus decisiones.',
  },
  {
    q: '¿Por qué no hay login ni cuenta?',
    a: 'Tus datos viven sólo en tu navegador (localStorage). No subimos nada a ningún servidor → cero cuentas, cero contraseñas, cero tracking. Si quieres mover los rangos a otro dispositivo usas export/import .json.',
  },
  {
    q: '¿Qué es un archivo .json y para qué lo uso?',
    a: (
      <>
        Es un archivo de texto con todos tus rangos serializados. Lo descargas
        desde <span className="font-medium text-content">Editor → Export → Download all ranges JSON</span>{' '}
        y lo guardas donde quieras (Drive, Dropbox, pendrive). En otra PC o en
        el celular lo importas desde <span className="font-medium text-content">Home → Importar perfil completo</span>{' '}
        y recuperas todo. El archivo también incluye los colores de tus carpetas
        y la configuración del randomizador (presets, sets, frecuencia), así
        que el perfil viaja completo.
      </>
    ),
    aPlain:
      'Es un archivo de texto con todos tus rangos serializados. Lo descargas desde Editor → Export → Download all ranges JSON y lo guardas donde quieras (Drive, Dropbox, pendrive). En otra PC o en el celular lo importas desde Home → Importar perfil completo y recuperas todo. El archivo también incluye los colores de tus carpetas y la configuración del randomizador (presets, sets, frecuencia), así que el perfil viaja completo.',
  },
  {
    q: '¿Cómo funciona el randomizador?',
    a: (
      <>
        Vives en el <span className="font-medium text-content">Visualizador → Resumen</span>{' '}
        como una tarjeta fija arriba a la derecha. Clic en{' '}
        <span className="font-medium text-content">Tirar</span> (o tecla{' '}
        <kbd className="rounded border border-border bg-bg px-1 py-0.5 font-mono text-[10px] text-content">
          Espacio
        </kbd>
        ) tira un número del 1 al 100. Los 4 presets editables (
        <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">
          60/40
        </code>
        ,{' '}
        <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">
          50/50
        </code>
        , …) se iluminan en verde si el roll cae dentro de su threshold, así
        lees la decisión de un vistazo: si tu rango dice "AKo 50/50" y el preset{' '}
        <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">
          50/50
        </code>{' '}
        está iluminado, haces la acción de la izquierda; si no, la de la derecha.
        Modo automático con{' '}
        <kbd className="rounded border border-border bg-bg px-1 py-0.5 font-mono text-[10px] text-content">
          A
        </kbd>{' '}
        y tres sets guardables para alternar configuraciones por formato.
      </>
    ),
    aPlain:
      'Vive en el Visualizador → Resumen como una tarjeta fija arriba a la derecha. Clic en Tirar (o tecla Espacio) tira un número del 1 al 100. Los 4 presets editables (60/40, 50/50, ...) se iluminan en verde si el roll cae dentro de su threshold, así lees la decisión de un vistazo: si tu rango dice "AKo 50/50" y el preset 50/50 está iluminado, haces la acción de la izquierda; si no, la de la derecha. Modo automático con A y tres sets guardables para alternar configuraciones por formato.',
  },
  {
    q: '¿Cómo funciona el cronómetro de sesión?',
    a: (
      <>
        Vives en el{' '}
        <span className="font-medium text-content">Visualizador → Resumen</span>{' '}
        como una tarjeta junto al randomizador. Play/pausa el timer, la
        bandera (🚩) marca el fin de una sesión y guarda su duración como{' '}
        <span className="font-medium text-content">vuelta</span>, y el reset (↺)
        limpia todo. La clave: el cronómetro solo cuenta tiempo mientras está
        corriendo, así que pausando durante los descansos las vueltas reflejan{' '}
        <span className="font-medium text-content">solo tu tiempo real de juego</span>{' '}
        — el descanso queda excluido. El estado persiste si recargas la página
        (si lo dejaste corriendo, retoma con el offset correcto).
      </>
    ),
    aPlain:
      'Vive en el Visualizador → Resumen como una tarjeta junto al randomizador. Play/pausa el timer, la bandera marca el fin de una sesión y guarda su duración como vuelta, y el reset limpia todo. La clave: el cronómetro solo cuenta tiempo mientras está corriendo, así que pausando durante los descansos las vueltas reflejan solo tu tiempo real de juego — el descanso queda excluido. El estado persiste si recargas la página (si lo dejaste corriendo, retoma con el offset correcto).',
  },
  {
    q: '¿Qué es la ventana flotante y para qué sirve?',
    a: (
      <>
        Es una ventana del sistema operativo que abre el cronómetro y el
        randomizador{' '}
        <span className="font-medium text-content">siempre encima</span> del
        cliente de poker. Útil para verlos sin hacer Alt+Tab mientras juegas en
        PokerStars, GG, WPT Global u otra mesa real. Click en el icono⊡{' '}
        arriba a la derecha del cluster de tools en{' '}
        <span className="font-medium text-content">Visualizador → Resumen</span>.
        Es redimensionable arrastrando los bordes y comparte estado con la
        pestaña — tirar en la flotante también se ve en la pestaña, play/pausa
        del cronómetro idem. Funciona nativo en{' '}
        <span className="font-medium text-content">
          Chrome 116+, Edge, Brave y Opera
        </span>{' '}
        (Document Picture-in-Picture API); en Firefox y Safari abre una
        ventana normal del navegador, redimensionable pero no siempre-encima.
      </>
    ),
    aPlain:
      'Es una ventana del sistema operativo que abre el cronómetro y el randomizador siempre encima del cliente de poker. Útil para verlos sin hacer Alt+Tab mientras juegas en PokerStars, GG, WPT Global u otra mesa real. Click en el icono arriba a la derecha del cluster de tools en Visualizador → Resumen. Es redimensionable arrastrando los bordes y comparte estado con la pestaña — tirar en la flotante también se ve en la pestaña, play/pausa del cronómetro idem. Funciona nativo en Chrome 116+, Edge, Brave y Opera (Document Picture-in-Picture API); en Firefox y Safari abre una ventana normal del navegador, redimensionable pero no siempre-encima.',
  },
  {
    q: '¿Mis rangos se borran si limpio el navegador?',
    a: 'Sí. localStorage muere si limpias caché/datos del sitio o usas navegación privada. Haz backup periódico exportando el .json — es la única copia que tienes.',
  },
  {
    q: '¿Cuántos rangos puedo guardar?',
    a: 'Hasta ~3.8 MB en localStorage (≈100 rangos llenos). Si te queda corto exporta unos a .json y bórralos del store.',
  },
  {
    q: '¿Sirve para 6-max y Heads-Up?',
    a: 'Sí. Cada rango se crea con un formato (6max o HU). El Entrenador pinta la mesa acorde y el Visualizador filtra por formato.',
  },
  {
    q: '¿Cómo imprimo varios rangos a PDF?',
    a: (
      <>
        En el <span className="font-medium text-content">Visualizador</span>, pestaña{' '}
        <span className="font-medium text-content">Resumen</span>, botón{' '}
        <span className="font-medium text-content">Imprimir PDF</span>. Configura rangos por
        página, etiquetas (stack/sizing), leyenda y badge de formato. Después usa
        <span className="font-medium text-content"> Print / Save as PDF</span> del navegador.
      </>
    ),
    aPlain:
      'En el Visualizador, pestaña Resumen, botón Imprimir PDF. Configura rangos por página, etiquetas (stack/sizing), leyenda y badge de formato. Después usa Print / Save as PDF del navegador.',
  },
  {
    q: '¿Funciona offline?',
    a: 'Sí, una vez cargada la página. Todo es JS estático servido desde GitHub Pages — no hay backend.',
  },
  {
    q: '¿Sirve para aprender pot odds?',
    a: (
      <>
        Sí. El <span className="font-medium text-content">Entrenador</span> tiene una pestaña{' '}
        <span className="font-medium text-content">Pot Odds</span> con cuatro tipos de pregunta sobre pot odds:
        cuánta fold equity necesitas cuando bluffeas, qué equity necesitas para
        pagar, y las dos inversas (qué tamaño apostar dado un % de fold equity y
        hasta qué tamaño puedes pagar dado un % de equity). Multiple choice de 4
        opciones con feedback que muestra la fórmula resuelta. No depende de
        tener rangos cargados, puedes practicar incluso desde un perfil vacío.
      </>
    ),
    aPlain:
      'Sí. El Entrenador tiene una pestaña Pot Odds con cuatro tipos de pregunta sobre pot odds: cuánta fold equity necesitas cuando bluffeas, qué equity necesitas para pagar, y las dos inversas (qué tamaño apostar dado un % de fold equity y hasta qué tamaño puedes pagar dado un % de equity). Multiple choice de 4 opciones con feedback que muestra la fórmula resuelta. No depende de tener rangos cargados, puedes practicar incluso desde un perfil vacío.',
  },
  {
    q: '¿Cómo uso las calculadoras de EV?',
    a: (
      <>
        Desde la barra lateral entra a{' '}
        <Link to="/calculadoras" className="font-medium text-accent-light hover:underline">
          Calculadoras
        </Link>
        . Tienes diecisiete herramientas:{' '}
        <span className="font-medium text-content">EV básico</span> (EV de una jugada con
        dos finales: pot, % que esperas ganar y lo que arriesgas),{' '}
        <span className="font-medium text-content">EV con fold equity</span> (semi-bluffs
        y shoves: F% de fold + showdown EV cuando te pagan),{' '}
        <span className="font-medium text-content">EV de bluff</span> (bluff puro sin
        equity en showdown — river bluffs y blocker bets — con breakeven F% automático),{' '}
        <span className="font-medium text-content">Doble barrel</span> (EV de la línea
        completa de apostar el turn y barrelear el river: muestra si el conjunto es +EV
        aunque el bet del turn solo sea −EV),{' '}
        <span className="font-medium text-content">EV multi-calle</span> (encadena el EV
        de dos calles —turn + river— ponderando cada cuánto se ve el river),{' '}
        <span className="font-medium text-content">Value / Bluff</span> (cuántos combos
        de farol puedes tener respecto a tus combos de valor para no desbalancear el
        rango de apuesta),{' '}
        <span className="font-medium text-content">Check vs Bet</span> (comparación lado a
        lado de check behind vs apostar el ríver con recomendación y delta de EV),{' '}
        <span className="font-medium text-content">EV de checkear</span> (cuánto rinde
        checkear juntando las dos ramas: check-call si apuesta y check-check si hace check
        behind),{' '}
        <span className="font-medium text-content">All-in EV</span> (shove preflop sobre
        la apuesta del villano: pot + call + shove + equity + fold, con tabla de
        sensibilidad ±5/±10% y breakeven F% automático),{' '}
        <span className="font-medium text-content">FE requerida</span> (fold equity que
        necesitas para shovear all-in teniendo en cuenta tu equity: muestra cómo el
        breakeven baja cuando vas con outs en flop o turn),{' '}
        <span className="font-medium text-content">Call vs Raise</span> (enfrentas una
        apuesta en el ríver y comparas pagar vs restear all-in encima, con fold como
        tercera opción si ambas son negativas),{' '}
        <span className="font-medium text-content">Raise sizing</span> (en el flop:
        dimensiona tu raise como % del pot, la conversión inversa a fichas y la equity
        que necesitas para pagar un raise),{' '}
        <span className="font-medium text-content">EV del raise</span> (EV de subir como
        bluff sobre la apuesta del villano, con fold% directo o derivado de combos),{' '}
        <span className="font-medium text-content">Implied Odds</span> (tienes un draw,
        ¿cuánto más necesitas ganarle en futuras calles cuando pegues para que el call sea
        rentable?),{' '}
        <span className="font-medium text-content">EV de flotar</span> (pagar el flop
        para robar el turn dadas las frecuencias de barrel y check-fold del villano),{' '}
        <span className="font-medium text-content">Fold equity combinada</span>{' '}
        (probabilidad de que todos los villanos foldeen en un shove multi-way — útil en
        BTN / SB cuando hay varios por hablar) y{' '}
        <span className="font-medium text-content">Call multi-way</span> (cuando pagas un
        shove preflop y hay jugadores por hablar que pueden coldcallar: modela el split HU
        vs MW con dos equities distintas y muestra tres escenarios HU only / actual / MW
        only). Cada calculadora muestra la fórmula y los valores sustituidos en un bloque
        colapsable, así sigues el cálculo paso a paso.
      </>
    ),
    aPlain:
      'Desde la barra lateral entra a Calculadoras. Tienes diecisiete herramientas: EV básico (EV de una jugada con dos finales: pot, % que esperas ganar y lo que arriesgas), EV con fold equity (semi-bluffs y shoves: F% de fold + showdown EV cuando te pagan), EV de bluff (bluff puro sin equity en showdown — river bluffs y blocker bets — con breakeven F% automático), Doble barrel (EV de la línea completa turn + barrel river: muestra si el conjunto es +EV aunque el bet del turn solo sea −EV), EV multi-calle (encadena el EV de dos calles turn + river ponderando cada cuánto se ve el river), Value / Bluff (cuántos combos de farol puedes tener respecto a tus combos de valor para no desbalancear el rango de apuesta), Check vs Bet (comparación lado a lado de check behind vs apostar el ríver con recomendación y delta de EV), EV de checkear (cuánto rinde checkear juntando check-call si el villano apuesta y check-check si hace check behind), All-in EV (shove preflop sobre la apuesta del villano: pot + call + shove + equity + fold, con tabla de sensibilidad ±5/±10% y breakeven F% automático), FE requerida (fold equity para shovear all-in teniendo en cuenta tu equity: el breakeven baja cuando vas con outs en flop o turn), Call vs Raise (enfrentando una apuesta en el ríver: pagar vs restear all-in encima, con fold como tercera opción), Raise sizing (en el flop: raise como % del pot, conversión inversa a fichas y equity para pagar un raise), EV del raise (EV de subir como bluff sobre la apuesta del villano, con fold% directo o derivado de combos), Implied Odds (tienes un draw, ¿cuánto más necesitas ganarle en futuras calles cuando pegues para que el call sea rentable?), EV de flotar (pagar el flop para robar el turn dadas las frecuencias de barrel y check-fold del villano), Fold equity combinada (probabilidad de que todos los villanos foldeen en un shove multi-way) y Call multi-way (pagar un shove preflop con potenciales overcallers detrás: modela HU vs MW con dos equities distintas y tres escenarios). Cada calculadora muestra la fórmula y los valores sustituidos en un bloque colapsable.',
  },
  {
    q: '¿Cómo analizo una mano que jugué?',
    a: (
      <>
        Entra a{' '}
        <Link to="/analisis" className="font-medium text-accent-light hover:underline">
          Análisis de manos
        </Link>{' '}
        y pega el historial{' '}
        <span className="font-medium text-content">.txt</span> que exporta PokerTracker 4.
        La web lo lee y arma una hoja de estudio: posiciones, stacks, board calle por calle y{' '}
        <span className="font-medium text-content">el pot y la apuesta de cada decisión</span>
        . Por cada jugada agresiva de hero te ofrece un botón{' '}
        <span className="font-medium text-content">Analizar</span> que abre la calculadora
        de EV adecuada —EV de bluff, doble barrel, all-in, call vs raise— ya pre-llenada con
        esos números. Tú solo ingresas la{' '}
        <span className="font-medium text-content">equity o el fold% que sacaste de Flopzilla</span>{' '}
        y la web hace el razonamiento de EV. No reproduce la mano (para eso ya tienes tu
        replayer) ni calcula equity (eso lo hace Flopzilla): lo que aporta es enseñarte qué
        herramienta usar y automatizar el cálculo. Puedes alternar entre fichas y BB y dejar
        tu conclusión escrita.
      </>
    ),
    aPlain:
      'Entra a Análisis de manos y pega el historial .txt que exporta PokerTracker 4. La web lo lee y arma una hoja de estudio: posiciones, stacks, board calle por calle y el pot y la apuesta de cada decisión. Por cada jugada agresiva de hero te ofrece un botón Analizar que abre la calculadora de EV adecuada (EV de bluff, doble barrel, all-in, call vs raise) ya pre-llenada con esos números. Tú solo ingresas la equity o el fold% que sacaste de Flopzilla y la web hace el razonamiento de EV. No reproduce la mano (para eso ya tienes tu replayer) ni calcula equity (eso lo hace Flopzilla): lo que aporta es enseñarte qué herramienta usar y automatizar el cálculo. Puedes alternar entre fichas y BB y dejar tu conclusión escrita.',
  },
  {
    q: '¿Qué ejercicios de práctica hay?',
    a: (
      <>
        En{' '}
        <Link to="/ejercicios" className="font-medium text-accent-light hover:underline">
          Ejercicios
        </Link>{' '}
        hay dos drills de active recall. <span className="font-medium text-content">¿Qué calculadora?</span>:
        te mostramos un spot real —tu mano, el board y la apuesta de la decisión— y eliges
        entre cuatro calculadoras cuál usarías; al responder ves por qué es esa herramienta y
        qué datos traerías de Flopzilla (es el mismo razonamiento de{' '}
        <Link to="/analisis" className="font-medium text-accent-light hover:underline">
          Análisis de manos
        </Link>{' '}
        pero como entrenamiento). <span className="font-medium text-content">Conteo de combos</span>:
        te damos una mano (por ejemplo{' '}
        <span className="font-mono text-content">AK</span>), un board y tus cartas, y cuentas{' '}
        <span className="font-medium text-content">cuántos combos quedan tras los bloqueadores</span>
        ; el feedback descompone base − bloqueados = quedan.{' '}
        <span className="font-medium text-content">Value / Bluff</span>: dado el tamaño de tu
        apuesta y tus combos de valor, eliges cuántos faroles puedes tener para que el rango
        quede balanceado (medio bote ≈ 3:1 valor:farol, pot-size ≈ 2:1, overbet ≈ 1.5:1).{' '}
        <span className="font-medium text-content">Fold equity</span>: dado un bote y tu
        apuesta, el % de fold mínimo para que el bluff sea break-even (auto-profit) — el alpha,
        complemento de la MDF. Los cuatro llevan puntaje, racha y atajos de teclado (1-4 para
        responder, N para avanzar).
      </>
    ),
    aPlain:
      'En Ejercicios hay cuatro drills de active recall. "¿Qué calculadora?": te mostramos un spot real (tu mano, el board y la apuesta de la decisión) y eliges entre cuatro calculadoras cuál usarías; al responder ves por qué es esa herramienta y qué datos traerías de Flopzilla (es el mismo razonamiento de Análisis de manos pero como entrenamiento). "Conteo de combos": te damos una mano (por ejemplo AK), un board y tus cartas, y cuentas cuántos combos quedan tras los bloqueadores; el feedback descompone base − bloqueados = quedan. "Value / Bluff": dado el tamaño de tu apuesta y tus combos de valor, eliges cuántos faroles para balancear el rango (medio bote ≈ 3:1 valor:farol, pot-size ≈ 2:1, overbet ≈ 1.5:1). "Fold equity": dado un bote y tu apuesta, el % de fold mínimo para que el bluff sea break-even (auto-profit), el alpha complemento de la MDF. Los cuatro llevan puntaje, racha y atajos de teclado (1-4 para responder, N para avanzar).',
  },
  {
    q: '¿Puedo contribuir al proyecto?',
    a: 'Si te resulta útil puedes dejar una propina en BTC desde la sección de abajo — cualquier monto suma y ayuda a mantener el proyecto vivo. Reportes de bugs y sugerencias también son bienvenidos.',
  },
];

type Shortcut = { keys: string; desc: string };

const SHORTCUTS: readonly Shortcut[] = [
  { keys: '1 – 9', desc: 'Entrenador · selecciona acción / Editor · pincel rápido' },
  { keys: 'Enter / Space / N', desc: 'Entrenador Clásico · siguiente mano (también auto en 1.5 s)' },
  { keys: 'S', desc: 'Entrenador Clásico · saltear mano' },
  { keys: 'Ctrl + Z / Ctrl + Y', desc: 'Editor · Undo / Redo' },
  { keys: 'Ctrl + RightClick', desc: 'Editor / Trainer · Hand+ expansion (ej. 88+ pinta 88, 99, TT…)' },
  { keys: 'RightClick', desc: 'Editor · borra la celda activa' },
];

export default function HomePage() {
  useDocumentTitle('Range Soprano · Estudio de rangos preflop de poker');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-faq-jsonld', '');
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.aPlain ?? (typeof f.a === 'string' ? f.a : ''),
        },
      })),
    });
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  const onCopyBtc = async () => {
    const ok = await copyToClipboard(BTC_ADDRESS);
    if (ok) {
      setCopied(true);
      pushToast({ kind: 'success', message: 'Dirección BTC copiada' });
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      pushToast({ kind: 'error', message: 'No se pudo copiar la dirección' });
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Range Soprano"
        title="Herramienta de estudio de rangos preflop"
        description="Visualiza, entrena y edita tus rangos en mesa 6-max o Heads-Up con paletas personalizables, comparación, exportación a PNG/PDF y entrenador con leaderboard local. Incluye calculadoras de EV, un módulo para analizar las manos que jugaste (importando el historial .txt de tu sala: iPoker, GGPoker, PokerStars o Winamax) y ejercicios para entrenar qué herramienta usar en cada spot. Cronómetro de sesión, randomizador para frecuencias mixtas y ventana flotante siempre-encima. Todo corre en tu navegador y los datos son tuyos."
        descriptionClassName="text-justify"
        actions={
          <ImportProfileButton
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface/60 px-3 py-1.5 text-sm font-medium text-content-muted shadow-sm transition-colors hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
            label="Importar perfil (.json)"
          />
        }
      />

      <section aria-labelledby="modules-heading" className="flex flex-col gap-4">
        <h2
          id="modules-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted"
        >
          Módulos
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {MODULES.map((m) => (
            <ModuleCardView key={m.to} card={m} />
          ))}
        </div>
      </section>

      <section aria-labelledby="what-heading" className="flex flex-col gap-3">
        <h2
          id="what-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted"
        >
          ¿Qué es un rango preflop?
        </h2>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 text-sm text-content-muted">
          <p>
            Un <span className="font-medium text-content">rango de poker preflop</span> es
            el conjunto de manos que decides jugar desde una posición
            específica antes del flop. En lugar de decidir mano a mano, defines un rango
            y lo aplicas de forma consistente: por ejemplo, abrir desde el botón con un
            rango más amplio que desde UTG, o defender la BB contra un raise con una mezcla
            de calls y 3-bets.
          </p>
          <p>
            Range Soprano es una{' '}
            <span className="font-medium text-content">herramienta gratis para el estudio de rangos de poker</span>
            {' '}que te permite visualizarlos sobre la grilla 13×13 estándar (pares en la
            diagonal, suited arriba, offsuit abajo) con{' '}
            <span className="font-medium text-content">frecuencias mixtas</span>: una misma
            mano puede ir 70% raise + 30% call, sumando hasta 100% por celda. Ideal para
            estudiar rangos de cash 6-max, MTTs y Heads-Up.
          </p>
        </div>
      </section>

      <section aria-labelledby="howto-heading" className="flex flex-col gap-3">
        <h2
          id="howto-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted"
        >
          Cómo estudiar rangos de poker con Range Soprano
        </h2>
        <ol className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-sm">
          <li className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 shrink-0 text-content-muted">
              <Pencil className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="text-content-muted">
              <span className="font-medium text-content">1. Crear o importar tus rangos</span>
              {' — '}armá tu primer rango desde el{' '}
              <Link to="/editor" className="font-medium text-accent-light hover:underline">
                Editor
              </Link>
              {' '}pintando celdas con la paleta de acciones y ajustando pesos con el
              slider. También puedes{' '}
              <span className="font-medium text-content">pegar texto desde GTOWizard, Flopzilla, GTObase</span>
              {' '}u otras tools de poker: Range Soprano entiende el formato estándar
              (ej.{' '}
              <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">
                22+,A2s+,KTs+,QJs,A5o+,KQo
              </code>
              ) con expansiones{' '}
              <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">+</code>
              , rangos{' '}
              <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">A5s-A2s</code>
              {' '}y pesos{' '}
              <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">[50%]AKs[/50%]</code>
              ; y también el formato combo-por-combo de GTOWizard (
              <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">
                AcKs: 0.78, AdKc: 1, ...
              </code>
              ) con frecuencias mixtas exactas. O importa tu perfil completo en{' '}
              <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">.json</code>
              {' '}desde la sección{' '}
              <span className="font-medium text-content">Guardar y portabilidad</span>.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 shrink-0 text-content-muted">
              <Eye className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="text-content-muted">
              <span className="font-medium text-content">2. Repasar en el Visualizador</span>
              {' — '}usa la vista{' '}
              <span className="font-medium text-content">Individual</span> para revisar un rango,{' '}
              <span className="font-medium text-content">Comparar</span> para comparar dos
              en paralelo (ej. abrir vs defender) o{' '}
              <span className="font-medium text-content">Resumen</span> para ver el mosaico
              completo de tus carpetas.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 shrink-0 text-content-muted">
              <Target className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="text-content-muted">
              <span className="font-medium text-content">3. Memorizar con el Entrenador</span>
              {' — '}entrena la decisión preflop con el modo{' '}
              <span className="font-medium text-content">Clásico</span> (precisión),{' '}
              <span className="font-medium text-content">Velocidad</span> (contrarreloj
              con tabla de líderes local) o{' '}
              <span className="font-medium text-content">Dibujo</span> (pinta el rango de
              memoria y compara con la verdad). Las tres modalidades sobre mesa 6-max o HU.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 shrink-0 text-content-muted">
              <Download className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="text-content-muted">
              <span className="font-medium text-content">4. Imprimir o exportar</span>
              {' — '}genera un PDF imprimible con varios rangos por hoja para estudio
              offline, o exporta una imagen PNG individual para compartir en foros y
              Discord.
            </div>
          </li>
        </ol>
      </section>

      <section aria-labelledby="analysis-heading" className="flex flex-col gap-3">
        <h2
          id="analysis-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted"
        >
          Análisis de manos jugadas
        </h2>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 text-sm text-content-muted">
          <p>
            Pega el <span className="font-medium text-content">historial .txt</span> de
            una mano que jugaste —la herramienta lee los formatos de{' '}
            <span className="font-medium text-content">
              iPoker, GGPoker, PokerStars y Winamax
            </span>
            — y Range Soprano extrae el spot (board, bote y apuesta de cada calle) y abre la{' '}
            <Link to="/calculadoras" className="font-medium text-accent-light hover:underline">
              calculadora de EV
            </Link>{' '}
            adecuada, ya cargada con los números. Solo agregas la equity que obtienes en
            Flopzilla.
          </p>
          <p>
            Es ideal para revisar si un bluff, un barrel o un call fue rentable a largo
            plazo, sin volver a escribir los datos a mano. No reemplaza tu replayer ni a
            Flopzilla: automatiza el cálculo y te enseña qué herramienta usar en cada spot.
          </p>
          <div>
            <Link
              to="/analisis"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-accent-light hover:bg-surface-hover hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
            >
              Abrir Análisis de manos
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="potodds-heading" className="flex flex-col gap-3">
        <h2
          id="potodds-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted"
        >
          Pot odds — matemática esencial
        </h2>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 text-sm text-content-muted">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent"
            >
              <Percent className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <p>
              Saber qué manos van en cada rango no es suficiente: en mesa también
              necesitas saber <span className="font-medium text-content">cuándo apostar es rentable</span> y{' '}
              <span className="font-medium text-content">hasta qué tamaño puedes pagar</span> con tu equity.
              Esa matemática se llama <span className="font-medium text-content">pot odds</span> y se resume en dos tablas
              clásicas que conviene tener internalizadas.
            </p>
          </div>

          <ul className="grid gap-2 sm:grid-cols-2">
            <li className="rounded-md border border-border bg-bg p-3">
              <p className="font-medium text-content">Cuando tú apuestas (bluff)</p>
              <p className="text-xs">
                Tu apuesta necesita éxito X% del tiempo:{' '}
                <code className="font-mono text-content">bet / (pot + bet)</code>.
                Ej. <span className="font-medium text-content">1/2 pot → 33%</span>,{' '}
                <span className="font-medium text-content">pot-size → 50%</span>,{' '}
                <span className="font-medium text-content">2x pot → 66%</span>.
              </p>
            </li>
            <li className="rounded-md border border-border bg-bg p-3">
              <p className="font-medium text-content">Cuando villano apuesta (call)</p>
              <p className="text-xs">
                Pagar requiere tener X% de equity:{' '}
                <code className="font-mono text-content">bet / (pot + 2·bet)</code>.
                Ej. <span className="font-medium text-content">vs 1/2 → 25%</span>,{' '}
                <span className="font-medium text-content">vs pot-size → 33%</span>,{' '}
                <span className="font-medium text-content">vs 2x → 40%</span>.
              </p>
            </li>
          </ul>

          <p>
            Range Soprano incluye un trainer de pot odds en{' '}
            <Link to="/trainer" className="font-medium text-accent-light hover:underline">
              Trainer → tab Odds
            </Link>
            : cuatro tipos de pregunta (fold equity al apostar, equity al pagar, y
            las inversas — qué tamaño apostar / hasta qué bet puedes pagar) con
            multiple choice de 4 opciones, atajos{' '}
            <kbd className="rounded border border-border bg-bg px-1 py-0.5 font-mono text-[10px] text-content">
              1
            </kbd>
            –
            <kbd className="rounded border border-border bg-bg px-1 py-0.5 font-mono text-[10px] text-content">
              4
            </kbd>{' '}
            y feedback con la fórmula resuelta. No requiere tener rangos cargados.
          </p>
        </div>
      </section>

      <section aria-labelledby="randomizer-heading" className="flex flex-col gap-3">
        <h2
          id="randomizer-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted"
        >
          Randomizador — mixed strategies en mesa
        </h2>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 text-sm text-content-muted">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent"
            >
              <Dices className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <p>
              Cuando juegas con frecuencias mixtas (ej. AKo va{' '}
              <span className="font-medium text-content">50% raise / 50% call</span>), la
              ejecución correcta requiere un dado: tiras un número del 1 al 100 y
              decides según ese valor. Range Soprano trae un{' '}
              <span className="font-medium text-content">randomizador integrado</span>{' '}
              en el{' '}
              <Link to="/viewer" className="font-medium text-accent-light hover:underline">
                Visualizador → Resumen
              </Link>
              {' '}para que tomes la decisión sin salir de la app mientras estudias.
            </p>
          </div>

          <ol className="flex flex-col gap-2">
            <li>
              <span className="font-medium text-content">1. Configurá tus presets.</span>{' '}
              Cuatro botones editables (default{' '}
              <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">
                60/40 · 50/50 · 25/75 · 10/90
              </code>
              ) que representan los splits más comunes de tus rangos. La etiqueta se
              autogenera al cambiar el valor (valor 25 → "25/75").
            </li>
            <li>
              <span className="font-medium text-content">2. Tira.</span> Botón{' '}
              <span className="font-medium text-content">Tirar</span> o tecla{' '}
              <kbd className="rounded border border-border bg-bg px-1 py-0.5 font-mono text-[10px] text-content">
                Espacio
              </kbd>{' '}
              te dan un número del 1 al 100. Los presets cuyo valor cubre el roll se
              iluminan en verde para que leas la decisión de un vistazo (el botón{' '}
              <kbd className="rounded border border-border bg-bg px-1 py-0.5 font-mono text-[10px] text-content">
                👁
              </kbd>{' '}
              alterna ese resaltado si solo quieres ver el número).
            </li>
            <li>
              <span className="font-medium text-content">3. Auto opcional.</span>{' '}
              Activa el modo automático con{' '}
              <kbd className="rounded border border-border bg-bg px-1 py-0.5 font-mono text-[10px] text-content">
                A
              </kbd>{' '}
              y el randomizador genera un nuevo número cada{' '}
              <span className="font-medium text-content">0.5 / 1 / 2 / 5 s</span> (config en
              el ⚙).
            </li>
            <li>
              <span className="font-medium text-content">4. Tres sets guardados.</span>{' '}
              Cambiá entre{' '}
              <span className="font-medium text-content">Set 1 · Set 2 · Set 3</span>{' '}
              para tener varias configuraciones (ej. uno para SnG con frecuencias
              típicas de push/fold y otro para cash 6-max).
            </li>
          </ol>

          <p className="text-xs">
            La configuración se guarda automáticamente y viaja en el{' '}
            <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">
              .json
            </code>{' '}
            cuando exportas tu perfil completo: al importarlo en otro dispositivo
            recuperas tus presets, sets y frecuencia tal como los dejaste.
          </p>
        </div>
      </section>

      <section aria-labelledby="chrono-heading" className="flex flex-col gap-3">
        <h2
          id="chrono-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted"
        >
          Cronómetro de sesión — trackear tu tiempo de juego
        </h2>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 text-sm text-content-muted">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent"
            >
              <Timer className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <p>
              Profesionalizar el estudio y el juego de poker arranca por saber
              cuánto tiempo realmente pasas en mesa. Range Soprano incluye un{' '}
              <span className="font-medium text-content">
                cronómetro de sesión integrado
              </span>{' '}
              en el{' '}
              <Link to="/viewer" className="font-medium text-accent-light hover:underline">
                Visualizador → Resumen
              </Link>{' '}
              con horas, minutos, segundos y centisegundos. Empiezas con Play,
              marcas cada sesión con la bandera, y al final tienes la lista
              completa de cuánto duró cada una.
            </p>
          </div>

          <p>
            <span className="font-medium text-content">
              Pausa-aware: el descanso entre sesiones no cuenta.
            </span>{' '}
            Si juegas una hora, te tomas 15 minutos de descanso (y pausas el
            cronómetro), después juegas otra hora, la siguiente vuelta solo
            cuenta los 60 minutos de juego — el descanso queda excluido
            automáticamente. Esto te da la duración{' '}
            <span className="font-medium text-content">efectiva</span> de cada
            sesión, no el tiempo total transcurrido.
          </p>

          <ol className="flex flex-col gap-2">
            <li>
              <span className="font-medium text-content">1. Play.</span>{' '}
              Botón ▶ arranca el cronómetro al sentarte en la mesa.
            </li>
            <li>
              <span className="font-medium text-content">2. Bandera 🚩 al fin de cada sesión.</span>{' '}
              Guarda la duración como vuelta numerada y dispara un toast con
              el tiempo. La lista no se abre sola para no desplazar layout.
            </li>
            <li>
              <span className="font-medium text-content">3. Pausa durante el descanso.</span>{' '}
              Apretá ⏸ cuando te levantas de la mesa. Al volver, ▶ retoma
              donde quedaste.
            </li>
            <li>
              <span className="font-medium text-content">4. Vueltas en panel desplegable.</span>{' '}
              El botón "N vueltas ↕" abre un panel absoluto con cada sesión
              (delta + total). No empuja contenido hacia abajo.
            </li>
            <li>
              <span className="font-medium text-content">5. Reset al final del día.</span>{' '}
              ↺ limpia todo y empiezas de cero la próxima jornada.
            </li>
          </ol>

          <p className="text-xs">
            El estado persiste en localStorage: si recargas la página o cierras
            el navegador con el cronómetro corriendo, al volver retoma con el
            offset correcto basado en{' '}
            <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">
              Date.now()
            </code>
            . Hasta 50 vueltas guardadas por sesión.
          </p>
        </div>
      </section>

      <section aria-labelledby="floating-heading" className="flex flex-col gap-3">
        <h2
          id="floating-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted"
        >
          Ventana flotante — tools siempre encima del cliente de poker
        </h2>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 text-sm text-content-muted">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent"
            >
              <PictureInPicture2 className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <p>
              Cuando juegas en{' '}
              <span className="font-medium text-content">
                PokerStars, GG, WPT Global, ACR, PartyPoker
              </span>{' '}
              o cualquier otra mesa real, hacer Alt+Tab para mirar la web rompe
              el flow. Range Soprano te permite{' '}
              <span className="font-medium text-content">
                sacar el cronómetro y el randomizador en una ventana flotante
              </span>{' '}
              del sistema operativo que queda{' '}
              <span className="font-medium text-content">siempre encima</span>{' '}
              del cliente de poker. Vía la API web nativa de{' '}
              <span className="font-medium text-content">
                Document Picture-in-Picture
              </span>{' '}
              — sin instalar nada.
            </p>
          </div>

          <ol className="flex flex-col gap-2">
            <li>
              <span className="font-medium text-content">1. Click en el icono ⊡.</span>{' '}
              Está arriba a la derecha del cluster de tools en{' '}
              <Link to="/viewer" className="font-medium text-accent-light hover:underline">
                Visualizador → Resumen
              </Link>
              .
            </li>
            <li>
              <span className="font-medium text-content">2. Ventana flotante 460×340.</span>{' '}
              Aparece con el cronómetro arriba y el randomizador abajo,
              redimensionable arrastrando los bordes. Llevala donde quieras
              en tu monitor.
            </li>
            <li>
              <span className="font-medium text-content">3. Estado sincronizado.</span>{' '}
              Tirar en la flotante también queda registrado en la pestaña;
              play/pausa/bandera del cronómetro idem. Es el mismo store —
              dos vistas del mismo estado.
            </li>
            <li>
              <span className="font-medium text-content">4. Volver a la página.</span>{' '}
              Cerrá con la X del SO, click en "Volver a la página" dentro de
              la ventana, o click en el pill "En ventana flotante · Volver"
              del header — los cards vuelven a su sitio en la pestaña.
            </li>
          </ol>

          <div className="flex flex-col gap-1 rounded-md border border-border bg-bg p-3 text-xs">
            <p className="font-medium text-content">Soporte de navegador</p>
            <ul className="flex flex-col gap-0.5">
              <li>
                <span className="font-medium text-success">✓ Always-on-top real</span>{' '}
                en Chrome 116+, Edge, Brave y Opera (Document
                Picture-in-Picture API).
              </li>
              <li>
                <span className="font-medium text-content">~ Fallback</span> en
                Firefox y Safari: ventana normal del browser, redimensionable
                pero no siempre-encima. El tooltip del botón lo aclara.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="shortcuts-heading" className="flex flex-col gap-3">
        <h2
          id="shortcuts-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted"
        >
          Atajos de teclado
        </h2>
        <ul className="grid gap-2 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-baseline gap-3 text-sm">
              <kbd className="shrink-0 rounded border border-border bg-bg px-2 py-0.5 font-mono text-[11px] text-content">
                {s.keys}
              </kbd>
              <span className="text-content-muted">{s.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="organize-heading" className="flex flex-col gap-3">
        <h2
          id="organize-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted"
        >
          Organizar rangos
        </h2>
        <ul className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-sm">
          <li className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 shrink-0 text-content-muted">
              <FolderOpen className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="text-content-muted">
              <span className="font-medium text-content">Crear una carpeta</span>
              {' — '}una carpeta nace al asignarle un grupo a un rango. Clic en{' '}
              <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px] text-content">
                ···
              </kbd>{' '}
              junto al rango → <span className="font-medium text-content">Mover a grupo…</span> → escribe el
              nombre de la carpeta (ej.{' '}
              <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">Opening</code>) y Enter.
              Ojo: el campo <span className="font-medium text-content">Nombre</span> al crear un rango es el nombre del rango, no
              de la carpeta.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 shrink-0 text-content-muted">
              <FolderOpen className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="text-content-muted">
              <span className="font-medium text-content">Sub-carpetas</span>
              {' — '}usa{' '}
              <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">/</code>{' '}
              en el mismo campo de grupo. Ej.{' '}
              <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">
                Preflop/Opening
              </code>{' '}
              crea o reutiliza la carpeta{' '}
              <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">Preflop</code> y dentro la
              sub-carpeta{' '}
              <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">Opening</code>.{' '}
              También puedes mover una carpeta ya existente dentro de otra desde el panel
              de doble click (ver abajo).
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 shrink-0 text-content-muted">
              <FolderInput className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="text-content-muted">
              <span className="font-medium text-content">Mover un rango</span>
              {' — '}mismo flujo: clic en{' '}
              <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px] text-content">
                ···
              </kbd>{' '}
              → <span className="font-medium text-content">Mover a grupo…</span> → escribe otro nombre (con autocompletado) o
              deja vacío para sacarlo de toda carpeta.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 shrink-0 text-content-muted">
              <Pencil className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="text-content-muted">
              <span className="font-medium text-content">Renombrar o mover carpeta</span>
              {' — '}
              <span className="font-medium text-content">doble click</span> sobre el nombre
              de la carpeta en la barra lateral. Se abre un panel con dos campos:{' '}
              <span className="font-medium text-content">Carpeta padre</span> (elige del
              dropdown para moverla dentro de otra, o{' '}
              <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">
                — Sin padre (raíz) —
              </code>{' '}
              para sacarla afuera) y{' '}
              <span className="font-medium text-content">Nombre</span>. Una línea{' '}
              <span className="font-mono text-content">Resultado:</span> en vivo te muestra
              el path final antes de guardar.
            </div>
          </li>
        </ul>
      </section>

      <section aria-labelledby="portability-heading" className="flex flex-col gap-3">
        <h2
          id="portability-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted"
        >
          Guardar y portabilidad
        </h2>
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
          <p className="text-sm text-content-muted">
            Tus rangos se guardan automáticamente en{' '}
            <span className="font-mono text-content">localStorage</span> (cap 3.8 MB, suficiente
            para ~100 rangos completos).
            Si quieres moverlos a otro dispositivo, exporta un archivo JSON y vuelve a
            importarlo desde aquí.
          </p>

          <ol className="flex flex-col gap-3 text-sm">
            <Step
              icon={Save}
              title="Autoguardado"
              body="Cada cambio en el Editor persiste solo. No hace falta cuenta ni login."
            />
            <Step
              icon={Download}
              title="Exportar perfil completo"
              body={
                <>
                  Descarga un .json con todos tus rangos para hacer backup o moverlos
                  de dispositivo:
                  <ol className="mt-1 list-decimal pl-5 text-content-muted">
                    <li>
                      Ve al <Link to="/editor" className="font-medium text-accent-light hover:underline">Editor</Link>.
                    </li>
                    <li>
                      Abre el menú <span className="font-medium text-content">Export</span> en la barra superior.
                    </li>
                    <li>
                      Elige <span className="font-medium text-content">Download all ranges JSON</span> y guarda el
                      archivo donde quieras (Dropbox, Google Drive, pendrive).
                    </li>
                  </ol>
                </>
              }
            />
            <Step
              icon={ArrowRight}
              title="Importar perfil completo"
              body={
                <>
                  Sube el mismo .json en cualquier dispositivo y recuperas todos tus
                  rangos:
                  <ol className="mt-1 list-decimal pl-5 text-content-muted">
                    <li>
                      Toca el botón{' '}
                      <span className="font-medium text-content">
                        Importar perfil completo
                      </span>{' '}
                      aquí abajo.
                    </li>
                    <li>Elige el archivo .json que exportaste antes.</li>
                    <li>
                      Los rangos se suman a los actuales (no se pisa nada). Cap 3.8 MB
                      por archivo (~100 rangos).
                    </li>
                  </ol>
                </>
              }
            />
          </ol>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <ImportProfileButton />
            <Link
              to="/editor"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
            >
              Ir al Editor para exportar
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="faq-heading" className="flex flex-col gap-3">
        <h2
          id="faq-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted"
        >
          Preguntas frecuentes
        </h2>
        <ul className="flex flex-col gap-2">
          {FAQS.map((f) => (
            <li key={f.q}>
              <details className="group rounded-lg border border-border bg-surface open:bg-surface-hover">
                <summary className="flex cursor-pointer list-none items-start gap-3 rounded-lg px-4 py-3 text-sm font-medium text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light">
                  <span aria-hidden className="mt-0.5 shrink-0 text-accent-light">
                    <HelpCircle className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                  <span className="flex-1">{f.q}</span>
                  <span
                    aria-hidden
                    className="mt-0.5 shrink-0 text-content-muted transition-transform group-open:rotate-180"
                  >
                    <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                </summary>
                <div className="px-4 pb-4 pl-11 text-sm text-content-muted">
                  {f.a}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="donate-heading" className="flex flex-col gap-3">
        <h2
          id="donate-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted"
        >
          Apoya el proyecto
        </h2>
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent"
            >
              <Bitcoin className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <p className="text-sm text-content-muted">
              Range Soprano es gratis. Si te resulta útil puedes dejar una propina en
              BTC — cualquier monto suma.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-5 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-2 self-center sm:self-start">
              <div
                className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-border"
                aria-label="Código QR de la dirección Bitcoin"
              >
                <QRCodeSVG
                  value={`bitcoin:${BTC_ADDRESS}`}
                  size={140}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#000000"
                  marginSize={0}
                />
              </div>
              <p className="text-[11px] text-content-muted">
                Escaneá con tu billetera
              </p>
            </div>

            <div className="flex flex-1 flex-col gap-2 sm:min-w-0">
              <code
                className="select-all break-all rounded-md border border-border bg-bg px-3 py-2 font-mono text-xs text-content"
                aria-label="Dirección Bitcoin"
              >
                {BTC_ADDRESS}
              </code>
              <button
                type="button"
                onClick={onCopyBtc}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-content hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light sm:self-start"
                aria-label="Copiar dirección Bitcoin"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Copiar
                  </>
                )}
              </button>

              {(() => {
                const pct = Math.min(
                  100,
                  Math.round((DONATION_RECEIVED_USD / DONATION_GOAL_USD) * 100),
                );
                return (
                  <div className="mt-1 flex flex-col gap-2 rounded-md border border-border bg-bg/40 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">
                        Meta {DONATION_YEAR}
                      </span>
                      <span className="font-mono text-sm tabular-nums text-content">
                        ${DONATION_RECEIVED_USD.toFixed(2)}{' '}
                        <span className="text-content-muted">/ ${DONATION_GOAL_USD}</span>{' '}
                        <span className="text-accent-light">({pct}%)</span>
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`Donaciones recibidas: ${pct}% de $${DONATION_GOAL_USD}`}
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-2 overflow-hidden rounded-full bg-surface"
                    >
                      <div
                        className="h-full bg-accent transition-[width] duration-500 ease-out"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[11px] leading-relaxed text-content-muted">
                      Range Soprano corre sobre dominio + servicios (~$15/año) y se
                      desarrolla con asistencia de Claude (suscripción mensual
                      recurrente). Toda contribución ayuda a bancar las próximas
                      mejoras y que siga gratis.{' '}
                      <span className="font-mono text-content">
                        {DONATION_RECEIVED_BTC.toFixed(8)} BTC
                      </span>{' '}
                      recibidos —{' '}
                      <a
                        href={`https://blockchain.com/explorer/addresses/btc/${BTC_ADDRESS}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent-light underline-offset-2 hover:underline"
                      >
                        verificar
                      </a>
                      .
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ModuleCardView({ card }: { card: ModuleCard }) {
  const Icon = card.icon;
  return (
    <Link
      to={card.to}
      className="group flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 transition-colors hover:border-accent/40 hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
    >
      <div className="flex items-center justify-between">
        <span
          aria-hidden
          className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent"
        >
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <code className="font-mono text-[11px] text-content-muted">
          {card.command}
        </code>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-content">{card.label}</h3>
        <p className="text-sm text-content-muted">{card.description}</p>
      </div>
      <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-accent-light opacity-0 transition-opacity group-hover:opacity-100">
        Abrir
        <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
      </span>
    </Link>
  );
}

function Step({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-accent/10 text-accent-light"
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-content">{title}</span>
        <span className="text-content-muted">{body}</span>
      </div>
    </li>
  );
}
