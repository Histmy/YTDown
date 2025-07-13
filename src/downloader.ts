/**
 * Module responsible for downloading and streaming the audio data.
 * It handles the WebSocket connection and manages the download state,
 */

import { config } from "./settings.js";

/**
 * Downloads a video from YouTube by its ID.
 * @param videoId - The ID of the YouTube video to download.
 * @param controller - An AbortController to cancel the download if needed.
 * @param updateProgress - A callback function to update the download progress.
 * @returns A promise that resolves with the title and data of the downloaded video.
 * @throws Throws an error if the download fails or is aborted.
 */
export async function download(videoId: string, controller: AbortController, updateProgress: (progress: number, left: number | undefined) => void): Promise<{ title: string; data: Uint8Array; }> {

  // Start the download
  const res = await fetch(`${config.domain}/stahnout?url=http://youtu.be/${videoId}`, { signal: controller.signal })
    .catch(e => {
      console.error(e);
      throw e;
    });

  if (res.status != 200) {
    const err = await res.text();
    throw new Error(`Stahování se nezdařilo. Důvod: ${err}`);
  }

  let data: Uint8Array;

  const expectedSize = res.headers.get("X-Estimated-Size");

  if (expectedSize) {
    let downloadedSize = 0;
    const totalNumber = parseInt(expectedSize, 10);
    data = new Uint8Array(totalNumber);
    const reader = res.body?.getReader();

    let measuredSize = 0;
    let measuredTime = Date.now();
    let left: number | undefined = undefined;

    while (reader) {
      const { done, value } = await reader.read();

      if (done) {
        console.log("Staženo, velikost:", downloadedSize, "očekávaná velikost:", totalNumber);
        updateProgress(100, 0);
        data = data.slice(0, downloadedSize);
        break;
      }

      // Resize if estimated size was too small
      if (downloadedSize + value.length > data.length) {
        const newData = new Uint8Array(downloadedSize + 4096); // reasonable buffer size since the estimate is almost correct

        newData.set(data);
        data = newData;
      }

      data.set(value, downloadedSize);

      downloadedSize += value.length;
      const percent = Math.round((downloadedSize / totalNumber) * 100);

      const now = Date.now();
      if (now - measuredTime > 1000) {
        const elapsed = now - measuredTime;
        const speed = (downloadedSize - measuredSize) / (elapsed / 1000); // bytes per second
        left = Math.round((totalNumber - downloadedSize) / speed); // seconds left

        measuredSize = downloadedSize;
        measuredTime = now;
      }

      updateProgress(percent, left);
    }
  } else {
    data = new Uint8Array(await res.arrayBuffer());
  }

  const titleFromHeader = res.headers.get("Content-Disposition")?.match(/filename\*=utf-8''(.+)\.mp3/i)?.[1].replace(/[\/\\?<>:*|"]/g, "_");

  const title = titleFromHeader ? decodeURIComponent(titleFromHeader) : "Bez_názvu";

  console.log(title);

  return {
    title,
    data
  };
}
