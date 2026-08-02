import { envGet, Fetcher } from '../utils';
import { Einschalten } from './Einschalten';
import { FilmpalastTO } from './FilmpalastTO';
import { KinoGer } from './KinoGer';
import { KinoKing } from './KinoKing'; // <-- Hier ist der fehlende Import!
import { MegaKino } from './MegaKino';
import { MeineCloud } from './MeineCloud';
import { Moflix } from './moflix';
import { Source } from './Source';

export * from './KinoKing';
export * from './Source';

export const createSources = (fetcher: Fetcher): Source[] => {
  const disabledSources = envGet('DISABLED_SOURCES')?.split(',') ?? [];

  return [
    // DE (Nur deutsche Quellen)
    new Einschalten(fetcher),
    new KinoGer(fetcher),
    new MegaKino(fetcher),
    new MeineCloud(fetcher),
    new FilmpalastTO(fetcher),
    new Moflix(fetcher),
    new KinoKing(fetcher),
  ].filter(source => !disabledSources.includes(source.id));
};
