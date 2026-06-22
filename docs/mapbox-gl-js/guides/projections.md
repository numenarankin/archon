<!-- Source: https://docs.mapbox.com/mapbox-gl-js/guides/projections/ -->

# Projections
Starting from v2.6, Mapbox GL JS supports multiple map projections. This feature allows you to create more accurate visualizations at every zoom level and tell a better story with your data.

Default projection for styles

In the [latest Mapbox styles](https://docs.mapbox.com/api/maps/styles/#mapbox-styles), [Globe](#globe) is the default projection.

## Map Projections

A [**map projection**](https://docs.mapbox.com/help/glossary/projection/) is a way to flatten the planet's surface onto a page or screen. Every projection has strengths and weaknesses, so the right projection depends on your use case.

For most maps, we recommend using [globe](/mapbox-gl-js/guides/globe/) to accurately represent locations on the Earth. The most notable limitation of globe is that only half the earth is visible onscreen at once. If you're building a static map or data visualization, an alternative projection might be a good choice.

Mapbox GL JS provides a variety of alternative "adaptive" projections, including projections optimized for thematic world maps, and projections for representing specific regions (such as the contiguous U.S. or Europe).

## Use projections in Mapbox GL JS

Projections are compatible with all tile sources and most map styles (with a few caveats [below](#limitations-of-adaptive-projections)). See [this example](/mapbox-gl-js/example/map-projection/) to get started quickly, or [explore all available projections](/mapbox-gl-js/example/projections/) in this more advanced example.

You can set the projection by editing the [map style](https://docs.mapbox.com/style-spec/reference/root/#projection) in Mapbox Studio, with the map constructor’s `projection` option, or at runtime via the [`setProjection`](/mapbox-gl-js/api/map/#map#setprojection) method. Mapbox v12 styles include the Globe projection by default. Maps with no projection set default to the Mercator projection.

### What projections are available?

Developers can select any of the following options when defining a style (each projection is defined in more detail below):

- **Globe**: A 3D representation of the Earth.
  - [`globe`](#globe), the default in v12 styles
- [**Thematic**](#thematic-projections): Curved map edges create a pleasing aesthetic suggesting classic world maps. A good choice for world-scale thematic maps.
  - **Equal-area**: Relative size of regions is accurate, but shapes are distorted. - [`equalEarth`](#equal-earth) - **Compromise**: A balance of shape and size distortion. - [`naturalEarth`](#natural-earth) - [`winkelTripel`](#winkel-tripel)
- [**Conic**](#conic-projections): Distortion is minimized in one area. A good choice for maps limited to a specific country or region.
  - **Equal-area**: Relative area is accurate, but shapes are distorted.
    - [`albers`](#albers)

  <!-- -->

  - **Conformal**: Shapes and angles are accurate, but sizes are distorted.
    - [`lambertConformalConic`](#lambert-conformal-conic)
- [**Rectangular**](#rectangular-projections): These projections can loop across the 180th Meridian, useful for viewing the Pacific ocean. Known as **cylindrical** projections in cartography.
  - **Compromise**: A balance of shape and size distortion.
    - [`equirectangular`](#equirectangular)

  <!-- -->

  - **Conformal**: Shapes and angles are accurate, but sizes are distorted.
    - [`mercator`](#mercator), the default if not set in style

### Define a projection as a Map constructor option

You can define a map projection when creating a `Map` instance using shorthand:

``` js
const map = new mapboxgl.Map({
  container: 'map',
  projection: 'naturalEarth'
});
```

### Set a projection at runtime

You can set or change the map’s projection after `Map` creation by using the `setProjection` method:

``` js
// Use shorthand with default parameters
map.setProjection('equalEarth');

// Or override the projection-specific options
map.setProjection({
  name: 'albers',
  center: [41.33, 123.45],
  parallels: [30, 50]
});
```

### Define a projection in a style

You can define a projection in a map style:

``` js
const map = new mapboxgl.Map({
  style: {
    version: 8,
    name: 'My Projected Style',
    sources: {
      // ...
    },
    layers: [
      // ...
    ],
    projection: {
      name: 'equalEarth'
    }
  }
});
```

Important notes about using projections in a style:

- A projection defined in a style must be an object. The string shorthand is not valid in a style specification.
- If you define one projection in a style, and set a different one at runtime (either through the map’s constructor or `setProjection`), then the runtime projection will be used.
- Calling `map.setProjection(null)` will revert from any runtime projection to the one defined in the style.

### Get current map projection

Developers can get the current map’s projection using `map.getProjection()`.

## Adaptive Projection Behavior

### Map “unskewing” on zoom

Adaptive projections in Mapbox GL JS (all projections besides globe and Mercator) have a novel adaptive design that adjusts the projection as you zoom in to reduce distortion at all zoom levels by gradually transitioning from the defined projection to Web Mercator (which is optimal on higher zooms).

### Zoom and bearing

For any [camera](https://docs.mapbox.com/help/glossary/camera/) zoom level and location, maps in adaptive projections will be rendered at the same scale they would be rendered in Mercator.

The [bearing](https://docs.mapbox.com/help/glossary/camera/#bearing) in rectangular projections corresponds directly to the rotation of the map (north is up). In thematic and conic projections, the concept of bearing is more complicated since the direction of north can be different at different points on the map:

- At low zoom levels, the bearing corresponds to the direction of north at the center of the projection.
- At high zoom levels, the bearing corresponds to the direction of north at the center of the screen.
- At intermediate zoom levels, bearing transitions between the two meanings.

[PLAYGROUNDLocation Helper](https://labs.mapbox.com/location-helper)

To experiment with camera pitch, bearing, tilt, and zoom and get values to use in your code, try our *Location Helper* tool.

### Constraining interaction

Maximum bounds constraints work differently with adaptive projections. Map panning and zooming is constrained in a way so that the center of the map doesn’t go beyond the specified geographic bounds, rather than the whole visible area. We may revisit this behavior in a future release.

## Limitations of Adaptive Projections

Adaptive projections don't support all features supported by Globe and Mercator. We plan to add support for these features in a future release.

### 3D and Background styling

[3D terrain](https://docs.mapbox.com/style-spec/reference/terrain/) and [Free Camera](/mapbox-gl-js/api/properties/#freecameraoptions) API can only be used with Globe and Mercator.

[Atmospheric styling](https://docs.mapbox.com/style-spec/reference/fog/) is also supported only in globe and Mercator projections. In other projections, the empty area around the world is always rendered as transparent and can be styled by changing the CSS background property on the map container.

### Custom style layers

[`CustomLayerInterface`](/mapbox-gl-js/api/properties/#customlayerinterface) can only be used only with Mercator.

## Thematic Projections

In these following three projections, curved map edges create a pleasant rounded aesthetic suggesting classic world maps. These projections are good choices for data visualization on a global scale.

Equal Earth and Natural Earth are [Pseudocylindrical](https://en.wikipedia.org/wiki/Map_projection#Pseudocylindrical) projections, with straight lines of latitude and curved lines of longitude. Winkel Tripel is a Pseudoazimuthal projection with lines of latitude bending slightly inward.

### Equal Earth

The [Equal Earth projection](https://en.wikipedia.org/wiki/Equal_Earth_projection) (defined as `equalEarth` in the Mapbox GL JS API) is a pseudocylindrical, equal-area projection. This projection accurately reflects sizes and is thus especially useful in data visualization when it's important to make regional size comparisons.

A notable use of Equal Earth projection is thematic maps on global temperature anomalies by NASA.

### Natural Earth

The [Natural Earth](https://en.wikipedia.org/wiki/Natural_Earth_projection) projection (defined as `naturalEarth` in the Mapbox GL JS API) is a pseudocylindrical, compromise projection. This projection looks much like Equal Earth but displays a more "natural" appearance by minimizing shape distortion at the cost of a small amount of size distortion.

### Winkel Tripel

The [Winkel Tripel](https://en.wikipedia.org/wiki/Winkel_tripel_projection) projection (defined as `winkelTripel` in the Mapbox GL JS API) is a “modified azimuthal” compromise projection. The “tripel” part of the name comes from its goal of minimizing distortion in three aspects: area, direction and distance.

Winkel Tripel appears taller and more rounded than Equal Earth and Natural Earth, and provides more accurate shapes with less accurate sizes. Winkel Tripel is commonly regarded as one of the least distorted compromise projections. The National Geographic Society and many other educational institutions use Winkel Tripel for global thematic mapping.

The curved latitude lines in Winkel Tripel make it unsuitable for maps where comparing latitude is important.

## Conic Projections

[Conic projections](https://en.wikipedia.org/wiki/Map_projection#Conic) create a map with little distortion in the area around a specific point. Further away from this point, distortion increases. In `albers`, this is shape distortion, while in `lambertConformalConic` size increases with greater distance.

This area can be placed anywhere on the earth as described [below](#customize-a-conic-projection).

### Albers

The [Albers projection](https://en.wikipedia.org/wiki/Albers_projection) (defined as `albers` in the Mapbox GL JS API) is a conic, equal-area projection. Like [Equal Earth](#equal-earth), this projection provides accurate relative sizes, but shapes are increasingly distorted at further distances.

By default, the Albers projection is centered on the mainland United States at `[-96, 37.5]` with the standard parallels `[29.5, 45.5]`. This “Albers USA” projection is commonly used for showing geographic data in which comparing state-level sizes is important, for example in U.S. elections. Notable users of the projection include U.S. Geographical Survey, U.S. Census Bureau, and National Atlas of the U.S.

Composite Albers projection (for example where Alaska and Hawaii are alongside the mainland U.S.) is not yet supported in Mapbox GL JS.

### Lambert conformal conic

The [Lambert conformal conic](https://en.wikipedia.org/wiki/Lambert_conformal_conic_projection) projection (defined as `lambertConformalConic` in the Mapbox GL JS API) is a conic, conformal projection used for aeronautical charts and many regional mapping systems. Like [Mercator](#mercator), this is a conformal projection, meaning that shapes and angles are accurately represented. Instead, regions further away from the center are increasingly exaggerated in size.

By default, this projection is centered on `[0, 30]` with the standard parallels `[30, 30]`. This projection preserves shapes and is appropriate for regional maps which need accurate shapes and angles (note that as with many other conformal projections, size distortion will increase towards the poles).

This projection is popular for aeronautical charts because straight lines on it approximate great circle routes between endpoints. Notable users include the European Environmental Agency, France, and also U.S. National Geodetic Survey for several U.S. states such as Tennessee.

### Customize a conic projection

By configuring `center` and `parallels` properties, a developer can choose where to place the area of minimized distortion.

- `parallels: [latitude1, latitude2]`: Distortion of area and shape is reduced by the projection in the region between these two lines of latitude. The parallels can be the same latitude.
- `center: [longitude, latitude]`: The location used to match scale and bearing with mercator. The size and bearing at this location will always be the same as it would be in mercator at the same zoom. At low zoom levels, other locations may have distorted size and bearing.

These properties can also be defined in the `setProjection` method or in a style.

This example shows how to configure the Albers projection to center on the U.S. state of Alaska:

``` js
const map = new mapboxgl.Map({
  container: 'map',
  projection: {
    name: 'albers',
    center: [-154, 50],
    parallels: [55, 65]
  }
});
```

A polar projection can be created by setting both parallel latitudes to 90 (for the North Pole) or -90 (for the South Pole). For instance, to create a conformal polar projection centered on Greenland:

``` js
const map = new mapboxgl.Map({
  container: 'map',
  projection: {
    name: 'lambertConformalConic',
    center: [-40, 0],
    parallels: [90, 90]
  }
});
```

For any projection besides Albers and Lambert conformal conic, the `center` and `parallels` properties will be ignored.

## Rectangular Projections

Equirectangular and Mercator are classified in cartography as [cylindrical](https://en.wikipedia.org/wiki/Map_projection#Cylindrical) projections. These projections have straight latitude and longitude lines. Their rectangular shape allows them to loop across their east and west edges at the 180th Meridian, useful for maps that need to cover the Pacific ocean. Looping can also be disabled with [setRenderWorldCopies](/mapbox-gl-js/api/map/#map#setrenderworldcopies).

### Equirectangular

The [Equirectangular](https://en.wikipedia.org/wiki/Equirectangular_projection) (Plate Carrée) projection (defined as `equirectangular` in the Mapbox GL JS API) is a cylindrical, compromise projection in which positions on the map directly correspond to their longitude and latitude values.

Equirectangular is useful for mapping the Pacific ocean while minimizing the size distortion of Mercator.

This projection is the standard for global raster datasets, such as Celestia, NASA World Wind, and Natural Earth, and is useful for displaying these datasets without distortion.

### Mercator

The [Web Mercator](https://en.wikipedia.org/wiki/Web_Mercator_projection) projection (defined as `mercator` in the Mapbox GL JS API) is a cylindrical, conformal projection and the default projection in Mapbox GL JS if projection is not specified in a style. Web Mercator is classified as [EPSG:3857](https://epsg.io/3857) and is a variant of the classic [Mercator](https://en.wikipedia.org/wiki/Mercator_projection) projection used for marine navigation. Web Mercator was the first projection introduced in web maps and remains widely used by most mapping platforms. Before the introduction of adaptive projections in v2.6, Mapbox GL JS only supported the Web Mercator projection.

Mercator accurately displays shapes and angles, which makes it useful for navigation. At the world scale, it exaggerates the size of geographic shapes near the poles. For example, Greenland appears the same size as Africa, even though it’s 14 times smaller.

Mercator is suitable for maps remaining at high zoom or cases where a map needs to cover the 180th meridian. In Mapbox GL JS, Mercator also supports some features unavailable in other projections as outlined [above](#limitations-of-adaptive-projections).

## Globe

The Globe projection (defined as `globe` in the Mapbox GL JS API) is a three-dimensional representation of the earth. Globe increases the sense of depth of the map and is a correct representation of the surface of the earth as viewed from space. Using this projection limits the display of the earth to one hemisphere at a time. This can be addressed in some cases by [rotating the globe](/mapbox-gl-js/example/globe-spin/) with camera animation.

In Mapbox GL JS, Globe is the default projection in most of the latest Mapbox styles. Globe supports some functionality that adaptive projections do not. This includes [Fog/atmospheric styling](https://docs.mapbox.com/style-spec/reference/fog/), [3D terrain](https://docs.mapbox.com/style-spec/reference/terrain/) and [Free Camera](/mapbox-gl-js/api/properties/#freecameraoptions).

Learn more about globe in the [Globe and Atmosphere guide](/mapbox-gl-js/guides/globe/).Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
