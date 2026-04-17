import PerspT from "perspective-transform";
import type { Point } from "../../types/layout";
import { orderCalibrationCorners } from "./calibration";

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function bilinearSample(
  imageData: ImageData,
  x: number,
  y: number,
): [number, number, number, number] {
  const { width, height, data } = imageData;

  if (x < 0 || y < 0 || x >= width - 1 || y >= height - 1) {
    return [0, 0, 0, 0];
  }

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);

  const dx = x - x0;
  const dy = y - y0;

  const index = (px: number, py: number) => (py * width + px) * 4;
  const c00 = index(x0, y0);
  const c10 = index(x1, y0);
  const c01 = index(x0, y1);
  const c11 = index(x1, y1);

  const channel = (offset: number) => {
    const v00 = data[c00 + offset];
    const v10 = data[c10 + offset];
    const v01 = data[c01 + offset];
    const v11 = data[c11 + offset];
    return (
      v00 * (1 - dx) * (1 - dy) +
      v10 * dx * (1 - dy) +
      v01 * (1 - dx) * dy +
      v11 * dx * dy
    );
  };

  return [channel(0), channel(1), channel(2), channel(3)] as [
    number,
    number,
    number,
    number,
  ];
}

async function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image for calibration."));
    image.src = source;
  });
}

export async function rectifyPerspective(
  imageSource: string,
  points: Point[],
): Promise<{ src: string; width: number; height: number }> {
  const ordered = orderCalibrationCorners(points);
  if (ordered.length !== 4) {
    throw new Error("Calibration requires exactly four points.");
  }

  const [topLeft, topRight, bottomRight, bottomLeft] = ordered;
  const image = await loadImage(imageSource);

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = image.naturalWidth;
  sourceCanvas.height = image.naturalHeight;
  const sourceContext = sourceCanvas.getContext("2d");
  if (!sourceContext) {
    throw new Error("Unable to initialize source canvas context.");
  }
  sourceContext.drawImage(image, 0, 0);
  const sourceData = sourceContext.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height,
  );

  const width = Math.max(
    1,
    Math.round(
      Math.max(distance(topLeft, topRight), distance(bottomLeft, bottomRight)),
    ),
  );
  const height = Math.max(
    1,
    Math.round(
      Math.max(distance(topLeft, bottomLeft), distance(topRight, bottomRight)),
    ),
  );

  const destinationCanvas = document.createElement("canvas");
  destinationCanvas.width = width;
  destinationCanvas.height = height;
  const destinationContext = destinationCanvas.getContext("2d");
  if (!destinationContext) {
    throw new Error("Unable to initialize destination canvas context.");
  }

  const destinationData = destinationContext.createImageData(width, height);

  const sourceCorners = [
    topLeft.x,
    topLeft.y,
    topRight.x,
    topRight.y,
    bottomRight.x,
    bottomRight.y,
    bottomLeft.x,
    bottomLeft.y,
  ];
  const destinationCorners = [0, 0, width, 0, width, height, 0, height];
  const transform = PerspT(sourceCorners, destinationCorners);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [sx, sy] = transform.transformInverse(x, y);
      const [r, g, b, a] = bilinearSample(sourceData, sx, sy);
      const targetIndex = (y * width + x) * 4;
      destinationData.data[targetIndex] = r;
      destinationData.data[targetIndex + 1] = g;
      destinationData.data[targetIndex + 2] = b;
      destinationData.data[targetIndex + 3] = a;
    }
  }

  destinationContext.putImageData(destinationData, 0, 0);

  return {
    src: destinationCanvas.toDataURL("image/png"),
    width,
    height,
  };
}
