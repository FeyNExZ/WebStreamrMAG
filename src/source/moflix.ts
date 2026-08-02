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
      // Falls TMDB fehlschlägt, abbrechen
      return [];
    }

    const season = tmdbIdObj?.season;
    const episode = tmdbIdObj?.episode;
    const tmdbId = tmdbIdObj?.id;

    if (!tmdbId) return [];

    // 1. Moflix URL aufbauen
    let targetUrl = '';
    if (!season) {
      targetUrl = `${this.baseUrl}/movie/${tmdbId}`;
    } else if (season && episode) {
      targetUrl = `${this.baseUrl}/tv/${tmdbId}/${season}/${episode}`;
    } else {
      return [];
    }

    const results: SourceResult[] = [];

    try {
      const pageUrl = new URL(targetUrl);
      const html = await this.fetcher.text(ctx, pageUrl);

      const title = season
        ? `${name} S${String(season).padStart(2, '0')}E${String(episode ?? 1).padStart(2, '0')}`
        : `${name} (${year})`;

      // 2. Player-Iframes herausfiltern
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
    } catch (error) {
      // Fehler beim Abruf abfangen
    }

    return results;
  }
}
