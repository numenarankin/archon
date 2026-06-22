<!-- Source: https://docs.mapbox.com/mapbox-gl-js/guides/migrate/ -->

# Migrate to Mapbox GL JS v3
Mapbox GL JS v3 enables the [**Mapbox Standard Style**](https://docs.mapbox.com/map-styles/standard/) and **Mapbox Standard Satellite Style**, a new realistic **3D lighting** system, **3D models** for landmarks, building and terrain **shadows** and many other visual enhancements, and an ergonomic API for using a new kind of rich, evolving, configurable map styles and seamless integration with custom data.

## Update Dependencies

Mapbox GL JS v3 is supported in most modern browsers. Mapbox GL JS v3 is backwards-compatible and existing layers and APIs will continue to work as expected. To use the new Mapbox GL JS v3 in your project, you need to import it using the Mapbox GL JS CDN or install the `mapbox-gl` npm package.

To learn how to install Mapbox GL JS, see the related install guides:

[GUIDEInstall Mapbox GL JS with a Content Delivery Network](https://docs.mapbox.com/mapbox-gl-js/guides/get-started/use-with-cdn/)

This guide will walk you through importing the Mapbox libraries directly into the file with a script tag and then creating a map.

[GUIDEInstall Mapbox GL JS with a Module Bundler](https://docs.mapbox.com/mapbox-gl-js/guides/get-started/use-with-npm/)

This guide will walk you through npm commands which will install a Mapbox npm package to your computer and help you spin up a project and create a map in JavaScript, React, Svelte or Vue.

## Explore New Features

### The Mapbox Standard style

We're excited to announce the launch of Mapbox Standard, our latest Mapbox style, now accessible to all customers. The new Mapbox Standard core style enables a highly performant and elegant 3D mapping experience with powerful dynamic lighting capabilities, landmark 3D buildings, and an expertly crafted symbolic aesthetic.

With Mapbox Standard, we are also introducing a new paradigm for how to interact with map styles. When you use this style in your application we will continuously update your basemap with the latest features with no additional work required from you. This ensures that your users will always have the latest features of our maps. You can get more information about the available presets and configuration options of the Standard style in the style documentation.

- The Mapbox Standard Style (`mapbox://styles/mapbox/standard`) is now enabled by default when no `style` option is provided to the `Map` constructor. Or, you can still [explicitly set the style](/mapbox-gl-js/guides/styles/set-a-style/#custom-styles) by passing the URL to the `style` option of the `Map` constructor.

- The Mapbox Standard Style offers a dynamic way to personalize your maps. The map's appearance can be changed using the `map.setConfigProperty` method, where you reference the Standard Style as `basemap`, followed by the configuration property, like light preset or label visibility, and then specify the desired value.

- The Mapbox Standard style features 4 light presets: "Day", "Dusk", "Dawn", and "Night". After the style has loaded, the light preset can be changed from the default, "Day", to another preset with a single line of code:

``` js
map.on('style.load', () => {
  map.setConfigProperty('basemap', 'lightPreset', 'dusk');
});
```

Changing the light preset will alter the colors and shadows on your map to reflect the time of day. For more information, refer to the [Lighting API](#lighting-api) section.

Similarly, you can set other configuration properties on the Standard style such as showing POIs, place labels, or specific fonts:

``` js
map.on('style.load', () => {
  map.setConfigProperty('basemap', 'showPointOfInterestLabels', false);
});
```

The Standard style offers 8 configuration properties for developers to change when they import it into their own style:

Property

Type

Description

`showPlaceLabels`

`Bool`

Shows and hides place label layers.

`showRoadLabels`

`Bool`

Shows and hides all road labels, including road shields.

`showPointOfInterestLabels`

`Bool`

Shows or hides all POI icons and text.

`showTransitLabels`

`Bool`

Shows or hides all transit icons and text.

`show3dObjects`

`Bool`

Shows or hides all 3D layers (3D buildings, landmarks, trees, etc.) including shadows, ambient occlusion, and flood lights.

`theme`

`String`

Switches between 3 themes: `default`, `faded` and `monochrome`.

`lightPreset`

`String`

Switches between 4 time-of-day states: `dusk`, `dawn`, `day`, and `night`.

`font`

`String`

Defines font family for the style from predefined options.

### The Mapbox Standard Satellite style

The Standard Satellite Style (`mapbox://styles/mapbox/standard-satellite`) combines updated satellite imagery and vector layers to offer users improved clarity and detail. Like Standard style, the Satellite Style receives all updates automatically and also supports light presets. Additionally, it introduces two new configurations `showRoadsAndTransit` and `showPedestrianRoads`. Users can now choose to hide roads, simplifying the map style for a better focus on specific areas or features.

The Standard Satellite style offers 8 configuration properties for developers to change when they import it into their own style:

Property

Type

Description

`showRoadsAndTransit`

`Bool`

Shows and hides all roads and transit networks.

`showPedestrianRoads`

`Bool`

Shows and hides all pedestrian roads, paths, trails.

`showPlaceLabels`

`Bool`

Shows and hides place label layers.

`showRoadLabels`

`Bool`

Shows and hides all road labels, including road shields.

`showPointOfInterestLabels`

`Bool`

Shows or hides all POI icons and text.

`showTransitLabels`

`Bool`

Shows or hides all transit icons and text.

`lightPreset`

`String`

Switches between 4 time-of-day states: `dusk`, `dawn`, `day`, and `night`.

`font`

`String`

Defines font family for the style from predefined options.

**Important**: Standard satellite style doesn't support `theme` and `show3dObjects` configuration.

### Layer `Slot`s

Mapbox Standard and Mapbox Standard Satellite are making adding your own data layers easier for you through the concept of `slot`s. `Slot`s are predetermined locations in the style where your layer will be added to (such as on top of existing land layers, but below all labels). To do this, we've added a new `slot` property to each `Layer`. This property allows you to identify which `slot` in the Mapbox Standard your new layer should be placed in. To add custom layers in the appropriate location in the Standard or Standard Satellite styles layer stack, we added 3 carefully designed slots that you can leverage to place your layer:

Slot

Description

`bottom`

Above polygons (land, landuse, water, etc.)

`middle`

Above lines (roads, etc.) and behind 3D buildings

`top`

Above POI labels and behind Place and Transit labels

not specified

If there is no identifier, the new layer will be placed above all existing layers in the style

Slots and performance-optimized layers reordering

During 3D globe and terrain rendering, GL JS aims to batch multiple layers together for optimal performance. This process might lead to a rearrangement of layers. Layers draped over globe and terrain, such as `fill`, `line`, `background`, `hillshade`, and `raster`, are rendered first. These layers are rendered underneath symbols, regardless of whether they are placed in the `middle` or `top` slots or without a designated slot.

Set the preferred `slot` on the `Layer` object before adding it to your map and your layer will be appropriately placed in the Standard style's layer stack.

``` js
map.addLayer({
  id: 'points-of-interest',
  slot: 'middle',
  source: {
    type: 'vector',
    url: 'mapbox://mapbox.mapbox-streets-v8'
  },
  'source-layer': 'poi_label',
  type: 'circle'
});
```

**Important**: For the new Standard and Standard Satellite style, you can only add layers to these three slots (`bottom`, `middle`, `top`) within the Standard and Standard Satellite style basemaps.

Like with the classic Mapbox styles, you can still use the layer position in `map.addLayer(layer, beforeId)` method when importing the Standard Style or Standard Satellite style. But, this method is only applicable to custom layers you have added yourself. If you add two layers to the same slot with a specified layer position the latter will define order of the layers in that slot.

When using the Standard style or Standard Satellite style, you get the latest basemap rendering features, map styling trends and data layers as soon as they are available, without requiring any manual migration/integration. On top of this, you'll still have the ability to introduce your own data to the map and control your user's experience. If you have feedback or questions about the Mapbox Standard style or Standard Satellite style reach out to: <hey-map-design@mapbox.com>.

Classic Mapbox styles (such as [Mapbox Streets](https://www.mapbox.com/maps/streets), [Mapbox Light](https://www.mapbox.com/maps/light), and [Mapbox Satellite Streets](https://www.mapbox.com/maps/satellite)) and any custom styles you have built in Mapbox Studio will still work like they do in v2, so no changes are required.

### Lighting API

The new Standard and Standard Satellite style and its dynamic lighting is powered by the new Style and Lighting APIs that you can experiment with. The following experimental APIs can be used to control the look and feel of the map.

In GL JS v3 we've introduced new experimental lighting APIs to give you control of lighting and shadows in your map when using 3D objects: `AmbientLight` and `DirectionalLight`. We've also added new APIs on `FillExtrusionLayer` and `LineLayer` to support this 3D lighting styling and enhance your ability to work with 3D model layers. Together, these properties can illuminate your 3D objects such as buildings and terrain to provide a more realistic and immersive map experience for your users. Set these properties at runtime to follow the time of day, a particular mood, or other lighting goals in your map.

### Style API and expressions improvements

We have introduced a new set of expressions to enhance your styling capabilities:

- Introduced `hsl`, `hsla` color expression: These expressions allow you to define colors using hue, saturation, lightness format.
- Introduced `random` expression: Generate random values using this expression. Use this expression to generate random values, which can be particularly helpful for introducing randomness into your map data.
- Introduced `measureLight` expression lights configuration property: Create dynamic styles based on lighting conditions.
- Introduced `config` expression: Retrieves the configuration value for the given option.
- Introduced `raster-value` expression: Returns the raster value of a pixel computed via `raster-color-mix`.
- Introduced `distance` expression: Returns the shortest distance in meters between the evaluated feature and the input geometry.

Mapbox GL JS v3 also introduces a new set of paint properties:

- `background`:
  - `background-emissive-strength`
- `circle`:
  - `circle-emissive-strength`
- `fill`:
  - `fill-emissive-strength`
  - `fill-extrusion-ambient-occlusion-ground-attenuation`
  - `fill-extrusion-ambient-occlusion-ground-radius`
  - `fill-extrusion-ambient-occlusion-wall-radius`
  - `fill-extrusion-flood-light-color`
  - `fill-extrusion-flood-light-ground-attenuation`
  - `fill-extrusion-flood-light-ground-radius`
  - `fill-extrusion-flood-light-intensity`
  - `fill-extrusion-flood-light-wall-radius`
  - `fill-extrusion-vertical-scale`
- `icon`:
  - `icon-emissive-strength`
  - `icon-image-cross-fade`
- `line`:
  - `line-emissive-strength`
- `raster`:
  - `raster-color-mix`
  - `raster-color-range`
  - `raster-color`
- `text`:
  - `text-emissive-strength`

## Migration guide

Mapbox GL JS v3 is backwards-compatible and existing layers and APIs will continue to work as expected, but there are some things to be aware of before upgrading from old versions.

- Mapbox GL JS is distributed as an ES6 compatible JavaScript bundle compatible with all major modern browsers. If you transpile Mapbox GL JS, upgrading from v1 to v3 may require modifications to your bundler configuration. See [Transpiling](/mapbox-gl-js/guides/transpiling/) for detailed guidance.
- Mapbox GL JS has not supported Internet Explorer 11 since v1. If you need to support Internet Explorer, consider using the [Mapbox Static Images API](https://docs.mapbox.com/api/maps/static-images/) for non-interactive maps or using the [Mapbox Static Tiles API](https://docs.mapbox.com/api/maps/static-tiles/) with another library for interactive maps.
- The default `maxPitch` increased from 60° to 85° in v2. This change makes it possible to view above the horizon when the map is fully pitched. We recommend adding a customizable sky with [atmospheric styling](/mapbox-gl-js/guides/globe/#atmosphere-styling). If the map's [`fog`](https://docs.mapbox.com/style-spec/reference/fog/) property is not set, the area above the horizon will be transparent to any pixels behind the map.
- A valid Mapbox access token is required to instantiate a `Map` object. Assign a token using the `accessToken` option in the `Map` constructor. To create an account or a new access token, visit <https://account.mapbox.com>.
- The action that triggers a map load has changed. In v1, a map load would occur whenever a `Map` instance was created *and* the map requested Mapbox-hosted tile resources. In v3, a map load occurs whenever a `Map` instance is created regardless of whether the map requests any Mapbox-hosted tile resources. Before updating an existing implementation of GL JS to v3, review the [pricing documentation](https://docs.mapbox.com/accounts/guides/pricing/#web-maps).
- From v3.5.0, Mapbox GL JS uses [Typescript](https://www.typescriptlang.org/) instead of [Flow](https://flow.org/). Community types `@types/mapbox-gl` are not fully compatible with the new first-class types. Users relying on the community types may experience breaking changes. Remove the `@types/mapbox-gl` dependency and refer to the [v3.5.0 migration guide](https://github.com/mapbox/mapbox-gl-js/issues/13203) for instructions on upgrading, resolving common issues, and asking questions about the migration to the first-class types.
- From v3.11.0, the [`at`](https://docs.mapbox.com/style-spec/reference/expressions/#at) expression does not interpolate anymore. Use [`at-interpolated`](https://docs.mapbox.com/style-spec/reference/expressions/#at-interpolated) if you want to keep the old behavior.

## Known issues and limitations

To report new issues with Mapbox GL JS v3, create a [bug report](https://github.com/mapbox/mapbox-gl-js/issues/new?template=Bug_report.md) on GitHub.

- Discontinued WebGL 1 support. WebGL 2 is now mandatory for GL JS v3 usage, aligned with universal [browser support](https://caniuse.com/webgl2).
- During 3D globe and terrain rendering, GL JS aims to batch multiple layers together for optimal performance. This process might lead to a rearrangement of layers. Layers draped over globe and terrain, such as `fill`, `line`, `background`, `hillshade`, and `raster`, are rendered first. These layers are rendered underneath symbols, regardless of whether they are placed in the `middle` or `top` slots when using [Mapbox Standard Style](https://docs.mapbox.com/map-styles/standard/guides/) or without a designated slot.
- In Safari 17 private browsing mode, Apple's Advanced Privacy Protection introduces [noise](https://developer.apple.com/documentation/safari-release-notes/safari-17-release-notes#Private-Browsing) into key fingerprinting areas like 2D Canvas and WebGL and may cause unexpected terrain spikes in GL JS v3.
- When using the globe projection, markers that are on the non-visible side of the globe have incorrect initial positions.
- Triggering a [`resize`](/mapbox-gl-js/api/map/#map#resize) event while a [`flyTo`](/mapbox-gl-js/api/map/#map#flyto) animation is in progress changes the final animation position.
- Markers and the screen area receptive to clicks diverge between zoom level 5 and 6 under some circumstances when using the globe projection.

Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
