import { Context, Fetcher, ParsedStream } from '../utils';
import { Source } from './Source';

export class Moflix extends Source {
  id = 'moflixstream';
  name = 'MoflixStream';
  baseUrl = 'https://moflix-stream.xyz';

  constructor(fetcher: Fetcher) {
    super(fetcher);
  }

  async getStreams(ctx: Context, tmdbId: string, type: string, season?: number, episode?: number): Promise<ParsedStream[]> {
    const streams: ParsedStream[] = [];

    // Liest den TMDB Key sicher aus den Render-Umgebungsvariablen
    const tmdbKey = process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_API_KEY;

    try {
      let germanTitle = '';

      // 1. Deutschen Titel über TMDB abrufen (nur wenn Key vorhanden)
      if (tmdbKey) {
        const tmdbUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${tmdbKey}&language=de-DE`;
        const tmdbRes = await fetch(tmdbUrl);
        if (tmdbRes.ok) {
          const tmdbData = await tmdbRes.json();
          germanTitle = tmdbData.title || tmdbData.name || '';
        }
      }

      // 2. Moflix URL aufbauen
      let targetUrl = '';
      if (type === 'movie') {
        targetUrl = `${this.baseUrl}/movie/${tmdbId}`;
      } else if (type === 'series' && season && episode) {
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
        } as ParsedStream);
      }

    } catch (error) {
      console.error('[Moflix] Fehler:', error);
    }

    return streams;
  }
}
