/**
 * Module responsible for downloading and streaming the audio data.
 * It handles the WebSocket connection and manages the download state,
 */

import { config } from "./settings.js";

/**
 * Downloads a video from YouTube by its ID.
 * @param {string} videoId - The ID of the YouTube video to download.
 * @param {AbortController} controller - An AbortController to cancel the download if needed.
 * @returns A promise that resolves with the title and data of the downloaded video.
 * @throws Throws an error if the download fails or is aborted.
 */
export async function download(videoId: string, controller: AbortController): Promise<{ title: string; data: Uint8Array; }> {

  // Start the download
  const res = await fetch(`${config.domain}/stahnout?url=http://youtu.be/${videoId}`, { signal: controller.signal })
    .catch(e => {
      console.error(e);
      throw new Error("Při stahování souboru došlo k chybě.");
    });

  if (res.status != 200) {
    const err = await res.text();
    throw new Error(`Stahování se nezdařilo. Důvod: ${err}`);
  }

  /*const totalSize = res.headers.get("Content-Length");
  if (totalSize) {
    const totalNumber = parseInt(totalSize, 10);
    result = new Uint8Array(totalNumber);
    const reader = res.body?.getReader();

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;

      result.set(value, downloadedSize);

      downloadedSize += value.length;
      const percent = Math.round((downloadedSize / totalNumber) * 100);
      updateProgress(percent);
    }
  }*/

  const title = res.headers.get("Content-Disposition")?.match(/=(.+)\.mp3/)?.[1].replace(/[\/\\?<>:*|"]/g, "_") || "Bez_názvu";
  console.log(title);

  return {
    title,
    data: new Uint8Array(await res.arrayBuffer())
  };
}
