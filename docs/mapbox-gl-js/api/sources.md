<!-- Source: https://docs.mapbox.com/mapbox-gl-js/api/sources/ -->

# Sources
Search GL JS API Reference

A [`source`](https://docs.mapbox.com/style-spec/reference/sources/) defines data the map should display. This reference lists the source types Mapbox GL JS can handle in addition to the ones described in the [Mapbox Style Specification](https://docs.mapbox.com/style-spec/).

## CanvasSource

[githubsrc/source/canvas_source.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/source/canvas_source.ts#L62-L238)

A data source containing the contents of an HTML canvas. See [CanvasSourceOptions](/mapbox-gl-js/api/sources/#canvassourceoptions) for detailed documentation of options.

Extends [ImageSource](/mapbox-gl-js/api/sources/#imagesource).

### Example

``` js
// add to map
map.addSource('some id', {
    type: 'canvas',
    canvas: 'idOfMyHTMLCanvas',
    animate: true,
    coordinates: [
        [-76.54, 39.18],
        [-76.52, 39.18],
        [-76.52, 39.17],
        [-76.54, 39.17]
    ]
});

// update
const mySource = map.getSource('some id');
mySource.setCoordinates([
    [-76.54335737228394, 39.18579907229748],
    [-76.52803659439087, 39.1838364847587],
    [-76.5295386314392, 39.17683392507606],
    [-76.54520273208618, 39.17876344106642]
]);

map.removeSource('some id');  // remove
```

### Instance Members

### Related

- [Example: Add a canvas source](https://docs.mapbox.com/mapbox-gl-js/example/canvas-source/)

Was this section on CanvasSource helpful?

## CanvasSourceOptions

[githubsrc/source/canvas_source.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/source/canvas_source.ts#L17-L25)

Options to add a canvas source type to the map.

### Type

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)

### Properties

Name

Description

#### animate

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)`?`

Whether the canvas source is animated. If the canvas is static (pixels do not need to be re-read on every frame), `animate` should be set to `false` to improve performance.

#### canvas

`(`[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)` | `[`HTMLCanvasElement`](https://developer.mozilla.org/docs/Web/API/HTMLCanvasElement)`)`

Canvas source from which to read pixels. Can be a string representing the ID of the canvas element, or the `HTMLCanvasElement` itself.

#### coordinates

[`Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)`<`[`Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)`<`[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)`>>`

Four geographical coordinates denoting where to place the corners of the canvas, specified in `[longitude, latitude]` pairs.

#### type

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

Source type. Must be `"canvas"` .

Was this section on CanvasSourceOptions helpful?

## GeoJSONSource

[githubsrc/source/geojson_source.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/source/geojson_source.ts#L74-L540)

A source containing GeoJSON. See the [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/#sources-geojson) for detailed documentation of options.

Extends [Evented](/mapbox-gl-js/api/events/#evented).

### Example

``` js
map.addSource('some id', {
    type: 'geojson',
    data: 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_ports.geojson'
});
```

``` js
map.addSource('some id', {
    type: 'geojson',
    data: {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "Point",
                "coordinates": [
                    -76.53063297271729,
                    39.18174077994108
                ]
            }
        }]
    }
});
```

``` js
map.getSource('some id').setData({
    "type": "FeatureCollection",
    "features": [{
        "type": "Feature",
        "properties": {"name": "Null Island"},
        "geometry": {
            "type": "Point",
            "coordinates": [ 0, 0 ]
        }
    }]
});
```

### Instance Members

### Related

- [Example: Draw GeoJSON points](https://www.mapbox.com/mapbox-gl-js/example/geojson-markers/)
- [Example: Add a GeoJSON line](https://www.mapbox.com/mapbox-gl-js/example/geojson-line/)
- [Example: Create a heatmap from points](https://www.mapbox.com/mapbox-gl-js/example/heatmap/)
- [Example: Create and style clusters](https://www.mapbox.com/mapbox-gl-js/example/cluster/)

Was this section on GeoJSONSource helpful?

## ImageSource

[githubsrc/source/image_source.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/source/image_source.ts#L217-L825)

A data source containing an image. See the [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/#sources-image) for detailed documentation of options.

Extends [Evented](/mapbox-gl-js/api/events/#evented).

### Example

``` js
// add to map
map.addSource('some id', {
    type: 'image',
    url: 'https://www.mapbox.com/images/foo.png',
    coordinates: [
        [-76.54, 39.18],
        [-76.52, 39.18],
        [-76.52, 39.17],
        [-76.54, 39.17]
    ]
});

// update coordinates
const mySource = map.getSource('some id');
mySource.setCoordinates([
    [-76.54335737228394, 39.18579907229748],
    [-76.52803659439087, 39.1838364847587],
    [-76.5295386314392, 39.17683392507606],
    [-76.54520273208618, 39.17876344106642]
]);

// update url and coordinates simultaneously
mySource.updateImage({
    url: 'https://www.mapbox.com/images/bar.png',
    coordinates: [
        [-76.54335737228394, 39.18579907229748],
        [-76.52803659439087, 39.1838364847587],
        [-76.5295386314392, 39.17683392507606],
        [-76.54520273208618, 39.17876344106642]
    ]
});

map.removeSource('some id');  // remove
```

### Instance Members

### Related

- [Example: Add an image](https://www.mapbox.com/mapbox-gl-js/example/image-on-a-map/)
- [Example: Animate a series of images](https://www.mapbox.com/mapbox-gl-js/example/animate-images/)

Was this section on ImageSource helpful?

## ModelSource

[github3d-style/source/model_source.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/3d-style/source/model_source.ts#L50-L355)

A source containing single models. See the [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/#sources-model) for detailed documentation of options.

Extends [Evented](/mapbox-gl-js/api/events/#evented).

### Example

``` js
map.addSource('some id', {
  "type": "model",
  "models": {
    "ego-car" : {
         "uri": "car.glb",
         "position": [-74.0135, 40.7153],
         "orientation": [0, 0, 0],
         "materialOverrides": {
           "body": {
             "model-color": [0.00775, 0.03458, 0.43854],
             "model-color-mix-intensity": 1.0
           }
         },
         "nodeOverrides": {
           "doors_front-left": {
             "orientation": [0.0, -45.0, 0.0]
           }
         }
     }
  }
});
```

### Instance Members

Was this section on ModelSource helpful?

## RasterArrayTileSource

[githubsrc/source/raster_array_tile_source.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/source/raster_array_tile_source.ts#L54-L431)

A data source containing raster-array tiles created with [Mapbox Tiling Service](https://docs.mapbox.com/mapbox-tiling-service/guides/). See the [Style Specification](https://docs.mapbox.com/style-spec/reference/sources/#raster-array) for detailed documentation of options.

Extends [RasterTileSource](/mapbox-gl-js/api/sources/#rastertilesource).new RasterArrayTileSource(id: [string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String), options: [RasterArraySourceSpecification](#rasterarraysourcespecification), dispatcher: Dispatcher, eventedParent: [Evented](/mapbox-gl-js/api/events/#evented))

### Parameters

Name

Description

#### id

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

#### options

[`RasterArraySourceSpecification`](#rasterarraysourcespecification)

#### dispatcher

`Dispatcher`

#### eventedParent

[`Evented`](/mapbox-gl-js/api/events/#evented)

### Example

``` js
// add to map
map.addSource('some id', {
    type: 'raster-array',
    url: 'mapbox://rasterarrayexamples.gfs-winds',
    tileSize: 512
});
```

### Instance Members

### Related

- [Example: Create a wind particle animation](https://docs.mapbox.com/mapbox-gl-js/example/raster-particle-layer/)

Was this section on RasterArrayTileSource helpful?

## RasterTileSource

[githubsrc/source/raster_tile_source.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/source/raster_tile_source.ts#L50-L407)

A source containing raster tiles. See the [Style Specification](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#raster) for detailed documentation of options.

Extends [Evented](/mapbox-gl-js/api/events/#evented).new RasterTileSource(id: [string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String), options: (RasterSourceSpecification \| RasterDEMSourceSpecification \| [RasterArraySourceSpecification](#rasterarraysourcespecification)), dispatcher: Dispatcher, eventedParent: [Evented](/mapbox-gl-js/api/events/#evented))

### Parameters

Name

Description

#### id

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

#### options

`(RasterSourceSpecification | RasterDEMSourceSpecification | `[`RasterArraySourceSpecification`](#rasterarraysourcespecification)`)`

#### dispatcher

`Dispatcher`

#### eventedParent

[`Evented`](/mapbox-gl-js/api/events/#evented)

### Example

``` js
map.addSource('some id', {
    type: 'raster',
    url: 'mapbox://mapbox.satellite',
    tileSize: 256
});
```

``` js
map.addSource('some id', {
    type: 'raster',
    tiles: ['https://img.nj.gov/imagerywms/Natural2015?bbox={bbox-epsg-3857}&format=image/png&service=WMS&version=1.1.1&request=GetMap&srs=EPSG:3857&transparent=true&width=256&height=256&layers=Natural2015'],
    tileSize: 256
});
```

### Instance Members

### Related

- [Example: Add a raster tile source](https://docs.mapbox.com/mapbox-gl-js/example/map-tiles/)
- [Example: Add a WMS source](https://docs.mapbox.com/mapbox-gl-js/example/wms/)

Was this section on RasterTileSource helpful?

## VectorTileSource

[githubsrc/source/vector_tile_source.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/source/vector_tile_source.ts#L55-L497)

A source containing vector tiles in [Mapbox Vector Tile format](https://docs.mapbox.com/vector-tiles/reference/). See the [Style Specification](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#vector) for detailed documentation of options.

Extends [Evented](/mapbox-gl-js/api/events/#evented).new VectorTileSource(id: [string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String), options: any, dispatcher: Dispatcher, eventedParent: [Evented](/mapbox-gl-js/api/events/#evented))

### Parameters

Name

Description

#### id

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

#### options

`any`

#### dispatcher

`Dispatcher`

#### eventedParent

[`Evented`](/mapbox-gl-js/api/events/#evented)

### Example

``` js
map.addSource('some id', {
    type: 'vector',
    url: 'mapbox://mapbox.mapbox-streets-v8'
});
```

``` js
map.addSource('some id', {
    type: 'vector',
    tiles: ['https://d25uarhxywzl1j.cloudfront.net/v0.1/{z}/{x}/{y}.mvt'],
    minzoom: 6,
    maxzoom: 14
});
```

``` js
map.getSource('some id').setUrl("mapbox://mapbox.mapbox-streets-v8");
```

``` js
map.getSource('some id').setTiles(['https://d25uarhxywzl1j.cloudfront.net/v0.1/{z}/{x}/{y}.mvt']);
```

### Instance Members

### Related

- [Example: Add a vector tile source](https://docs.mapbox.com/mapbox-gl-js/example/vector-source/)
- [Example: Add a third party vector tile source](https://docs.mapbox.com/mapbox-gl-js/example/third-party/)

Was this section on VectorTileSource helpful?

## VideoSource

[githubsrc/source/video_source.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/source/video_source.ts#L44-L233)

A data source containing video. See the [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/#sources-video) for detailed documentation of options.

Extends [ImageSource](/mapbox-gl-js/api/sources/#imagesource).

### Example

``` js
// add to map
map.addSource('some id', {
    type: 'video',
    url: [
        'https://www.mapbox.com/blog/assets/baltimore-smoke.mp4',
        'https://www.mapbox.com/blog/assets/baltimore-smoke.webm'
    ],
    coordinates: [
        [-76.54, 39.18],
        [-76.52, 39.18],
        [-76.52, 39.17],
        [-76.54, 39.17]
    ]
});

// update
const mySource = map.getSource('some id');
mySource.setCoordinates([
    [-76.54335737228394, 39.18579907229748],
    [-76.52803659439087, 39.1838364847587],
    [-76.5295386314392, 39.17683392507606],
    [-76.54520273208618, 39.17876344106642]
]);

map.removeSource('some id');  // remove
```

### Instance Members

### Related

- [Example: Add a video](https://www.mapbox.com/mapbox-gl-js/example/video-on-a-map/)

Was this section on VideoSource helpful?Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
