let bar = Number(localStorage.getItem("barHeight")) || 0;
const requiredSize = 500;
const requiredWidth = 790;
let windowHeight = bar + requiredSize;

browser.pageAction.onClicked.addListener(async tab => {
  const id = /v=([\w\d_-]+)/i.exec(tab.url!)?.[1];
  const win = await browser.windows.create({ url: `res/popup.html?id=${id}`, width: requiredWidth, height: windowHeight, type: "panel" });

  // If RFP is enabled, the window will be created with a different size than requested. Simply resize it again.
  browser.windows.update(win.id!, { width: requiredWidth, height: windowHeight });
});

/*
  Height of the window also includes height of the title bar.
  If for whatever reason the size of the title bar is different,
  we could have either too little or too much space for actuall content.
*/
browser.runtime.onMessage.addListener((mes, sender) => {
  if (mes.height == requiredSize) return;

  bar = windowHeight - mes.height;
  localStorage.setItem("barHeight", bar.toString());
  windowHeight = bar + requiredSize;

  const id = sender.tab?.windowId;
  if (!id) throw new Error("No tab ID provided in message sender");

  browser.windows.update(id, { height: windowHeight });
});
