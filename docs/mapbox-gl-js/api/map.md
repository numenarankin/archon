<!-- Source: https://docs.mapbox.com/mapbox-gl-js/api/map/ -->

# Map
Search GL JS API Reference[githubsrc/ui/map.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/map.ts#L451-L5322)

The `Map` object represents the map on your page. It exposes methods and properties that enable you to programmatically change the map, and fires events as users interact with it.

You create a `Map` by specifying a `container` and other options. Then Mapbox GL JS initializes the map on the page and returns your `Map` object.

Extends [Evented](/mapbox-gl-js/api/events/#evented).new Map class(options: [Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object))

## Parameters

Name

Description

#### options

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)

#### options.accessToken

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)(default `null`)

If specified, map will use this [token](https://docs.mapbox.com/help/glossary/access-token/) instead of the one defined in `mapboxgl.accessToken` .

#### options.antialias

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `false`)

If `true` , the gl context will be created with [MSAA antialiasing](https://en.wikipedia.org/wiki/Multisample_anti-aliasing) . This is `false` by default as a performance optimization.

#### options.attributionControl

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

If `true` , an [AttributionControl](/mapbox-gl-js/api/markers/#attributioncontrol) will be added to the map.

#### options.bearing

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `0`)

The initial [bearing](https://docs.mapbox.com/help/glossary/camera#bearing) (rotation) of the map, measured in degrees counter-clockwise from north. If `bearing` is not specified in the constructor options, Mapbox GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `0` .

#### options.bearingSnap

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `7`)

The threshold, measured in degrees, that determines when the map's bearing will snap to north. For example, with a `bearingSnap` of 7, if the user rotates the map within 7 degrees of north, the map will automatically snap to exact north.

#### options.bounds

[`LngLatBoundsLike`](/mapbox-gl-js/api/geography/#lnglatboundslike)(default `null`)

The initial bounds of the map. If `bounds` is specified, it overrides `center` and `zoom` constructor options.

#### options.boxZoom

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

If `true` , the "box zoom" interaction is enabled (see [BoxZoomHandler](/mapbox-gl-js/api/handlers/#boxzoomhandler) ).

#### options.center

[`LngLatLike`](/mapbox-gl-js/api/geography/#lnglatlike)(default `[0,0]`)

The initial geographical [centerpoint](https://docs.mapbox.com/help/glossary/camera#center) of the map. If `center` is not specified in the constructor options, Mapbox GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `[0, 0]` Note: Mapbox GL uses longitude, latitude coordinate order (as opposed to latitude, longitude) to match GeoJSON.

#### options.clickTolerance

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `3`)

The max number of pixels a user can shift the mouse pointer during a click for it to be considered a valid click (as opposed to a mouse drag).

#### options.collectResourceTiming

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `false`)

If `true` , Resource Timing API information will be collected for requests made by GeoJSON and Vector Tile web workers (this information is normally inaccessible from the main Javascript thread). Information will be returned in a `resourceTiming` property of relevant `data` events.

#### options.config

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)(default `null`)

The initial configuration options for the style fragments. Each key in the object is a fragment ID (e.g., `basemap` ) and each value is a configuration object.

#### options.container

`(`[`HTMLElement`](https://developer.mozilla.org/docs/Web/HTML/Element)` | `[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)`)`

The HTML element in which Mapbox GL JS will render the map, or the element's string `id` . The specified element must have no children.

#### options.cooperativeGestures

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)`?`

If `true` , scroll zoom will require pressing the ctrl or ⌘ key while scrolling to zoom map, and touch pan will require using two fingers while panning to move the map. Touch pitch will require three fingers to activate if enabled.

#### options.crossSourceCollisions

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

If `true` , symbols from multiple sources can collide with each other during collision detection. If `false` , collision detection is run separately for the symbols in each source.

#### options.customAttribution

`(`[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)` | `[`Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)`<`[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)`>)`(default `null`)

String or strings to show in an [AttributionControl](/mapbox-gl-js/api/markers/#attributioncontrol) . Only applicable if `options.attributionControl` is `true` .

#### options.doubleClickZoom

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

If `true` , the "double click to zoom" interaction is enabled (see [DoubleClickZoomHandler](/mapbox-gl-js/api/handlers/#doubleclickzoomhandler) ).

#### options.dragPan

`(`[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)` | `[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)`)`(default `true`)

If `true` , the "drag to pan" interaction is enabled. An `Object` value is passed as options to [DragPanHandler#enable](/mapbox-gl-js/api/handlers/#dragpanhandler#enable) .

#### options.dragRotate

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

If `true` , the "drag to rotate" interaction is enabled (see [DragRotateHandler](/mapbox-gl-js/api/handlers/#dragrotatehandler) ).

#### options.fadeDuration

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `300`)

Controls the duration of the fade-in/fade-out animation for label collisions, in milliseconds. This setting affects all symbol layers. This setting does not affect the duration of runtime styling transitions or raster tile cross-fading.

#### options.failIfMajorPerformanceCaveat

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `false`)

If `true` , map creation will fail if the performance of Mapbox GL JS would be dramatically worse than expected (a software renderer would be used).

#### options.fitBoundsOptions

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)(default `null`)

A [Map#fitBounds](/mapbox-gl-js/api/map/#map#fitbounds) options object to use *only* when fitting the initial `bounds` provided above.

#### options.fontstackCompositing

`(``"client"`` | ``"server"``)`(default `'client'`)

Controls how multi-font fontstacks are composited. When `'client'` (the default), each font in a comma-separated fontstack is loaded individually and missing glyphs are filled from subsequent fallback fonts on the client. When `'server'` , the full fontstack string is passed as-is to the glyph server, which must support server-side fontstack composition.

#### options.hash

`(`[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)` | `[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)`)`(default `false`)

If `true` , the map's [position](https://docs.mapbox.com/help/glossary/camera) (zoom, center latitude, center longitude, bearing, and pitch) will be synced with the hash fragment of the page's URL. For example, `http://path/to/my/page.html#2.59/39.26/53.07/-24.1/60` . An additional string may optionally be provided to indicate a parameter-styled hash, for example <http://path/to/my/page.html#map=2.59/39.26/53.07/-24.1/60&foo=bar> , where `foo` is a custom parameter and `bar` is an arbitrary hash distinct from the map hash.

#### options.interactive

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

If `false` , no mouse, touch, or keyboard listeners will be attached to the map, so it will not respond to interaction.

#### options.keyboard

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

If `true` , keyboard shortcuts are enabled (see [KeyboardHandler](/mapbox-gl-js/api/handlers/#keyboardhandler) ).

#### options.language

`(``"auto"`` | `[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)` | `[`Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)`<`[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)`>)`(default `null`)

A string with a BCP 47 language tag, or an array of such strings representing the desired languages used for the map's labels and UI components. Languages can only be set on Mapbox vector tile sources. By default, GL JS will not set a language so that the language of Mapbox tiles will be determined by the vector tile source's TileJSON. Valid language strings must be a [BCP-47 language code](https://en.wikipedia.org/wiki/IETF_language_tag#List_of_subtags) . Unsupported BCP-47 codes will not include any translations. Invalid codes will result in an recoverable error. If a label has no translation for the selected language, it will display in the label's local language. If option is set to `auto` , GL JS will select a user's preferred language as determined by the browser's [`window.navigator.language`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language) property. If the `locale` property is not set separately, this language will also be used to localize the UI for supported languages.

#### options.locale

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)(default `null`)

A patch to apply to the default localization table for UI strings such as control tooltips. The `locale` object maps namespaced UI string IDs to translated strings in the target language; see [`src/ui/default_locale.js`](https://github.com/mapbox/mapbox-gl-js/blob/main/src/ui/default_locale.js) for an example with all supported string IDs. The object may specify all UI strings (thereby adding support for a new translation) or only a subset of strings (thereby patching the default translation table).

#### options.localFontFamily

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)(default `null`)

Defines a CSS font-family for locally overriding generation of all glyphs. Font settings from the map's style will be ignored, except for font-weight keywords (light/regular/medium/bold). If set, this option overrides the setting in localIdeographFontFamily.

#### options.localIdeographFontFamily

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)(default `'sans-serif'`)

Defines a CSS font-family for locally overriding generation of glyphs in the 'CJK Unified Ideographs', 'Hiragana', 'Katakana', 'Hangul Syllables' and 'CJK Symbols and Punctuation' ranges. In these ranges, font settings from the map's style will be ignored, except for font-weight keywords (light/regular/medium/bold). Set to `false` , to enable font settings from the map's style for these glyph ranges. Note that [Mapbox Studio](https://studio.mapbox.com/) sets this value to `false` by default. The purpose of this option is to avoid bandwidth-intensive glyph server requests. For an example of this option in use, see [Use locally generated ideographs](https://www.mapbox.com/mapbox-gl-js/example/local-ideographs) .

#### options.logoPosition

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)(default `'bottom-left'`)

A string representing the position of the Mapbox wordmark on the map. Valid options are `top-left` , `top-right` , `bottom-left` , `bottom-right` .

#### options.maxBounds

[`LngLatBoundsLike`](/mapbox-gl-js/api/geography/#lnglatboundslike)(default `null`)

If set, the map will be constrained to the given bounds.

#### options.maxPitch

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `85`)

The maximum pitch of the map (0-85).

#### options.maxTileCacheSize

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `null`)

The maximum number of tiles stored in the tile cache for a given source. If omitted, the cache will be dynamically sized based on the current viewport.

#### options.maxZoom

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `22`)

The maximum zoom level of the map (0-24).

#### options.minPitch

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `0`)

The minimum pitch of the map (0-85).

#### options.minTileCacheSize

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `null`)

The minimum number of tiles stored in the tile cache for a given source. Larger viewports use more tiles and need larger caches. Larger viewports are more likely to be found on devices with more memory and on pages where the map is more important. If omitted, the cache will be dynamically sized based on the current viewport.

#### options.minZoom

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `0`)

The minimum zoom level of the map (0-24).

#### options.performanceMetricsCollection

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

If `true` , mapbox-gl will collect and send performance metrics.

#### options.pitch

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `0`)

The initial [pitch](https://docs.mapbox.com/help/glossary/camera#pitch) (tilt) of the map, measured in degrees away from the plane of the screen (0-85). If `pitch` is not specified in the constructor options, Mapbox GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `0` .

#### options.pitchRotateKey

`(``"Control"`` | ``"Alt"`` | ``"Shift"`` | ``"Meta"``)`(default `'Control'`)

Allows overriding the keyboard modifier key used for pitch/rotate interactions from `Control` to another modifier key.

#### options.pitchWithRotate

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

If `false` , the map's pitch (tilt) control with "drag to rotate" interaction will be disabled.

#### options.preserveDrawingBuffer

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `false`)

If `true` , the map's canvas can be exported to a PNG using `map.getCanvas().toDataURL()` . This is `false` by default as a performance optimization.

#### options.projection

`ProjectionSpecification`(default `'mercator'`)

The [projection](https://docs.mapbox.com/mapbox-gl-js/style-spec/projection/) the map should be rendered in. Supported projections are:

- [Albers](https://en.wikipedia.org/wiki/Albers_projection) equal-area conic projection as `albers`
- [Equal Earth](https://en.wikipedia.org/wiki/Equal_Earth_projection) equal-area pseudocylindrical projection as `equalEarth`
- [Equirectangular](https://en.wikipedia.org/wiki/Equirectangular_projection) (Plate Carrée/WGS84) as `equirectangular`
- 3d Globe as `globe`
- [Lambert Conformal Conic](https://en.wikipedia.org/wiki/Lambert_conformal_conic_projection) as `lambertConformalConic`
- [Mercator](https://en.wikipedia.org/wiki/Mercator_projection) cylindrical map projection as `mercator`
- [Natural Earth](https://en.wikipedia.org/wiki/Natural_Earth_projection) pseudocylindrical map projection as `naturalEarth`
- [Winkel Tripel](https://en.wikipedia.org/wiki/Winkel_tripel_projection) azimuthal map projection as `winkelTripel` Conic projections such as Albers and Lambert have configurable `center` and `parallels` properties that allow developers to define the region in which the projection has minimal distortion; see the example for how to configure these properties.

#### options.refreshExpiredTiles

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

If `false` , the map won't attempt to re-request tiles once they expire per their HTTP `cacheControl` / `expires` headers.

#### options.renderWorldCopies

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

If `true` , multiple copies of the world will be rendered side by side beyond -180 and 180 degrees longitude. If set to `false` :

- When the map is zoomed out far enough that a single representation of the world does not fill the map's entire container, there will be blank space beyond 180 and -180 degrees longitude.
- Features that cross 180 and -180 degrees longitude will be cut in two (with one portion on the right edge of the map and the other on the left edge of the map) at every zoom level.

#### options.respectPrefersReducedMotion

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

If set to `true` , the map will respect the user's `prefers-reduced-motion` browser setting and apply a reduced motion mode, minimizing animations and transitions. When set to `false` , the map will always ignore the `prefers-reduced-motion` settings, regardless of the user's preference, making all animations essential.

#### options.scaleFactor

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `1`)

The scale factor for text and icon sizes in symbol layers. A value greater than `1` increases label sizes, useful for improving accessibility or adjusting for high-density displays. The scale factor is clamped per-layer by `text-size-scale-range` and `icon-size-scale-range` style properties. This option is experimental and may change in future releases.

#### options.scrollZoom

`(`[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)` | `[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)`)`(default `true`)

If `true` , the "scroll to zoom" interaction is enabled. An `Object` value is passed as options to [ScrollZoomHandler#enable](/mapbox-gl-js/api/handlers/#scrollzoomhandler#enable) .

#### options.style

`(`[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)` | `[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)`)`(default `'mapbox://styles/mapbox/standard'`)

The map's Mapbox style. This must be an a JSON object conforming to the schema described in the [Mapbox Style Specification](https://mapbox.com/mapbox-gl-style-spec/) , or a URL to such JSON. Can accept a null value to allow adding a style manually.

To load a style from the Mapbox API, you can use a URL of the form `mapbox://styles/:owner/:style`, where `:owner` is your Mapbox account name and `:style` is the style ID. You can also use a [Mapbox-owned style](https://docs.mapbox.com/api/maps/styles/#mapbox-styles):

- `mapbox://styles/mapbox/standard`
- `mapbox://styles/mapbox/streets-v12`
- `mapbox://styles/mapbox/outdoors-v12`
- `mapbox://styles/mapbox/light-v11`
- `mapbox://styles/mapbox/dark-v11`
- `mapbox://styles/mapbox/satellite-v9`
- `mapbox://styles/mapbox/satellite-streets-v12`
- `mapbox://styles/mapbox/navigation-day-v1`
- `mapbox://styles/mapbox/navigation-night-v1`.

Tilesets hosted with Mapbox can be style-optimized if you append `?optimize=true` to the end of your style URL, like `mapbox://styles/mapbox/streets-v11?optimize=true`. Learn more about style-optimized vector tiles in our [API documentation](https://www.mapbox.com/api-documentation/maps/#retrieve-tiles).

#### options.testMode

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `false`)

Silences errors and warnings generated due to an invalid accessToken, useful when using the library to write unit tests.

#### options.touchPitch

`(`[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)` | `[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)`)`(default `true`)

If `true` , the "drag to pitch" interaction is enabled. An `Object` value is passed as options to [TouchPitchHandler](/mapbox-gl-js/api/handlers/#touchpitchhandler) .

#### options.touchZoomRotate

`(`[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)` | `[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)`)`(default `true`)

If `true` , the "pinch to rotate and zoom" interaction is enabled. An `Object` value is passed as options to [TouchZoomRotateHandler#enable](/mapbox-gl-js/api/handlers/#touchzoomrotatehandler#enable) .

#### options.trackResize

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

If `true` , the map will automatically resize when the browser window resizes.

#### options.transformRequest

`RequestTransformFunction`(default `null`)

A callback run before the Map makes a request for an external URL. The callback can be used to modify the url, set headers, or set the credentials property for cross-origin requests. Expected to return a [RequestParameters](/mapbox-gl-js/api/properties/#requestparameters) object with a `url` property and optionally `headers` and `credentials` properties.

#### options.worldview

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)(default `null`)

Sets the map's worldview. A worldview determines the way that certain disputed boundaries are rendered. By default, GL JS will not set a worldview so that the worldview of Mapbox tiles will be determined by the vector tile source's TileJSON. Valid worldview strings must be an [ISO alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1#Current_codes) . Unsupported ISO alpha-2 codes will fall back to the TileJSON's default worldview. Invalid codes will result in a recoverable error.

#### options.zoom

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `0`)

The initial [zoom](https://docs.mapbox.com/help/glossary/camera#zoom) level of the map. If `zoom` is not specified in the constructor options, Mapbox GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `0` .

## Example

``` js
const map = new mapboxgl.Map({
    container: 'map',
    center: [-122.420679, 37.772537],
    zoom: 13,
    style: 'mapbox://styles/mapbox/standard',
    config: {
        // Initial configuration for the Mapbox Standard style set above. By default, its ID is `basemap`.
        basemap: {
            // Here, we're setting the light preset to `night`.
            lightPreset: 'night'
        }
    }
});
```

``` js
const map = new mapboxgl.Map({
    container: 'map', // container ID
    center: [-122.420679, 37.772537], // starting position [lng, lat]
    zoom: 13, // starting zoom
    style: 'mapbox://styles/mapbox/streets-v11', // style URL or style object
    hash: true, // sync `center`, `zoom`, `pitch`, and `bearing` with URL
    // Use `transformRequest` to modify requests that begin with `http://myHost`.
    transformRequest: (url, resourceType) => {
        if (resourceType === 'Source' && url.startsWith('http://myHost')) {
            return {
                url: url.replace('http', 'https'),
                headers: {'my-custom-header': true},
                credentials: 'include'  // Include cookies for cross-origin requests
            };
        }
    }
});
```

## Instance Members

Search Instance Members

### Interaction handlers

### Controls

### Map constraints

### Point conversion

### Movement state

### Working with events

### Querying features

### Working with styles

### Sources

### Images

### Models

### Layers

### Style properties

### Feature state

### Lifecycle

### Debug features

### Camera

### Querying features

## Events

Search Events

## Related

- [Example: Display a map on a webpage](https://docs.mapbox.com/mapbox-gl-js/example/simple-map/)
- [Example: Display a map with a custom style](https://docs.mapbox.com/mapbox-gl-js/example/custom-style-id/)
- [Example: Check if Mapbox GL JS is supported](https://docs.mapbox.com/mapbox-gl-js/example/check-for-support/)

Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
