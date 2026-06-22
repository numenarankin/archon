<!-- Source: https://docs.mapbox.com/mapbox-gl-js/api/properties/ -->

# Properties and options
Search GL JS API Reference

Mapbox GL JS's global properties and options that you can access while initializing your map or accessing information about its status.

## accessToken

[githubsrc/index.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/index.ts#L164-L166)

Gets and sets the map's [access token](https://www.mapbox.com/help/define-access-token/).

### Type

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

### Returns

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String): The currently set access token.

### Example

``` js
mapboxgl.accessToken = myAccessToken;
```

### Related

- [Example: Display a map](https://www.mapbox.com/mapbox-gl-js/example/simple-map/)

Was this section on accessToken helpful?

## AnimationOptions

[githubsrc/ui/camera.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/camera.ts#L99-L133)

Options common to map movement methods that involve animation, such as [Map#panBy](/mapbox-gl-js/api/map/#map#panby) and [Map#easeTo](/mapbox-gl-js/api/map/#map#easeto), controlling the duration and easing function of the animation. All properties are optional.

### Type

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)

### Properties

Name

Description

#### animate

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)

If `false` , no animation will occur.

#### curve

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)

The zooming "curve" that will occur along the flight path. A high value maximizes zooming for an exaggerated animation, while a low value minimizes zooming for an effect closer to [Map#easeTo](/mapbox-gl-js/api/map/#map#easeto) . 1.42 is the average value selected by participants in the user study discussed in [van Wijk (2003)](https://www.win.tue.nl/~vanwijk/zoompan.pdf) . A value of `Math.pow(6, 0.25)` would be equivalent to the root mean squared average velocity. A value of 1 would produce a circular motion. If `minZoom` is specified, this option will be ignored.

#### duration

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)

The animation's duration, measured in milliseconds.

#### easing

[`Function`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Statements/function)

A function taking a time in the range 0..1 and returning a number where 0 is the initial state and 1 is the final state.

#### essential

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)

If `true` , then the animation is considered essential and will not be affected by [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) .

#### maxDuration

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)

The animation's maximum duration, measured in milliseconds. If duration exceeds maximum duration, it resets to 0.

#### minZoom

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)

The zero-based zoom level at the peak of the flight path. If this option is specified, `curve` will be ignored.

#### offset

[`PointLike`](/mapbox-gl-js/api/geography/#pointlike)

The target center's offset relative to real map container center at the end of animation.

#### preloadOnly

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)

If `true` , it will trigger tiles loading across the animation path, but no animation will occur.

#### screenSpeed

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)

The average speed of the animation measured in screenfuls per second, assuming a linear timing curve. If `speed` is specified, this option is ignored.

#### speed

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)

The average speed of the animation defined in relation to `curve` . A speed of 1.2 means that the map appears to move along the flight path by 1.2 times `curve` screenfuls every second. A *screenful* is the map's visible span. It does not correspond to a fixed physical distance, but varies by zoom level.

### Related

