const LAT_CELL_DEGREES = 0.0045;

function getLngCellDegrees(latitude: number) {
  const latitudeRadians = (latitude * Math.PI) / 180;
  const cosFactor = Math.max(Math.cos(latitudeRadians), 0.2);
  return LAT_CELL_DEGREES / cosFactor;
}

export function toRecommendationGeoCell(latitude: number, longitude: number) {
  const latBucket = Math.floor(latitude / LAT_CELL_DEGREES);
  const lngBucket = Math.floor(longitude / getLngCellDegrees(latitude));
  return `${latBucket}:${lngBucket}`;
}
