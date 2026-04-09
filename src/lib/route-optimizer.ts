export interface JobLocation {
  id: number;
  coords: [number, number];
}

// Haversine formula to calculate distance between two points in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function optimizeRoute(startCoords: [number, number], jobs: JobLocation[]): number[] {
  if (jobs.length === 0) return [];

  const unvisited = [...jobs];
  const route: number[] = [];
  let currentCoords = startCoords;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = calculateDistance(
        currentCoords[0], currentCoords[1],
        unvisited[i].coords[0], unvisited[i].coords[1]
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    const nextJob = unvisited[nearestIdx];
    route.push(nextJob.id);
    currentCoords = nextJob.coords;
    unvisited.splice(nearestIdx, 1);
  }

  return route;
}

export function calculateTripMetrics(distanceKm: number) {
  const timeMinutes = Math.round((distanceKm / 18) * 60);
  const costCLP = Math.max(800, Math.round(distanceKm * 700));
  return { timeMinutes, costCLP };
}
