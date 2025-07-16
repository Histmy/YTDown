/**
 * @file Custom "milinalistic" ID3 library. It can remove all tags but insert "TIT2", "TPE1", "TALB" and "APIC" frames only.
 * This implementation really stinks. I was recently trying to make it better, but it would be easier to rewrite it from scratch.
 * I don't recommend using this library for anybody, but for me it works.
 * @author Histmy
 */

const textEncoder = new TextEncoder();

function strToBuffer(string: string) {
  return textEncoder.encode(string);
}

function numberToSyncsafe(number: number) {
  let res = 0;
  let mask = 127;
  for (let i = 0; i < 4; i++) {
    res |= (number & mask) << i;
    mask <<= 7;
  }
  return res
    .toString(16).padStart(8, "0")
    .split(/(?=(?:..)*$)/).map(n => parseInt(n, 16));
}

function makeFrame(name: string, value: string | number[]) {
  //                                   encoding      string      null
  let data = typeof value == "string" ? [3, ...strToBuffer(value), 0] : value;
  //                            frame name              frame length             flags    data
  return new Uint8Array([...strToBuffer(name), ...numberToSyncsafe(data.length), 0, 0, ...data]);
}

function makeImageFrame(mime: string, img: Uint8Array) {
  //       encoding      mime    null imgtype desc image
  const h = [0, ...strToBuffer(mime), 0, 3, 0, ...img];
  return makeFrame("APIC", h);
}

function removeID3(buffer: Uint8Array) {
  const start = buffer.slice(0, 3);
  if (start[0] != 73 || start[1] != 68 || start[2] != 51) return buffer;
  const lenBytes = buffer.slice(6, 10);
  const length = lenBytes[0] << 21 | lenBytes[1] << 14 | lenBytes[2] << 7 | lenBytes[3];
  return buffer.slice(length + 10);
}

export default function addID3(buffer: Uint8Array, title?: string, interpret?: string, album?: string, imgMIME?: string, image?: Uint8Array) {
  let frames: Uint8Array[] = [];
  const pairs = [["TIT2", title], ["TPE1", interpret], ["TALB", album]] as const;

  pairs.forEach(p => {
    if (p[1]) frames.push(makeFrame(p[0], p[1]));
  });
  if (imgMIME && image)
    frames.push(makeImageFrame(imgMIME, image));

  const framesR = frames.reduce<number[]>((arr, frame) => { frame.forEach(num => arr.push(num)); return arr; }, []);

  //                           I   D   3  version flags         tag length
  const id3 = Uint8Array.from([73, 68, 51, 4, 0, 0, ...numberToSyncsafe(framesR.length), ...framesR]);

  return Uint8Array.from([...id3, ...removeID3(buffer)]);
}
