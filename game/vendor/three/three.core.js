// three.js 0.187 splits its module build: three.module.js imports its core
// from ./three.core.js. The minified core is vendored here as
// three.core.min.js, so this file re-exports it under the name the module
// build asks for.
export * from './three.core.min.js';
