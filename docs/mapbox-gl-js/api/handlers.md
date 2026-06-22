<!-- Source: https://docs.mapbox.com/mapbox-gl-js/api/handlers/ -->

# User interaction handlers
Search GL JS API Reference

Items related to the ways in which the map responds to user input.

## BoxZoomHandler

[githubsrc/ui/handler/box_zoom.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/handler/box_zoom.ts#L15-L178)

The `BoxZoomHandler` allows the user to zoom the map to fit within a bounding box. The bounding box is defined by clicking and holding `shift` while dragging the cursor.

### Instance Members

### Related

- [Example: Toggle interactions](https://docs.mapbox.com/mapbox-gl-js/example/toggle-interaction-handlers/)
- [Example: Highlight features within a bounding box](https://docs.mapbox.com/mapbox-gl-js/example/using-box-queryrenderedfeatures/)

Was this section on BoxZoomHandler helpful?

## DoubleClickZoomHandler

[githubsrc/ui/handler/shim/dblclick_zoom.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/handler/shim/dblclick_zoom.ts#L10-L66)

The `DoubleClickZoomHandler` allows the user to zoom the map at a point by double clicking or double tapping.

### Instance Members

### Related

- [Example: Toggle interactions](https://docs.mapbox.com/mapbox-gl-js/example/toggle-interaction-handlers/)

Was this section on DoubleClickZoomHandler helpful?

## DragPanHandler

[githubsrc/ui/handler/shim/drag_pan.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/handler/shim/drag_pan.ts#L18-L94)

The `DragPanHandler` allows the user to pan the map by clicking and dragging the cursor.

### Instance Members

### Related

- [Example: Toggle interactions](https://docs.mapbox.com/mapbox-gl-js/example/toggle-interaction-handlers/)
- [Example: Highlight features within a bounding box](https://docs.mapbox.com/mapbox-gl-js/example/using-box-queryrenderedfeatures/)

Was this section on DragPanHandler helpful?

## DragRotateHandler

[githubsrc/ui/handler/shim/drag_rotate.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/handler/shim/drag_rotate.ts#L10-L102)

The `DragRotateHandler` allows the user to rotate the map by clicking and dragging the cursor while holding the right mouse button or `ctrl` key.

### Instance Members

### Related

- [Example: Toggle interactions](https://docs.mapbox.com/mapbox-gl-js/example/toggle-interaction-handlers/)
- [Example: Disable map rotation](https://docs.mapbox.com/mapbox-gl-js/example/disable-rotation/)

Was this section on DragRotateHandler helpful?

## FeaturesetDescriptor

[githubsrc/util/vectortile_to_geojson.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/util/vectortile_to_geojson.ts#L82-L84)

`FeaturesetDescriptor` references a featureset in a style. If `importId` is not specified, the featureset is assumed to be in the root style.

### Type

`{featuresetId: `[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)`, importId: `[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)`?}`

### Properties

Name

Description

#### featuresetId

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)

#### importId

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)`?`

Was this section on FeaturesetDescriptor helpful?

## Interaction

[githubsrc/ui/interactions.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/interactions.ts#L16-L19)

`Interaction` is a configuration object used with [Map#addInteraction](/mapbox-gl-js/api/map/#map#addinteraction) to handle user events, such as clicks and hovers. Interactions can be applied globally or to specific targets, such as layers or featuresets.

### Type

`{type: MapInteractionEventType, target: `[`TargetDescriptor`](/mapbox-gl-js/api/handlers/#targetdescriptor)`?, namespace: `[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)`?, filter: FilterSpecification?, handler: function (event: `[`InteractionEvent`](/mapbox-gl-js/api/handlers/#interactionevent)`): (`[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)` | void)}`

### Properties

Name

Description

#### filter

`FilterSpecification?`

#### handler

`function (event: `[`InteractionEvent`](/mapbox-gl-js/api/handlers/#interactionevent)`): (`[`boolean`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)` | void)`

#### namespace

[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)`?`

#### target

[`TargetDescriptor`](/mapbox-gl-js/api/handlers/#targetdescriptor)`?`

#### type

`MapInteractionEventType`

### Static Members

Was this section on Interaction helpful?

## InteractionEvent

[githubsrc/ui/interactions.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/interactions.ts#L54-L93)

`InteractionEvent` is an event object that is passed to the interaction handler.

Extends [Event](https://developer.mozilla.org/docs/Web/API/Event).

### Instance Members

Was this section on InteractionEvent helpful?

## KeyboardHandler

[githubsrc/ui/handler/keyboard.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/handler/keyboard.ts#L28-L238)

The `KeyboardHandler` allows the user to zoom, rotate, and pan the map using the following keyboard shortcuts:

- `=` / `+`: Increase the zoom level by 1.
- `Shift-=` / `Shift-+`: Increase the zoom level by 2.
- `-`: Decrease the zoom level by 1.
- `Shift--`: Decrease the zoom level by 2.
- Arrow keys: Pan by 100 pixels.
- `Shift+⇢`: Increase the rotation by 15 degrees.
- `Shift+⇠`: Decrease the rotation by 15 degrees.
- `Shift+⇡`: Increase the pitch by 10 degrees.
- `Shift+⇣`: Decrease the pitch by 10 degrees.

### Instance Members

### Related

- [Example: Toggle interactions](https://docs.mapbox.com/mapbox-gl-js/example/toggle-interaction-handlers/)
- [Example: Navigate the map with game-like controls](https://docs.mapbox.com/mapbox-gl-js/example/game-controls/)
- [Example: Display map navigation controls](https://docs.mapbox.com/mapbox-gl-js/example/navigation/)

Was this section on KeyboardHandler helpful?

## ScrollZoomHandler

[githubsrc/ui/handler/scroll_zoom.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/handler/scroll_zoom.ts#L37-L430)

The `ScrollZoomHandler` allows the user to zoom the map by scrolling.

### Instance Members

### Related

- [Example: Toggle interactions](https://docs.mapbox.com/mapbox-gl-js/example/toggle-interaction-handlers/)
- [Example: Disable scroll zoom](https://docs.mapbox.com/mapbox-gl-js/example/disable-scroll-zoom/)

Was this section on ScrollZoomHandler helpful?

## TargetDescriptor

[githubsrc/util/vectortile_to_geojson.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/util/vectortile_to_geojson.ts#L87-L91)

`TargetDescriptor` defines the target for a [Map#queryRenderedFeatures](/mapbox-gl-js/api/map/#map#queryrenderedfeatures) query to inspect, referencing either a [style layer ID](https://docs.mapbox.com/mapbox-gl-js/style-spec/#layer-id) or a [FeaturesetDescriptor](/mapbox-gl-js/api/handlers/#featuresetdescriptor). It acts as a universal target for [Map#addInteraction](/mapbox-gl-js/api/map/#map#addinteraction) and [Map#queryRenderedFeatures](/mapbox-gl-js/api/map/#map#queryrenderedfeatures).

### Type

`({layerId: `[`string`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)`} | `[`FeaturesetDescriptor`](/mapbox-gl-js/api/handlers/#featuresetdescriptor)`)`Was this section on TargetDescriptor helpful?

## TargetFeature

[githubsrc/util/vectortile_to_geojson.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/util/vectortile_to_geojson.ts#L113-L152)

`TargetFeature` is a [GeoJSON](http://geojson.org/) [Feature object](https://tools.ietf.org/html/rfc7946#section-3.2) representing a feature associated with a specific query target in [Map#queryRenderedFeatures](/mapbox-gl-js/api/map/#map#queryrenderedfeatures). For featuresets in imports, `TargetFeature` includes a `target` reference as a [TargetDescriptor](/mapbox-gl-js/api/handlers/#targetdescriptor) and may also include a `namespace` property to prevent feature ID collisions when layers defined in the query target reference multiple sources. Unlike features returned for root style featuresets, `TargetFeature` omits the `layer`, `source`, and `sourceLayer` properties if the feature belongs to import style.

Extends Feature.

### Instance Members

Was this section on TargetFeature helpful?

## TouchPitchHandler

[githubsrc/ui/handler/touch_zoom_rotate.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/handler/touch_zoom_rotate.ts#L210-L287)

The `TouchPitchHandler` allows the user to pitch the map by dragging up and down with two fingers.

Extends TwoTouchHandler.new TouchPitchHandler(map: [Map](/mapbox-gl-js/api/map/#map))

### Parameters

Name

Description

#### map

[`Map`](/mapbox-gl-js/api/map/#map)

### Related

- [Example: Set pitch and bearing](https://docs.mapbox.com/mapbox-gl-js/example/set-perspective/)

Was this section on TouchPitchHandler helpful?

## TouchZoomRotateHandler

[githubsrc/ui/handler/shim/touch_zoom_rotate.ts](https://github.com/mapbox/mapbox-gl-js/blob/2ab4e84c323f752b4f7943c9c67b2385da5fa8b3/src/ui/handler/shim/touch_zoom_rotate.ts#L17-L144)

The `TouchZoomRotateHandler` allows the user to zoom and rotate the map by pinching on a touchscreen.

They can zoom with one finger by double tapping and dragging. On the second tap, hold the finger down and drag up or down to zoom in or out.

### Instance Members

### Related

- [Example: Toggle interactions](https://docs.mapbox.com/mapbox-gl-js/example/toggle-interaction-handlers/)

Was this section on TouchZoomRotateHandler helpful?Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
