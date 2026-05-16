import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const outDir = path.resolve(process.cwd(), "src/assets/gamification/passport");
mkdirSync(outDir, { recursive: true });

function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0xffffffff;
  };
}

function makeCanvas(width, height, transparent = true) {
  const image = new PNG({ width, height });
  if (!transparent) fillRect(image, 0, 0, width, height, [255, 255, 255, 255]);
  return image;
}

function save(image, name) {
  writeFileSync(path.join(outDir, name), PNG.sync.write(image));
}

function blendPixel(image, x, y, color) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const idx = (image.width * y + x) << 2;
  const alpha = color[3] / 255;
  const inverse = 1 - alpha;
  const r = Math.max(0, Math.min(255, color[0]));
  const g = Math.max(0, Math.min(255, color[1]));
  const b = Math.max(0, Math.min(255, color[2]));
  image.data[idx] = Math.round(r * alpha + image.data[idx] * inverse);
  image.data[idx + 1] = Math.round(g * alpha + image.data[idx + 1] * inverse);
  image.data[idx + 2] = Math.round(b * alpha + image.data[idx + 2] * inverse);
  image.data[idx + 3] = Math.min(255, Math.round(color[3] + image.data[idx + 3] * inverse));
}

function fillRect(image, x, y, width, height, color) {
  for (let py = Math.floor(y); py < y + height; py += 1) {
    for (let px = Math.floor(x); px < x + width; px += 1) blendPixel(image, px, py, color);
  }
}

function fillRoundedRect(image, x, y, width, height, radius, color) {
  for (let py = Math.floor(y); py < y + height; py += 1) {
    for (let px = Math.floor(x); px < x + width; px += 1) {
      const cx = px < x + radius ? x + radius : px > x + width - radius ? x + width - radius : px;
      const cy = py < y + radius ? y + radius : py > y + height - radius ? y + height - radius : py;
      if ((px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2 + 0.75) blendPixel(image, px, py, color);
    }
  }
}

function strokeRoundedRect(image, x, y, width, height, radius, thickness, color) {
  fillRoundedRect(image, x, y, width, height, radius, color);
  fillRoundedRect(
    image,
    x + thickness,
    y + thickness,
    width - thickness * 2,
    height - thickness * 2,
    Math.max(0, radius - thickness),
    [0, 0, 0, 0],
  );
  for (let py = Math.floor(y + thickness); py < y + height - thickness; py += 1) {
    for (let px = Math.floor(x + thickness); px < x + width - thickness; px += 1) {
      const idx = (image.width * py + px) << 2;
      if (image.data[idx + 3] > 0) {
        image.data[idx] = 0;
        image.data[idx + 1] = 0;
        image.data[idx + 2] = 0;
        image.data[idx + 3] = 0;
      }
    }
  }
}

function line(image, x1, y1, x2, y2, color, width = 3) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    fillCircle(image, x, y, width / 2, color);
  }
}

function fillCircle(image, cx, cy, radius, color) {
  for (let y = Math.floor(cy - radius); y <= cy + radius; y += 1) {
    for (let x = Math.floor(cx - radius); x <= cx + radius; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) blendPixel(image, x, y, color);
    }
  }
}

function strokeEllipse(image, cx, cy, rx, ry, thickness, color) {
  for (let y = Math.floor(cy - ry - thickness); y <= cy + ry + thickness; y += 1) {
    for (let x = Math.floor(cx - rx - thickness); x <= cx + rx + thickness; x += 1) {
      const d = ((x - cx) ** 2) / (rx ** 2) + ((y - cy) ** 2) / (ry ** 2);
      if (d >= 1 - thickness / Math.max(rx, ry) && d <= 1 + thickness / Math.max(rx, ry)) {
        blendPixel(image, x, y, color);
      }
    }
  }
}

function fillEllipse(image, cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
      if (((x - cx) ** 2) / (rx ** 2) + ((y - cy) ** 2) / (ry ** 2) <= 1) {
        blendPixel(image, x, y, color);
      }
    }
  }
}

function polygon(image, points, color) {
  const minY = Math.floor(Math.min(...points.map((p) => p[1])));
  const maxY = Math.ceil(Math.max(...points.map((p) => p[1])));
  for (let y = minY; y <= maxY; y += 1) {
    const nodes = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if ((yi < y && yj >= y) || (yj < y && yi >= y)) {
        nodes.push(xi + ((y - yi) / (yj - yi)) * (xj - xi));
      }
    }
    nodes.sort((a, b) => a - b);
    for (let k = 0; k < nodes.length; k += 2) {
      for (let x = Math.floor(nodes[k]); x < nodes[k + 1]; x += 1) blendPixel(image, x, y, color);
    }
  }
}

