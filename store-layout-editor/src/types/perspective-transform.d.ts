declare module "perspective-transform" {
  interface PerspectiveTransformer {
    transform(x: number, y: number): [number, number];
    transformInverse(x: number, y: number): [number, number];
  }

  function PerspT(
    sourceCorners: number[],
    destinationCorners: number[],
  ): PerspectiveTransformer;

  export default PerspT;
}
