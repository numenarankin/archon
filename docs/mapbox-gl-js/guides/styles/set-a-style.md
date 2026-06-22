<!-- Source: https://docs.mapbox.com/mapbox-gl-js/guides/styles/set-a-style/ -->

# Set a style
When adding a map to a web application or website using Mapbox GL JS, the map's [style](https://docs.mapbox.com/help/glossary/style/) dictates the visual design of the map, including colors, labels, and feature visibility. It also includes information about data sources, and is used by the SDK to fetch the appropriate data necessary to render the map.

By default Mapbox GL JS uses the [Mapbox Standard](https://docs.mapbox.com/map-styles/standard/guides/) style, which is a versatile and visually appealing map style suitable for many applications. Mapbox Standard offers many [configuration options](https://docs.mapbox.com/map-styles/standard/api/#configuration-properties), allowing developers to customize the map's appearance to suit the needs of their application. If a completely unique look and feel is needed for the map, developers can create custom styles using [Mapbox Studio](https://docs.mapbox.com/studio-manual/), which can then be loaded into the map.

Once a style is loaded, you can continue to manipulate it at runtime, changing the appearance of the map by changing style configurations, adding or removing layers, changing layer properties, and more. This guide explains how to set and configure a style when initializing a map and how to switch styles dynamically during runtime.

## Load a style

Mapbox GL JS provides an embeddable map interface using the [`Map`](/mapbox-gl-js/api/map/) class. To render a map you will need to determine which style the renderer should use. You can rely on the **Mapbox Standard** style which is loaded by default, or you can specify another style.

### Mapbox Standard

[Mapbox Standard](https://docs.mapbox.com/map-styles/standard/) is our general-purpose map style that is designed to be used in a wide range of applications. It is suitable for most use cases and includes a variety of configuration options to customize the map's appearance.

Mapbox Standard is the default style, and instantiating a `Map` without specifying any style means your map will use Mapbox Standard.

``` javascript
// if the `style` option is not specified, loads Mapbox Standard by default
const map = new mapboxgl.Map({
    container: 'map',
})
```

You can explicitly set Mapbox Standard as the style for your map by adding its style URL to the `style` option when initializing the map:

``` javascript
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/standard',
})
```

### Custom styles

You can also create your own custom styles using the Mapbox Style Editor. Custom styles can be used to create a unique look and feel for your map, tailored to your application's design needs. You can customize a Mapbox style or start from scratch entirely. Learn how to customize Standard in [this tutorial](https://docs.mapbox.com/help/tutorials/create-a-custom-style/), how to build a style from scratch [in this guide](https://docs.mapbox.com/help/dive-deeper/map-design/#how-to-create-a-custom-style) or explore our style [gallery](https://www.mapbox.com/gallery).

You can specify a style to use when you instantiate a map using a Style URL or a Style JSON string.

#### Load a style using a Style URL

All Mapbox styles and custom styles created in Mapbox Studio have a unique style URL starting with `mapbox://`. You can use this URL to load a style when initializing a map.

``` javascript
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/your-mapbox-username/your-custom-style-url',
})
```

Loading a Style using Style JSONThough less common, you can also load a style from a JSON string, either loaded from a local file or downloaded over the network. See a minimal style JSON example in [Delay setting the style](#delay-setting-the-style) below.

### Delay setting the style

If you want to initialize the `Map` but delay loading a style until after it is displayed on the UI, you can set the `style` option to an empty style JSON when initializing the map. This will display the map with a white background until you add a style later using the [`setStyle`](/mapbox-gl-js/api/map/#map#setstyle) method.

``` javascript
const map = new mapboxgl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: {},
        layers: []
    },
})
```

In the case above, the map is rendered with solid white background color by default. But, if you want to adjust the color of the map's background to fit your design before your style is loaded to the `Map`, you can create a minimal style JSON string with a `background` layer set to the desired color.

``` javascript
const map = new mapboxgl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: {},
        layers: [
            {
                id: 'background',
                type: 'background',
                paint: {
                    'background-color': 'hsl(100, 50%, 50%)',
                },
            },
        ],
    },
})
```

## Configure a style

Depending on which map style you choose, you have different configuration options available to customize aspects of your style such as fonts, colors, and more.

### Mapbox Standard

**Mapbox Standard** and **Mapbox Standard Satellite** are our default, all-purpose map styles, and are recommended for most use cases. Mapbox Standard and Mapbox Standard Satellite provide a limited set of configurations instead of allowing for full manipulation of the style.

Each style can be configured with several options, including [light presets](https://docs.mapbox.com/map-styles/standard/guides/#light-presets), [label visibility](https://docs.mapbox.com/map-styles/standard/guides/#label-visibility), [feature visibility](https://docs.mapbox.com/map-styles/standard/guides/#feature-visibility), [color theming](https://docs.mapbox.com/map-styles/standard/guides/#theming), and [fonts](https://docs.mapbox.com/map-styles/standard/guides/#fonts), and more. You can set these at runtime using the [`setStyle`](/mapbox-gl-js/api/map/#map#setstyle) method.

[PLAYGROUNDMapbox Standard Style Playground](https://docs.mapbox.com/playground/standard-style/)

Using this interactive tool, you can see in real-time how different configuration options affect the Mapbox Standard or Mapbox Standard Satellite styles.

All configuration properties for Mapbox Standard are also available for Mapbox Standard Satellite except for toggling 3D objects and color theming. To learn more about configuration options, refer to the [Mapbox Standard Guide](https://docs.mapbox.com/map-styles/standard/guides/#configuration) and the [Mapbox Standard API Reference Docs](https://docs.mapbox.com/map-styles/standard/api/#configuration-properties).

The following sample code shows how to change the 3D lights from the default preset, `day`, to another preset, `dusk`, by setting the `lightPreset` property. The code also shows how to hide the point of interest labels by setting the `showPointOfInterestLabels` property to `false`. You can set these properties either when initializing the map with the `config` parameter or after the map has been initialized using the [`setConfigProperty`](/mapbox-gl-js/api/map/#map#setconfigproperty) method. To update the configuration you must specify the import id of the style you want to configure. For Mapbox Standard, this is `basemap`.

``` javascript
// configure Mapbox Standard during map initialization
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/standard',
    config: {
        basemap: {
            lightPreset: 'dusk',
            showPointOfInterestLabels: false,
        }
    }
});
```

``` javascript
// configure Mapbox Standard after map initialization
map.setConfigProperty('basemap', 'lightPreset', 'dusk');

map.setConfigProperty('basemap', 'showPointOfInterestLabels', false);
```

All configurations are also available in [Mapbox Studio](https://docs.mapbox.com/studio-manual/guides/map-styling/#the-style-editor), where you can create a custom style that imports Mapbox Standard or Mapbox Standard Satellite and adjust the configurations as needed.

### Custom styles

Custom styles can be configured by calling methods to update the properties of the style. The most common configurations are updates to layer properties, such as changing the color of a line or the visibility of a label.

For example, you may want to hide an existing layer by setting its `visibility` to `none` using [`setLayoutProperty`](/mapbox-gl-js/api/map/#map#setlayoutproperty), or change the color of a `fill` layer by setting its `fill-color` property using [`setPaintProperty`](/mapbox-gl-js/api/map/#map#setpaintproperty). Learn more about updating layers in the [Work with sources and layers](/mapbox-gl-js/guides/styles/work-with-layers/#update-a-layer-at-runtime) guide.

``` javascript
// hide the point of interest labels layer
map.setLayoutProperty('poi-label', 'visibility', 'none');

// set the fill color of the water layer to a teal color
map.setPaintProperty('water', 'fill-color', '#45d9ca');
```

This approach requires knowing the ids and types of layers in the style and understanding the properties that can be updated for each layer type. You can explore the properties available for a given layer type in the [Mapbox Style Specification](https://docs.mapbox.com/style-spec/reference/).

An alternative approach to adding many runtime configuration changes for a style is to create a custom style in [Mapbox Studio](https://docs.mapbox.com/studio-manual/guides/map-styling/#the-style-editor). You can make the desired changes in the style editor and load the custom style in your application.

## Change to a different style (#change-to-a-different-style)

You can change the style any time after initializing the map using the [`setStyle`](/mapbox-gl-js/api/map/#map#setstyle) method.

``` javascript
// load the Mapbox Standard Satellite style, replacing the current map style
map.setStyle('mapbox://styles/mapbox/standard-satellite');
```

If you added any layers after map initialized, you will need to re-add them after the new style is loaded.Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
