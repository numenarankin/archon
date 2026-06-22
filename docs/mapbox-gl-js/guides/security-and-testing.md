<!-- Source: https://docs.mapbox.com/mapbox-gl-js/guides/security-and-testing/ -->

# Security and testing
Learn how to set up CSP directives and referrer policies and how to write automated tests.

## What is a CSP?

[Content Security Policies (CSPs)](https://developer.mozilla.org/en-US/docs/Web/Security/CSP) are features that help reduce the risk of security threats like [XSS](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/XSS) attacks and [clickjacking](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/Clickjacking). CSPs assume that an attacker has already accessed your website, and can now execute code on your site. CSPs add rules (known as directives) to restrict what code executed on your site can do, where it can be loaded from and where it can make requests to.

### Setting CSPs

CSP's should be delivered to the browser from the server's [Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy) response header. If you are operating in a serverless environment (like a client-side-rendered single page app), you can use the HTML `<meta>` element. But, this option does not support all CSP features.

## Using CSP directives with Mapbox GL JS

To use a Content Security Policy with **Mapbox GL JS**, the following directives are required:

``` text
worker-src blob: ;
img-src data: blob: ;
connect-src https://api.mapbox.com https://events.mapbox.com ;
```

If you use [Mapbox Standard Style](https://docs.mapbox.com/map-styles/standard/guides/) or 3D features such as 3D models, you also need to allow WebAssembly execution:

``` text
script-src 'wasm-unsafe-eval' ;
```

For additional security against clickjacking attacks, consider adding the `frame-ancestors` directive, which when set to `self` tells browsers to only allow a webpage to be embedded (framed) by pages from the same origin.

``` text
frame-ancestors 'self' ;
```

## Strict CSP environments

In strict CSP environments where `worker-src blob: ;` cannot be used, **Mapbox GL JS** includes special bundles for use in strict CSP environments. Use the `mapbox-gl-csp.js` file instead of `mapbox-gl.js`. The strict CSP bundle also requires manually setting the path to the GL JS worker source to use the `mapbox-gl-csp-worker.js` file. Note that [workers](https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker) must obey the [same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy), which means that `mapbox-gl-csp-worker.js` must be served from the same origin as the page that loads it.

``` html
<script src='https://api.mapbox.com/mapbox-gl-js/v3.25.0/mapbox-gl-csp.js'></script>
<script>mapboxgl.workerUrl = "https://api.mapbox.com/mapbox-gl-js/v3.25.0/mapbox-gl-csp-worker.js"; </script>
```

ESM Bundles

The ESM bundle requires `worker-src blob:` and does not have a CSP-strict alternative. This is because ESM module workers use a blob wrapper to support cross-origin loading from CDNs. The CSP-strict workaround described above is only available for UMD bundles and is typically only needed in environments that specifically prohibit blob-based workers.

### Additional considerations

If you use the `sandbox` directive, and your [access token is restricted to certain URLs](https://docs.mapbox.com/accounts/overview/tokens/#url-restrictions), the `allow-same-origin` value is required. This allows requests to have a `Referer` header that is not `null`. See the section on [Referrer Policies](#referrer-policies) for further information.

## Scoped CSP rules

In some rare scenarios, you may need even stricter CSP rules: If an attacker is able to inject arbitrary code in the same environment that Mapbox GL JS runs in, and you want to prevent data exfiltration through the Mapbox API, using an access token provided by the attacker.

In such situations, you can specify even tighter policy directives to restrict HTTP requests to read-only Mapbox API endpoints, or to endpoints that are owned by you and thus require a secret access token:

### `style-src` and `script-src`

**Recommended approach:** Integrate Mapbox GL JS into your own JavaScript bundle using a module bundler. This allows you to use CSP [nonces](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/nonce) or hashes instead of `'unsafe-inline'`, significantly improving security:

``` text
style-src 'self' 'nonce-{random}';
script-src 'self' 'nonce-{random}';
```

**Alternative approach:** If loading from the CDN, use `https://api.mapbox.com/mapbox-gl-js/` for these directives. There are no endpoints under this prefix that allow writing, and Mapbox will not add such endpoints. This requires the `'unsafe-inline'` directive:

``` text
style-src https://api.mapbox.com/mapbox-gl-js/ 'unsafe-inline';
script-src https://api.mapbox.com/mapbox-gl-js/ 'unsafe-inline';
```

### `connect-src`

- `https://api.mapbox.com/v4/`. The Tiles API for [vector](https://docs.mapbox.com/api/maps/vector-tiles/), [raster](https://docs.mapbox.com/api/maps/raster-tiles/), [static](https://docs.mapbox.com/api/maps/static-tiles/), or 3D model tiles only has read-only endpoints. Use this source directive as is. Mapbox will not add endpoints under this prefix that allow writing.
- `https://api.mapbox.com/raster/v1/`. The endpoint for [raster DEM](https://docs.mapbox.com/style-spec/reference/sources/#raster-dem) tiles. It only has read-only endpoints. Use this source directive as is. Mapbox will not add endpoints under this prefix that allow writing. Or, you can restrict this to the actual tiles and TileJSON documents requested by your implementation.
- `https://api.mapbox.com/rasterarrays/v1/`. The endpoint for [rasterarray](https://docs.mapbox.com/api/maps/tilequery/#rasterarray-specific-query-parameters) tiles. It only has read-only endpoints. Use this source directive as is. Mapbox will not add endpoints under this prefix that allow writing. Or, you can restrict this to the actual tiles and TileJSON documents requested by your implementation.
- `https://api.mapbox.com/styles/v1/{username}/`. The [Styles API](https://docs.mapbox.com/api/maps/styles/) has an endpoint to create new styles, or update existing ones. Restrict this endpoint to either `mapbox`, and/or usernames you control, so that the attacker cannot write to their account.
- `https://api.mapbox.com/fonts/v1/{username}/`. The [Fonts API](https://docs.mapbox.com/api/maps/fonts/) has an endpoint for uploading new fonts. Restrict this endpoint to either Mapbox and/or usernames you control, so that the attacker cannot write to their account.
- `https://api.mapbox.com/models/v1/{username}/`. The 3D Models API only has read-only endpoints. While we don't provide any endpoints that allow model creation, restrict this endpoint to either Mapbox and/or usernames you control as a precautionary measure, so that the attacker cannot write to their account.
- `https://api.mapbox.com/mapbox-gl-js/`. The endpoint for WebAssembly modules used by 3D features (Draco decoder, Meshopt decoder, building generation). Only has read-only endpoints.
- `https://api.mapbox.com/map-sessions/v1`. The endpoint for billed map sessions. While this endpoint allows writing data, an attacker cannot retrieve this data from Mapbox. Note the missing trailing slash.
- `https://events.mapbox.com/`. The endpoint for anonymized user telemetry. While this endpoint allows writing data, an attacker cannot retrieve this data from Mapbox.

As a result, you can specify the following directives.

**For bundled applications:**

``` text
default-src 'none';
img-src data: blob:;
worker-src 'self';
style-src 'self' 'nonce-{random}';
script-src 'self' 'nonce-{random}';
frame-ancestors 'self';
connect-src
    https://api.mapbox.com/v4/
    https://api.mapbox.com/raster/v1/
    https://api.mapbox.com/rasterarrays/v1/
    https://api.mapbox.com/styles/v1/mapbox/
    https://api.mapbox.com/fonts/v1/mapbox/
    https://api.mapbox.com/models/v1/mapbox/
    https://api.mapbox.com/mapbox-gl-js/
    https://api.mapbox.com/map-sessions/v1
    https://events.mapbox.com/;
```

**For CDN-loaded applications:**

``` text
default-src 'none';
img-src data: blob:;
worker-src /mapbox-gl-csp-worker.js;
style-src https://api.mapbox.com/mapbox-gl-js/ 'unsafe-inline';
script-src https://api.mapbox.com/mapbox-gl-js/ 'unsafe-inline' 'wasm-unsafe-eval';
frame-ancestors 'self';
connect-src
    https://api.mapbox.com/v4/
    https://api.mapbox.com/raster/v1/
    https://api.mapbox.com/rasterarrays/v1/
    https://api.mapbox.com/styles/v1/mapbox/
    https://api.mapbox.com/fonts/v1/mapbox/
    https://api.mapbox.com/models/v1/mapbox/
    https://api.mapbox.com/mapbox-gl-js/
    https://api.mapbox.com/map-sessions/v1
    https://events.mapbox.com/;
```

If you’re using custom styles and fonts, you’ll either have to change the `/mapbox/` suffixes for `styles`, `fonts` and `models` `connect-src` directives to your account name, or add a version of that URL with your account name as well as the Mapbox one.

For the proposed directives to be effective against data exfiltration, you must use an access token that has only read/list scopes, [as per Mapbox recommended security practices](https://docs.mapbox.com/help/troubleshooting/how-to-use-mapbox-securely/#access-tokens).

Mapbox guarantees that these source directives required for loading map data are stable for the same Mapbox GL JS version. New Mapbox GL JS updates may introduce new endpoints, and if you use these directives you must check the Mapbox GL JS changelog for required updates to your CSP rules.

## Referrer policies

If you use a [URL-restricted access token](https://docs.mapbox.com/accounts/overview/tokens/#url-restrictions), you have to make sure that the browser sends the correct referrer header. This is the default setting. But if you use the [Referrer-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy) header on your website, pick a value that still sends a `Referer` header, like `no-referrer-when-downgrade`, `origin`, `origin-when-cross-origin`, or `strict-origin`. Specifically, `same-origin` and `no-referrer` will never send a referrer header, and thus Mapbox API calls won't work.

If you limit the referrer to the origin, make sure that the URL you restrict your access token to doesn't contain path information, because the `Origin` header doesn't contain a path by definition.

## Automated tests

When writing integration or end-to-end tests for your application, you can use the [`testMode`](/mapbox-gl-js/api/map/#map-class-parameters-options-testmode) option when instantiating the `Map` to test map interactions without requiring an access token or rendering visual output.

### What `testMode` enables

The `testMode` option is designed for testing **application logic that interacts with the map**, such as:

- Event handlers that respond to map interactions (`click`, `mouseover`, etc.)
- Features that query or filter map data
- UI components that control map state (zoom, pan, pitch)
- Data loading and layer management workflows

### Environment requirements

Test mode requires a **browser environment** (or browser-like environment such as `jsdom` or `happy-dom`) because it uses the full Mapbox GL JS library. It does not produce visual output, making it suitable for headless browser testing with tools like Playwright, Puppeteer, or Vitest with `jsdom`.

### How it works

When `testMode` is `true`:

- The map doesn't render visual output (faster tests)
- No access token is required (avoids billing and rate limits)
- Styles and tiles load from local fixtures instead of the Mapbox API
- The full JavaScript API remains available for testing interactions

Example initialization of a `Map` in `testMode`:

``` js
const map = new mapboxgl.Map({
  container: 'map',
  zoom: 1,
  fadeDuration: 0,
  center: [0, 0],
  testMode: true
});
```

Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
