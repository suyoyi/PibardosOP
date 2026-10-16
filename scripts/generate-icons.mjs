import { mkdirSync } from "node:fs";
import sharp from "sharp";

// Original geometric compass mark, no licensed card or franchise artwork.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="100" fill="#10141c"/><circle cx="256" cy="256" r="132" fill="none" stroke="#f5b66b" stroke-width="12"/><path d="m302 196-30 76-76 44 30-76z" fill="#f5b66b"/><circle cx="256" cy="256" r="12" fill="#10141c"/><path d="M256 104v34M256 374v34M104 256h34M374 256h34" stroke="#f5b66b" stroke-width="12" stroke-linecap="round"/></svg>`;
mkdirSync("public/icons", { recursive: true });
for (const [name, size] of [
  ["icon-192", 192],
  ["icon-512", 512],
  ["maskable-512", 512],
  ["apple-touch-icon", 180],
]) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(`public/icons/${name}.png`);
}
