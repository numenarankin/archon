<!-- Source: https://docs.mapbox.com/mapbox-gl-js/api/markers/ -->

# Markers and controls
Search GL JS API Reference

User interface elements that can be added to the map. The items in this section exist outside of the map's `canvas` element.

## AttributionControl

[githubsrc/ui/control/attribution_control.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/control/attribution_control.ts#L30-L208)

An `AttributionControl` control presents the map's [attribution information](https://docs.mapbox.com/help/how-mapbox-works/attribution/). Add this control to a map using [Map#addControl](/mapbox-gl-js/api/map/#map#addcontrol).

new AttributionControl(options: [Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)?)

### Parameters

Name

Description

#### options

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)`?`(default `{}`)

#### options.compact

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)`?`

If `true` , force a compact attribution that shows the full attribution on mouse hover. If `false` , force the full attribution control. The default is a responsive attribution that collapses when the map is less than 640 pixels wide. **Attribution should not be collapsed if it can comfortably fit on the map. `compact` should only be used to modify default attribution when map size makes it impossible to fit [default attribution](https://docs.mapbox.com/help/how-mapbox-works/attribution/) and when the automatic compact resizing for default settings are not sufficient** .

#### options.customAttribution

`(`[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)` | `[`Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)`<`[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)`>)?`

String or strings to show in addition to any other attributions. You can also set a custom attribution when initializing your map with [the customAttribution option](https://docs.mapbox.com/mapbox-gl-js/api/map/#map-parameters) .

### Example

``` js
const map = new mapboxgl.Map({attributionControl: false})
    .addControl(new mapboxgl.AttributionControl({
        customAttribution: 'Map design by me'
    }));
```

Was this section on AttributionControl helpful?

## FullscreenControl

[githubsrc/ui/control/fullscreen_control.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/control/fullscreen_control.ts#L32-L137)

A `FullscreenControl` control contains a button for toggling the map in and out of fullscreen mode. See the `requestFullScreen` [compatibility table](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullScreen#browser_compatibility) for supported browsers. Add this control to a map using [Map#addControl](/mapbox-gl-js/api/map/#map#addcontrol).

new FullscreenControl(options: [Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)?)

### Parameters

Name

Description

#### options

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)`?`(default `{}`)

#### options.container

[`HTMLElement`](https://developer.mozilla.org/docs/Web/HTML/Element)`?`

`container` is the [compatible DOM element](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullScreen#Compatible_elements) which should be made full screen. By default, the map container element will be made full screen.

### Example

``` js
map.addControl(new mapboxgl.FullscreenControl({container: document.querySelector('body')}));
```

### Related

- [Example: View a fullscreen map](https://www.mapbox.com/mapbox-gl-js/example/fullscreen/)

Was this section on FullscreenControl helpful?

## GeolocateControl

[githubsrc/ui/control/geolocate_control.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/control/geolocate_control.ts#L126-L948)

A `GeolocateControl` control provides a button that uses the browser's geolocation API to locate the user on the map. Add this control to a map using [Map#addControl](/mapbox-gl-js/api/map/#map#addcontrol).

Not all browsers support geolocation, and some users may disable the feature. Geolocation support for modern browsers including Chrome requires sites to be served over HTTPS. If geolocation support is not available, the `GeolocateControl` will show as disabled.

The [zoom level](https://docs.mapbox.com/help/glossary/zoom-level/) applied depends on the accuracy of the geolocation provided by the device.

The GeolocateControl has two modes. If `trackUserLocation` is `false` (default) the control acts as a button, which when pressed will set the map's camera to target the user location. If the user moves, the map won't update. This is most suited for the desktop. If `trackUserLocation` is `true` the control acts as a toggle button that when active the user's location is actively monitored for changes. In this mode the `GeolocateControl` has three interaction states:

- active - The map's camera automatically updates as the user's location changes, keeping the location dot in the center. This is the initial state, and the state upon clicking the `GeolocateControl` button.
- passive - The user's location dot automatically updates, but the map's camera does not. Occurs upon the user initiating a map movement.
- disabled - Occurs if geolocation is not available, disabled, or denied.

These interaction states can't be controlled programmatically. Instead, they are set based on user interactions.

Extends [Evented](/mapbox-gl-js/api/events/#evented).new GeolocateControl(options: [Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)?)

### Parameters

Name

Description

#### options

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)`?`(default `{}`)

#### options.fitBoundsOptions

`EasingOptions`(default `{maxZoom:15}`)

A [Map#fitBounds](/mapbox-gl-js/api/map/#map#fitbounds) options object to use when the map is panned and zoomed to the user's location. The default is to use a `maxZoom` of 15 to limit how far the map will zoom in for very accurate locations.

#### options.followUserLocation

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

If `true` , the camera centers on the user's location. If `false` , the location dot will be shown without moving the camera. Clicking the control still centers on the user's location.

#### options.geolocation

`Geolocation`(default `window.navigator.geolocation`)

`window.navigator.geolocation` by default; you can provide an object with the same shape to customize geolocation handling.

#### options.positionOptions

[`PositionOptions`](https://developer.mozilla.org/docs/Web/API/PositionOptions)(default `{enableHighAccuracy:false,timeout:6000}`)

A Geolocation API [PositionOptions](https://developer.mozilla.org/en-US/docs/Web/API/PositionOptions) object.

#### options.showAccuracyCircle

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

By default, if `showUserLocation` is `true` , a transparent circle will be drawn around the user location indicating the accuracy (95% confidence level) of the user's location. Set to `false` to disable. Always disabled when `showUserLocation` is `false` .

#### options.showButton

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

If `false` , the control button will be hidden. The user location dot can still be shown by setting `showUserLocation` to `true` and calling [GeolocateControl#trigger](/mapbox-gl-js/api/markers/#geolocatecontrol#trigger) programmatically.

#### options.showUserHeading

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `false`)

If `true` an arrow will be drawn next to the user location dot indicating the device's heading. This only has affect when `trackUserLocation` is `true` .

#### options.showUserLocation

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

By default a dot will be shown on the map at the user's location. Set to `false` to disable.

#### options.trackUserLocation

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `false`)

If `true` the `GeolocateControl` becomes a toggle button and when active the map will receive updates to the user's location as it changes.

### Example

``` js
map.addControl(new mapboxgl.GeolocateControl({
    positionOptions: {
        enableHighAccuracy: true
    },
    trackUserLocation: true,
    showUserHeading: true
}));
```

``` js
// Tracking without visible button - call trigger() to start
const geolocate = new mapboxgl.GeolocateControl({
    trackUserLocation: true,
    showUserLocation: true,
    showButton: false
});
map.addControl(geolocate);
geolocate.trigger();
```

``` js
// Show user location without moving the camera
const geolocate = new mapboxgl.GeolocateControl({
    trackUserLocation: true,
    showUserLocation: true,
    followUserLocation: false
});
map.addControl(geolocate);
geolocate.trigger();
```

### Instance Members

### Events

### Related

- [Example: Locate the user](https://www.mapbox.com/mapbox-gl-js/example/locate-user/)

Was this section on GeolocateControl helpful?

## IControl

[githubsrc/ui/map.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/map.ts#L451-L5322)

Interface for interactive controls added to the map. This is a specification for implementers to model: it is not an exported method or class.

Controls must implement `onAdd` and `onRemove`, and must own an element, which is often a `div` element. To use Mapbox GL JS's default control styling, add the `mapboxgl-ctrl` class to your control's node.

### Example

``` js
// Control implemented as ES6 class
class HelloWorldControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl';
        this._container.textContent = 'Hello, world';
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}
```

``` js
// Control implemented as ES5 prototypical class
function HelloWorldControl() { }

