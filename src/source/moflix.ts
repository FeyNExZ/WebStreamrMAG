import { Source, StreamResult } from './source';

export class MoflixSource implements Source {
    // Name, der später in Nuvio als Quelle angezeigt wird
    name = 'MoflixStream';

    private baseUrl = 'https://moflix-stream.xyz';

    async getStreams(tmdbId: string, type: string, season?: number, episode?: number): Promise<StreamResult[]> {
        const streams: StreamResult[] = [];

        try {
            // 1. Zieldatei/URL bestimmen (Beispiel für Filme vs. Serien)
            let targetUrl = '';
            if (type === 'movie') {
                targetUrl = `${this.baseUrl}/movie/${tmdbId}`;
            } else if (type === 'series' && season && episode) {
                targetUrl = `${this.baseUrl}/tv/${tmdbId}/${season}/${episode}`;
            } else {
                return [];
            }

            // 2. HTML-Seite von Moflix abrufen
            const response = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': this.baseUrl
                }
            });

            if (!response.ok) {
                console.log(`[Moflix] Kein Inhalt unter ${targetUrl} gefunden (Status: ${response.status})`);
                return [];
            }

            const html = await response.text();

            // 3. Embedded Player / Hoster-Links per Regex aus dem HTML-Code filtern
            // Moflix verwendet oft Standard-Iframe-Embeds (z.B. VOE, Streamtape, Vidoza)
            const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/g;
            let match;

            while ((match = iframeRegex.exec(html)) !== null) {
                let streamUrl = match[1];

                // Relative URLs ergänzen
                if (streamUrl.startsWith('//')) {
                    streamUrl = 'https:' + streamUrl;
                }

                // Erkennen, welcher Hoster es ist (z.B. VOE, Streamtape)
                let hosterName = 'Hoster';
                if (streamUrl.includes('voe') || streamUrl.includes('jodomi')) hosterName = 'VOE';
                else if (streamUrl.includes('streamtape')) hosterName = 'Streamtape';
                else if (streamUrl.includes('vidoza')) hosterName = 'Vidoza';

                streams.push({
                    name: `Moflix [DE] (${hosterName})`,
                    title: `1080p | German Stream`,
                    url: streamUrl
                });
            }

        } catch (error) {
            console.error('[Moflix] Fehler beim Abrufen der Streams:', error);
        }

        return streams;
    }
}
