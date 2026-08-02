import { ContentType } from 'stremio-addon-sdk';
import * as cheerio from 'cheerio';
import { Context, CountryCode } from '../types';
import { Fetcher, getTmdbId, getTmdbNameAndYear, Id } from '../utils';
import { Source, SourceResult } from './Source';

export class KinoKing extends Source {
  public readonly id = 'kinoking';
  public readonly label = 'KinoKing';
  public readonly baseUrl = 'https://kinoking.cc'; // Aktuelle Domain

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

    if (!name) return [];

    const results: SourceResult[] = [];
    const cleanQuery = encodeURIComponent(name);
    // Such-URL (z.B. https://kinoking.cc/?s=Batman)
    const searchUrl = `${this.baseUrl}/?s=${cleanQuery}`;

    const season = tmdbIdObj?.season;
    const episode = tmdbIdObj?.episode;
    const title = season
      ? `${name} S${String(season).padStart(2, '0')}E${String(episode ?? 1).padStart(2, '0')}`
      : `${name} (${year})`;

    try {
      // 1. Suche auf KinoKing ausführen
      const searchHtml = await this.fetcher.text(ctx, new URL(searchUrl), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': this.baseUrl,
        },
      });

      const $ = cheerio.load(searchHtml);
      let detailUrl = '';
      
      // Wir schnappen uns den ersten Link aus den Suchergebnissen, der zum Film/Serie führt
      $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.includes(this.baseUrl) && !detailUrl) {
          // Überspringt Such-Links und Menü-Links
          if (href.length > this.baseUrl.length + 5 && !href.includes('?s=')) {
            detailUrl = href;
          }
        }
      });

      if (!detailUrl) return [];

      // 2. Film/Serien-Detailseite abrufen, wo die Videoplayer stecken
      const detailHtml = await this.fetcher.text(ctx, new URL(detailUrl), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': searchUrl,
        },
      });

      // 3. Hoster-Links aus dem HTML herausfiltern
      const linkRegex = /(?:src|data-src|data-link|href)=["']([^"']*(?:voe|jodomi|streamtape|vidoza|dood|mixdrop|supervideo)[^"']*)["']/gi;
      let match: RegExpExecArray | null;

      while ((match = linkRegex.exec(detailHtml)) !== null) {
        let streamUrlStr = match[1];
        if (!streamUrlStr) continue;

        if (streamUrlStr.startsWith('//')) {
          streamUrlStr = 'https:' + streamUrlStr;
        }

        let hostName = 'Hoster';
        const lowerUrl = streamUrlStr.toLowerCase();
        if (lowerUrl.includes('voe') || lowerUrl.includes('jodomi')) hostName = 'VOE';
        else if (lowerUrl.includes('streamtape')) hostName = 'Streamtape';
        else if (lowerUrl.includes('vidoza')) hostName = 'Vidoza';
        else if (lowerUrl.includes('dood')) hostName = 'Doodstream';
        else if (lowerUrl.includes('mixdrop')) hostName = 'Mixdrop';

        try {
          results.push({
            url: new URL(streamUrlStr),
            meta: {
              countryCodes: [CountryCode.de],
              referer: detailUrl,
              title: `${hostName} - ${title}`,
              sourceLabel: this.label,
            },
          });
        } catch {
          // Ignoriert defekte Links
        }
      }
    } catch (error) {
      // Wenn KinoKing blockiert oder offline ist, leeres Ergebnis liefern
    }

    return results;
  }
}
