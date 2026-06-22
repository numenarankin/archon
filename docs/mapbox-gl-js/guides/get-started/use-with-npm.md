<!-- Source: https://docs.mapbox.com/mapbox-gl-js/guides/get-started/use-with-npm/ -->

# Get started with Mapbox GL JS using npm
This guide walks through the steps to add **Mapbox GL JS** to a web project using a package manager like npm or yarn and instantiate a map.

If you are building a standalone webpage or want to quickly test out Mapbox GL JS, you can follow along with our [Get started with CDN](/mapbox-gl-js/guides/get-started/use-with-cdn/) guide.

## Prerequisites

Using Mapbox GL JS requires a [**public access token**](https://docs.mapbox.com/help/glossary/access-token/) from your account to access Mapbox services and associate usage with your account.

You can find your default public access token in the [Mapbox console](https://console.mapbox.com/).

Find the default public access token (a long string that starts with `pk.`) and keep it handy, as you will need to add it to your code in the next steps to render a map on your webpage.

## Part 1: Add the dependency

Add the Mapbox GL JS library to your project using npm or yarn. Run the following command in your terminal:

``` text
npm install mapbox-gl
```

The `npm install` command will add the Mapbox GL JS package to your project and save it as a dependency in your `package.json` file. You can now import the library into your project and use it to create maps.

## Part 2: Import `mapbox-gl` and instantiate a map

How you import and instantiate a map depends on your environment and framework. Below are examples for plain JavaScript (no framework), React, Svelte and Vue.

JavaScriptReactSvelteVue

**Step 1: Include Mapbox GL JS and its CSS**

You must make sure that **both Mapbox GL JS and its CSS** are included in your JavaScript and CSS bundles.

Depending on your environment and setup, you may be able to import the library and CSS with `import` statements in one of your JavaScript files:

``` javascript
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

...
```

If you are bundling only JavaScript and not CSS, you will need to include the Mapbox GL JS CSS file in your HTML or bundle it with your other styles. You can find the CSS file in `node_modules/mapbox-gl/dist/mapbox-gl.css` after installing Mapbox GL JS with npm.

**Step 2: Add a map container**

Wherever you want the map to appear in your project, add a `div` element with an id attribute to use as the map container. You will reference the id when you instantiate the map in the next step.

``` html
<div id="map" style="width: 800px; height: 600px;"></div>
```

Tip

Make sure that the map container div has a width and height set, either through inline styles or CSS. If the container does not have dimensions, the map will not be visible on the page.

**Step 3: Instantiate a Map**

With the Mapbox GL JS package installed and a map container added to your page, you can now create a map by setting your access token and instantiating a new `mapboxgl.Map` object in your JavaScript code.

``` javascript
<script>
  // creates the map, passing your access token to associate it with your Mapbox account, and setting the container, initial center, and zoom level
  const map = new mapboxgl.Map({
      accessToken: 'YOUR_MAPBOX_ACCESS_TOKEN', // associates the map with your Mapbox account and its permissions
      container: 'map', // container ID
      center: [-71.06776, 42.35816], // starting position [lng, lat]. Note that lat must be set between -90 and 90
      zoom: 9 // starting zoom
  });
</script>
```

Build and run your project, and you should see a map rendered on your page like below. Drag, zoom and interact with the map to explore the default Mapbox Standard style and its visual features.

Mapbox GL JS uses imperative code to create and manipulate maps. To use it in a React application, you can create a React component that renders a map container and initializes the map when the component mounts and cleans up when it unmounts. Below is an example of how to add a Mapbox GL JS map to a React application.

Key steps include:

- Importing the `mapbox-gl` library and its CSS
- Returning a `div` element to serve as the map container
- Using the `useRef` hook to create a reference to the map container and the map instance
- Instantiating the map in a `useEffect` hook to make sure it runs after the component has mounted
- Cleaning up the map instance when the component unmounts to prevent memory leaks

Tip

Make sure that the map container div has a width and height set, either through inline styles or CSS. If the container does not have dimensions, the map will not be visible on the page.

src/Map.jsx

``` jsx
import { useRef, useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css';

function Map() {
  const mapRef = useRef()
  const mapContainerRef = useRef()

  useEffect(() => {
    mapRef.current = new mapboxgl.Map({
      accessToken: 'YOUR_MAPBOX_ACCESS_TOKEN',
      container: mapContainerRef.current,
      center: [-71.06776, 42.35816], // starting position [lng, lat]. Note that lat must be set between -90 and 90
      zoom: 9 // starting zoom
    });

    return () => {
      mapRef.current.remove()
    }
  }, [])

  return (
    <>
    </>
  )
}

export default Map
```

For more details on how to set up a React application with Mapbox GL JS, see the [Use Mapbox GL JS in a React App](https://docs.mapbox.com/help/tutorials/use-mapbox-gl-js-with-react/) tutorial.

Mapbox GL JS uses imperative code to create and manipulate maps. To use it in a Svelte application, you can create a Svelte component that renders a map container and initializes the map when the component mounts and cleans up when it unmounts. Below is an example of how to add a Mapbox GL JS map to a Svelte application.

Key steps include:

- Importing the `mapbox-gl` library and its CSS
- Creating a `div` element to serve as the map container
- Using `bind:this` to create a reference to the map container element
- Instantiating the map in the `onMount` lifecycle hook to make sure it runs after the component has mounted
- Cleaning up the map instance in the `onDestroy` hook to prevent memory leaks

Tip

Make sure that the map container div has a width and height set, either through inline styles or CSS. If the container does not have dimensions, the map will not be visible on the page.

src/Map.svelte

``` js
<script>
  import mapboxgl from 'mapbox-gl';
  import 'mapbox-gl/dist/mapbox-gl.css';
  import { onMount, onDestroy } from 'svelte';

  let map;
  let mapContainer;

  onMount(() => {
    map = new mapboxgl.Map({
      accessToken: 'YOUR_MAPBOX_ACCESS_TOKEN',
      container: mapContainer,
      center: [-71.06776, 42.35816], // starting position [lng, lat]. Note that lat must be set between -90 and 90
      zoom: 9 // starting zoom
    });
  });

  onDestroy(() => {
    map?.remove();
  });
</script>
<style>
  #map-container {
    width: 100%;
    height: 100%;
  }
</style>
```

For more details on how to set up a Svelte application with Mapbox GL JS, see the [Use Mapbox GL JS in a Svelte App](https://docs.mapbox.com/help/tutorials/use-mapbox-gl-js-with-svelte/) tutorial.

Mapbox GL JS uses imperative code to create and manipulate maps. To use it in a Vue application, you can create a Vue component that renders a map container and initializes the map when the component mounts and cleans up when it unmounts. Below is an example of how to add a Mapbox GL JS map to a Vue application.

Key steps include:

- Importing the `mapbox-gl` library and its CSS
- Creating a `div` element to serve as the map container
- Using `ref` to create a reference to the map container element
- Instantiating the map in the `mounted` lifecycle hook to make sure it runs after the component has mounted
- Cleaning up the map instance in the `unmounted` hook to prevent memory leaks

Tip

Make sure that the map container div has a width and height set, either through inline styles or CSS. If the container does not have dimensions, the map will not be visible on the page.

src/components/Map.vue

``` js
<template>
</template>

<script>
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

export default {
  mounted() {
    this.map = new mapboxgl.Map({
      accessToken: 'YOUR_MAPBOX_ACCESS_TOKEN',
      container: this.$refs.mapContainer,
      center: [-71.06776, 42.35816], // starting position [lng, lat]. Note that lat must be set between -90 and 90
      zoom: 9 // starting zoom
    });
  },

  unmounted() {
    this.map?.remove();
    this.map = null;
  }
};
</script>

<style>
#map-container {
  width: 100%;
  height: 100%;
}
</style>
```

For more details on how to set up a Vue application with Mapbox GL JS, see the [Use Mapbox GL JS in a Vue App](https://docs.mapbox.com/help/tutorials/use-mapbox-gl-js-with-vue/) tutorial.

------------------------------------------------------------------------

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
