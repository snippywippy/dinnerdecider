// Real driving times/distances from home base to a batch of destinations,
// via Google's Routes API (computeRouteMatrix) — the current replacement for the
// legacy Distance Matrix API, which Google no longer enables for new projects.
// Falls back gracefully client-side if this errors — see fetchDriveTimes in index.html.
module.exports = async function handler(req, res) {
  const { originLat, originLng, destinations } = req.query;
  if (!originLat || !originLng || !destinations) {
    res.status(400).json({ error: 'Missing originLat/originLng/destinations' });
    return;
  }
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'Server is missing GOOGLE_MAPS_API_KEY' });
    return;
  }

  const destList = destinations.split(';').filter(Boolean);
  const results = new Array(destList.length).fill(null);
  const originPoint = {
    waypoint: { location: { latLng: { latitude: parseFloat(originLat), longitude: parseFloat(originLng) } } }
  };

  try {
    // Route matrix caps out around 25 destinations per request (with 1 origin); batch it.
    for (let i = 0; i < destList.length; i += 25) {
      const batch = destList.slice(i, i + 25);
      const body = {
        origins: [originPoint],
        destinations: batch.map(d => {
          const [lat, lng] = d.split(',').map(Number);
          return { waypoint: { location: { latLng: { latitude: lat, longitude: lng } } } };
        }),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE'
      };
      const r = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,condition,status'
        },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      if (!r.ok) {
        const msg = (data && data.error && data.error.message) || `HTTP ${r.status}`;
        res.status(400).json({ error: msg });
        return;
      }
      (Array.isArray(data) ? data : []).forEach(el => {
        const di = el.destinationIndex || 0;
        if (el.condition === 'ROUTE_EXISTS' && el.duration && typeof el.distanceMeters === 'number') {
          const seconds = parseInt(String(el.duration).replace('s', ''), 10);
          results[i + di] = {
            minutes: Math.round(seconds / 60),
            miles: Math.round((el.distanceMeters / 1609.34) * 10) / 10
          };
        }
      });
    }
    res.status(200).json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Route matrix failed: ' + err.message });
  }
};
