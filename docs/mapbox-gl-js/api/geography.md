<!-- Source: https://docs.mapbox.com/mapbox-gl-js/api/geography/ -->

# Geography and geometry
Search GL JS API Reference

General utilities and types that relate to working with and manipulating geographic information or geometries.

## LngLat

[githubsrc/geo/lng_lat.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/geo/lng_lat.ts#L70-L195)

A `LngLat` object represents a given longitude and latitude coordinate, measured in degrees. These coordinates use longitude, latitude coordinate order (as opposed to latitude, longitude) to match the [GeoJSON specification](https://datatracker.ietf.org/doc/html/rfc7946#section-4), which is equivalent to the OGC:CRS84 coordinate reference system.

Note that any Mapbox GL method that accepts a `LngLat` object as an argument or option can also accept an `Array` of two numbers and will perform an implicit conversion. This flexible type is documented as [LngLatLike](/mapbox-gl-js/api/geography/#lnglatlike).

new LngLat(lng: [number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number), lat: [number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number))

### Parameters

Name

Description

#### lng

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)

Longitude, measured in degrees.

#### lat

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)

Latitude, measured in degrees.

### Example

``` js
const ll = new mapboxgl.LngLat(-123.9749, 40.7736);
console.log(ll.lng); // = -123.9749
```

### Static Members

### Instance Members

### Related

- [Example: Get coordinates of the mouse pointer](https://www.mapbox.com/mapbox-gl-js/example/mouse-position/)
- [Example: Display a popup](https://www.mapbox.com/mapbox-gl-js/example/popup/)
- [Example: Highlight features within a bounding box](https://www.mapbox.com/mapbox-gl-js/example/using-box-queryrenderedfeatures/)
- [Example: Create a timeline animation](https://www.mapbox.com/mapbox-gl-js/example/timeline-animation/)

Was this section on LngLat helpful?

## LngLatBounds

[githubsrc/geo/lng_lat.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/geo/lng_lat.ts#L235-L517)

A `LngLatBounds` object represents a geographical bounding box, defined by its southwest and northeast points in [`longitude`](https://docs.mapbox.com/help/glossary/lat-lon/) and [`latitude`](https://docs.mapbox.com/help/glossary/lat-lon/). `Longitude` values are typically set between `-180` to `180`, but can exceed this range if `renderWorldCopies` is set to `true`. `Latitude` values must be within `-85.051129` to `85.051129`.

If no arguments are provided to the constructor, a `null` bounding box is created.

Note that any Mapbox GL method that accepts a `LngLatBounds` object as an argument or option can also accept an `Array` of two [LngLatLike](/mapbox-gl-js/api/geography/#lnglatlike) constructs and will perform an implicit conversion. This flexible type is documented as [LngLatBoundsLike](/mapbox-gl-js/api/geography/#lnglatboundslike).

new LngLatBounds(sw: [LngLatLike](/mapbox-gl-js/api/geography/#lnglatlike)?, ne: [LngLatLike](/mapbox-gl-js/api/geography/#lnglatlike)?)

### Parameters

Name

Description

#### sw

[`LngLatLike`](/mapbox-gl-js/api/geography/#lnglatlike)`?`

The southwest corner of the bounding box.

#### ne

[`LngLatLike`](/mapbox-gl-js/api/geography/#lnglatlike)`?`

The northeast corner of the bounding box.

### Example

``` js
const sw = new mapboxgl.LngLat(-73.9876, 40.7661);
const ne = new mapboxgl.LngLat(-73.9397, 40.8002);
const llb = new mapboxgl.LngLatBounds(sw, ne);
```

### Static Members

### Instance Members

Search Instance Members Was this section on LngLatBounds helpful?

## LngLatBoundsLike

[githubsrc/geo/lng_lat.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/geo/lng_lat.ts#L519-L531)

A [LngLatBounds](/mapbox-gl-js/api/geography/#lnglatbounds) object, an array of [LngLatLike](/mapbox-gl-js/api/geography/#lnglatlike) objects in \[sw, ne\] order, or an array of numbers in \[west, south, east, north\] order.

### Type

`(`[`LngLatBounds`](/mapbox-gl-js/api/geography/#lnglatbounds)` | [`[`LngLatLike`](/mapbox-gl-js/api/geography/#lnglatlike)`, `[`LngLatLike`](/mapbox-gl-js/api/geography/#lnglatlike)`] | [`[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)`, `[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)`, `[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)`, `[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)`])`

### Example

``` js
const v1 = new mapboxgl.LngLatBounds(
  new mapboxgl.LngLat(-73.9876, 40.7661),
  new mapboxgl.LngLat(-73.9397, 40.8002)
);
const v2 = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
const v3 = [[-73.9876, 40.7661], [-73.9397, 40.8002]];
```

Was this section on LngLatBoundsLike helpful?

## LngLatLike

[githubsrc/geo/lng_lat.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/geo/lng_lat.ts#L197-L206)

A [LngLat](/mapbox-gl-js/api/geography/#lnglat) object, an array of two numbers representing longitude and latitude, or an object with `lng` and `lat` or `lon` and `lat` properties.

### Type

`(`[`LngLat`](/mapbox-gl-js/api/geography/#lnglat)` | {lng: `[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)`, lat: `[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)`} | {lon: `[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)`, lat: `[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)`} | [`[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)`, `[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)`])`

### Example

``` js
const v1 = new mapboxgl.LngLat(-122.420679, 37.772537);
const v2 = [-122.420679, 37.772537];
const v3 = {lon: -122.420679, lat: 37.772537};
```

Was this section on LngLatLike helpful?

## MercatorCoordinate

[githubsrc/geo/mercator_coordinate.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/geo/mercator_coordinate.ts#L105-L180)

A `MercatorCoordinate` object represents a projected three dimensional position.

`MercatorCoordinate` uses the web mercator projection ([EPSG:3857](https://epsg.io/3857)) with slightly different units:

- the size of 1 unit is the width of the projected world instead of the "mercator meter"
- the origin of the coordinate space is at the north-west corner instead of the middle.

For example, `MercatorCoordinate(0, 0, 0)` is the north-west corner of the mercator world and `MercatorCoordinate(1, 1, 0)` is the south-east corner. If you are familiar with [vector tiles](https://github.com/mapbox/vector-tile-spec) it may be helpful to think of the coordinate space as the `0/0/0` tile with an extent of `1`.

The `z` dimension of `MercatorCoordinate` is conformal. A cube in the mercator coordinate space would be rendered as a cube.

new MercatorCoordinate(x: [number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number), y: [number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number), z: [number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number))

### Parameters

Name

Description

#### x

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)

The x component of the position.

#### y

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)

The y component of the position.

#### z

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `0`)

The z component of the position.

### Example

``` js
const nullIsland = new mapboxgl.MercatorCoordinate(0.5, 0.5, 0);
```

### Static Members

### Instance Members

### Related

- [Example: Add a custom style layer](https://www.mapbox.com/mapbox-gl-js/example/custom-style-layer/)

Was this section on MercatorCoordinate helpful?

## Point

[githubsrc/ui/map.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/map.ts#L5412-L5419)

A [`Point` geometry](https://github.com/mapbox/point-geometry) object, which has `x` and `y` screen coordinates in pixels, or other units.

### Type

[`Point`](/mapbox-gl-js/api/geography/#point)

### Example

``` js
const point = new mapboxgl.Point(400, 525);
```

Was this section on Point helpful?

## PointLike

[githubsrc/ui/map.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/map.ts#L5421-L5428)

A [Point](/mapbox-gl-js/api/geography/#point) or an array of two numbers representing `x` and `y` screen coordinates in pixels, or other units.

### Type

`(`[`Point`](/mapbox-gl-js/api/geography/#point)` | `[`Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)`<`[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)`>)`

### Example

``` js
const p1 = new mapboxgl.Point(400, 525); // a PointLike which is a Point
const p2 = [400, 525]; // a PointLike which is an array of two numbers
```

Was this section on PointLike helpful?Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
