import { ContentType } from '../types';
import { Stream } from '../stream';
import { Fetcher, RequestContext } from '../utils';
import { Source } from './Source';

export class Moflix extends Source {
  readonly id = 'moflixstream';
  readonly label = 'MoflixStream';
  readonly name = 'MoflixStream';
  readonly baseUrl = 'https://moflix-stream.xyz';
  readonly contentTypes: ContentType[] = [ContentType.Movie, ContentType.Series];
  readonly countryCodes: string[] = ['DE'];

  constructor(fetcher: Fetcher) {
    super(fetcher);
  }

  async handleInternal(
    ctx: RequestContext,
    type: ContentType,
    tmdbId: string,
    season?: number,
    episode?: number
  ): Promise<Stream[]> {
    const streams: Stream[] = [];

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
      } else if (type === ContentType.Series && season && episode) {
        targetUrl = `${this.baseUrl}/tv/${tmdbId}/${season}/${episode}`;
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

        streams.push({
          name: `Moflix [DE] (${hosterName})`,
          title: displayTitle,
          url: streamUrl
        } as Stream);
      }

    } catch (error) {
      console.error('[Moflix] Fehler:', error);
    }

    return streams;
  }
}
