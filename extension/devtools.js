
console.info('!!! devtools')
chrome.devtools.panels.create("glass-easel",
  "icons/glass-easel-32.png",
  "devtools-panel.html",
  function(panel) {
    // code invoked on panel creation
    console.info('!!! done')
  }
)
