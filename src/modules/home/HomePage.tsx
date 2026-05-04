import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  ArrowRight,
  Bitcoin,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FolderInput,
  FolderOpen,
  HelpCircle,
  Pencil,
  Percent,
  Save,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { PageHeader } from '@/components/ui/PageHeader';
import { copyToClipboard } from '@/utils/exportRange';
import { pushToast } from '@/store/toastStore';
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
      'Tres vistas: Individual, Comparar (dos rangos en paralelo) y Resumen (mosaico de carpetas). Filtrá por posición, situación, villano y acción. Exportá a PNG o imprimí varias hojas a PDF con leyenda y etiquetas de stack/sizing.',
  },
  {
    to: '/trainer',
    command: '/trainer',
    label: 'Entrenador',
    icon: Target,
    description:
      'Entrená manos en mesa 6-max o Heads-Up. Modos Clásico (auto-avance 1.5 s), Velocidad (contrarreloj con tabla de líderes local), Dibujo (pintar el rango de memoria) y Pot Odds (fold equity al apostar y equity al pagar, con MC y fórmula explicada). Filtros por posición, situación y villano.',
  },
  {
    to: '/editor',
    command: '/editor',
    label: 'Editor',
    icon: Pencil,
    description:
      'Creá y editá rangos con paleta de acciones por rango, pesos mixtos, notas, deshacer/rehacer, carpetas y sub-carpetas. Importá/exportá rangos individuales o el perfil completo.',
  },
];

type Faq = { q: string; a: React.ReactNode; aPlain?: string };

