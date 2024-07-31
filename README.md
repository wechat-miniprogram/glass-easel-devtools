<p align="center">
  <img src="https://github.com/wechat-miniprogram/glass-easel/blob/master/logo_256.png" style="width: 128px" />
</p>

# glass-easel DevTools

DevTools for debugging glass-easel applications.

An important usage is to run as Chrome/Firefox DevTools extension. Install the extension in the browser, and it will add a `glass-easel` panel in the browser DevTools (F12).

However, it can also be integrated into other JS environments.

*Still in early development.*


## Development Guide

After git clone, run `pnpm install` to do basic setup.

### The Core Modules

The core modules are `glass-easel-devtools-agent` and `glass-easel-devtools-panel` , i.e. an agent and a panel.

The agent is an information extractor that should work along with glass-easel. The glass-easel dist should be built in development mode (i.e. `glass_easel.dev.all.es.js` ) and the agent can extract neccessary information from the glass-easel node tree.

The panel is the front end to display the information extracted by the agent. It can work in an independent environment, as long as it can communicate with the panel through a "message channel".

To build these two modules:

1. run `npm run build` in `glass-easel-devtools-agent` directory;
1. run `npm run build` in `glass-easel-devtools-panel` directory.

While development, run `npm run dev` instead (more debug logs and webpack will watch changes).

These two modules are also available as npm public packages.

### The Extension

The extension `glass-easel-devtools-extension` is a wrapper for both the agent and the panel. It acts as an Chrome/Firefox extension.

1. Run `npm run build` in `glass-easel-devtools-extension` directory to build the extension.
1. Then the directory can be loaded as an browser extension.
  * In Chrome, open `chrome://extensions/` and load this extracted extension.
  * In Firefox, open `about:debugging#/runtime/this-firefox` and temporarily load this extension.

This extension appears in DevTools (F12) in every web pages.

While development, run `npm run dev` instead.

### The Standalone Usage

The agent and the panel can also be loaded as common JS modules. The `examples/standalone` is an example that shows how to use them.

1. Run `npm run build` in `examples/miniprogram` directory to build a glass-easel application for debugging.
1. Run `npm run build` in `examples/standalone` directory.
1. Open the `examples/standalone/index.html` (may need a web server to host the directory).

While development, run `npm run dev` instead.

When developing the agent and the panel, the standalone environment is more convinient.
