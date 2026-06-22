<!-- Source: https://docs.mapbox.com/mapbox-gl-js/guides/user-interactions/interactions/ -->

# Interactions API
The new Interactions API is a toolset that allows you to handle interactions on layers, predefined [featuresets](https://docs.mapbox.com/style-spec/reference/featuresets/) in evolving basemap styles like Standard, and the map itself. The API is available starting from Mapbox GL JS `v3.9.0`.

To use the API, you define *interaction handlers* for events like `'click'` or `'mouseenter'` that target specific map layers, [featuresets](https://docs.mapbox.com/style-spec/reference/featuresets/), or the map itself. When a user interacts with map features belonging to one of these sets, the API will call the appropriate interaction handler for that feature that was interacted with.

## Adding an interaction to a map layer

Add interactions to the map by indicating an event type (`'click'`, `'mouseenter'`, `'mouseleave'`, etc), a target (either a layer or featureset), and a handler function.

Use the [`addInteraction`](/mapbox-gl-js/api/map/#map#addinteraction) method to add the interaction:

``` javascript
map.addInteraction('my-polygon-click-interaction', {
  type: 'click',
  target: { layerId: polygons },
  handler: (e) => {
    map.setFeatureState(e.feature, {highlight: true});
  }
});
```

The handler in the example above will be called each time a user clicks a feature rendered on the `polygons` layer. The handler receives an event object with information about the interaction, including the feature that was interacted with. In this example, the handler sets a feature state on the clicked feature to highlight it.

You can add an interaction at any time, there is no need to wait for the style to load. If there is no layer with the name provided, then no interaction will be added.

Interactions can be removed by calling the [`removeInteraction`](/mapbox-gl-js/api/map/#map#removeinteraction) method:

``` javascript
map.removeInteraction('my-polygon-click-interaction');
```

[EXAMPLELayer Interaction](https://docs.mapbox.com/mapbox-gl-js/example/simple-interactions/)

See a working example of using `addInteraction` to add hover and click interactions to a map layer.

## Adding an interaction to a featureset

Interactions can also be added to a featureset. [Featuresets](https://docs.mapbox.com/style-spec/reference/root/#featuresets) are named groups of layers that can be defined in an evolving basemap style. In the [Mapbox Standard Style](https://docs.mapbox.com/map-styles/standard/), there are predefined Points-of-Interest (POI), Place Labels, and Buildings featuresets that include all corresponding features in the map. You can add interactions to your map that target these featuresets.

To see the available featuresets in the Standard Style, see the [Mapbox Standard Style API reference documentation](https://docs.mapbox.com/map-styles/standard/api/#featuresets).

``` js
map.addInteraction('poi-click', {
  type: 'click',
  target: {featuresetId: 'poi', importId: 'basemap'},
  handler(e) {
    console.log(e.feature);
  }
});
```

When you use a featureset, the interaction handler will receive a `Feature` object that contains the feature's properties and geometry. You can use this information to customize the behavior of your application based on the specific feature that was interacted with.

[EXAMPLEFeatureset Interaction](https://docs.mapbox.com/mapbox-gl-js/example/standard-interactions/)

See a working example of using `addInteraction` to interact with featuresets in the Mapbox Standard style.

## Setting feature states

After a feature is returned from the interaction, you can set its [feature state](https://docs.mapbox.com/style-spec/reference/expressions/#feature-state). Setting the feature state allows you to control the appearance of individual features within a featureset.

For example, you may want to highlight individual buildings after a user hovers the mouse over them. To do this, you would add an interaction targeting the `buildings` featureset. When a user taps on a building in this featureset, the building feature is available in the handler function. You then set the feature state for this feature's `highlight` configuration option to `true`. By default, highlighted buildings in Mapbox Standard will be displayed in blue, as shown in the image below. You can customize the color of selected buildings.

``` js
map.addInteraction('building-mouseenter', {
  type: 'mouseenter',
  target: {featuresetId: 'buildings', importId: 'basemap'},
  handler: (e) => {
    map.setFeatureState(e.feature, {highlight: true});
  }
});
```

Each predefined featureset in the Standard Style has appropriate configuration options that can be modified at runtime in this way. Explore the Mapbox Standard Documentation to learn more about the specific configuration options available for each featureset.

[EXAMPLEFeatureset Interaction](https://docs.mapbox.com/mapbox-gl-js/example/standard-interactions/)

See a working example of using `addInteraction` to update feature states on featuresets in the Mapbox Standard style.

## Adding an interaction to the map

You can use `addInteraction` in a way that doesn't take any layer or featureset by omitting the `target` option. This lets you handle events on the map itself. For example, you can add an interaction that listens for `'click'` events anywhere on the map and logs the coordinates of the click to the console:

``` javascript
map.addInteraction('map-click', {
  type: 'click',
  handler: (e) => {
    console.log(`Clicked at: ${e.lngLat.lng}, ${e.lngLat.lat}`);
  }
});
```

Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
