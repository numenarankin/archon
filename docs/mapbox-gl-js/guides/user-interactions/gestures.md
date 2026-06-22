<!-- Source: https://docs.mapbox.com/mapbox-gl-js/guides/user-interactions/gestures/ -->

# Gestures and Events
This guide explains how to work with user gestures and events in Mapbox GL JS. You'll learn about default map gestures, how to enable and disable gestures, how to listen for user interactions on the map and how to control the map from external events.

## Default Map Gestures

Mapbox GL JS provides intuitive gestures to interact with the map. Gestures vary between desktop and mobile devices.

### Desktop Gestures

- **Pan around**: Click and drag with mouse.
- **Adjust pitch**: Right-click + drag up/down.
- **Gradually zoom**: Scroll mouse wheel or use touch pinch gesture.
- **Rotate**: Right-click + drag left/right. (Hold `control` + click + drag left/right on Mac)
- **Zoom in one level**: Double-click.
- **Zoom out one level**: Hold `Shift` and double-click.
- **Quick zoom**: Hold `Shift` + drag a box.

### Mobile Gestures

- **Pan around**: Tap and drag with touch screen.
- **Adjust pitch**: Two-finger drag up/down.
- **Gradually zoom**: Touch pinch gesture.
- **Rotate**: Two-finger rotate.
- **Zoom in one level**: Double-tap.
- **Zoom out one level**: Two-finger tap.

## Enable and Disable Default Gestures

You can enable or disable specific gestures when instantiating a map using the `dragPan`, `scrollZoom`, `boxZoom`, `dragRotate`, `keyboard`, and `touchZoomRotate` options.

Example:

``` javascript
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [0, 0],
    zoom: 2,
    dragPan: true, // Enable or disable drag panning
    scrollZoom: false, // Disable scroll zoom
    boxZoom: true, // Enable box zoom
    dragRotate: true, // Enable drag rotation
    keyboard: true, // Enable keyboard controls
    touchZoomRotate: true // Enable touch zoom & rotation
});
```

You can also enable and disable interactions after the map has been created:

``` javascript
map.scrollZoom.disable();  // Disable scroll zoom
map.scrollZoom.enable();   // Enable scroll zoom
```

[EXAMPLEDisable map rotation](/mapbox-gl-js/example/disable-rotation/)

See an example of a map with rotation disabled.

[EXAMPLEDisable scroll zoom](/mapbox-gl-js/example/disable-scroll-zoom/)

See an example of a map with scroll zoom disabled.

[EXAMPLEDisplay a non-interactive map](/mapbox-gl-js/example/interactive-false/)

See an example of a map with all default gestures disabled.

## User Interaction Events

You can listen for user interactions on the `map` object by using events. Some common event types include:

Event Name

Description

`move`

Fires continuously as the map is panned or zoomed

`moveend`

Fires when a panning movement has completed

`zoom`

Fires continuously while the map is zooming

`zoomend`

Fires when zooming has completed

`rotate`

Fires continuously while the map is rotating

`rotateend`

Fires when rotation has completed

`pitch`

Fires continuously when the pitch is changing

`click`

Fires when the user clicks the map

These listeners are used with the `on` method:

``` javascript
map.on('move', () => {
    console.log('Map is moving');
});

map.on('click', (e) => {
    console.log(`Clicked at: ${e.lngLat.lng}, ${e.lngLat.lat}`);
});
```

They can also be used with the [Interactions API](/mapbox-gl-js/guides/user-interactions/interactions/) to handle interactions on layers, featuresets, or the map itself.

``` javascript
map.addInteraction('my-polygon-click-interaction', {
  type: 'click',
  target: { layerId: 'polygons' },
  handler: (e) => {
    map.setFeatureState(e.feature, {highlight: true});
  }
});

map.addInteraction('building-mouseenter', {
  type: 'mouseenter',
  target: {featuresetId: 'buildings', importId: 'basemap'},
  handler: (e) => {
    map.setFeatureState(e.feature, {highlight: true});
  }
});
```

Explore [all available events](/mapbox-gl-js/api/map/#map-events) in the API reference documentation.

[EXAMPLEAdd feature-level interactions to a map](/mapbox-gl-js/example/simple-interactions/)

See an example of a map with interactions on a specific layer.

[EXAMPLEAdd interactions to a Mapbox Standard Style](/mapbox-gl-js/example/standard-interactions/)

See an example of a map with interactions on a featureset of the Mapbox Standard Style.

## External Interactions

You can also control the map using external UI elements like buttons or sliders. Use the `map` object's methods to programmatically control the map.

### Zoom Control

You can build your own zoom in/out UI and use the `zoomIn` and `zoomOut` methods to control the map.

``` javascript
const zoomInButton = document.getElementById('zoom-in');

zoomInButton.addEventListener('click', () => {
    map.zoomIn();
});
```

### Fly the Camera

Use the `flyTo` method to smoothly transition the map to a new location when the user clicks a reset button.

``` javascript
 const zoomOutButton = document.getElementById('reset-map-view');
zoomOutButton.addEventListener('click', () => {
    map.flyTo({
        center: [0, 0],
        zoom: 2
    });
});
```

[EXAMPLEFly to a location](/mapbox-gl-js/example/flyto/)

See an example of a map with a button that triggers a fly-to animation.

### Show or Hide a Layer

Show or hide a layer in the map's style when the user clicks a checkbox.

``` javascript
const checkbox = document.getElementById('toggle-layer');
checkbox.addEventListener('change', (event) => {
    const layerId = 'my-layer';
    if (event.target.checked) {
        map.setLayoutProperty(layerId, 'visibility', 'visible');
    } else {
        map.setLayoutProperty(layerId, 'visibility', 'none');
    }
});
```

[EXAMPLEShow and hide layers](/mapbox-gl-js/example/toggle-layers/)

See an example of a map with buttons to show and hide layers.

Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
