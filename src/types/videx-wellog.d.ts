// @equinor/videx-wellog is mis-packaged: package.json declares
// `"type": "module"` but its `main` points at a CommonJS file
// (dist/index.cjs.js). Bundlers/Node that resolve `main` then treat that CJS
// file as ESM, and its named exports come back undefined at runtime — the
// symptom is `ScaleTrack is not a constructor`. We sidestep this by importing
// the genuine ESM build by path; this declaration maps that path to the
// package's real type definitions so it stays fully typed.
declare module "@equinor/videx-wellog/dist/index.esm.js" {
  export * from "@equinor/videx-wellog";
}
