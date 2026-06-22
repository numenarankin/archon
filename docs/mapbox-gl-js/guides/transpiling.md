<!-- Source: https://docs.mapbox.com/mapbox-gl-js/guides/transpiling/ -->

# Transpiling
## Transpiling

Starting with version 2, Mapbox GL JS is distributed as an ES6-compatible JavaScript bundle. It uses syntax and APIs from modern JavaScript specifications and is compatible with all major modern browsers.

The JavaScript bundle is incompatible with some transpiler transforms because of the way it shares code between the main thread and Web Worker. We do this to reduce the bundle size and improve rendering performance. If you are using Mapbox GL JS v2 or newer with a module bundler such as Webpack or Rollup along with a transpiler such as Babel, there are three ways to make it compatible:

- Use `browserslist` to target transpilation to a set of compatible transforms
- Explicitly disable transpiling of the Mapbox GL JS bundle
- Load and transpile Web Worker code separately at the cost of increasing bundle size and reducing performance.

### Targeting transpilation of ESNext syntax with browserslist

- If you're using build tool, which supports [browserslist](http://browsersl.ist/) such as [@babel/preset-env](https://babeljs.io/docs/babel-preset-env), use can align your list with Mapbox GL JS [`.browserlistrc`](https://github.com/mapbox/mapbox-gl-js/blob/main/.browserslistrc).

This list can be specified in your project's `package.json` or in a `.browserslistrc` file. See [@babel/preset-env docs](https://babeljs.io/docs/en/babel-preset-env#browserslist-integration) for more details.

### Excluding Mapbox GL JS explicitly from transpilation

- If other parts of your application need ES5 transpilation, then consider excluding GL JS explicitly from transpilation. If you are using Webpack, you can use the `!` prefix in the import statement to exclude `mapbox-gl` from being transformed by existing loaders. See Webpack loaders [inline usage docs](https://webpack.js.org/concepts/loaders/#inline) for more details.

``` js
import mapboxgl from '!mapbox-gl';
```

**OR**

You can also configure this centrally in `webpack.config.js` by adding the [ignore](https://babeljs.io/docs/en/options#ignore) option to Babel.

``` js
use: {
  loader: 'babel-loader',
  options: {
    presets: ['my-custom-babel-preset'],
    ..,
    ..,
    ignore: [ './node_modules/mapbox-gl/dist/mapbox-gl.js' ]
  }
}
```

### Loading and transpiling the Web Worker separately

If your application requires ES5 compatibility, then your module bundler needs to be configured to load and transpile Mapbox GL JS's Web Worker separately. This comes at the cost of significantly increasing the bundle size and negatively impacting rendering performance and you should only do this if you have a strong need for supporting legacy browsers. Mapbox GL JS can be configured with bundler specific `worker-loader` plugins. See [webpack-worker-loader](https://webpack.js.org/loaders/worker-loader/) and [rollup-plugin-worker-loader](https://www.npmjs.com/package/rollup-plugin-web-worker-loader).

- If you are using Webpack, you can configure `worker-loader` to be used inline when importing `mapbox-gl`:

``` js
import mapboxgl from 'mapbox-gl/dist/mapbox-gl-csp';
import MapboxWorker from 'worker-loader!mapbox-gl/dist/mapbox-gl-csp-worker'; // Load worker code separately with worker-loader

mapboxgl.workerClass = MapboxWorker; // Wire up loaded worker to be used instead of the default
const map = new mapboxgl.Map({
  container: 'map', // container ID
  center: [-74.5, 40], // starting position [lng, lat]
  zoom: 9 // starting zoom
});
```

**OR**

- You can also configure `worker-loader` centrally in `webpack.config.js` :

``` js
module.exports = {
  module: {
    rules: [
      {
        test: /\bmapbox-gl-csp-worker.js\b/i,
        use: { loader: 'worker-loader' }
      }
    ]
  }
};
```

and then integrate the Webpack loaded worker with Mapbox GL JS:

``` js
import mapboxgl from 'mapbox-gl/dist/mapbox-gl';
import MapboxWorker from 'mapbox-gl/dist/mapbox-gl-csp-worker';

mapboxgl.workerClass = MapboxWorker;
const map = new mapboxgl.Map({
  container: 'map', // container ID
  center: [-74.5, 40], // starting position [lng, lat]
  zoom: 9 // starting zoom
});
```

To test client support for your applications, see our [Check Mapbox GL JS browser support](/mapbox-gl-js/example/check-for-support/) example.Was this page helpful?

Need help? [Visit the Support Center](https://support.mapbox.com/hc/en-us)Join our [Mapbox Developer Discord](https://discord.gg/sBBksyMjcd)Check out the [Developer Cheatsheet](https://labs.mapbox.com/developer-cheatsheet/)Questions? [Ask Mapbox Docs AI](https://docs.mapbox.com/ask-ai/)
