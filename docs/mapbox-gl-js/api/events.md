<!-- Source: https://docs.mapbox.com/mapbox-gl-js/api/events/ -->

# Events and event types
Search GL JS API Reference

`Map` and other Mapbox GL JS classes emit events in response to user interactions or changes in state. `Evented` is the interface used to bind and unbind listeners for these events. This page describes the different types of events that Mapbox GL JS can raise.

You can learn more about the originating events here:

- [`Map` events](/mapbox-gl-js/api/map/#map-events) fire when a user interacts with a `Map`.
- [`Marker` events](/mapbox-gl-js/api/markers/#marker-events) fire when a user interacts with a `Marker`.
- [`Popup` events](/mapbox-gl-js/api/markers/#popup-events) fire when a user interacts with a `Popup`.
- [`GeolocationControl` events](/mapbox-gl-js/api/markers/#geolocatecontrol-events) fire when a user interacts with a `GeolocationControl`.

## Evented

[githubsrc/util/evented.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/util/evented.ts#L73-L208)

`Evented` mixes methods into other classes for event capabilities.

Unless you are developing a plugin you will most likely use these methods through classes like `Map` or `Popup`.

For lists of events you can listen for, see API documentation for specific classes: [`Map`](https://docs.mapbox.com/mapbox-gl-js/api/map/#map-events), [`Marker`](https://docs.mapbox.com/mapbox-gl-js/api/map/#map-events), [`Popup`](https://docs.mapbox.com/mapbox-gl-js/api/map/#map-events), and [`GeolocationControl`](https://docs.mapbox.com/mapbox-gl-js/api/map/#map-events).

### Instance Members

Was this section on Evented helpful?

## MapBoxZoomEvent

[githubsrc/ui/events.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/events.ts#L380-L404)

`MapBoxZoomEvent` is a class used to generate the events 'boxzoomstart', 'boxzoomend', and 'boxzoomcancel'. For a full list of available events, see [`Map` events](/mapbox-gl-js/api/map/#map-events).

### Type

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)

### Properties

Name

Description

#### originalEvent

[`MouseEvent`](https://developer.mozilla.org/docs/Web/API/MouseEvent)

The DOM event that triggered the boxzoom event. Can be a `MouseEvent` or `KeyboardEvent` .

#### target

[`Map`](/mapbox-gl-js/api/map/#map)

The `Map` instance that triggered the event.

#### type

`(``"boxzoomstart"`` | ``"boxzoomend"`` | ``"boxzoomcancel"``)`

The type of originating event. For a full list of available events, see [`Map` events](/mapbox-gl-js/api/map/#map-events) .

### Example

``` js
// Example trigger of a BoxZoomEvent of type "boxzoomstart"
map.on('boxzoomstart', (e) => {
    console.log('event type:', e.type);
    // event type: boxzoomstart
});
```

``` js
// Example of a BoxZoomEvent of type "boxzoomstart"
// {
//   originalEvent: {...},
//   type: "boxzoomstart",
//   target: {...}
// }
```

### Related

- [Reference: `Map` events API documentation](https://docs.mapbox.com/mapbox-gl-js/api/map/#map-events)
- [Example: Highlight features within a bounding box](https://docs.mapbox.com/mapbox-gl-js/example/using-box-queryrenderedfeatures/)

Was this section on MapBoxZoomEvent helpful?

## MapDataEvent

[githubsrc/ui/events.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/events.ts#L428-L465)

`MapDataEvent` is a type of events related to loading data, styles, and sources. For a full list of available events, see [`Map` events](/mapbox-gl-js/api/map/#map-events).

### Type

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)

### Properties

Name

Description

#### coord

`OverscaledTileID?`

The coordinate of the tile if the event has a `dataType` of `source` and the event is related to loading of a tile.

#### dataType

`(``"source"`` | ``"style"``)`

The type of data that has changed. One of `'source'` or `'style'` , where `'source'` refers to the data associated with any source, and `'style'` refers to the entire [style](https://docs.mapbox.com/help/glossary/style/) used by the map.

#### isSourceLoaded

[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)`?`

True if the event has a `dataType` of `source` and the source has no outstanding network requests.

#### source

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)`?`

The [style spec representation of the source](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/) if the event has a `dataType` of `source` .

#### sourceDataType

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)`?`

Included if the event has a `dataType` of `source` and the event signals that internal data has been received or changed. Possible values are `metadata` , `content` and `visibility` , and `error` .

#### sourceId

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)`?`

The `id` of the [`source`](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/) that triggered the event, if the event has a `dataType` of `source` . Same as the `id` of the object in the `source` property.

#### tile

[`Object`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)`?`

The tile being loaded or changed, if the event has a `dataType` of `source` and the event is related to loading of a tile.

#### type

`(``"data"`` | ``"dataloading"`` | ``"styledata"`` | ``"styledataloading"`` | ``"sourcedata"`` | ``"sourcedataloading"``)`

The type of originating event. For a full list of available events, see [`Map` events](/mapbox-gl-js/api/map/#map-events) .

### Example

``` js
// Example of a MapDataEvent of type "sourcedata"
map.on('sourcedata', (e) => {
    console.log(e);
    // {
    //   dataType: "source",
    //   isSourceLoaded: false,
    //   source: {
    //     type: "vector",
    //     url: "mapbox://mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2"
    //   },
    //   sourceDataType: "visibility",
    //   sourceId: "composite",
    //   style: {...},
    //   target: {...},
    //   type: "sourcedata"
    // }
});
```

### Related

- [Reference: `Map` events API documentation](https://docs.mapbox.com/mapbox-gl-js/api/map/#map-events)
- [Example: Change a map's style](https://docs.mapbox.com/mapbox-gl-js/example/setstyle/)
- [Example: Add a GeoJSON line](https://docs.mapbox.com/mapbox-gl-js/example/geojson-line/)

Was this section on MapDataEvent helpful?

## MapMouseEvent

[githubsrc/ui/events.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/events.ts#L58-L157)

`MapMouseEvent` is a class used by other classes to generate mouse events of specific types such as 'click' or 'hover'. For a full list of available events, see [`Map` events](/mapbox-gl-js/api/map/#map-events).

Extends [Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object).

### Example

``` js
// Example of a MapMouseEvent of type "click"
map.on('click', (e) => {
    console.log(e);
    // {
    //     lngLat: {
    //         lng: 40.203,
    //         lat: -74.451
    //     },
    //     originalEvent: {...},
    //     point: {
    //         x: 266,
    //         y: 464
    //     },
    //      target: {...},
    //      type: "click"
    // }
});
```

### Instance Members

### Related

- [Reference: `Map` events API documentation](https://docs.mapbox.com/mapbox-gl-js/api/map/#map-events)
- [Example: Display popup on click](https://docs.mapbox.com/mapbox-gl-js/example/popup-on-click/)
- [Example: Display popup on hover](https://www.mapbox.com/mapbox-gl-js/example/popup-on-hover/)

Was this section on MapMouseEvent helpful?

## MapTouchEvent

[githubsrc/ui/events.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/events.ts#L200-L304)

`MapTouchEvent` is a class used by other classes to generate mouse events of specific types such as 'touchstart' or 'touchend'. For a full list of available events, see [`Map` events](/mapbox-gl-js/api/map/#map-events).

Extends [Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object).

### Example

``` js
// Example of a MapTouchEvent of type "touch"
map.on('touchstart', (e) => {
    console.log(e);
    // {
    //   lngLat: {
    //      lng: 40.203,
    //      lat: -74.451
    //   },
    //   lngLats: [
    //      {
    //         lng: 40.203,
    //         lat: -74.451
    //      }
    //   ],
    //   originalEvent: {...},
    //   point: {
    //      x: 266,
    //      y: 464
    //   },
    //   points: [
    //      {
    //         x: 266,
    //         y: 464
    //      }
    //   ]
    //   preventDefault(),
    //   target: {...},
    //   type: "touchstart"
    // }
});
```

### Instance Members

### Related

- [Reference: `Map` events API documentation](https://docs.mapbox.com/mapbox-gl-js/api/map/#map-events)
- [Example: Create a draggable point](https://docs.mapbox.com/mapbox-gl-js/example/drag-a-point/)

Was this section on MapTouchEvent helpful?

## MapWheelEvent

[githubsrc/ui/events.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/events.ts#L329-L376)

`MapWheelEvent` is a class used by other classes to generate mouse events of specific types such as 'wheel'. For a full list of available events, see [`Map` events](/mapbox-gl-js/api/map/#map-events).

Extends [Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object).

### Example

``` js
// Example event trigger for a MapWheelEvent of type "wheel"
map.on('wheel', (e) => {
    console.log('event type:', e.type);
    // event type: wheel
});
```

``` js
// Example of a MapWheelEvent of type "wheel"
// {
//   originalEvent: WheelEvent {...},
//    target: Map {...},
//   type: "wheel"
// }
```

### Instance Members

### Related

- [Reference: `Map` events API documentation](https://docs.mapbox.com/mapbox-gl-js/api/map/#map-events)

Was this section on MapWheelEvent helpful?Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
