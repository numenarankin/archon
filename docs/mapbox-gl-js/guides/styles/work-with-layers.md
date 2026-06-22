<!-- Source: https://docs.mapbox.com/mapbox-gl-js/guides/styles/work-with-layers/ -->

# Work with sources and layers
Layers define how map features—such as roads, buildings, water, and points of interest—are visually represented in a Mapbox style. Each layer handles rendering specific data from a source, determining its appearance and behavior on the map. With Mapbox GL JS, developers can dynamically add, remove, and change layers to customize their map's design and functionality.

This guide covers the fundamentals of working with layers, including:

- The relationship between sources and layers
- Adding and updating layers at runtime
- Controlling layer order and rendering behavior
- Using different layer types (such as fill, line, symbol, and raster layers)
- Understanding layers is essential for customizing a Mapbox-powered map and displaying data in a visually meaningful way.

## Add and update layers

You can use Mapbox GL JS API to add more styled data to the map at runtime. There are two key concepts to understand when preparing to add a layer to a style at runtime: layers and sources.

**Sources** contain geographic data. They determine the shape of the features you’re adding to the map and where in the world they belong.

**Layers** contain styling information. They determine how the data in a source should look on the map.

A **layer** is a styled representation of data of a single type (for example polygons, lines, or points) that make up a map style. For example, roads, city labels, and rivers would be three separate layers in a map. There are several layer types (for example fill, line, and symbol). You can read more about [layers in the Mapbox Style Specification](https://docs.mapbox.com/style-spec/reference/layers/).

Most layers also require a **source**. The source provides map data that Mapbox GL JS can use with a style document to render a visual representation of that data. There are several source types (for example vector tilesets, GeoJSON, and raster data). You can read more about [sources in the Mapbox Style Specification](https://docs.mapbox.com/style-spec/reference/sources/).

In Mapbox GL JS, the [`Map` class](/mapbox-gl-js/api/map/) exposes the entry point for all methods related to the style object including [sources](/mapbox-gl-js/api/map/#instance-members-sources) and [layers](/mapbox-gl-js/api/map/#instance-members-layers).

### Add a layer at runtime

To add a new layer to the map at runtime, start by adding a source using the `Style`’s [`addSource`](/mapbox-gl-js/api/map/#map#addsource) method. It is important that you add the source for a new layer after the map has loaded but *before* attempting to add the layer itself because the source is a required parameter for most layer types.

Then, you’ll use the [`addLayer`](/mapbox-gl-js/api/map/#map#addlayer) method to add the layer to the style. When adding the style layer, you will specify:

- A unique `id` that you assign to the new layer
- The layer `type` (for example fill, line, or symbol)
- What data to use by referencing a `source`
- The appearance of the data by setting various properties (for example color, opacity, and language)

The sample code below illustrates how to add a GeoJSON source and then add and style a line layer that uses the data in that source.

``` js
map.on('style.load', () => {
  map.addSource('route', {
    type: 'geojson',
    data: {
      /* ... GeoJSON data ... */
    }
  });
  map.addLayer({
    id: 'route',
    type: 'line',
    source: 'route',
    paint: {
      'line-color': '#888',
      'line-width': 8
    }
  });
});
```

The exact available properties available when adding a source and layer varies by source type and layer type. Read more about [source types](#source-types) and [layer types](#layer-types) below.

### Update a layer at runtime

You can also update the style of any layer at runtime using the layer's unique layer ID and defining style properties. The sample code below illustrates how to get an existing layer by referencing a layer ID and updating the [`line-opacity`](https://docs.mapbox.com/style-spec/reference/layers/#paint-line-line-opacity) value.

``` js
map.setPaintProperty('route', 'line-opacity', 0.9);
```

The exact available properties available when updating a layer varies by layer type. Read more about [layer types](#layer-types) below.

### Specify order of a layer at runtime for Mapbox Standard

Mapbox Standard and Standard Satellite uses the [`slot`](https://docs.mapbox.com/style-spec/reference/layers/#slot) property to specify where custom data layers can be added. **Slots** are predetermined locations in the Standard basemap where your layer can be inserted. To add custom layers in the appropriate location in the Standard basemap layer stack, Standard offers 3 carefully designed slots that you can leverage to place your layer. These slots will stay stable, and you can be sure that your own map won't break even as the basemap updates over time.

Slot

Description

`bottom`

Above polygons (land, landuse, water, etc.)

`middle`

Above lines (roads, etc.) and behind 3D buildings

`top`

Above POI labels and behind Place and Transit labels

not specified

Above all existing layers in the style

Here’s an example of how to assign a slot to a layer:

``` js
map.addLayer({ type: 'line', slot: 'middle' /* ... */ });
```

Make sure to use `slot` instead of layer [`id`](https://docs.mapbox.com/style-spec/reference/layers/#id) when inserting a custom layer into the Standard basemap. Layers within the same `slot` can be rearranged using the optional [`beforeId`](/mapbox-gl-js/api/map/#map#addlayer) argument. This argument specifies the `id` of an existing layer before which the new layer will be inserted, causing the new layer to appear visually underneath the specified layer. But, if the layers are in different `slot`s, the `beforeId` argument is ignored, and the new layer is added to the end of the layers array.

Slots and performance-optimized layers reordering

During 3D globe and terrain rendering, GL JS aims to batch multiple layers together for optimal performance. This process might lead to a rearrangement of layers. Layers draped over globe and terrain, such as `fill`, `line`, `background`, `hillshade`, and `raster`, are rendered first. These layers are rendered underneath symbols, regardless of whether they are placed in the `middle` or `top` slots or without a designated slot.

[EXAMPLELayer slot example](/mapbox-gl-js/example/geojson-layer-in-slot/)

Add a new layer to a slot in the Mapbox Standard Style.

### Specify order of a layer at runtime for other styles

Map styles contain many individual layers (for example roads, buildings, labels, and more). By default, when you add a new layer to the style, it is placed on top of all the other layers. You can specify where the new layer is positioned relative to existing layers with an additional argument to the `addLayer` method which specifies an existing layer below which the new one should go.

``` js
map.addLayer({ type: 'line' /* ... */ }, 'state-labels');
```

### Remove a layer at runtime

You can remove a layer from a style using `Style`'s [`removeLayer`](/mapbox-gl-js/api/map/#map#removelayer) method.

``` js
map.removeLayer('route');
```

## Source types

### Vector

A vector source, [`VectorTileSource`](/mapbox-gl-js/api/sources/#vectortilesource), is a vector tileset that conforms to the [Mapbox Vector Tile](https://docs.mapbox.com/vector-tiles/specification/) format. A vector source contains geographic features (and their data properties) that have already been tiled. Learn more about the benefits of vector tilesets and how they work in the [Vector tiles](https://docs.mapbox.com/vector-tiles/reference/) documentation. For vector tiles hosted by Mapbox, the "url" value should be of the form of `mapbox://username.tilesetid`.

``` js
map.addSource('terrain', {
  type: 'vector',
  url: 'mapbox://mapbox.mapbox-terrain-v2'
});
```

Note

All style layers that use a vector source must specify a [`"source-layer"`](https://docs.mapbox.com/style-spec/reference/layers/#source-layer) value.

### GeoJSON

A GeoJSON source, [`GeoJSONSource`](/mapbox-gl-js/api/sources/#geojsonsource), is data in the form of a JSON object that conforms to the [GeoJSON specification](https://geojson.org/). A GeoJSON source is a collection of one or more geographic features, which may be points, lines, and polygons. Data must be provided via a `"data"` property, whose value can be a URL or inline GeoJSON.

``` js
map.addSource('polygon', {
  type: 'geojson',
  data: { type: 'Feature', geometry: { type: 'Polygon' /* ... */ } }
});
```

[EXAMPLEAdd a polygon to a map using a GeoJSON source](/mapbox-gl-js/example/geojson-polygon/)

See the format of the data used in the sample code above in the GeoJSON polygon example.

### Raster

A raster source, [`RasterTileSource`](/mapbox-gl-js/api/sources/#rastertilesource), is a raster tileset. For raster tiles hosted by Mapbox, the "url" value should be of the form `mapbox://tilesetid`.

``` js
map.addSource('openstreetmap', {
  type: 'raster',
  tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
  tileSize: 256,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});
```

### Raster DEM

A raster DEM source, which is a special case of [`RasterTileSource`](/mapbox-gl-js/api/sources/#rastertilesource), contains elevation data and refers to Mapbox Terrain-DEM (`mapbox://mapbox.mapbox-terrain-dem-v1`), which is the only supported raster DEM source. It must be added with the `type: "raster-dem`.

``` js
map.addSource('dem', {
  type: 'raster-dem',
  url: 'mapbox://mapbox.mapbox-terrain-dem-v1'
});
```

### Image

An image source, [`ImageSource`](/mapbox-gl-js/api/sources/#imagesource), is an image that you supply along with geographic coordinates. Specify geographic coordinates in the `"coordinates"` array as `[longitude, latitude]` pairs so the map knows at what location in the world to place the image. Each coordinate pair in the `"coordinates"` array represents the image corners listed in clockwise order: top left, top right, bottom right, bottom left.

``` js
map.addSource('radar', {
  type: 'image',
  url: '/mapbox-gl-js/assets/radar.gif',
  coordinates: [
    [-80.425, 46.437],
    [-71.516, 46.437],
    [-71.516, 37.936],
    [-80.425, 37.936]
  ]
});
```

## Layer types

### Fill layer

A [`fill` style layer](https://docs.mapbox.com/style-spec/reference/layers/#fill) renders one or more filled (and optionally stroked) polygons on a map. You can use a `fill` layer to configure the visual appearance of polygon or multipolygon features.

To add a `fill` layer, you need to first add a vector or GeoJSON source that contains polygon data. Then you can use the available [properties in `fill` layer](https://docs.mapbox.com/style-spec/reference/layers/#fill) to customize its appearance (for example, the color, opacity, or pattern).

``` js
map.addLayer({
  id: 'maine',
  type: 'fill',
  source: 'maine',
  paint: {
    'fill-color': '#0080ff',
    'fill-opacity': 0.5
  }
});
```

[EXAMPLEFill layer example](/mapbox-gl-js/example/geojson-polygon/)

Add a polygon to a map with an optional stroked border using a GeoJSON source.

### Line layer

A [`line` style layer](https://docs.mapbox.com/style-spec/reference/layers/#line) renders one or more stroked polylines on the map. You can use a `line` layer to configure the visual appearance of polyline or multipolyline features.

To add a `line` layer, you need to first add a vector or GeoJSON source that contains line data. Then you can use the available [properties in `line` layer](https://docs.mapbox.com/style-spec/reference/layers/#line) to customize the appearance of the layer (for example, the color, width, or dash pattern).

``` js
map.addLayer({
  id: 'route',
  type: 'line',
  source: 'route',
  layout: {
    'line-cap': 'round'
  },
  paint: {
    'line-color': 'red',
    'line-opacity': 0.8
  }
});
```

[EXAMPLELine layer example](/mapbox-gl-js/example/geojson-line/)

Add a line to a map using a GeoJSON source.

### Symbol layer

A [`symbol` style layer](https://docs.mapbox.com/style-spec/reference/layers/#symbol) renders icon and text labels at points or along lines on a map. You can use a `symbol` layer to configure the visual appearance of labels for features in vector tiles.

To add a `symbol` layer, you need to first add a vector or GeoJSON source that contains point data. If you want to use icons in this layer, you also need to add images to the style before adding the layer. Then you can use the available [properties in `symbol` layer](https://docs.mapbox.com/style-spec/reference/layers/#symbol) to customize the appearance of the layer.

``` js
map.addLayer({
  id: 'city-label',
  type: 'symbol',
  source: 'labels',
  layout: {
    'text-field': ['get', 'city_name'],
    'text-size': 12
  }
});
```

[EXAMPLESymbol layer example](/mapbox-gl-js/example/variable-label-placement/)

Add labels with variable label placement to a map using a GeoJSON source.

### Circle layer

A [`circle` style layer](https://docs.mapbox.com/style-spec/reference/layers/#circle) renders one or more filled circles on a map. You can use a `circle` layer to configure the visual appearance of point or point collection features in vector tiles. A circle layer renders circles whose radii are measured in screen units.

To add a `circle` layer, you need to first add a vector or GeoJSON source that contains point data. Then you can use the available [properties in `circle` layer](https://docs.mapbox.com/style-spec/reference/layers/#circle) to customize the appearance of the layer (for example, radius, color, or offset).

``` js
map.addLayer({
  id: 'park-volcanoes',
  type: 'circle',
  source: 'national-park',
  paint: {
    'circle-radius': 6,
    'circle-color': '#B42222'
  }
});
```

[EXAMPLECircle layer example](/mapbox-gl-js/example/data-driven-circle-colors/)

Style circles with a data-driven property.

### Fill extrusion layer

A [`fill-extrusion` style layer](https://docs.mapbox.com/style-spec/reference/layers/#fill-extrusion) renders one or more filled (and optionally stroked) extruded (3D) polygons on a map. You can use a `fill-extrusion` layer to configure the extrusion and visual appearance of polygon or multipolygon features.

To add a `fill-extrusion` layer, you need to first add a vector or GeoJSON source that contains polygon data. The data should contain a data property used to determine the height of extrusion of each feature. This may be a physical height in meters or a way to illustrate a non-physical attribute of the area like population in Census blocks. Once you've added an appropriate source, you can use the available [properties in `fill-extrusion` layer](https://docs.mapbox.com/style-spec/reference/layers/#fill-extrusion) class to customize the appearance of the layer (for example, the height, opacity, or color).

``` js
map.addLayer({
  id: '3d-buildings',
  source: 'composite',
  'source-layer': 'building',
  filter: ['==', 'extrude', 'true'],
  type: 'fill-extrusion',
  paint: {
    'fill-extrusion-color': '#aaa',
    'fill-extrusion-height': ['get', 'height'],
    'fill-extrusion-base': ['get', 'min_height'],
    'fill-extrusion-opacity': 0.6
  }
});
```

[EXAMPLEFill extrusion layer example](/mapbox-gl-js/example/3d-buildings/)

Display buildings in 3D using a fill extrusion layer.

### Hillshade layer

A [`hillshade` style layer](https://docs.mapbox.com/style-spec/reference/layers/#hillshade), renders digital elevation model (DEM) data on the client-side.

The implementation only supports sources comprised of Mapbox Terrain RGB or Mapzen Terrarium tiles. Once you've added an appropriate source, you can use the available [properties in `hillshade` layer](https://docs.mapbox.com/style-spec/reference/layers/#hillshade) to customize the appearance of the layer.

``` js
map.addSource('dem', {
  type: 'raster-dem',
  url: 'mapbox://mapbox.mapbox-terrain-dem-v1'
});
map.addLayer({
  id: 'hillshading',
  source: 'dem',
  type: 'hillshade'
});
```

[EXAMPLEHillshade layer example](/mapbox-gl-js/example/hillshade/)

Add hillshading using Mapbox terrain DEM source.

### Heatmap layer

A [`heatmap` style layer](https://docs.mapbox.com/style-spec/reference/layers/#heatmap) renders a range of colors to represent the density of points in an area.

To add a `heatmap` layer, you need to first add a vector or GeoJSON source that contains point data. Then you can use the available [properties in `heatmap` layer](https://docs.mapbox.com/style-spec/reference/layers/#heatmap) to customize the appearance of the layer.

``` js
map.addLayer({
  id: 'earthquakes-heat',
  type: 'heatmap',
  source: 'earthquakes',
  paint: {
    'heatmap-color': [
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0,
      'rgba(33,102,172,0)',
      0.2,
      'rgb(103,169,207)',
      0.4,
      'rgb(209,229,240)',
      0.6,
      'rgb(253,219,199)',
      0.8,
      'rgb(239,138,98)',
      1,
      'rgb(178,24,43)'
    ],
    'heatmap-radius': 20
  }
});
```

[EXAMPLEHeatmap layer example](/mapbox-gl-js/example/heatmap-layer/)

Add a heatmap layer using a GeoJSON source with point data.

### Raster layer

A [`raster` style layer](https://docs.mapbox.com/style-spec/reference/layers/#raster), renders raster tiles on a map. You can use a raster layer to configure the color parameters of raster tiles.

To add a raster layer, you need to first add a raster source. Then you can use the available [properties in `raster` layer](https://docs.mapbox.com/style-spec/reference/layers/#raster) to customize the appearance of the layer.

``` js
map.addLayer({
  id: 'radar-layer',
  type: 'raster',
  source: 'radar',
  paint: {
    'raster-fade-duration': 0
  }
});
```

[EXAMPLERaster layer example](/mapbox-gl-js/example/image-on-a-map/)

Add a raster image to a map using an image source and a raster layer.

### Background layer

The [`background` style layer](https://docs.mapbox.com/style-spec/reference/layers/#background), covers the entire map. Use a `background` style layer to configure a color or pattern to show below all other map content. If the `background` layer is transparent or omitted from the style, any part of the map view that does not show another style layer is transparent.

You can use the available [properties in `background` layer](https://docs.mapbox.com/style-spec/reference/layers/#background) to customize the appearance of the layer.

``` js
map.addLayer({
  type: 'background',
  paint: {
    'background-color': 'blue',
    'background-opacity': 0.3
  }
});
```

Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
