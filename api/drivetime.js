// Real driving times/distances from home base to a batch of destinations,
// via Google's Distance Matrix API. Falls back gracefully client-side if this
// errors (e.g. the API isn't enabled yet on the key) — see fetchDriveTimes in index.html.
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

  try {
    // Distance Matrix caps out around 25 destinations per request; batch it.
    for (let i = 0; i < destList.length; i += 25) {
      const batch = destList.slice(i, i + 25);
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(originLat + ',' + originLng)}&destinations=${encodeURIComponent(batch.join('|'))}&units=imperial&mode=driving&key=${key}`;
      const r = await fetch(url);
      const data = await r.json();
      if (data.status !== 'OK') {
        const detail = data.error_message ? ` — ${data.error_message}` : '';
        res.status(400).json({ error: `${data.status}${detail}` });
        return;
      }
      const elements = (data.rows && data.rows[0] && data.rows[0].elements) || [];
      elements.forEach((el, j) => {
        if (el.status === 'OK') {
          results[i + j] = {
            minutes: Math.round(el.duration.value / 60),
            miles: Math.round((el.distance.value / 1609.34) * 10) / 10
          };
        } else if (el.status && el.status !== 'ZERO_RESULTS') {
          // leave as null but don't fail the whole batch over one bad element
        }
      });
    }
    res.status(200).json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Distance matrix failed: ' + err.message });
  }
};
