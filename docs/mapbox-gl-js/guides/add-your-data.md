<!-- Source: https://docs.mapbox.com/mapbox-gl-js/guides/add-your-data/ -->

# Add your data to the map
When using **Mapbox GL JS**, there are several ways to add your own data. The right approach depends on the type, quantity, and style of data you want to display.

The most important distinction is whether you want to display data **above** the map or **within** the map itself, as each approach has fundamental differences in how the data is loaded, styled and interacted with.

For most use cases where you want to add point data to your map, **Markers** provide the quickest and easiest solution.

Above the Map: MarkersDOM elements positioned above the map at specific geographic coordinates - the quickest way to add point data.Above the Map: Custom MarkersHTML elements pinned to a map location, using a custom SVG image.In the Map: Style LayersData rendered as part of the map itself, allowing for high-performance visualization of large datasets, and positioning relative to other map features.

## Understanding how the Map is rendered

Mapbox GL JS maps are rendered entirely in the browser using WebGL technology, which enables high-performance, smooth rendering of complex geographic data in a [`<canvas>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas) element.

The map you see is not a single image, but rather a composite of many virtual layers. The SDK fetches data for roads, buildings, and other map features from Mapbox servers, assembles these layers in memory, and presents them based on the current map position, zoom level, and style. In Mapbox GL JS, this rendering is handled by the [`Map`](/mapbox-gl-js/api/map/) class.

This client-side rendering enables smooth interactions with the map - you can rotate, tilt, and zoom while maintaining crisp visuals at any scale. The Map instance dynamically loads additional data as needed based on the current view.

Understanding this architecture is key to choosing how to add your data: you can either add visual elements **above** the map using DOM elements rendered in the browser's UI layer (markers) or integrate your data **into** the map itself as additional layers that can be mixed into the existing layer stack (style layers).

Above the Map: MarkersMarkers are rendered above the map by the browser's DOM layer, and are fixed to a geographic location so they will move when the map moves.In the Map: Style LayersStyle layers are rendered as part of the map itself, allowing for high-performance visualization of large datasets, and positioning relative to other map features.

## Choosing the right approach

When deciding how to add your data to the map, consider the following factors:

- The complexity of your data
- The level of interactivity you need
- Performance requirements
- Development time and effort

**Markers** provide the quickest way to visualize point data. **Style layers** offer maximum flexibility and performance for complex datasets, including points, lines, or polygons.

### Markers

Markers are DOM elements positioned above the map at specific geographic coordinates. They provide a quick way to add interactive elements with minimal code.

**Advantages:**

- Easy to implement with standard web development skills
- Default SVG marker icon, ability to control size and color via options
- Full HTML/CSS customization
- Built-in drag and drop support
- Easy interaction handling with DOM events

**Limitations:**

- Less efficient for large datasets (100+ markers)
- Limited interaction with other map features
- No built-in clustering support

### Style Layers

Style layers are additional layers rendered as part of the map, integrated along with the roads, buildings, and other map features — **sources** provide the geographic data (GeoJSON, vector tiles, raster tiles), and **layers** define how that data is styled (circle, fill, line, symbol, heatmap, etc.).

They are ideal for large or complex datasets, advanced styling, or when you need precise control over map rendering.

**Advantages:**

- Maximum flexibility and performance — can handle tens of thousands of features.
- Compatible with vector tiles for large datasets with wide geographic coverage.
- Can make style changes dynamically without reloading the data.
- Can use data-driven styling (styles change based on feature properties).

**Limitations:**

- More verbose to set up, requires familiarity with the Mapbox Style Specification.
- Requires data in specific formats, such as GeoJSON or vector tiles.
- Complex integration for user interaction — you'll need to add event listeners and query rendered features manually.

------------------------------------------------------------------------

[Markers](/mapbox-gl-js/guides/add-your-data/markers/)

Add interactive markers to your map with minimal code using the Marker class.

[Style layers](/mapbox-gl-js/guides/add-your-data/style-layers/)

Efficiently and performantly display many features on a map from vector or GeoJSON sources.

Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