- [Example: Slowly fly to a location](https://docs.mapbox.com/mapbox-gl-js/example/flyto-options/)
- [Example: Customize camera animations](https://docs.mapbox.com/mapbox-gl-js/example/camera-animation/)
- [Example: Navigate the map with game-like controls](https://docs.mapbox.com/mapbox-gl-js/example/game-controls/)

Was this section on AnimationOptions helpful?

## baseApiUrl

[githubsrc/index.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/index.ts#L180-L182)

Gets and sets the map's default API URL for requesting tiles, styles, sprites, and glyphs.

### Type

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

### Returns

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String): The current base API URL.

### Example

``` js
mapboxgl.baseApiUrl = 'https://api.mapbox.com';
```

Was this section on baseApiUrl helpful?

## CameraOptions

[githubsrc/ui/camera.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/camera.ts#L44-L80)

Options common to [Map#jumpTo](/mapbox-gl-js/api/map/#map#jumpto), [Map#easeTo](/mapbox-gl-js/api/map/#map#easeto), and [Map#flyTo](/mapbox-gl-js/api/map/#map#flyto), controlling the desired location, zoom, bearing, and pitch of the camera. All properties are optional, and when a property is omitted, the current camera value for that property will remain unchanged.

### Type

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)

### Properties

Name

Description

#### around

[`LngLatLike`](/mapbox-gl-js/api/geography/#lnglatlike)

The location serving as the origin for a change in `zoom` , `pitch` and/or `bearing` . This location will remain at the same screen position following the transform. This is useful for drawing attention to a location that is not in the screen center. `center` is ignored if `around` is included.

#### bearing

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)

The desired bearing in degrees. The bearing is the compass direction that is "up". For example, `bearing: 90` orients the map so that east is up.

#### center

[`LngLatLike`](/mapbox-gl-js/api/geography/#lnglatlike)

The location to place at the screen center.

#### padding

[`PaddingOptions`](/mapbox-gl-js/api/properties/#paddingoptions)

Dimensions in pixels applied on each side of the viewport for shifting the vanishing point. Note that when `padding` is used with `jumpTo` , `easeTo` , and `flyTo` , it also sets the global map padding as a side effect, affecting all subsequent camera movements until the padding is reset. To avoid this, add the `retainPadding: false` option.

#### pitch

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)

The desired pitch in degrees. The pitch is the angle towards the horizon measured in degrees with a range between 0 and 85 degrees. For example, pitch: 0 provides the appearance of looking straight down at the map, while pitch: 60 tilts the user's perspective towards the horizon. Increasing the pitch value is often used to display 3D objects.

#### retainPadding

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)

If `false` , the value provided with the `padding` option will not be retained as the global map padding. When set to `true` the current camera transform will be modified by the function being called with this option. This is `true` by default.

#### zoom

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)

The desired zoom level.

### Example

``` js
// set the map's initial perspective with CameraOptions
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [-73.5804, 45.53483],
    pitch: 60,
    bearing: -60,
    zoom: 10
});
```

### Related

- [Example: Set pitch and bearing](https://docs.mapbox.com/mapbox-gl-js/example/set-perspective/)
- [Example: Jump to a series of locations](https://docs.mapbox.com/mapbox-gl-js/example/jump-to/)
- [Example: Fly to a location](https://docs.mapbox.com/mapbox-gl-js/example/flyto/)
- [Example: Display buildings in 3D](https://docs.mapbox.com/mapbox-gl-js/example/3d-buildings/)

Was this section on CameraOptions helpful?

## clearPrewarmedResources

[githubsrc/index.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/index.ts#L153-L153)

Clears up resources that have previously been created by [`mapboxgl.prewarm()`](https://docs.mapbox.com/mapbox-gl-js/api/properties/#prewarm). Note that this is typically not necessary. You should only call this function if you expect the user of your app to not return to a Map view at any point in your application.

### Example

``` js
mapboxgl.clearPrewarmedResources();
```

Was this section on clearPrewarmedResources helpful?

## clearStorage

[githubsrc/index.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/index.ts#L240-L242)

Clears browser storage used by this library. Using this method flushes the Mapbox tile cache that is managed by this library. Tiles may still be cached by the browser in some cases.

This API is supported on browsers where the [`Cache` API](https://developer.mozilla.org/en-US/docs/Web/API/Cache) is supported and enabled. This includes all major browsers when pages are served over `https://`, except Internet Explorer and Edge Mobile.

When called in unsupported browsers or environments (private or incognito mode), the callback will be called with an error argument.

### Parameters

Name

Description

#### callback

[`Function`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Statements/function)

Called with an error argument if there is an error.

### Example

``` js
mapboxgl.clearStorage();
```

Was this section on clearStorage helpful?

## CustomLayerInterface

[githubsrc/style/style_layer/custom_style_layer.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/style/style_layer/custom_style_layer.ts#L177-L197)

Interface for custom style layers. This is a specification for implementers to model: it is not an exported method or class.

Custom layers allow a user to render directly into the map's GL context using the map's camera. These layers can be added between any regular layers using [Map#addLayer](/mapbox-gl-js/api/map/#map#addlayer).

Custom layers must have a unique `id` and must have the `type` of `"custom"`. They must implement `render` and may implement `prerender`, `onAdd` and `onRemove`. They can trigger rendering using [Map#triggerRepaint](/mapbox-gl-js/api/map/#map#triggerrepaint) and they should appropriately handle [Map.event:webglcontextlost](/mapbox-gl-js/api/map/#map.event:webglcontextlost) and [Map.event:webglcontextrestored](/mapbox-gl-js/api/map/#map.event:webglcontextrestored).

The `renderingMode` property controls whether the layer is treated as a `"2d"` or `"3d"` map layer. Use:

- `"renderingMode": "3d"` to use the depth buffer and share it with other layers
- `"renderingMode": "2d"` to add a layer with no depth. If you need to use the depth buffer for a `"2d"` layer you must use an offscreen framebuffer and [CustomLayerInterface#prerender](/mapbox-gl-js/api/properties/#customlayerinterface#prerender).

### Properties

Name

Description

#### id

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

A unique layer id.

#### renderingMode

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

Either `"2d"` or `"3d"` . Defaults to `"2d"` .

#### type

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

The layer's type. Must be `"custom"` .

#### wrapTileId

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)

If `renderWorldCopies` is enabled `renderToTile` of the custom layer method will be called with different `x` value of the tile rendered on different copies of the world unless `wrapTileId` is set to `true` . Defaults to `false` .

### Example

``` js
// Custom layer implemented as ES6 class
class NullIslandLayer {
    constructor() {
        this.id = 'null-island';
        this.type = 'custom';
        this.renderingMode = '2d';
    }

    onAdd(map, gl) {
        const vertexSource = `
        uniform mat4 u_matrix;
        void main() {
            gl_Position = u_matrix * vec4(0.5, 0.5, 0.0, 1.0);
            gl_PointSize = 20.0;
        }`;

        const fragmentSource = `
        void main() {
            gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
        }`;

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);

        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);
    }

    render(gl, matrix) {
        gl.useProgram(this.program);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, "u_matrix"), false, matrix);
        gl.drawArrays(gl.POINTS, 0, 1);
    }
}

map.on('load', () => {
    map.addLayer(new NullIslandLayer());
});
```

### Static Members

### Instance Members

### Related

- [Example: Add a custom style layer](https://docs.mapbox.com/mapbox-gl-js/example/custom-style-layer/)
- [Example: Add a 3D model](https://docs.mapbox.com/mapbox-gl-js/example/add-3d-model/)

Was this section on CustomLayerInterface helpful?

## FreeCameraOptions

[githubsrc/ui/free_camera.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/free_camera.ts#L97-L177)

Options for accessing physical properties of the underlying camera entity. Direct access to these properties allows more flexible and precise controlling of the camera. These options are also fully compatible and interchangeable with CameraOptions. All fields are optional. See [Map#setFreeCameraOptions](/mapbox-gl-js/api/map/#map#setfreecameraoptions) and [Map#getFreeCameraOptions](/mapbox-gl-js/api/map/#map#getfreecameraoptions).

new FreeCameraOptions(position: [MercatorCoordinate](/mapbox-gl-js/api/geography/#mercatorcoordinate), orientation: quat)

### Parameters

Name

Description

#### position

[`MercatorCoordinate`](/mapbox-gl-js/api/geography/#mercatorcoordinate)

Position of the camera in slightly modified web mercator coordinates.

- The size of 1 unit is the width of the projected world instead of the "mercator meter". Coordinate \[0, 0, 0\] is the north-west corner and \[1, 1, 0\] is the south-east corner.
- Z coordinate is conformal and must respect minimum and maximum zoom values.
- Zoom is automatically computed from the altitude (z).

#### orientation

`quat`

Orientation of the camera represented as a unit quaternion \[x, y, z, w\] in a left-handed coordinate space. Direction of the rotation is clockwise around the respective axis. The default pose of the camera is such that the forward vector is looking up the -Z axis. The up vector is aligned with north orientation of the map: forward: \[0, 0, -1\] up: \[0, -1, 0\] right \[1, 0, 0\] Orientation can be set freely but certain constraints still apply:

- Orientation must be representable with only pitch and bearing.
- Pitch has an upper limit.

### Example

``` js
const camera = map.getFreeCameraOptions();

const position = [138.72649, 35.33974];
const altitude = 3000;

camera.position = mapboxgl.MercatorCoordinate.fromLngLat(position, altitude);
camera.lookAtPoint([138.73036, 35.36197]);

map.setFreeCameraOptions(camera);
```

### Instance Members

### Related

- [Example: Animate the camera around a point in 3D terrain](https://docs.mapbox.com/mapbox-gl-js/example/free-camera-point/)
- [Example: Animate the camera along a path](https://docs.mapbox.com/mapbox-gl-js/example/free-camera-path/)

Was this section on FreeCameraOptions helpful?

## getRTLTextPluginStatus

[githubsrc/index.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/index.ts#L415-L415)

Gets the map's [RTL text plugin](https://www.mapbox.com/mapbox-gl-js/plugins/#mapbox-gl-rtl-text) status. The status can be `unavailable` (not requested or removed), `loading`, `loaded`, or `error`. If the status is `loaded` and the plugin is requested again, an error will be thrown.

### Example

``` js
const pluginStatus = mapboxgl.getRTLTextPluginStatus();
```

Was this section on getRTLTextPluginStatus helpful?

## maxParallelImageRequests

[githubsrc/index.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/index.ts#L215-L217)

Gets and sets the maximum number of images (raster tiles, sprites, icons) to load in parallel. 16 by default. There is no maximum value, but the number of images affects performance in raster-heavy maps.

### Type

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

### Returns

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number): Number of parallel requests currently configured.

### Example

``` js
mapboxgl.maxParallelImageRequests = 10;
```

Was this section on maxParallelImageRequests helpful?

## PaddingOptions

[githubsrc/ui/camera.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/camera.ts#L166-L193)

Options for setting padding on calls to methods such as [Map#jumpTo](/mapbox-gl-js/api/map/#map#jumpto), [Map#easeTo](/mapbox-gl-js/api/map/#map#easeto), [Map#flyTo](/mapbox-gl-js/api/map/#map#flyto), [Map#fitBounds](/mapbox-gl-js/api/map/#map#fitbounds), [Map#fitScreenCoordinates](/mapbox-gl-js/api/map/#map#fitscreencoordinates), and [Map#setPadding](/mapbox-gl-js/api/map/#map#setpadding). Adjust these options to set the amount of padding in pixels added to the edges of the canvas. Set a uniform padding on all edges or individual values for each edge. All properties of this object must be non-negative integers. Note that when `padding` is used with `fitBounds`, `flyTo`, or similar methods, it also sets the global map padding as a side effect, affecting all subsequent camera movements until the padding is reset.

### Type

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)

### Properties

Name

Description

#### bottom

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)

Padding in pixels from the bottom of the map canvas.

#### left

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)

Padding in pixels from the left of the map canvas.

#### right

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)

Padding in pixels from the right of the map canvas.

#### top

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)

Padding in pixels from the top of the map canvas.

### Example

``` js
const bbox = [[-79, 43], [-73, 45]];
map.fitBounds(bbox, {
    padding: {top: 10, bottom: 25, left: 15, right: 5}
});
```

``` js
const bbox = [[-79, 43], [-73, 45]];
map.fitBounds(bbox, {
    padding: 20
});
```

### Related

- [Example: Fit to the bounds of a LineString](https://docs.mapbox.com/mapbox-gl-js/example/zoomto-linestring/)
- [Example: Fit a map to a bounding box](https://docs.mapbox.com/mapbox-gl-js/example/fitbounds/)

Was this section on PaddingOptions helpful?

## prewarm

[githubsrc/index.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/index.ts#L142-L142)

Initializes resources like WebWorkers that can be shared across maps to lower load times in some situations. [`mapboxgl.workerUrl`](https://docs.mapbox.com/mapbox-gl-js/api/properties/#workerurl) and [`mapboxgl.workerCount`](https://docs.mapbox.com/mapbox-gl-js/api/properties/#workercount), if being used, must be set before `prewarm()` is called to have an effect.

By default, the lifecycle of these resources is managed automatically, and they are lazily initialized when a `Map` is first created. Invoking `prewarm()` creates these resources ahead of time and ensures they are not cleared when the last `Map` is removed from the page. This allows them to be re-used by new `Map` instances that are created later. They can be manually cleared by calling [`mapboxgl.clearPrewarmedResources()`](https://docs.mapbox.com/mapbox-gl-js/api/properties/#clearprewarmedresources). This is only necessary if your web page remains active but stops using maps altogether. `prewarm()` is idempotent and has guards against being executed multiple times, and any resources allocated by `prewarm()` are created synchronously.

This is primarily useful when using Mapbox GL JS maps in a single page app, in which a user navigates between various views, resulting in constant creation and destruction of `Map` instances.

### Example

``` js
mapboxgl.prewarm();
```

Was this section on prewarm helpful?

## RequestParameters

[githubsrc/util/ajax.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/util/ajax.ts#L34-L61)

A `RequestParameters` object to be returned from Map.options.transformRequest callbacks.

### Type

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)

### Properties

Name

Description

#### body

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

Request body.

#### collectResourceTiming

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)

If true, Resource Timing API information will be collected for these transformed requests and returned in a resourceTiming property of relevant data events.

#### credentials

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

`'same-origin'|'include'` Use 'include' to send cookies with cross-origin requests.

#### headers

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)

The headers to be sent with the request.

#### method

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

Request method `'GET' | 'POST' | 'PUT'` .

#### referrerPolicy

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

A string representing the request's referrerPolicy. For more information and possible values, see the [Referrer-Policy HTTP header page](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy) .

#### type

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

Response body type to be returned `'string' | 'json' | 'arrayBuffer'` .

#### url

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

The URL to be requested.

### Example

``` js
// use transformRequest to modify requests that begin with `http://myHost`
const map = new Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    transformRequest: (url, resourceType) => {
        if (resourceType === 'Source' && url.indexOf('http://myHost') > -1) {
            return {
                url: url.replace('http', 'https'),
                headers: {'my-custom-header': true},
                credentials: 'include'  // Include cookies for cross-origin requests
            };
        }
    }
});
```

Was this section on RequestParameters helpful?

## setRTLTextPlugin

[githubsrc/index.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/index.ts#L415-L415)

Sets the map's [RTL text plugin](https://www.mapbox.com/mapbox-gl-js/plugins/#mapbox-gl-rtl-text). Necessary for supporting the Arabic and Hebrew languages, which are written right-to-left. Mapbox Studio loads this plugin by default.

### Parameters

Name

Description

#### pluginURL

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

URL pointing to the Mapbox RTL text plugin source.

#### callback

[`Function`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Statements/function)

Called with an error argument if there is an error, or no arguments if the plugin loads successfully.

#### lazy

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)

If set to `true` , MapboxGL will defer loading the plugin until right-to-left text is encountered, and right-to-left text will be rendered only after the plugin finishes loading.

### Example

``` js
mapboxgl.setRTLTextPlugin('https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.4.0/mapbox-gl-rtl-text.js');
```

### Related

- [Example: Add support for right-to-left scripts](https://www.mapbox.com/mapbox-gl-js/example/mapbox-gl-rtl-text/)

Was this section on setRTLTextPlugin helpful?

## StyleImageInterface

[githubsrc/style/style_image.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/style/style_image.ts#L42-L52)

Interface for dynamically generated style images. This is a specification for implementers to model: it is not an exported method or class.

Images implementing this interface can be redrawn for every frame. They can be used to animate icons and patterns or make them respond to user input. Style images can implement a [StyleImageInterface#render](/mapbox-gl-js/api/properties/#styleimageinterface#render) method. The method is called every frame and can be used to update the image.

### Properties

Name

Description

#### data

`(`[`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)` | `[`Uint8ClampedArray`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8ClampedArray)`)`

Byte array representing the image. To ensure space for all four channels in an RGBA color, size must be width × height × 4.

#### height

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)

Height in pixels.

#### width

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)

Width in pixels.

### Example

``` js
const flashingSquare = {
    width: 64,
    height: 64,
    data: new Uint8Array(64 * 64 * 4),

    onAdd(map) {
        this.map = map;
    },

    render() {
        // keep repainting while the icon is on the map
        this.map.triggerRepaint();

        // alternate between black and white based on the time
        const value = Math.round(Date.now() / 1000) % 2 === 0  ? 255 : 0;

        // check if image needs to be changed
        if (value !== this.previousValue) {
            this.previousValue = value;

            const bytesPerPixel = 4;
            for (let x = 0; x < this.width; x++) {
                for (let y = 0; y < this.height; y++) {
                    const offset = (y * this.width + x) * bytesPerPixel;
                    this.data[offset + 0] = value;
                    this.data[offset + 1] = value;
                    this.data[offset + 2] = value;
                    this.data[offset + 3] = 255;
                }
            }

            // return true to indicate that the image changed
            return true;
        }
    }
};

map.addImage('flashing_square', flashingSquare);
```

### Instance Members

### Related

- [Example: Add an animated icon to the map.](https://docs.mapbox.com/mapbox-gl-js/example/add-image-animated/)

Was this section on StyleImageInterface helpful?

## supported

[githubsrc/index.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/index.ts#L415-L415)

Test whether the browser [supports Mapbox GL JS](https://www.mapbox.com/help/mapbox-browser-support/#mapbox-gl-js).

### Parameters

Name

Description

#### options

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)`?`

#### options.failIfMajorPerformanceCaveat

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `false`)

If `true` , the function will return `false` if the performance of Mapbox GL JS would be dramatically worse than expected (for example, a software WebGL renderer would be used).

### Returns

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean):

### Example

``` js
// Show an alert if the browser does not support Mapbox GL
if (!mapboxgl.supported()) {
    alert('Your browser does not support Mapbox GL');
}
```

### Related

- [Example: Check for browser support](https://www.mapbox.com/mapbox-gl-js/example/check-for-support/)

Was this section on supported helpful?

## version

[githubsrc/index.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/index.ts#L415-L415)

Gets the version of Mapbox GL JS in use as specified in `package.json`, `CHANGELOG.md`, and the GitHub release.

### Type

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

### Example

``` js
console.log(`Mapbox GL JS v${mapboxgl.version}`);
```

Was this section on version helpful?

## workerClass

[githubsrc/index.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/index.ts#L282-L284)

Provides an interface for external module bundlers such as Webpack or Rollup to package mapbox-gl's WebWorker into a separate class and integrate it with the library.

Takes precedence over `mapboxgl.workerUrl`.

### Type

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)

### Returns

`(`[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)` | null)`: A class that implements the `Worker` interface.

### Example

``` js
import mapboxgl from 'mapbox-gl/dist/mapbox-gl-csp';
import MapboxGLWorker from 'mapbox-gl/dist/mapbox-gl-csp-worker';

mapboxgl.workerClass = MapboxGLWorker;
```

Was this section on workerClass helpful?

## workerCount

[githubsrc/index.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/index.ts#L198-L200)

Gets and sets the number of web workers instantiated on a page with Mapbox GL JS maps. By default, it is set to 2. Make sure to set this property before creating any map instances for it to have effect.

### Type

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

### Returns

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number): Number of workers currently configured.

### Example

``` js
mapboxgl.workerCount = 4;
```

Was this section on workerCount helpful?

## workerUrl

[githubsrc/index.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/index.ts#L260-L262)

Provides an interface for loading mapbox-gl's WebWorker bundle from a self-hosted URL. This needs to be set only once, and before any call to `new mapboxgl.Map(..)` takes place. This is useful if your site needs to operate in a strict CSP (Content Security Policy) environment wherein you are not allowed to load JavaScript code from a [`Blob` URL](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL), which is default behavior.

See our documentation on [CSP Directives](https://docs.mapbox.com/mapbox-gl-js/guides/browsers/#csp-directives) for more details.

### Type

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

### Returns

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String): A URL hosting a JavaScript bundle for mapbox-gl's WebWorker.

### Example

``` js
<script src='https://api.mapbox.com/mapbox-gl-js/v2.3.1/mapbox-gl-csp.js'></script>
<script>
mapboxgl.workerUrl = "https://api.mapbox.com/mapbox-gl-js/v2.3.1/mapbox-gl-csp-worker.js";
...
</script>
```

Was this section on workerUrl helpful?Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
