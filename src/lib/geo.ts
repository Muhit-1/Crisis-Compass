/**
 * Distance helper for "Near Me" mode. Haversine formula is plenty accurate at
 * the ~1,000 km radius we use for "nearby" — no need for a geo library.
 */
const EARTH_RADIUS_KM = 6371

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

export const NEARBY_RADIUS_KM = 1000

export interface UserLocation {
  lat: number
  lng: number
}

export function getCurrentPosition(): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported by this browser.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Location permission denied. Enable it in your browser settings to use Near Me.'))
        } else if (err.code === err.TIMEOUT) {
          reject(new Error('Location request timed out. Try again.'))
        } else {
          reject(new Error('Could not determine your location.'))
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    )
  })
}

/**
 * Builds a GeoJSON circle polygon (an N-sided approximation) around a center
 * point — used to draw the "Near Me" radius ring on the MapLibre map.
 * Hand-rolled rather than pulling in a turf dependency for one shape.
 */
export function circlePolygon(
  center: UserLocation,
  radiusKm: number,
  steps = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = []
  const centerLatRad = toRad(center.lat)
  const angularDistance = radiusKm / EARTH_RADIUS_KM

  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 2 * Math.PI

    const lat2 = Math.asin(
      Math.sin(centerLatRad) * Math.cos(angularDistance) +
        Math.cos(centerLatRad) * Math.sin(angularDistance) * Math.cos(bearing),
    )
    const lng2 =
      toRad(center.lng) +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(centerLatRad),
        Math.cos(angularDistance) - Math.sin(centerLatRad) * Math.sin(lat2),
      )

    coords.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI])
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coords] },
  }
}