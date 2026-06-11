import { Resvg } from "@resvg/resvg-js";

export function renderPNG(svg: string, fontPath: string): Buffer {
  const r = new Resvg(svg, {
    font: { fontFiles: [fontPath], loadSystemFonts: false, defaultFontFamily: "Space Mono" },
  });
  return Buffer.from(r.render().asPng());
}
