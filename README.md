in testing phase

The following hosters can be used only with MediaFlow Proxy:

- Fastream
- FileLions
- FileMoon
- LuluStream
- Mixdrop
- Streamtape
- VOE

## Environment variables

#### `CACHE_DIR`

Optional. Directory for persistent caches using SQLite files. Default: OS tmp dir.

#### `CONFIGURATION_DESCRIPTION`

Optional. To customize the description shown on the configuration page.

#### `DISABLED_EXTRACTORS`

Optional. Comma separated list of extractors which should be disabled. E.g. `doodstream,vidsrc`

#### `DISABLED_SOURCES`

Optional. Comma separated list of sources which should be disabled. E.g. `frembed,vidsrc`

#### `FLARESOLVERR_ENDPOINT`

Optional. If domains show Cloudflare challenges, FlareSolverr can be used to work around them. E.g. `http://flaresolverr:8191`

#### `MANIFEST_ID`

Optional. Add-on manifest ID. Default: `webstreamr-mbg`

#### `MANIFEST_NAME`

Optional. Add-on manifest name. Default: `WebStreamrMBG`

#### `PORT`

Optional. Port of the node web server. Default: `51546`

#### `PROXY_CONFIG`

Optional. Proxies which should be used based on domain. Supports minimatch. E.g. `dood.to:http://USERNAME:PASSWORD@IP:PORT,*:socks5://172.17.0.1:1080`

#### `TMDB_ACCESS_TOKEN`

**Required**. TMDB access token to get information like title and year for content. Use the [API Read Access Token](https://www.themoviedb.org/settings/api).