const FAQS: readonly Faq[] = [
  {
    q: '¿Qué es Range Soprano?',
    a: 'Una herramienta web gratis para estudiar rangos preflop. Tres módulos: Visualizador, Entrenador, Editor. Pensada para repasar, memorizar y comparar tus propios rangos (o copiados de un libro/solver) en mesa 6-max o Heads-Up.',
  },
  {
    q: '¿Por qué no hay login ni cuenta?',
    a: 'Tus datos viven sólo en tu navegador (localStorage). No subimos nada a ningún servidor → cero cuentas, cero contraseñas, cero tracking. Si querés mover los rangos a otro dispositivo usás export/import .json.',
  },
  {
    q: '¿Qué es un archivo .json y para qué lo uso?',
    a: (
      <>
        Es un archivo de texto con todos tus rangos serializados. Lo descargás
        desde <span className="font-medium text-content">Editor → Export → Download all ranges JSON</span>{' '}
        y lo guardás donde quieras (Drive, Dropbox, pendrive). En otra PC o en
        el celular lo importás desde <span className="font-medium text-content">Home → Importar perfil completo</span>{' '}
        y recuperás todo.
      </>
    ),
    aPlain:
      'Es un archivo de texto con todos tus rangos serializados. Lo descargás desde Editor → Export → Download all ranges JSON y lo guardás donde quieras (Drive, Dropbox, pendrive). En otra PC o en el celular lo importás desde Home → Importar perfil completo y recuperás todo.',
  },
  {
    q: '¿Mis rangos se borran si limpio el navegador?',
    a: 'Sí. localStorage muere si limpiás caché/datos del sitio o usás navegación privada. Hacé backup periódico exportando el .json — es la única copia que tenés.',
  },
  {
    q: '¿Cuántos rangos puedo guardar?',
    a: 'Hasta ~3.8 MB en localStorage (≈100 rangos llenos). Si te queda corto exportá unos a .json y borralos del store.',
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
        <span className="font-medium text-content">Imprimir PDF</span>. Configurá rangos por
        página, etiquetas (stack/sizing), leyenda y badge de formato. Después usá
        <span className="font-medium text-content"> Print / Save as PDF</span> del navegador.
      </>
    ),
    aPlain:
      'En el Visualizador, pestaña Resumen, botón Imprimir PDF. Configurá rangos por página, etiquetas (stack/sizing), leyenda y badge de formato. Después usá Print / Save as PDF del navegador.',
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
        cuánta fold equity necesitás cuando bluffeás, qué equity necesitás para
        pagar, y las dos inversas (qué tamaño apostar dado un % de fold equity y
        hasta qué tamaño podés pagar dado un % de equity). Multiple choice de 4
        opciones con feedback que muestra la fórmula resuelta. No depende de
        tener rangos cargados, podés practicar incluso desde un perfil vacío.
      </>
    ),
    aPlain:
      'Sí. El Entrenador tiene una pestaña Pot Odds con cuatro tipos de pregunta sobre pot odds: cuánta fold equity necesitás cuando bluffeás, qué equity necesitás para pagar, y las dos inversas (qué tamaño apostar dado un % de fold equity y hasta qué tamaño podés pagar dado un % de equity). Multiple choice de 4 opciones con feedback que muestra la fórmula resuelta. No depende de tener rangos cargados, podés practicar incluso desde un perfil vacío.',
  },
  {
    q: '¿Puedo contribuir al proyecto?',
    a: 'Si te resulta útil podés dejar una propina en BTC desde la sección de abajo — cualquier monto suma y ayuda a mantener el proyecto vivo. Reportes de bugs y sugerencias también son bienvenidos.',
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
        description="Visualizá, entrená y editá tus rangos en mesa 6-max o Heads-Up con paletas de acciones personalizables, comparación, exportación a PNG/PDF y entrenador con leaderboard local. Todo corre en tu navegador y vos sos dueño de los datos."
      />

      <section aria-labelledby="modules-heading" className="flex flex-col gap-4">
        <h2
          id="modules-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted"
        >
          Módulos
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            el conjunto de manos que decidís jugar desde una posición
            específica antes del flop. En lugar de decidir mano a mano, definís un rango
            y lo aplicás de forma consistente: por ejemplo, abrir desde el botón con un
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
              slider. También podés{' '}
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
              ) con frecuencias mixtas exactas. O importá tu perfil completo en{' '}
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
              {' — '}usá la vista{' '}
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
              {' — '}entrená la decisión preflop con el modo{' '}
              <span className="font-medium text-content">Clásico</span> (precisión),{' '}
              <span className="font-medium text-content">Velocidad</span> (contrarreloj
              con tabla de líderes local) o{' '}
              <span className="font-medium text-content">Dibujo</span> (pintá el rango de
              memoria y compará con la verdad). Las tres modalidades sobre mesa 6-max o HU.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 shrink-0 text-content-muted">
              <Download className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="text-content-muted">
              <span className="font-medium text-content">4. Imprimir o exportar</span>
              {' — '}generá un PDF imprimible con varios rangos por hoja para estudio
              offline, o exportá una imagen PNG individual para compartir en foros y
              Discord.
            </div>
          </li>
        </ol>
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
              necesitás saber <span className="font-medium text-content">cuándo apostar es rentable</span> y{' '}
              <span className="font-medium text-content">hasta qué tamaño podés pagar</span> con tu equity.
              Esa matemática se llama <span className="font-medium text-content">pot odds</span> y se resume en dos tablas
              clásicas que conviene tener internalizadas.
            </p>
          </div>

          <ul className="grid gap-2 sm:grid-cols-2">
            <li className="rounded-md border border-border bg-bg p-3">
              <p className="font-medium text-content">Cuando vos apostás (bluff)</p>
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
            las inversas — qué tamaño apostar / hasta qué bet podés pagar) con
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
              junto al rango → <span className="font-medium text-content">Mover a grupo…</span> → escribí el
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
              {' — '}usá{' '}
              <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">/</code>{' '}
              en el mismo campo de grupo. Ej.{' '}
              <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">
                Preflop/Opening
              </code>{' '}
              crea o reutiliza la carpeta{' '}
              <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">Preflop</code> y dentro la
              sub-carpeta{' '}
              <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">Opening</code>.
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
              → <span className="font-medium text-content">Mover a grupo…</span> → escribí otro nombre (con autocompletado) o
              dejá vacío para sacarlo de toda carpeta.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 shrink-0 text-content-muted">
              <Pencil className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="text-content-muted">
              <span className="font-medium text-content">Renombrar o mover carpeta</span>
              {' — '}clic en{' '}
              <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px] text-content">
                ···
              </kbd>{' '}
              en el header de carpeta →{' '}
              <span className="font-medium text-content">Renombrar carpeta…</span>.{' '}
              Tip: renombrá{' '}
              <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">Opening</code>
              {' → '}
              <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-content">
                Preflop/Opening
              </code>{' '}
              para moverla dentro de Preflop.
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
            Si querés moverlos a otro dispositivo, exportá un archivo JSON y volvé a
            importarlo desde acá.
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
                  Descargá un .json con todos tus rangos para hacer backup o moverlos
                  de dispositivo:
                  <ol className="mt-1 list-decimal pl-5 text-content-muted">
                    <li>
                      Andá al <Link to="/editor" className="font-medium text-accent-light hover:underline">Editor</Link>.
                    </li>
                    <li>
                      Abrí el menú <span className="font-medium text-content">Export</span> en la barra superior.
                    </li>
                    <li>
                      Elegí <span className="font-medium text-content">Download all ranges JSON</span> y guardá el
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
                  Subí el mismo .json en cualquier dispositivo y recuperás todos tus
                  rangos:
                  <ol className="mt-1 list-decimal pl-5 text-content-muted">
                    <li>
                      Tocá el botón{' '}
                      <span className="font-medium text-content">
                        Importar perfil completo
                      </span>{' '}
                      acá abajo.
                    </li>
                    <li>Elegí el archivo .json que exportaste antes.</li>
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
              Range Soprano es gratis. Si te resulta útil podés dejar una propina en
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
