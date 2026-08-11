# glass-easel DevTools for Browsers

This is the DevTools panel implementation of glass-easel-devtools for Chrome/Firefox DevTools.

See [glass-easel-devtools](https://github.com/wechat-miniprogram/glass-easel-devtools) for details.

## How to Build

[nodejs](https://nodejs.org/en) and [pnpm](https://pnpm.io/) should be globally installed.

In the project root directory (glass-easel-devtools):

1. run `pnpm install` to install dependencies;
2. run `npm run pack-extension` to build.

The final product can be found in `extension/pkg` directory.

## Publish

The extension packages should be publish manually (the `publish-version.js` does not do this).

Modify the version in [Chrome Manifest](./chrome.manifest.json) and [Firefox Manifest](./firefox.manifest.json), then run `npm run pack-extension` in the project root.

* For Chrome extension, go to [this page](https://chrome.google.com/webstore/devconsole), find the published extension, and upload the new `pkg/glass-easel-devtools-chrome.zip`.
* For Firefox extension, go to [this page](https://addons.mozilla.org/developers/addons), find the published extension, and upload the new `pkg/glass-easel-devtools-chrome.zip`.
