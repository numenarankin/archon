<!-- Source: https://docs.mapbox.com/mapbox-gl-js/guides/indoor/ -->

# Indoor mapping
The **Mapbox GL JS** library provides indoor mapping support, allowing your application to display detailed floor plans inside buildings and let users switch between floors. Indoor mapping is part of the [Mapbox Standard](https://docs.mapbox.com/map-styles/standard/guides/) style and is controlled via a style configuration property.

Experimental feature

Indoor mapping is an experimental feature. APIs may change in future releases.

## Enable indoor mapping

Indoor mapping is included in the Mapbox Standard style, but this feature is **disabled by default**. To enable it, set the `showIndoor` configuration property on the `basemap` style configuration to `true`:

``` js
const map = new mapboxgl.Map({
    container: 'map',
    style: "mapbox://styles/mapbox/standard",
    config: {
        basemap: {
            showIndoor: true
        }
    }
});
```

Once enabled, buildings that have indoor map data will render their indoor floor plans at appropriate zoom levels 16+.

## Indoor selector control

The `IndoorControl` provides a floor selection UI that lets users browse and switch between floors in an indoor-mapped building. To use the indoor selector control besides rendering of default indoor floors enabled by the configuration, add control to your map:

``` js
// Create and add the indoor floor selector to the map
const indoorControl = new mapboxgl.IndoorControl();
map.addControl(indoorControl);
```

When indoor data becomes available (e.g., the user pans to a building with indoor mapping), the selector automatically populates with available floors and lets the user click to switch floors.

## Disable indoor mapping

To completely disable indoor mapping after it was enabled, you can turn off the style configuration parameter and remove the control from the map. Set the `showIndoor` configuration property to `false` at runtime using `setConfigProperty`:

``` js
map.setConfigProperty('basemap', 'showIndoor', false);
```

Remove the `IndoorControl` instance from the map using `removeControl`:

``` js
map.removeControl(indoorControl);
```

## Complete example

Here's a complete example showing how to set up indoor mapping with the floor selector using HTML and JavaScript:

``` html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Indoor mapping example</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <script src='https://api.mapbox.com/mapbox-gl-js/v3.21.0/mapbox-gl.js'></script>
    <link href='https://api.mapbox.com/mapbox-gl-js/v3.21.0/mapbox-gl.css' rel='stylesheet' />
    <style>
        body { margin: 0; padding: 0; }
        #map { position: absolute; top: 0; bottom: 0; width: 100%; }
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        const map = new mapboxgl.Map({
            accessToken: 'YOUR_MAPBOX_ACCESS_TOKEN',
            container: 'map',
            zoom: 17.5,
            center: [24.941915, 60.171768],
            pitch: 50,
            bearing: -15,
            style: "mapbox://styles/mapbox/standard",
            config: {
                basemap: {
                    showIndoor: true
                }
            }
        });

        // Add the indoor floor selector UI
        map.addControl(new mapboxgl.IndoorControl());

        // Add navigation controls (optional)
        map.addControl(new mapboxgl.NavigationControl());
    </script>
</body>
</html>
```

Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
