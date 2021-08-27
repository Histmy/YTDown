browser.tabs.query({ currentWindow: true, active: true })
  .then(tabs => {
    const url = tabs[0].url;
    const rawTitle = /(?:\(\d+\) )?(.+) - YouTube/.exec(tabs[0].title)[1];
    const title = rawTitle.replace(/[``#%&{}\\<>*?\/ $!'":@+|=]/g, "_");
    browser.windows.create({ url: `popup.html?url=${url}&title=${title}`, width: 760, height: 570 });
  });
