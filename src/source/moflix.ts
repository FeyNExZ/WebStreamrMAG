import { Context, ContentType, CountryCode, Id } from '../types';
import { Source, SourceResult } from './Source';

export class Moflix extends Source {
  readonly id = 'moflixstream';
  readonly label = 'MoflixStream';
  readonly name = 'MoflixStream';
  readonly baseUrl = 'https://moflix-stream.xyz';
  readonly contentTypes: ContentType[] = [ContentType.Movie, ContentType.Series];
  readonly countryCodes: CountryCode[] = [CountryCode.DE];

  async handleInternal(
    ctx: Context,
    type: ContentType,
    id: Id
  ): Promise<SourceResult[]> {
    const results: SourceResult[] = [];

    const tmdbId = id.tmdb;
    if (!tmdbId) return [];

    // Liest den TMDB Key aus den Umgebungsvariablen
    const env = process.env as Record<string, string | undefined>;
    const tmdbKey = env['TMDB_ACCESS_TOKEN'] || env['TMDB_API_KEY'];

    try {
      let germanTitle = '';

      // 1. Deutschen Titel über TMDB abrufen (falls Key vorhanden)
      if (tmdbKey) {
        const typeStr = type === ContentType.Movie ? 'movie' : 'tv';
        const tmdbUrl = `https://api.themoviedb.org/3/${typeStr}/${tmdbId}?api_key=${tmdbKey}&language=de-DE`;

        try {
          const tmdbRes = await fetch(tmdbUrl);
          if (tmdbRes.ok) {
            const tmdbData: any = await tmdbRes.json();
            germanTitle = tmdbData.title || tmdbData.name || '';
          }
        } catch {
          // Falls TMDB fehlschlägt, machen wir trotzdem weiter
        }
      }

      // 2. Moflix URL aufbauen
      let targetUrl = '';
      if (type === ContentType.Movie) {
        targetUrl = `${this.baseUrl}/movie/${tmdbId}`;
      } else if (type === ContentType.Series && id.season && id.episode) {
        targetUrl = `${this.baseUrl}/tv/${tmdbId}/${id.season}/${id.episode}`;
      } else {
        return [];
      }

      // 3. Moflix HTML-Seite abrufen
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': this.baseUrl
        }
      });

      if (!response.ok) return [];

      const html = await response.text();

      // 4. Player-Iframes (VOE, Streamtape etc.) herausfiltern
      const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/g;
      let match: RegExpExecArray | null;

      while ((match = iframeRegex.exec(html)) !== null) {
        let streamUrl = match[1];

        if (!streamUrl) continue;

        if (streamUrl.startsWith('//')) {
          streamUrl = 'https:' + streamUrl;
        }

        let hosterName = 'Hoster';
        if (streamUrl.includes('voe') || streamUrl.includes('jodomi')) {
          hosterName = 'VOE';
        } else if (streamUrl.includes('streamtape')) {
          hosterName = 'Streamtape';
        } else if (streamUrl.includes('vidoza')) {
          hosterName = 'Vidoza';
        }

        const displayTitle = germanTitle ? `${germanTitle} | 1080p Deutsch` : '1080p Deutsch';

        results.push({
          name: `Moflix [DE] (${hosterName})`,
          title: displayTitle,
          url: streamUrl
        } as unknown as SourceResult);
      }

    } catch (error) {
      if (ctx) {
        console.error('[Moflix] Fehler:', error);
      }
    }

    return results;
  }
}
