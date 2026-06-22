<!-- Source: https://docs.mapbox.com/mapbox-gl-js/guides/get-started/use-with-cdn/ -->

# Get started with Mapbox GL JS using a CDN
This guide walks through the steps to add **Mapbox GL JS** to a web project using hosted resources on the Mapbox Content Delivery Network (CDN) and instantiate a map. This method can be used in any web project, whether it is a standalone HTML file or a more complex project.

If you are using a module bundler (npm or yarn) to manage your dependencies, you can follow along with our [Get started with npm](/mapbox-gl-js/guides/get-started/use-with-npm/) guide.

## Prerequisites

Using Mapbox GL JS requires a [**public access token**](https://docs.mapbox.com/help/glossary/access-token/) from your account to access Mapbox services and associate usage with your account.

You can find your default public access token in the [Mapbox console](https://console.mapbox.com/).

Find the default public access token (a long string that starts with `pk.`) and keep it handy, as you will need to add it to your code in the next steps to render a map on your webpage.

## Step 1: Add the dependency

First, add the Mapbox GL JS library and its CSS to your project using CDN links.

Add the following `<script>` and `<link>` to the `<head>` of your HTML file:

``` html
<!-- Includes the Mapbox GL JS CSS stylesheet -->
<link href="https://api.mapbox.com/mapbox-gl-js/v3.25.0/mapbox-gl.css" rel="stylesheet">
<!-- Imports the Mapbox GL JS bundle -->
<script src="https://api.mapbox.com/mapbox-gl-js/v3.25.0/mapbox-gl.js"></script>
```

Including these CDN resources makes the `mapboxgl` global variable available to your site's JavaScript code.

## Step 2: Add a map container div

Wherever you want the map to appear on your webpage, add a `div` element with an id attribute to use as the map container. You will reference the id when you instantiate the map in the next step.

``` html
<div id="map" style="position: absolute; top: 0; bottom: 0; width: 100%;"></div>
```

Tip

Make sure that the map container div has a width and height set, either through inline styles or CSS. If the container does not have dimensions, the map will not be visible on the page.

## Step 3: Instantiate a Map

With the Mapbox GL JS library included and a map container added to your page, you can now create a map by setting your access token and instantiating a new `mapboxgl.Map` object in your JavaScript code. This code can be added to a `<script>` tag in your HTML file or to an external JavaScript file that is included in your project.

``` javascript
<script>
  // creates the map, passing your access token to associate it with your Mapbox account, and setting the container, initial center, and zoom level
  const map = new mapboxgl.Map({
      accessToken: 'YOUR_MAPBOX_ACCESS_TOKEN',
      container: 'map', // container ID
      center: [-71.06776, 42.35816], // starting position [lng, lat]. Note that lat must be set between -90 and 90
      zoom: 9 // starting zoom
  });
</script>
```

If you have followed the steps correctly, you should see a map like the one below rendered in the container div on your webpage. Drag, zoom and interact with the map to explore the default Mapbox Standard style and its visual features.

The code above creates a map centered on Boston, Massachusetts. You can change the `center` property to set the initial location of the map to any valid longitude and latitude coordinates. You can also adjust the `zoom` property to set the initial zoom level of the map. To learn more about the options available when creating a map, see the [`Map` class](/mapbox-gl-js/api/map/) reference documentation.

## Working Example Code

The following example shows the full HTML code for a webpage that includes all three parts: the Mapbox GL JS library from the CDN, a map container div, and a script to instantiate a map centered on Boston, Massachusetts.

JavaScript

``` html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Mapbox GL JS map</title>
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
        container: 'map', // container ID
        center: [-71.06776, 42.35816], // starting position [lng, lat]. Note that lat must be set between -90 and 90
        zoom: 9 // starting zoom
    });
</script>

</body>
</html>
```

This code snippet will not work as expected until you replace `YOUR_MAPBOX_ACCESS_TOKEN` with an access token from [your Mapbox account](https://account.mapbox.com).

## Troubleshooting

If your map is not rendering, check the following:

- Make sure your have replaced "YOUR_MAPBOX_ACCESS_TOKEN" in your code.
- Check that you are using a valid public access token from your [Mapbox account](https://console.mapbox.com/account/access-tokens/).
- Make sure that your map container div has a width and height set, either through inline styles or CSS.
- Check the browser console for any error messages that may show what is preventing the map from rendering.

## Next Steps

With Mapbox GL JS installed and a map rendered on your page, you can customize the map and explore additional features:

- [Add your data](/mapbox-gl-js/guides/add-your-data/)
- [Markers](/mapbox-gl-js/guides/add-your-data/markers/)
- [Map Styles](/mapbox-gl-js/guides/styles/)

You can also explore example code and tutorials:

[TUTORIALAdd custom markers to a map.](https://docs.mapbox.com/help/tutorials/custom-markers-gl-js/)

Learn how to add custom markers to a map.

[TUTORIALAdd and style data](https://docs.mapbox.com/help/tutorials/add-data-to-mapbox-style/)

Learn how to add and style data with Mapbox Studio and then add this style to your map.

[EXAMPLELocate the user](/mapbox-gl-js/example/locate-user/)

Learn how to access the user's location and display it on the map.

Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
