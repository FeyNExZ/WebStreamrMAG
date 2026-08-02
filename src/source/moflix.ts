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
    const tmdbId = tmdbIdObj?.id;

    if (!name) return [];

    const results: SourceResult[] = [];

    // Suchpfad aufbauen (Versuch 1: TMDB-ID, Versuch 2: Titel-Suche)
    const urlsToTry: string[] = [];
    if (tmdbId) {
      if (!season) {
        urlsToTry.push(`${this.baseUrl}/movie/${tmdbId}`);
      } else if (season && episode) {
        urlsToTry.push(`${this.baseUrl}/tv/${tmdbId}/${season}/${episode}`);
      }
    }
    
    // Fallback URL-Suche
    const cleanQuery = encodeURIComponent(name);
    urlsToTry.push(`${this.baseUrl}/search?q=${cleanQuery}`);

    const title = season
      ? `${name} S${String(season).padStart(2, '0')}E${String(episode ?? 1).padStart(2, '0')}`
      : `${name} (${year})`;

    for (const targetUrl of urlsToTry) {
      try {
        const pageUrl = new URL(targetUrl);
        const html = await this.fetcher.text(ctx, pageUrl);

        if (!html || html.length < 200) continue;

        // Player-Iframes (VOE, Streamtape, Vidoza etc.) herausfiltern
        const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/g;
        let match: RegExpExecArray | null;

        while ((match = iframeRegex.exec(html)) !== null) {
          let streamUrlStr = match[1];

          if (!streamUrlStr) continue;

          if (streamUrlStr.startsWith('//')) {
            streamUrlStr = 'https:' + streamUrlStr;
          }

          let hostName = 'Hoster';
          if (streamUrlStr.includes('voe') || streamUrlStr.includes('jodomi')) {
            hostName = 'VOE';
          } else if (streamUrlStr.includes('streamtape')) {
            hostName = 'Streamtape';
          } else if (streamUrlStr.includes('vidoza')) {
            hostName = 'Vidoza';
          } else if (streamUrlStr.includes('dood')) {
            hostName = 'Doodstream';
          }

          try {
            results.push({
              url: new URL(streamUrlStr),
              meta: {
                countryCodes: [CountryCode.de],
                referer: pageUrl.href,
                title: `${hostName} - ${title}`,
                sourceLabel: this.label,
              },
            });
          } catch {
            // Ungültige URL überspringen
          }
        }

        // Falls wir Ergebnisse auf dieser Seite gefunden haben, beenden wir die Schleife
        if (results.length > 0) {
          break;
        }
      } catch {
        // Bei Fehler zur nächsten URL springen
      }
    }

    return results;
  }
}
