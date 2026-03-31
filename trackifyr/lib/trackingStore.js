let latest = null

export function setTrackingLive(data) {
  latest = data && typeof data === 'object' ? { ...data } : null
}

export function getTrackingLive() {
  return latest
}