HelloWorldControl.prototype.onAdd = function(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'mapboxgl-ctrl';
    this._container.textContent = 'Hello, world';
    return this._container;
};

HelloWorldControl.prototype.onRemove = function () {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
};
```

### Instance Members

Was this section on IControl helpful?

## Marker

[githubsrc/ui/marker.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/marker.ts#L84-L1010)

Creates a marker component.

Extends [Evented](/mapbox-gl-js/api/events/#evented).new Marker(options: [Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)?, legacyOptions: MarkerOptions?)

### Parameters

Name

Description

#### options

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)`?`

#### options.altitude

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `0`)

Elevation in meters above the map surface. If terrain is enabled, the marker will be elevated relative to the terrain.

#### options.anchor

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)(default `'center'`)

A string indicating the part of the Marker that should be positioned closest to the coordinate set via [Marker#setLngLat](/mapbox-gl-js/api/markers/#marker#setlnglat) . Options are `'center'` , `'top'` , `'bottom'` , `'left'` , `'right'` , `'top-left'` , `'top-right'` , `'bottom-left'` , and `'bottom-right'` .

#### options.className

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)`?`

Space-separated CSS class names to add to marker element.

#### options.clickTolerance

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `0`)

The max number of pixels a user can shift the mouse pointer during a click on the marker for it to be considered a valid click (as opposed to a marker drag). The default is to inherit map's `clickTolerance` .

#### options.color

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)(default `'#3FB1CE'`)

The color to use for the default marker if `options.element` is not provided. The default is light blue.

#### options.draggable

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `false`)

A boolean indicating whether or not a marker is able to be dragged to a new position on the map.

#### options.element

[`HTMLElement`](https://developer.mozilla.org/docs/Web/HTML/Element)`?`

DOM element to use as a marker. The default is a light blue, droplet-shaped SVG marker.

#### options.occludedOpacity

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `0.2`)

The opacity of a marker that's occluded by 3D terrain.

#### options.offset

[`PointLike`](/mapbox-gl-js/api/geography/#pointlike)`?`

The offset in pixels as a [PointLike](/mapbox-gl-js/api/geography/#pointlike) object to apply relative to the element's center. Negatives indicate left and up.

#### options.pitchAlignment

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)(default `'auto'`)

`'map'` aligns the `Marker` to the plane of the map. `'viewport'` aligns the `Marker` to the plane of the viewport. `'auto'` automatically matches the value of `rotationAlignment` .

#### options.rotation

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `0`)

The rotation angle of the marker in degrees, relative to its respective `rotationAlignment` setting. A positive value will rotate the marker clockwise.

#### options.rotationAlignment

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)(default `'auto'`)

The alignment of the marker's rotation. `'map'` is aligned with the map plane, consistent with the cardinal directions as the map rotates. `'viewport'` is screenspace-aligned. `'horizon'` is aligned according to the nearest horizon, on non-globe projections it is equivalent to `'viewport'` . `'auto'` is equivalent to `'viewport'` .

#### options.scale

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `1`)

The scale to use for the default marker if `options.element` is not provided. The default scale corresponds to a height of `41px` and a width of `27px` .

#### legacyOptions

`MarkerOptions?`

### Example

``` js
// Create a new marker.
const marker = new mapboxgl.Marker()
    .setLngLat([30.5, 50.5])
    .addTo(map);
