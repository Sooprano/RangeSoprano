import { Upload } from 'lucide-react';
import { useImportProfile } from '@/hooks/useImportProfile';

export function ImportProfileButton({
  className,
  label = 'Importar perfil completo',
}: {
  className?: string | undefined;
  label?: string | undefined;
} = {}) {
  const { inputRef, onChange, openPicker } = useImportProfile();

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        onChange={onChange}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={openPicker}
        className={
          className ??
          'inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light'
        }
      >
        <Upload className="h-3.5 w-3.5" strokeWidth={2.25} />
        {label}
      </button>
    </>
  );
}
