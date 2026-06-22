<!-- Source: https://docs.mapbox.com/mapbox-gl-js/guides/ -->

# Mapbox GL JS

Current version:`v3.25.0`[View changelog](https://github.com/mapbox/mapbox-gl-js/releases)

- checkCustom map styles
- checkFast vector maps
- checkCompatible with other Mapbox tools

[Install](/mapbox-gl-js/guides/install/)[githubContribute on GitHub](https://github.com/mapbox/mapbox-gl-js)

**Mapbox GL JS** is a client-side JavaScript library for building web maps and web applications with Mapbox's modern mapping technology. You can use Mapbox GL JS to display Mapbox maps in a web browser or client, add user interactivity, and customize the map experience in your application.

JavaScript

``` html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Guides</title>
<meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no">
<link href="https://api.mapbox.com/mapbox-gl-js/v3.25.0/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/v3.25.0/mapbox-gl.js"></script>
<style>
body { margin: 0; padding: 0; }
#map { position: absolute; top: 0; bottom: 0; width: 100%; }
</style>
</head>
<body>
<div id="map"></div>
<script>
    const map = new mapboxgl.Map({
        // TO MAKE THE MAP APPEAR YOU MUST
        // ADD YOUR ACCESS TOKEN FROM
        // https://account.mapbox.com
        accessToken: 'YOUR_MAPBOX_ACCESS_TOKEN',
        container: 'map',
        style: 'mapbox://styles/mapbox/standard', // Use the standard style for the map
        projection: 'globe', // display the map as a globe
        zoom: 1, // initial zoom level, 0 is the world view, higher values zoom in
        center: [30, 15] // center the map on this longitude and latitude
    });

    map.addControl(new mapboxgl.NavigationControl());
    map.scrollZoom.disable();

    map.on('style.load', () => {
        map.setFog({}); // Set the default atmosphere style
    });
</script>

</body>
</html>
```

This code snippet will not work as expected until you replace `YOUR_MAPBOX_ACCESS_TOKEN` with an access token from [your Mapbox account](https://account.mapbox.com).

Learn more about how you can use Mapbox GL JS in your own applications on this page. Want to get started right away? See the [quickstart guide](/mapbox-gl-js/guides/install/), or take a look at our [examples](/mapbox-gl-js/example/).

## Use cases

Use cases for Mapbox GL JS include:

- Visualizing and animating geographic data
- Querying and filtering features on a map
- Placing your data between layers of a Mapbox style
- Dynamically displaying and styling custom client-side data on a map
- 3D data visualizations and animations
- Adding markers and popups to maps programmatically

For more inspiration about what you can do with Mapbox GL JS, see our [tutorials](https://docs.mapbox.com/help/tutorials/?product=Mapbox+GL+JS), [examples](/mapbox-gl-js/example/), and the Mapbox [customer showcase page](https://www.mapbox.com/showcase).

## Key concepts

### Mapbox GL

The "GL" in Mapbox GL JS refers to [Mapbox GL](https://docs.mapbox.com/help/glossary/mapbox-gl/), a graphics library that renders 2D and 3D Mapbox maps as dynamic visual graphics with [OpenGL](https://en.wikipedia.org/wiki/OpenGL) in any compatible web browser, without using additional plugins.

### Client-side rendering

Mapbox GL JS relies on client-side rendering. Mapbox GL JS maps are dynamically rendered by combining vector tiles with style rules in the browser rather than on a server, which makes it possible to change the maps's style and displayed data in response to user interaction.

### The `Map` class

The [`mapboxgl.Map`](/mapbox-gl-js/api/map/) class is the basis of every Mapbox GL JS project. The example code in this section demonstrates the minimum you need to add a map to your page:

``` js
const map = new mapboxgl.Map({
  accessToken: 'YOUR_MAPBOX_ACCESS_TOKEN',
  container: 'map', // container ID
  style: 'mapbox://styles/mapbox/streets-v12', // style URL
  center: [-74.5, 40], // starting position [lng, lat]
  zoom: 9 // starting zoom
});
```

- **`accessToken`**: This Mapbox [access token](https://docs.mapbox.com/help/glossary/access-token/) associates your Mapbox GL JS map with a Mapbox account.
- **`container`**: The HTML element in which the map will be placed. In the example above, this element is the `<div>` with an ID of `"map"`.
- **`style`**: The [style URL](https://docs.mapbox.com/help/glossary/style-url/) of the map style being used to determine which [tilesets](https://docs.mapbox.com/help/glossary/tileset/) the map includes and how they are styled. The example above uses the [Mapbox Streets v12](https://www.mapbox.com/maps/streets) style. The [Mapbox Standard Style](https://docs.mapbox.com/map-styles/standard/) is enabled by default when no `style` option is provided to the `Map` constructor.
- **`center`**: The coordinates of the map's starting position, in [`longitude, latitude`](https://docs.mapbox.com/help/glossary/lat-lon/) order.
- **`zoom`**: The [zoom level](https://docs.mapbox.com/help/glossary/zoom-level/) at which the map should be initialized. This can be a whole number or a decimal value.

### Layers

Mapbox GL JS maps can be composed of several layers that provide visual elements and map data. Each layer provides rules about how the renderer should draw certain data in the browser, and the renderer uses these layers to draw the map on the screen.

The Mapbox GL JS [`addLayer`](/mapbox-gl-js/api/map/#map#addlayer) method adds a Mapbox style layer to the map's style. The only required parameter for `addLayer` is a Mapbox style layer object. It also accepts an optional `before` parameter, which is the ID of an existing layer to insert the new layer before. If you omit this argument, then the renderer will draw the layer on top of the map.

Ordering layers with Mapbox Standard

Mapbox Standard makes adding your data layers easier through the concept of `slot`s. `Slot`s are predetermined locations in the style where your layer will be added to, such as on top of existing land layers, but below all labels. Learn more about [how to specify the order of a layer at runtime for Mapbox Standard](/mapbox-gl-js/guides/styles/work-with-layers/#specify-order-of-a-layer-at-runtime-for-mapbox-standard).

The following sections describe the elements of a Mapbox style layer object.

#### Asynchronous

Since layers in Mapbox GL JS are remote, they are asynchronous. So code that connects to Mapbox GL JS often uses event binding to change the map at the right time. For example:

``` js
map.on('load', () => {
  map.addLayer({
    id: 'terrain-data',
    type: 'line',
    source: {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-terrain-v2'
    },
    'source-layer': 'contour'
  });
});
```

This example code uses `map.on('load', function() {` to call `map.addLayer` only after the map's resources, including the style, have been loaded. If it were to run `map.addLayer` right away, it would trigger an error because the style to which you would like to add a layer would not exist yet.

#### Layer source

You must define a source when you add a new layer. A source accepts a `type` and a `url`, excluding GeoJSON sources which do not have a `url`. There are six types of sources, each with its own properties:

- [vector tiles](https://docs.mapbox.com/style-spec/reference/sources/#vector)
- [raster tiles](https://docs.mapbox.com/style-spec/reference/sources/#raster)
- [raster-dem](https://docs.mapbox.com/style-spec/reference/sources/#raster-dem)
- [GeoJSON](https://docs.mapbox.com/style-spec/reference/sources/#geojson)
- [image](https://docs.mapbox.com/style-spec/reference/sources/#image)
- [video](https://docs.mapbox.com/style-spec/reference/sources/#video)

For more information on each source type, explore the [Sources](https://docs.mapbox.com/style-spec/reference/sources/) section of the Mapbox Style Specification.

Tilesets can include multiple subsets of data called [source layers](https://docs.mapbox.com/help/glossary/source-layer/). As an example, the Mapbox Streets tileset contains source layers for roads, parks, and more. To make sure your layers are referencing the correct source layers, your layer object also needs to include a `source-layer` (often the name of the original file). See this example:

``` js
map.on('load', () => {
  map.addLayer({
    id: 'rpd_parks',
    type: 'fill',
    source: {
      type: 'vector',
      url: 'mapbox://mapbox.3o7ubwm8'
    },
    'source-layer': 'RPD_Parks'
  });
});
```

addSource()

You can also add sources using the Mapbox GL JS [`addSource`](/mapbox-gl-js/api/map/#map#addsource) method. There is no difference in map performance when using this alternative method, but it is sometimes preferable to keep code more readable.

#### Layout and paint properties

Layers feature two properties that enable data styling: [`paint`](https://docs.mapbox.com/style-spec/reference/layers/#paint) and [`layout`](https://docs.mapbox.com/style-spec/reference/layers/#layout). These are used to define how data will be rendered on the map. `layout` properties refer to placement and visibility, among other high-level preferences, and are applied early in the rendering process. `paint` properties are more fine-grained style attributes like opacity, color, and translation. They are less processing-intensive and are rendered later.

The following code adds a layer to a map and styles the data with a green fill:

``` js
map.on('load', () => {
  map.addLayer({
    id: 'rpd_parks',
    type: 'fill',
    source: {
      type: 'vector',
      url: 'mapbox://mapbox.3o7ubwm8'
    },
    'source-layer': 'RPD_Parks',
    layout: {
      visibility: 'visible'
    },
    paint: {
      'fill-color': 'rgba(61,153,80,0.55)'
    }
  });
});
```

The final product for the code snippet above could be a map zoomed to show San Francisco with parks shown as green polygons. The `RPD_Parks` layer could contain vector polygons from the city's park lands data.

addLayer()

If you added your source using the alternative [`addSource`](/mapbox-gl-js/api/map/#map#addsource) method, you will need to include the source `id` as the source in [`addLayer`](/mapbox-gl-js/api/map/#map#addlayer).

### Camera

The camera is the map's field of view. Mapbox GL JS provides the following parameters for adjusting the camera's perspective: `center`, `zoom`, `bearing` (the visual rotation of the map), and `pitch` (the visual tilt of the map). The [map's initial perspective](/mapbox-gl-js/api/map/), [`jumpTo`](/mapbox-gl-js/api/map/#map#jumpto), [`easeTo`](/mapbox-gl-js/api/map/#map#easeto), and [`flyTo`](/mapbox-gl-js/api/map/#map#flyto) all use [common camera options](/mapbox-gl-js/api/properties/#cameraoptions).

[PLAYGROUNDLocation Helper](https://labs.mapbox.com/location-helper)

To experiment with camera pitch, bearing, tilt, and zoom and get values to use in your code, try our *Location Helper* tool.

## Use Mapbox GL JS with other tools

Mapbox GL JS works well with many other Mapbox tools. You can use your own data in a map, create your own custom map style, add interactivity, and more.

### Use your own data

With Mapbox GL JS, you have access to [Mapbox tilesets](https://docs.mapbox.com/help/getting-started/mapbox-data/) that provide a large amount of geographic data. You can also [upload your own data](https://docs.mapbox.com/help/troubleshooting/uploads/) using [Mapbox Studio](https://docs.mapbox.com/studio-manual/), [Mapbox Tiling Service](https://docs.mapbox.com/api/maps/mapbox-tiling-service/), or the [Uploads API](https://docs.mapbox.com/api/maps/uploads/), then access and display it in your Mapbox GL JS map.

### Style your maps

You can use any [Mapbox-owned style](https://docs.mapbox.com/api/maps/styles/#mapbox-styles) like [Mapbox Streets](https://www.mapbox.com/maps/streets) to style your map. Or you can use your own custom styles created in [Mapbox Studio](https://docs.mapbox.com/studio-manual/guides/map-styling/). For more examples of Mapbox-designed and custom map styles being used in Mapbox GL JS maps, see our [Examples page](/mapbox-gl-js/example/?topic=Styles).

### Interactivity

Third party tools allow you add additional interactivity to your Mapbox GL JS map. For example, you can do spatial analysis in your Mapbox GL JS map using [Turf.js](/mapbox-gl-js/example/measure/), add a 3D model to your map using [three.js](/mapbox-gl-js/example/add-3d-model/), or create animations that respond to sounds in your user's environment using the [Web Audio API](/mapbox-gl-js/example/dancing-buildings/). For more ways to use Mapbox GL JS with various third-party tools, see our [Examples page](/mapbox-gl-js/example/).

Mapbox GL JS also supports many plugins that you can use to add interactive elements to your web map. There are plugins for adding interactive drawing tools, adding inset maps, integrating with the Mapbox Geocoding API and the Mapbox Directions API, and more. Explore the [Mapbox GL JS plugins page](/mapbox-gl-js/plugins/) for more details.

### Mapbox web services APIs

Mapbox GL JS is an excellent starting point for apps that use one or more [Mapbox web services APIs](https://docs.mapbox.com/api/overview/). For example, you can use the [Directions API](https://docs.mapbox.com/api/navigation/directions/) to [visualize turn-by-turn directions on a map](https://docs.mapbox.com/help/tutorials/getting-started-directions-api/), or the [Isochrone API](https://docs.mapbox.com/api/navigation/isochrone/) to [visualize estimated travel times](https://docs.mapbox.com/help/tutorials/get-started-isochrone-api/). For more examples of ways to use Mapbox web services APIs with Mapbox GL JS, see our [Tutorials page](https://docs.mapbox.com/help/tutorials/?search=api) and our [Mapbox GL JS examples page](/mapbox-gl-js/example/?search=api).

### JavaScript frameworks

Mapbox GL JS can be used with various JavaScript frameworks, including React. To learn more about using Mapbox GL JS with React, see the [Use Mapbox GL JS in a React app tutorial](https://docs.mapbox.com/help/tutorials/use-mapbox-gl-js-with-react/).

## Attribution

When you create a map with Mapbox GL JS, it automatically includes attribution on the bottom right corner of the map. For additional display options, see the API documentation for [`AttributionControl`](/mapbox-gl-js/api/markers/#attributioncontrol). For more details on what kinds of attribution Mapbox requires and why, see the [Attribution](https://docs.mapbox.com/help/getting-started/attribution/) guide.Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