```

``` js
// Set marker options.
const marker = new mapboxgl.Marker({
    color: "#FFFFFF",
    draggable: true
}).setLngLat([30.5, 50.5])
    .addTo(map);
```

### Instance Members

Search Instance Members

### Events

### Related

- [Example: Add custom icons with Markers](https://www.mapbox.com/mapbox-gl-js/example/custom-marker-icons/)
- [Example: Create a draggable Marker](https://www.mapbox.com/mapbox-gl-js/example/drag-a-marker/)

Was this section on Marker helpful?

## NavigationControl

[githubsrc/ui/control/navigation_control.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/control/navigation_control.ts#L41-L164)

A `NavigationControl` control contains zoom buttons and a compass. Add this control to a map using [Map#addControl](/mapbox-gl-js/api/map/#map#addcontrol).

new NavigationControl(options: [Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)?)

### Parameters

Name

Description

#### options

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)`?`(default `{}`)

#### options.showCompass

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

If `true` the compass button is included.

#### options.showZoom

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

If `true` the zoom-in and zoom-out buttons are included.

#### options.visualizePitch

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `false`)

If `true` the pitch is visualized by rotating X-axis of compass.

### Example

``` js
const nav = new mapboxgl.NavigationControl();
map.addControl(nav, 'top-left');
```

``` js
const nav = new mapboxgl.NavigationControl({
    visualizePitch: true
});
map.addControl(nav, 'bottom-right');
```

### Related

- [Example: Display map navigation controls](https://www.mapbox.com/mapbox-gl-js/example/navigation/)
- [Example: Add a third party vector tile source](https://www.mapbox.com/mapbox-gl-js/example/third-party/)

Was this section on NavigationControl helpful?

## Popup

[githubsrc/ui/popup.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/popup.ts#L112-L699)

A popup component.

Extends [Evented](/mapbox-gl-js/api/events/#evented).new Popup(options: [Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)?)

### Parameters

Name

Description

#### options

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)`?`

#### options.altitude

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `0`)

Elevation in meters above the map surface. If terrain is enabled, the popup will be elevated relative to the terrain.

#### options.anchor

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)`?`

A string indicating the part of the popup that should be positioned closest to the coordinate, set via [Popup#setLngLat](/mapbox-gl-js/api/markers/#popup#setlnglat) . Options are `'center'` , `'top'` , `'bottom'` , `'left'` , `'right'` , `'top-left'` , `'top-right'` , `'bottom-left'` , and `'bottom-right'` . If unset, the anchor will be dynamically set to ensure the popup falls within the map container with a preference for `'bottom'` .

#### options.className

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)`?`

Space-separated CSS class names to add to popup container.

#### options.closeButton

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

If `true` , a close button will appear in the top right corner of the popup.

#### options.closeOnClick

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

If `true` , the popup will close when the map is clicked.

#### options.closeOnMove

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `false`)

If `true` , the popup will close when the map moves.

#### options.focusAfterOpen

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)(default `true`)

If `true` , the popup will try to focus the first focusable element inside the popup.

#### options.maxWidth

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)(default `'240px'`)

A string that sets the CSS property of the popup's maximum width (for example, `'300px'` ). To ensure the popup resizes to fit its content, set this property to `'none'` . See the MDN documentation for the list of [available values](https://developer.mozilla.org/en-US/docs/Web/CSS/max-width) .

#### options.offset

`(`[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)` | `[`PointLike`](/mapbox-gl-js/api/geography/#pointlike)` | `[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)`)?`

A pixel offset applied to the popup's location specified as:

- a single number specifying a distance from the popup's location
- a [PointLike](/mapbox-gl-js/api/geography/#pointlike) specifying a constant offset
- an object of [Point](/mapbox-gl-js/api/geography/#point)s specifing an offset for each anchor position.

Negative offsets indicate left and up.

### Example

``` js
const markerHeight = 50;
const markerRadius = 10;
const linearOffset = 25;
const popupOffsets = {
    'top': [0, 0],
    'top-left': [0, 0],
    'top-right': [0, 0],
    'bottom': [0, -markerHeight],
    'bottom-left': [linearOffset, (markerHeight - markerRadius + linearOffset) * -1],
    'bottom-right': [-linearOffset, (markerHeight - markerRadius + linearOffset) * -1],
    'left': [markerRadius, (markerHeight - markerRadius) * -1],
    'right': [-markerRadius, (markerHeight - markerRadius) * -1]
};
const popup = new mapboxgl.Popup({offset: popupOffsets, className: 'my-class'})
    .setLngLat(e.lngLat)
    .setHTML("<h1>Hello World!</h1>")
    .setMaxWidth("300px")
    .addTo(map);
