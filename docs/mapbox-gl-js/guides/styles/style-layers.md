<!-- Source: https://docs.mapbox.com/mapbox-gl-js/guides/styles/style-layers/ -->

# Styling layers with expressions
In Mapbox GL JS, you can specify the value for any layout property, paint property, or filter as an expression. Expressions define how one or more feature property value or the current zoom level are combined using logical, mathematical, string, or color operations to produce the appropriate style property value or filter decision.

A **property expression** is any expression defined using a reference to feature property data. Property expressions allow the appearance of a feature to change with its properties. They can be used to visually differentiate types of features within the same layer or create data visualizations.

A **camera expression** is any expression defined using `['zoom']`. Such expressions allow the appearance of a layer to change with the map’s zoom level. Zoom expressions can be used to create the illusion of depth and control data density.

There are countless ways to apply property expressions to your application, including:

- **Data-driven styling**: Specify style rules based on one or more data attribute.
- **Arithmetic**: Do arithmetic on source data, for example performing calculations to convert units.
- **Conditional logic**: Use if-then logic, for example to decide exactly what text to display for a label based on which properties are available in the feature or even the length of the name.
- **String manipulation**: Take control over label text with things like uppercase, lowercase, and title case transforms without having to edit, re-prepare and re-upload your data.

[RELATEDMapbox Style Specification: Expressions](https://docs.mapbox.com/style-spec/reference/expressions/)

An expression defines a formula for computing the value of the property using the operators described in this section.

### Syntax

The Mapbox GL JS expressions follow this format:

``` text
["expression_name", argument_0, argument_1]
```

The `expression_name` is the **expression operator**, for example, you would use [`"*"`](https://docs.mapbox.com/style-spec/reference/expressions/#*) to multiply two arguments or [`case`](https://docs.mapbox.com/style-spec/reference/expressions/#case) to create conditional logic.

The **arguments** are either *literal* (numbers, strings, or boolean values) or else themselves expressions. The number of arguments varies based on the expression.

Here's one example using an expression to calculate an arithmetic expression (π \* 3<sup>2</sup>):

``` json
["*", ["pi"], ["^", 3, 2]]
```

This example uses the [`"*"`](https://docs.mapbox.com/style-spec/reference/expressions/#*) operator to multiply two arguments. The first argument is [`pi`](https://docs.mapbox.com/style-spec/reference/expressions/#pi), which is an expression that returns the mathematical constant Pi. The second argument is another expression: a [`pow`](https://docs.mapbox.com/style-spec/reference/expressions/#pow) expression with two arguments of its own. It will return 3<sup>2</sup>, and the result will be multiplied by π.

### Expression types

- **Mathematical operators** for performing arithmetic and other operations on numeric values
- **Logical operators** for manipulating boolean values and making conditional decisions
- **String operators** for manipulating strings
- **Data operators** for providing access to the properties of source features
- **Camera operators** for providing access to the parameters defining the current map view

### Data-driven styling at runtime

You can use expressions to determine the style of features in a layer based on data properties in the source data. For example, if you have a source containing point data from individual responses to the 2010 U.S. Census and each point has an "ethnicity" data property, you can use expressions to specify the color of each circle based on reported ethnicity.

The example below uses the [`match`](https://docs.mapbox.com/style-spec/reference/expressions/#match) operator to compare the value of the `"ethnicity"` data property for each point in the source to several possible values. The first argument of the `match` expression is the value of the `"ethnicity"` data property. There are several arguments that specify what to do if the value of the data property matches a given string and a final argument that specifies what to do if the value of the data property does not match any of the strings provided.

To read the values of the `"ethnicity"` data property, this example uses the [`get`](https://docs.mapbox.com/style-spec/reference/expressions/#get) operator with `"ethnicity"` as the sole argument.

Then, it uses `stop`s for the next several arguments for the `match` expression. Each `stop` has two arguments: the first is the value to compare to the value of the `"ethnicity"` data property and the second is the value that should be applied to the layer's `circleColor` property if the value of the data property matches the first argument.

The second argument of the `stop` is a color, which is constructed using the [`rgb`](https://docs.mapbox.com/style-spec/reference/expressions/#rgb) operator.

The final argument of the `match` expression is a fallback value that should be applied to `circle-color` if the value of the `"ethnicity"` data property does not match any of the strings provided.

``` js
map.addLayer({
  id: 'circle',
  type: 'circle',
  source: 'census',
  paint: {
    // match the value of the data property to a specific color
    'circle-color': [
      'match',
      ['get', 'ethnicity'],
      'White',
      '#fbb03b',
      'Black',
      '#223b53',
      'Hispanic',
      '#e55e5e',
      'Asian',
      '#3bb2d0',
      /* other */ 'black'
    ]
  }
});
```

[EXAMPLEData-driven styling example](/mapbox-gl-js/example/data-driven-circle-colors/)

Style circles with a data-driven property

### Zoom-driven styling at runtime

You can use expressions to determine the style of features in a layer based on the camera position, including the zoom level. For example, if you have dense point data displayed using a circle layer, you may want to adjust the radius of circles based on the zoom level to make the data more readable at low zoom levels.

The example below uses the [`interpolate`](https://docs.mapbox.com/style-spec/reference/expressions/#interpolate) operator to produce a continuous, smooth series of values between pairs of input and output values ("stops"). Its first argument sets the interpolation type, the second is the value of the zoom level, and the remaining arguments specify the size of the circle radius that should be applied based on the value of the zoom level.

"Exponential" is one of a few types of interpolation available Mapbox expressions. An expression using the `exponential` operator has one argument: the `base`, which controls the rate at which the output increases.

The [`zoom`](https://docs.mapbox.com/style-spec/reference/expressions/#zoom) expression does not require any arguments. It will return the value of the current zoom level of the map.

The remaining arguments of the `interpolate` expression are `stop`s. They represent points along the exponential curve. When a user is viewing the map at zoom level `12` or below, the circles will have a radius of `2`. When viewing it at zoom level `22` and above, the circles will have a radius of `180`. For all zoom levels between, the radius will be determined by an exponential function and the value will fall somewhere between `2` and `180`.

``` js
map.addLayer({
  id: 'population',
  type: 'circle',
  source: 'ethnicity-source',
  'source-layer': 'sf2010',
  paint: {
    'circle-radius': [
      // Produce a continuous, smooth series of values
      // between pairs of input and output values
      'interpolate',
      ['exponential', 1.75], // Set the interpolation type
      ['zoom'], // Get current zoom level
      // If the map is at zoom level 12 or below, set circle radius to 2
      12,
      2,
      // If the map is at zoom level 22 or above, set circle radius to 180
      22,
      180
    ]
  }
});
```

[EXAMPLEZoom-driven styling example](/mapbox-gl-js/example/change-building-color-based-on-zoom-level/)

Change building color based on zoom level

### Light-driven styling in Standard

Mapbox Standard uses 3D lighting which affects the entire map, like lighting in the real world. This means that when you switch to dark lights, for example to the “night” preset, your custom layers will also be dark. If you want to change how light affects your custom layer, you will need to configure different variants of the `emissive-strength` property. These properties control how light is being emitted, for example, `background-emissive-strength` adjusts the opacity of the background. The different variants of emissive-strength include: [`background`](https://docs.mapbox.com/style-spec/reference/layers/#paint-background-background-emissive-strength), [`fill`](https://docs.mapbox.com/style-spec/reference/layers/#paint-fill-fill-emissive-strength), [`circle`](https://docs.mapbox.com/style-spec/reference/layers/#paint-circle-circle-emissive-strength), [`text`](https://docs.mapbox.com/style-spec/reference/layers/#paint-symbol-text-emissive-strength), [`line`](https://docs.mapbox.com/style-spec/reference/layers/#paint-line-line-emissive-strength) and many more variants which can be viewed on the [layers page](https://docs.mapbox.com/style-spec/reference/layers/) of the Mapbox Style Specification.

To learn more about `layer types` in general, view the [layer types style spec documentation](https://docs.mapbox.com/style-spec/reference/layers/#type).

Here’s an example how you would set \*-emissive-strength for a [line](https://docs.mapbox.com/style-spec/reference/layers/#line) layer:

``` js
map.addLayer({
  id: 'my-line-layer',
  source: 'vector-source',
  'source-layer': 'road',
  paint: {
    'line-emissive-strength': 1
  }
});
```

This image illustrates how different `line-emissive-strength` values are impacting the visual appearance of a line layer:

Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
