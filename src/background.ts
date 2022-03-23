let winId: number | undefined;
let bar = Number(localStorage.getItem("barHeight")) || 0;
const requiredSize = 500;
let windowHeight = bar + requiredSize;

browser.pageAction.onClicked.addListener(async tab => {
  const id = /v=([\w\d_-]+)/i.exec(tab.url!)?.[1];
  winId = (await browser.windows.create({ url: `res/popup.html?id=${id}`, width: 790, height: windowHeight, type: "panel" })).id;
});

/*
  Height of the window also includes height of the title bar.
  If for whatever reason the size of the title bar is different,
  we could have either too little or too much space for actuall content.
*/
browser.runtime.onMessage.addListener(mes => {
  if (mes.height == requiredSize) return;

  bar = windowHeight - mes.height;
  localStorage.setItem("barHeight", `${bar}`);
  windowHeight = bar + requiredSize;
  browser.windows.update(winId!, { height: windowHeight });
});
