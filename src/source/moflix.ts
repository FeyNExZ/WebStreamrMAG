import { ContentType } from 'stremio-addon-sdk';
import { Context, CountryCode } from '../types';
import { Fetcher, getTmdbId, getTmdbNameAndYear, Id } from '../utils';
import { Source, SourceResult } from './Source';

export class Moflix extends Source {
  public readonly id = 'moflixstream';
  public readonly label = 'MoflixStream';
  public readonly baseUrl = 'https://moflix-stream.xyz';

  public override readonly contentTypes: ContentType[] = ['movie' as ContentType, 'series' as ContentType];
  public override readonly countryCodes = [CountryCode.de];
  public override readonly priority = 1;

  private readonly fetcher: Fetcher;

  public constructor(fetcher: Fetcher) {
    super();
    this.fetcher = fetcher;
  }

  protected override async handleInternal(ctx: Context, _type: ContentType, id: Id): Promise<SourceResult[]> {
    let name = '';
    let year = 0;
    let tmdbIdObj;

    try {
      tmdbIdObj = await getTmdbId(ctx, this.fetcher, id);
      [name, year] = await getTmdbNameAndYear(ctx, this.fetcher, tmdbIdObj, 'de');
    } catch {
      return [];
    }

    const season = tmdbIdObj?.season;
    const episode = tmdbIdObj?.episode;

    if (!name) return [];

    const results: SourceResult[] = [];

    // Wir suchen primär über die Suchfunktion der Seite mit dem sauberen Filmnamen
    const cleanQuery = encodeURIComponent(name);
    const searchUrl = `${this.baseUrl}/search?q=${cleanQuery}`;

    const title = season
      ? `${name} S${String(season).padStart(2, '0')}E${String(episode ?? 1).padStart(2, '0')}`
      : `${name} (${year})`;

    try {
      // User-Agent mitsenden, um Blocking zu verhindern
      const html = await this.fetcher.text(ctx, new URL(searchUrl), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': this.baseUrl,
        },
      });

      if (!html || html.length < 100) return [];

      // Flexiblerer Regex: Sucht nach iframe src, data-src, data-link oder normalen Hoster-Links
      const linkRegex = /(?:src|data-src|data-link|href)=["']([^"']*(?:voe|jodomi|streamtape|vidoza|dood|mixdrop|supervideo)[^"']*)["']/gi;
      let match: RegExpExecArray | null;

      while ((match = linkRegex.exec(html)) !== null) {
        let streamUrlStr = match[1];

        if (!streamUrlStr) continue;

        if (streamUrlStr.startsWith('//')) {
          streamUrlStr = 'https:' + streamUrlStr;
        }

        let hostName = 'Hoster';
        const lowerUrl = streamUrlStr.toLowerCase();
        if (lowerUrl.includes('voe') || lowerUrl.includes('jodomi')) {
          hostName = 'VOE';
        } else if (lowerUrl.includes('streamtape')) {
          hostName = 'Streamtape';
        } else if (lowerUrl.includes('vidoza')) {
          hostName = 'Vidoza';
        } else if (lowerUrl.includes('dood')) {
          hostName = 'Doodstream';
        } else if (lowerUrl.includes('mixdrop')) {
          hostName = 'Mixdrop';
        }

        try {
          results.push({
            url: new URL(streamUrlStr),
            meta: {
              countryCodes: [CountryCode.de],
              referer: this.baseUrl,
              title: `${hostName} - ${title}`,
              sourceLabel: this.label,
            },
          });
        } catch {
          // Ungültige URL ignorieren
        }
      }
    } catch {
      // Fehler beim Abruf auffangen
    }

    return results;
  }
}