```

### Instance Members

Search Instance Members

### Events

### Related

- [Example: Display a popup](https://www.mapbox.com/mapbox-gl-js/example/popup/)
- [Example: Display a popup on hover](https://www.mapbox.com/mapbox-gl-js/example/popup-on-hover/)
- [Example: Display a popup on click](https://www.mapbox.com/mapbox-gl-js/example/popup-on-click/)
- [Example: Attach a popup to a marker instance](https://www.mapbox.com/mapbox-gl-js/example/set-popup/)

Was this section on Popup helpful?

## ScaleControl

[githubsrc/ui/control/scale_control.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/control/scale_control.ts#L43-L144)

A `ScaleControl` control displays the ratio of a distance on the map to the corresponding distance on the ground. Add this control to a map using [Map#addControl](/mapbox-gl-js/api/map/#map#addcontrol).

new ScaleControl(options: [Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)?)

### Parameters

Name

Description

#### options

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)`?`(default `{}`)

#### options.maxWidth

[`number`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)(default `'100'`)

The maximum length of the scale control in pixels.

#### options.unit

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)(default `'metric'`)

Unit of the distance ( `'imperial'` , `'metric'` or `'nautical'` ).

### Example

``` js
const scale = new mapboxgl.ScaleControl({
    maxWidth: 80,
    unit: 'imperial'
});
map.addControl(scale);

scale.setUnit('metric');
```

### Instance Members

Was this section on ScaleControl helpful?Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