function gradient(image, top, bottom, noiseSeed = 1) {
  const random = rng(noiseSeed);
  for (let y = 0; y < image.height; y += 1) {
    const t = y / Math.max(1, image.height - 1);
    for (let x = 0; x < image.width; x += 1) {
      const n = (random() - 0.5) * 8;
      blendPixel(image, x, y, [
        top[0] * (1 - t) + bottom[0] * t + n,
        top[1] * (1 - t) + bottom[1] * t + n,
        top[2] * (1 - t) + bottom[2] * t + n,
        255,
      ]);
    }
  }
}

function distress(image, seed, strength = 0.18) {
  const random = rng(seed);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const idx = (image.width * y + x) << 2;
      if (image.data[idx + 3] > 25 && random() < strength) {
        image.data[idx + 3] = Math.max(0, image.data[idx + 3] - 80 - random() * 120);
      }
    }
  }
}

function microBars(image, x, y, color) {
  for (let i = 0; i < 5; i += 1) {
    fillRoundedRect(image, x, y + i * 15, 86 - i * 8, 5, 2, color);
  }
}

function passportCover() {
  const image = makeCanvas(1000, 640, false);
  gradient(image, [244, 84, 24], [216, 52, 18], 11);
  fillRoundedRect(image, 22, 22, 956, 596, 48, [120, 24, 14, 95]);
  fillRoundedRect(image, 32, 32, 936, 576, 40, [239, 78, 22, 255]);
  fillRect(image, 76, 76, 10, 488, [118, 22, 12, 175]);
  fillRect(image, 104, 78, 5, 486, [255, 205, 120, 45]);
  strokeEllipse(image, 500, 310, 152, 152, 5, [255, 182, 79, 50]);
  strokeEllipse(image, 500, 310, 112, 112, 4, [125, 26, 12, 54]);
  for (let i = 0; i < 24; i += 1) {
    const a = (Math.PI * 2 * i) / 24;
    line(image, 500, 310, 500 + Math.cos(a) * 150, 310 + Math.sin(a) * 150, [255, 176, 88, 28], 2);
  }
  strokeEllipse(image, 725, 282, 86, 86, 5, [255, 226, 155, 88]);
  strokeEllipse(image, 725, 282, 48, 48, 4, [255, 226, 155, 85]);
  polygon(image, [[725, 196], [748, 260], [820, 260], [762, 300], [786, 368], [725, 326], [664, 368], [688, 300], [630, 260], [702, 260]], [255, 221, 143, 80]);
  for (let i = 0; i < 7; i += 1) {
    line(image, 188 + i * 7, 120, 188 + i * 7, 248, [255, 220, 150, 22], 2);
    line(image, 650, 420 + i * 16, 890 - i * 28, 420 + i * 16, [255, 238, 190, 110], 7);
  }
  return image;
}

function paperSpread() {
  const image = makeCanvas(1000, 640, false);
  gradient(image, [255, 249, 237], [244, 232, 211], 17);
  fillRect(image, 491, 0, 18, 640, [120, 82, 42, 26]);
  fillRect(image, 504, 0, 8, 640, [255, 255, 255, 40]);
  for (let i = 0; i < 18; i += 1) {
    const y = 42 + i * 32;
    line(image, 64, y, 436, y + Math.sin(i) * 20, [220, 138, 82, 20], 2);
    line(image, 564, y + 10, 936, y + Math.cos(i) * 20, [33, 66, 94, 17], 2);
  }
  strokeEllipse(image, 250, 318, 136, 86, 3, [231, 91, 38, 26]);
  strokeEllipse(image, 742, 318, 136, 86, 3, [22, 54, 83, 24]);
  for (let i = 0; i < 8; i += 1) {
    fillRoundedRect(image, 84 + i * 42, 532, 24, 6, 3, [31, 54, 78, 25]);
    fillRoundedRect(image, 584 + i * 42, 532, 24, 6, 3, [231, 91, 38, 22]);
  }
  return image;
}

