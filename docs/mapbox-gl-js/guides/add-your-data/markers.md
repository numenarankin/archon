<!-- Source: https://docs.mapbox.com/mapbox-gl-js/guides/add-your-data/markers/ -->

# Markers
When using **Mapbox GL JS**, there are several ways to add your own data to the map. The right approach depends on the type, quantity, and style of data you want to display.

**Markers** are DOM elements positioned above the map at geographic coordinates. They are ideal for quickly adding interactive elements to represent specific locations.

**Benefits:**

- Quick to implement for common use cases
- Full HTML/CSS customization options
- Built-in drag and drop support
- Easy interaction handling with DOM events
- No image assets required for default markers

**Limitations:**

- Less efficient for large datasets (100+ markers)
- No built-in clustering support
- Limited integration with map styling

Both default and custom markers are created using the [`Marker`](/mapbox-gl-js/api/markers/) class.

## Default Markers

Default markers are the quickest way to visually represent point data on a map. They use a generic pin icon that can be customized with different colors and sizes.

Default MarkersThe default marker style is a generic pin icon that can be customized with different colors and sizes

### Add a default marker

To add a default marker to the map, instantiate the `mapboxgl.Marker` class and set its geographic coordinates using `setLngLat()`. Finally, add it to the map instance with `addTo()`.

``` javascript
// create a marker at a coordinate
const marker = new mapboxgl.Marker()
  .setLngLat([-74.0060, 40.7128])
  .addTo(map);
```

[EXAMPLEAdd a default marker](/mapbox-gl-js/example/add-a-marker/)

See an interactive example showing how to add a default marker to a map.

### Customize a default marker

You can customize the default marker's color and size by passing options to the `Marker` constructor:

``` javascript
const marker = new mapboxgl.Marker({
    color: '#FF0000', // set marker color
    scale: 1.5        // scale the marker size
  })
  .setLngLat([-74.0060, 40.7128])
  .addTo(map);
```

