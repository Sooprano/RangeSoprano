import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PageHeader } from '@/components/ui/PageHeader';
import { WhichCalcDrill } from './WhichCalcDrill';

export default function WorkbookPage() {
  useDocumentTitle('Ejercicios de poker · Range Soprano', {
    description:
      'Practica elegir la calculadora de EV correcta para cada spot postflop. Te mostramos una mano real (board, bote y apuesta) y eliges la herramienta adecuada, con explicación. Sin login, sin tracking.',
    canonical: 'https://rangesoprano.com/ejercicios/',
  });

  return (
    <>
      <PageHeader
        eyebrow="Entrenamiento"
        title="Ejercicios"
        description="Entrena el reflejo de elegir la calculadora correcta. Te mostramos un spot real de una mano jugada y tú eliges qué herramienta de EV usarías para analizarlo. Después ves por qué y qué datos traerías de Flopzilla."
      />

      <div className="mx-auto w-full max-w-3xl">
        <WhichCalcDrill />
      </div>
    </>
  );
}