function stamp(name, ink, mode) {
  const image = makeCanvas(640, 400, true);
  const shadow = [20, 15, 10, 22];
  if (mode === "oval") {
    strokeEllipse(image, 320, 200, 242, 132, 16, shadow);
    strokeEllipse(image, 320, 200, 232, 122, 14, ink);
    strokeEllipse(image, 320, 200, 178, 82, 7, ink);
  } else if (mode === "circle") {
    strokeEllipse(image, 320, 200, 152, 152, 15, shadow);
    strokeEllipse(image, 320, 200, 148, 148, 13, ink);
    strokeEllipse(image, 320, 200, 104, 104, 6, ink);
  } else {
    strokeRoundedRect(image, 74, 72, 492, 256, 26, 13, shadow);
    strokeRoundedRect(image, 66, 64, 492, 256, 24, 11, ink);
    strokeRoundedRect(image, 108, 108, 408, 168, 18, 5, ink);
  }
  microBars(image, 118, 118, ink);
  microBars(image, 430, 236, ink);
  if (name.includes("hawker")) {
    polygon(image, [[242, 203], [320, 146], [398, 203]], ink);
    fillRoundedRect(image, 256, 204, 128, 68, 8, ink);
    for (let i = 0; i < 4; i += 1) line(image, 270 + i * 30, 206, 270 + i * 30, 270, [255, 255, 255, 90], 4);
  } else if (name.includes("laksa")) {
    strokeEllipse(image, 320, 218, 86, 42, 10, ink);
    line(image, 246, 200, 386, 168, ink, 7);
    strokeEllipse(image, 320, 206, 54, 26, 5, ink);
    fillCircle(image, 356, 185, 14, ink);
  } else if (name.includes("chinatown")) {
    for (let i = 0; i < 4; i += 1) {
      polygon(image, [[230 + i * 46, 190], [252 + i * 46, 166], [274 + i * 46, 190]], ink);
      fillRoundedRect(image, 236 + i * 46, 190, 34, 64, 4, ink);
    }
  } else {
    strokeEllipse(image, 320, 202, 62, 62, 8, ink);
    fillCircle(image, 342, 180, 20, [255, 255, 255, 150]);
    line(image, 266, 256, 374, 256, ink, 8);
    line(image, 290, 132, 290, 264, ink, 5);
    line(image, 350, 132, 350, 264, ink, 5);
  }
  distress(image, name.length * 997, 0.16);
  save(image, name);
}

function badge(name, fill, rim, motif) {
  const image = makeCanvas(480, 480, true);
  fillCircle(image, 244, 250, 184, [0, 0, 0, 32]);
  fillCircle(image, 240, 236, 176, rim);
  fillCircle(image, 240, 236, 144, fill);
  strokeEllipse(image, 240, 236, 118, 118, 8, [255, 255, 255, 110]);
  for (let i = 0; i < 18; i += 1) {
    const a = (Math.PI * 2 * i) / 18;
    line(image, 240 + Math.cos(a) * 130, 236 + Math.sin(a) * 130, 240 + Math.cos(a) * 154, 236 + Math.sin(a) * 154, [255, 238, 188, 150], 4);
  }
  if (motif === "hawker") {
    polygon(image, [[154, 220], [240, 150], [326, 220]], [255, 245, 212, 230]);
    fillRoundedRect(image, 176, 224, 128, 66, 12, [255, 245, 212, 230]);
  } else if (motif === "bowl") {
    strokeEllipse(image, 240, 258, 82, 42, 13, [255, 245, 212, 230]);
    line(image, 160, 212, 322, 178, [255, 245, 212, 230], 8);
    fillCircle(image, 294, 200, 18, [255, 245, 212, 230]);
  } else if (motif === "moon") {
    fillCircle(image, 236, 204, 54, [255, 245, 212, 230]);
    fillCircle(image, 262, 190, 54, fill);
    for (let i = 0; i < 5; i += 1) fillCircle(image, 188 + i * 26, 300 + (i % 2) * 10, 8, [255, 245, 212, 230]);
  } else {
    strokeEllipse(image, 240, 224, 72, 72, 12, [255, 245, 212, 230]);
    line(image, 184, 292, 296, 292, [255, 245, 212, 230], 10);
    line(image, 212, 158, 212, 296, [255, 245, 212, 230], 6);
    line(image, 268, 158, 268, 296, [255, 245, 212, 230], 6);
  }
  distress(image, name.length * 1447, 0.08);
  save(image, name);
}

save(passportCover(), "passport-cover-orange.png");
save(paperSpread(), "passport-paper-spread.png");
stamp("stamp-cuisine-hawker.png", [228, 73, 26, 210], "rect");
stamp("stamp-classic-laksa.png", [197, 42, 22, 205], "oval");
stamp("stamp-hood-chinatown.png", [20, 58, 92, 212], "rect");
stamp("stamp-dietary-halal.png", [14, 146, 137, 200], "circle");
badge("badge-hawker-explorer.png", [230, 82, 30, 235], [28, 55, 83, 245], "hawker");
badge("badge-classics-trail.png", [246, 159, 45, 235], [221, 97, 28, 245], "bowl");
badge("badge-night-makan.png", [29, 54, 82, 240], [243, 174, 70, 245], "moon");
badge("badge-contributor.png", [17, 147, 139, 235], [28, 55, 83, 245], "contributor");
