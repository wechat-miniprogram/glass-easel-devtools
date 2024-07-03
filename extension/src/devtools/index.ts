import { inFirefox } from "../utils"

chrome.devtools.panels.create(
  'glass-easel',
  '../icons/glass-easel-grey-48.png',
  inFirefox() ? 'panel.html' : 'dist/panel.html',
  (_panel) => {
    // empty
  },
)

// eslint-disable-next-line no-console
console.log('glass-easel DevTools extension DevTools created')
