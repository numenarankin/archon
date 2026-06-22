<!-- Source: https://docs.mapbox.com/mapbox-gl-js/guides/globe/ -->

# Globe and Atmosphere
Mapbox GL JS supports displaying the map as a 3D globe, starting from v2.9.

## Use Globe in Mapbox GL JS

Most of the latest [Mapbox styles](https://docs.mapbox.com/api/maps/styles/#mapbox-styles) use globe by default. Using these styles or a style created them in Studio will enable globe on your map.

Navigation styles default to the [Mercator projection](/mapbox-gl-js/guides/projections/#mercator).

You can change any other map to globe by setting the [projection](https://docs.mapbox.com/style-spec/reference/projection/) property.

``` js
const map = new mapboxgl.Map({
  container: 'map',
  projection: 'globe'
});
```

Globe is compatible with all tile sources and map styles (with a [few caveats](#limitations-of-globe)). See examples for [custom atmosphere styling](/mapbox-gl-js/example/flyto-options/) and [rotating globe](/mapbox-gl-js/example/globe-spin/).

## Atmosphere styling

The latest Mapbox styles include atmosphere by default. You can customize stars and atmosphere with the [fog](https://docs.mapbox.com/style-spec/reference/fog/) property. To set a custom atmosphere in GL JS:

``` js
map.on('style.load', () => {
  map.setFog({
    color: 'rgb(186, 210, 235)', // Lower atmosphere
    'high-color': 'rgb(36, 92, 223)', // Upper atmosphere
    'horizon-blend': 0.02, // Atmosphere thickness (default 0.2 at low zooms)
    'space-color': 'rgb(11, 11, 25)', // Background color
    'star-intensity': 0.6 // Background star brightness (default 0.35 at low zoooms )
  });
});
```

These properties support [zoom expressions](https://docs.mapbox.com/style-spec/reference/expressions/#zoom), for instance to fade from starry space at low zooms to a blue sky at high zooms.

Atmosphere can also be customized per-style in [Mapbox Studio](https://docs.mapbox.com/studio-manual/examples/atmosphere/).

## Behavior

For any [camera](https://docs.mapbox.com/help/glossary/camera/) zoom level and location, maps in globe will be rendered at roughly the same size. At low zoom levels, the same zoom level will result in features near the poles appearing larger in Mercator, while near the equator features will appear larger in globe. This is a compromise ensuring relatively consistent map appearance given the size distortion inherent in Mercator.

## Limitations of Globe

Globe does not yet support [`CustomLayerInterface`](/mapbox-gl-js/api/properties/#customlayerinterface).

Globe does not support the deprecated [sky layer](https://docs.mapbox.com/style-spec/reference/layers/#sky). We recommend styling the sky and atmosphere with the [`fog`](https://docs.mapbox.com/style-spec/reference/fog/) property as described [above](#atmosphere-styling).

Panning is limited by the poles. In the case where it's important to position the map center at pole, consider a [polar projection](/mapbox-gl-js/guides/projections/#customize-a-conic-projection).Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
