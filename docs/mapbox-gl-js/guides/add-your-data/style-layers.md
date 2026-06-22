<!-- Source: https://docs.mapbox.com/mapbox-gl-js/guides/add-your-data/style-layers/ -->

# Style layers
When using **Mapbox GL JS**, **Style Layers** provide a way to display many features on a map from `vector` or `geojson` sources. In contrast to **Markers**, which are HTML elements positioned above the map, Style Layers are rendered directly within the map canvas using WebGL.

Style layers provide a more efficient and performant way to display many features on a map. They can display points, lines, and polygons and offer several options for importing, styling, and interacting with your data.

Style LayersAfter your data as a vector or geojson source, you can add a style layer to visualize it on the map.

**Benefits:**

- Style Layers are more efficient and performant, especially when dealing with a large number of features on the map from `vector` or `geojson` sources.
- Style Layers offer extensive customization options, allowing developers to precisely control the appearance of map elements. This includes options such as the color, opacity, size and many other visual attributes listed in the [Layers section](https://docs.mapbox.com/style-spec/reference/layers/) of the Mapbox Style Spec.

**Limitations:**

- Data must be prepared as a hosted vector tileset or valid GeoJSON data.
- Style Layers require a developer to learn specific Mapbox APIs and usage patterns associated with Layers. In contrast, Markers use higher-level abstractions.
- Using the lower-level APIs of Style Layers may take more time, especially if you are new to Mapbox GL JS or mapping technologies.
- To achieve more sophisticated data-driven styling, developers will need to learn how to use [Mapbox Expressions](https://docs.mapbox.com/style-spec/reference/expressions/) to control the appearance of map features based on the underlying data. This adds complexity to the development process.

This guide covers the basics of adding your own data to a map using sources and layers. To learn more about working with sources and layers, see the full guide:

[RELATEDMap styles: Work with sources and layers](/mapbox-gl-js/guides/styles/)

See the full guide on working with sources and layers in Mapbox GL JS.

## Add your data as a source

Before you can add a Style Layer, you need to add a data source to the map. Sources provide the geographic data that the Style Layer will render. The most commonly used source types are `vector` and `geojson` sources, each requiring different data formats and handling.

Both `vector` and `geojson` sources are added using the [`Map.addSource`](/mapbox-gl-js/api/map/#map#addsource) method.

### `vector` sources

Vector sources retrieve data from a server in the form of [vector tiles](https://docs.mapbox.com/data/tilesets/guides/vector-tiles-introduction/), or chunks of geographic data representing small areas of the earth's surface. Using vector tiles means you don't have to load all the data at once, which is ideal for large datasets that cover wide geographic areas.

To add your own data as a vector source, you must first process the data into a vector tileset. There are several options available for creating and hosting vector tilesets:

- Use Mapbox's [Data manager](https://console.mapbox.com/studio/tilesets/) to upload data and generate vector tiles using an intuitive graphical user interface.
- Use [Mapbox Tiling Service (MTS)](https://docs.mapbox.com/mapbox-tiling-service/guides/) to build a data pipeline for continuous updates to a vector tileset from source data.
- Use [third party tools](https://github.com/mapbox/awesome-vector-tiles?tab=readme-ov-file#parsers--generators) to create vector tiles from your source data and host them on your own infrastructure.

#### Add a Mapbox-hosted vector source

Vector tilesets hosted on your Mapbox account are accessible using the tileset URL following the format `mapbox://username.tilesetid`.

The following snippet shows how to add a Mapbox-hosted vector source:

``` javascript
map.addSource('vector-source', {
  'type': 'vector',
  'url': 'mapbox://your-tileset-id'
});

// now you can add a layer to use this source
```

[EXAMPLEAdd a vector tile source](/mapbox-gl-js/example/vector-source/)

See an interactive example showing how to add a Mapbox-hosted vector tile source to a map.

#### Add a third-party vector source

You can also add vector sources hosted by third-party providers or on your own infrastructure. To do this, you need to provide the URL template for the vector tiles, which typically includes placeholders for the zoom level (`{z}`), x-coordinate (`{x}`), and y-coordinate (`{y}`) of the tile.

``` javascript
map.addSource('third-party-vector-source', {
  'type': 'vector',
  'url': 'https://{s}.example.com/tiles/{z}/{x}/{y}.pbf'
});
```

[EXAMPLEAdd a third party vector tile source](/mapbox-gl-js/example/third-party/)

See an interactive example showing how to add a third party vector tile source to a map.

### `geojson` sources

`geojson` sources contain the same type of data as vector sources, but the data is loaded from a [GeoJSON](https://geojson.org/) object or URL. This allows for more flexibility as developers can change and host GeoJSON data without needing to regenerate and serve vector tiles.

A limitation of `geojson` sources is that they may not perform as well as vector tiles when rendering large datasets, as the entire dataset must be added to the map at once regardless of what features are visible on the map's current location and zoom level.

Developers will often source data from a custom API endpoint that serves GeoJSON data live from a database, or they may use static GeoJSON files hosted on the web or bundled with their app.

#### Add a `geojson` source from a URL

`addSource` accepts a URL to a GeoJSON file, which can be hosted on your own server or a third-party service. Mapbox GL JS will fetch the data from the URL behind the scenes and create a source from it.

``` javascript
map.addSource('geojson-source', {
  'type': 'geojson',
  'data': 'https://example.com/data.geojson'
});

// now you can add a layer to use this source
```

#### Add a `geojson` source from a local file

You can store geojson files alongside your HTML, CSS, and JavaScript files in your project and load them using a relative URL. Note that this approach requires the site and its files to be served from a web server, as most browsers block fetching local files due to security restrictions.

``` javascript
map.addSource('geojson-source', {
  'type': 'geojson',
  'data': './path-to-my-geojson-file.geojson'
});

// now you can add a layer to use this source
```

If you are using a bundler, you may be able to import a GeoJSON file at the top of your JavaScript file, making it available as a JavaScript object.

``` javascript
import someGeojsonData from './path-to-my-geojson-file.geojson' assert { type: 'json' };

map.addSource('geojson-source', {
  'type': 'geojson',
  'data': data
});

// now you can add a layer to use this source
```

#### Add a `geojson` source from inline data

You can define a GeoJSON object directly in your JavaScript code and use it as the data for a `geojson` source. This is useful for small or static datasets or when you want to quickly test with sample data.

``` javascript
const myGeojsonData = {
    'type': 'FeatureCollection',
    'features': [
      {
        'type': 'Feature',
        'geometry': {
          'type': 'Point',
          'coordinates': [-74.0060, 40.7128]
        },
        'properties': {
          'title': 'New York City'
        }
      },
      ... // more features here
    ]
  }

map.addSource('geojson-source', {
  'type': 'geojson',
  'data': myGeojsonData
});

// now you can add a layer to use this source
```

### Other source types

For a complete list of source types supported by Mapbox GL JS, see the [Sources guide](/mapbox-gl-js/guides/styles/) or consult the references listed below.

[RELATEDSources API reference](https://docs.mapbox.com/mapbox-gl-js/api/sources/)

API reference documentation for adding sources using Mapbox GL JS.

[RELATEDMapbox Style Specification - Sources](https://docs.mapbox.com/style-spec/reference/sources/)

View the reference docs for the Mapbox Style Specification to see details about each source type and its properties.

## Add layers that use your data sources

Once you have added a source to the map, you can add a Style Layer that uses that source to render features on the map.

For example, you can create a `circle` layer to represent point data as circles on the map, or a `symbol` layer to display icons or text. The following snippet shows how to add a `circle` layer and a `symbol` layer that uses a common source:

``` javascript
// a vector or geojson source with id "my-pointdata-source" must have been added to the map

// add a circle layer
map.addLayer({
  'id': 'circle-layer',
  'type': 'circle',
  'source': 'my-pointdata-source',
  'paint': {
    'circle-radius': 6,
    'circle-color': '#007cbf'
  }
});

// add a symbol layer
map.addLayer({
  'id': 'symbol-layer',
  'type': 'symbol',
  'source': 'my-pointdata-source',
  'layout': {
    'icon-image': 'my-icon',
    'icon-size': 1.5
  }
});
```

### Layer Types for `vector` and `geojson` sources

Layer types are defined in the [Mapbox Style Specification](https://docs.mapbox.com/style-spec/) and are used to render different types of data on the map. The most common layer types for showing data from `vector` and `geojson` sources are:

- **Circle Layer**: This layer is used to represent point data as circles on the map, useful for visualizing locations with minimal code and configuration.

[EXAMPLECircle Layer Example](/mapbox-gl-js/example/external-geojson/)

See an interactive example showing how to add a GeoJSON source to a map and visualize it using a circle layer.

- **Line Layer**: This layer is used to render lines on the map, often used to show routes, directions or paths.

[EXAMPLELine Layer Example](/mapbox-gl-js/example/geojson-line/)

See an interactive example showing how to add a GeoJSON source to a map and visualize it using a line layer.

- **Fill Layer**: This layer is used to fill a polygon with a color.

[EXAMPLEFill Layer Example](/mapbox-gl-js/example/geojson-polygon/)

See an interactive example showing how to add a GeoJSON source to a map and visualize it using a fill layer.

- **Symbol Layer**: This layer is used to render icons or text representing point locations on the map.

[EXAMPLESymbol layer example](/mapbox-gl-js/example/variable-label-placement/)

See an interactive example showing how to add a GeoJSON source to a map and represent it using symbol layers to show glyphs and text.

The layers each have their own set of properties and styling options, allowing you to customize the appearance of the map features. For example, you can set the color, opacity, size, and other visual attributes of each layer type.

For details and code snippets about all available layer types, see the [Layers guide](/mapbox-gl-js/guides/styles/), or browse the examples below.

Each layer must specify a data source, which defines the geographic data that a layer will render.

### Adding interactivity to layers

You can add click and hover events to layers to make them interactive:

``` javascript
// assume a layer with id "airport" has been added to the map

map.addInteraction('click', {
    type: 'click',
    target: { layerId: 'airport' },
    handler: ({ feature }) => {
        console.log('Clicked on airport:', feature.properties);
        // handle the click event, e.g., show a popup or highlight the feature
    }
});
```

[EXAMPLEAdd feature-level interactions to a map](/mapbox-gl-js/example/simple-interactions/)

Learn how to add click and hover interactions to a layer on the map.

[GUIDEUser Interactions Guide](/mapbox-gl-js/guides/user-interactions/interactions/)

See the **Interactions API Guide** for more details on interacting with features on the map.

### Data-driven styling

Use [expressions](https://docs.mapbox.com/style-spec/reference/expressions/) to style features based on their properties. It is also possible to style features based on zoom level, allowing for dynamic visualizations that change as users zoom in and out.

``` javascript
map.addLayer({
  'id': 'data-driven-circles',
  'type': 'circle',
  'source': 'my-geojson-source',
  'paint': {
    // make circles larger based on a 'mag' property
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['get', 'mag'],
      1, 8,
      1.5, 10,
      2, 12,
      2.5, 14,
      3, 16,
      3.5, 18,
      4.5, 20,
      6.5, 22,
      8.5, 24,
      10.5, 26
    ],
    // color circles based on a 'mag' property
    'circle-color': [
      'interpolate',
      ['linear'],
      ['get', 'mag'],
      1, '#fff7ec',
      1.5, '#fee8c8',
      2, '#fdd49e',
      2.5, '#fdbb84',
      3, '#fc8d59',
      3.5, '#ef6548',
      4.5, '#d7301f',
      6.5, '#b30000',
      8.5, '#7f0000',
      10.5, '#000'
    ],
    'circle-stroke-color': 'white',
    'circle-stroke-width': 1,
    'circle-opacity': 0.6
  }
});
```

[EXAMPLEStyle circles with a data-driven property](/mapbox-gl-js/example/data-driven-circle-colors/)

Learn how to style circle layers based on a data property using expressions.

[EXAMPLEChange building color based on zoom level](/mapbox-gl-js/example/change-building-color-based-on-zoom-level/)

Learn how to style building layers based on the zoom level using expressions.

### Other layer types

Other layer types are possible, including raster tile layers, images, videos, and custom types. For a complete list of layer types supported by Mapbox GL JS, see the [Layers guide](/mapbox-gl-js/guides/styles/) or consult the references listed below.

[RELATEDLayers API reference](https://docs.mapbox.com/mapbox-gl-js/api/map/#addlayer)

API reference documentation for adding style layers using Mapbox GL JS.

[RELATEDMapbox Style Specification - Layers](https://docs.mapbox.com/style-spec/reference/layers/)

View the reference docs for the Mapbox Style Specification to see details about each layer type and its properties.

## Add your data to a custom style in Mapbox Studio

The concepts outlined above involve coding to add sources and layers to the map at runtime after the initial map style has been loaded. Using [Mapbox Studio](https://console.mapbox.com/studio/), you can create a custom style that combines your data sources and layers with basemap layers provided by Mapbox.

Adding your data to a custom style requires vector sources (GeoJSON sources are not supported in Mapbox Studio) and allows you to load the map in your application with your data already included and styled, simplifying your runtime code.

See our tutorials for more information on creating custom styles:

[RELATEDAdd and style data with the Mapbox Style Editor](https://docs.mapbox.com/help/tutorials/add-data-to-mapbox-style/)

This tutorial will walk you through the process of adding custom data to a style that uses the Mapbox Standard basemap.

Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
