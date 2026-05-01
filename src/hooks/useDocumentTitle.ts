import { useEffect } from 'react';

type Options = {
  description?: string;
  noindex?: boolean;
};

const DEFAULT_DESCRIPTION =
  'Range Soprano: app gratuita para estudiar, crear y entrenar rangos preflop de poker (6-max y HU). Visualizador, editor con pesos mixtos y entrenador con modo Speed.';
const DEFAULT_ROBOTS = 'index, follow';

function setMeta(name: string, content: string): void {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function useDocumentTitle(title: string, options: Options = {}): void {
  const { description, noindex } = options;
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    if (description) setMeta('description', description);
    if (noindex) setMeta('robots', 'noindex, nofollow');
    return () => {
      document.title = previousTitle;
      if (description) setMeta('description', DEFAULT_DESCRIPTION);
      if (noindex) setMeta('robots', DEFAULT_ROBOTS);
    };
  }, [title, description, noindex]);
}