For a full list of options, see the [`Marker` API documentation](/mapbox-gl-js/api/markers/#marker).

[EXAMPLEAdd a default marker](/mapbox-gl-js/example/add-a-marker/)

See an interactive example showing how to set the color of a default marker.

## Custom markers

Markers can be created using an HTML element, allowing for complete control over appearance and interactivity.

Custom MarkersYou can create custom markers using any HTML element, allowing for complete control over appearance and interactivity

To create a custom marker, first create a DOM element via JavaScript. Then, use that element as the `element` option when instantiating the `Marker` class.

``` javascript
const el = document.createElement('div');
// style the element with CSS
...

const marker = new mapboxgl.Marker({
    element: el,
    // specify other options here
})
  .setLngLat([-74.0060, 40.7128])
  .addTo(map);
```

### Add a custom marker using a background image

To use an image as a marker, a common practice is to create a `div` element and set its `backgroundImage` style property to the URL of your image. You can also set the width, height, and other styles as needed.

``` javascript
// create a custom marker element
const el = document.createElement('div');
// add a class or style to the element
el.className = 'custom-marker';
el.style.backgroundImage = 'url(path/to/marker.png)';
el.style.width = '32px';
el.style.height = '32px';
el.style.cursor = 'pointer';

const marker = new mapboxgl.Marker({
    element: el,
})
    .setLngLat([-74.0060, 40.7128])
    .addTo(map);
```

[EXAMPLEAdd markers using background images](/mapbox-gl-js/example/custom-marker-icons/)

See an interactive example showing how to create a custom marker.

### Add a custom marker using HTML

You can build out a complex HTML structure for your marker. For example, you might create a `div` containing an `img` and some text:

``` javascript
const el = document.createElement('div');
el.className = 'custom-marker';
el.innerHTML = `
  <img src="path/to/marker.png" alt="Marker" style="width:32px;height:32px;">
  <span class="marker-label">My Marker</span>
`;

const marker = new mapboxgl.Marker({
  element: el
})
  .setLngLat([-74.0060, 40.7128])
  .addTo(map);
```

### Styling markers with CSS

Since markers are HTML elements, you can style them using CSS loaded from an external stylesheet. For example, you might add a class to your marker element and define styles for that class in a CSS file:

``` javascript
const el = document.createElement('div');
el.className = 'custom-marker';

const marker = new mapboxgl.Marker({
  element: el
})
  .setLngLat([-74.0060, 40.7128])
  .addTo(map);
```

styles.css

``` css
.custom-marker {
  position: relative;
  width: 32px;
  height: 32px;
  cursor: pointer;
}
```

You can also use CSS to add animations, transitions, and other effects to your markers.

[EXAMPLEAnimate a custom marker on appearance](/mapbox-gl-js/example/animate-marker-on-appearance/)

See an interactive example showing how to animate a custom marker with CSS when it is added to the map.

## Offset and anchor options

When creating a marker, you specify `offset` and `anchor` options to fine-tune the marker's position relative to its geographical coordinates.

By default, the marker uses a `center` anchor, meaning the marker element is centered vertically and horizontally on the specified coordinates. You can change the anchor to `top`, `bottom`, `left`, `right`, or combinations like `top-left` to adjust where the marker points.

For example, a typical "pin" marker often uses a `bottom` anchor so that the tip of the pin points to the exact location on the map.

For a full list of options, see the [`Marker` reference documentation](/mapbox-gl-js/api/markers/#marker).

## Adding multiple markers

Use a loop to add multiple markers from a data array:

``` javascript
const locations = [
  {
    coordinates: [-74.0060, 40.7128],
    name: 'New York City'
  },
  {
    coordinates: [-118.2437, 34.0522],
    name: 'Los Angeles'
  },
  // ... more locations
];

locations.forEach(location => {
  // create a marker for each location
  new mapboxgl.Marker()
    .setLngLat(location.coordinates)
    .addTo(map);
});
```

## Marker Interactivity

The most common interactions with markers include adding popups, making them draggable, and handling click events.

### Adding popups

Mapbox GL JS provides a [`Popup`](/mapbox-gl-js/api/markers/#popup) class that can display HTML content in a dismissable callout-style UI. These are often used in conjunction with markers to show additional information about a point location when the marker is clicked.

To attach a popup to a marker, create a `Popup` instance and set its HTML content using `setHTML()`. Then, associate the popup with the marker using `setPopup()`.

``` javascript
const marker = new mapboxgl.Marker()
  .setLngLat([-74.0060, 40.7128])
  .addTo(map);

const popup = new mapboxgl.Popup()
  .setHTML('<h3>New York City</h3><p>The most populous city in the United States.</p>');

marker.setPopup(popup);
```

[EXAMPLEAttach a popup to a marker instance](/mapbox-gl-js/example/set-popup/)

See an interactive example showing how to attach a popup to a marker.

Popups are not limited to use with markers; they can be used independently and added or removed programmatically. See the [`Popup` reference documentation](/mapbox-gl-js/api/markers/#popup) for more details.

### Drag and drop

Enable marker dragging by setting the `draggable` option to `true` when creating the marker. You can listen for drag events to get the updated position of the marker.

``` javascript
const marker = new mapboxgl.Marker({
  draggable: true
})
  .setLngLat([-74.0060, 40.7128])
  .addTo(map);

// listen for drag events
marker.on('drag', () => {
  const lngLat = marker.getLngLat();
  console.log(`Marker position: ${lngLat.lng}, ${lngLat.lat}`);
});

marker.on('dragend', () => {
  const lngLat = marker.getLngLat();
  console.log(`Marker dropped at: ${lngLat.lng}, ${lngLat.lat}`);
});
```

[EXAMPLEDrag a marker](/mapbox-gl-js/example/drag-a-marker/)

See an interactive example showing how to drag a marker and access its new coordinates.

### Click events

Since markers are DOM elements, you can add normal DOM event listeners to them for interactivity using `addEventListener`.

``` javascript
// create a custom marker element
const el = document.createElement('div');
el.className = 'custom-marker';
el.style.backgroundImage = 'url(path/to/marker.png)';
el.style.width = '32px';
el.style.height = '32px';
el.style.cursor = 'pointer';

// add click event
el.addEventListener('click', () => {
  console.log('Marker clicked!');
  // respond to the click event here
});

const marker = new mapboxgl.Marker(el)
  .setLngLat([-74.0060, 40.7128])
  .addTo(map);
```

## Removing markers

Call `Marker.remove()` to remove a marker from the map.

``` javascript
// create a Marker instance and add it to the map
const marker = new mapboxgl.Marker()
  .setLngLat([-74.0060, 40.7128])
  .addTo(map);

...

// remove the marker from the map
marker.remove();
```

If you are managing multiple markers, keep track of each instance by storing them in an array so you can remove them as needed.

``` javascript
// use an array of objects to hold data for each marker
const markerData = [
    { city: 'New York City', coordinates: [-74.0060, 40.7128] },
    { city: 'Los Angeles', coordinates: [-118.2437, 34.0522] },
    // ... more marker data
]

// map the array of objects to an array of Marker instances
const markers = markerData.map(data => {
  const marker = new mapboxgl.Marker()
    .setLngLat(data.coordinates)
    .addTo(map);

  return marker;
});

// iterate over the array to remove all markers
markers.forEach(marker => marker.remove());
```

## Performance considerations

Markers create DOM elements, so performance may degrade with large numbers of markers. For scenarios with 100+ markers, consider:

- Using [Style Layers](/mapbox-gl-js/guides/add-your-data/style-layers/) for better performance with large datasets
- Implementing custom clustering solutions
- Loading markers progressively based on map bounds

## Using Markers in a React app

A common pattern when using Mapbox GL JS in a React application is to create a custom `Marker` component that encapsulates the marker logic within the React component lifecycle.

Marker.jsx

``` jsx
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import mapboxgl from 'mapbox-gl';

const Marker = ({ map, coordinates, data }) => {
  const markerRef = useRef();
  const markerElementRef = useRef(document.createElement('div'));

  // initialize the marker when the component mounts
  useEffect(() => {
    markerRef.current = new mapboxgl.Marker({
      element: markerElementRef.current
    })
      .setLngLat(coordinates)
      .addTo(map);

    // remove the marker when the component unmounts
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
      }
    };
  }, []);

  // use createPortal to render JSX content into the marker element
  return (
    <>
      {createPortal(
          <img src="path/to/marker.png" alt={data.city} style={{ width: '32px', height: '32px' }} />
          <span className="marker-label">{data.city}</span>
        </div>,
        markerElementRef.current
      )}
    </>
  )
};

// usage example in a parent component
/*
<Marker
  map={map} // Mapbox GL JS map instance
  coordinates={[-74.0060, 40.7128]} // marker coordinates
  data={{ city: 'New York City' }} // custom data for the marker
/>
```

See the following tutorials to learn more about using Mapbox GL JS and Markers with React:

[TUTORIALUse Mapbox GL JS with React](https://docs.mapbox.com/help/tutorials/use-mapbox-gl-js-with-react/)

Learn how to set up a Mapbox GL JS map in a React application.

[TUTORIALAdd Dynamic Markers and Popups to a Map in a React app](https://docs.mapbox.com/help/tutorials/dynamic-markers-react/)

Learn how to create reusable components for adding dynamic markers and popups to a Mapbox GL JS map in a React application.

Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
