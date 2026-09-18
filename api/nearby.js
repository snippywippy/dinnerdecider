function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Places we never want to see in the auto-import results.
// Edit these lists any time — they only affect "Find restaurants", not manual lookups.
const EXCLUDED_TYPES = new Set(['gas_station']);
const EXCLUDED_NAME_KEYWORDS = [
  // fast food
  "mcdonald's", "mcdonalds", "burger king", "wendy's", "wendys", "taco bell", "kfc",
  "kentucky fried chicken", "popeyes", "chick-fil-a", "chick fil a", "sonic drive-in", "sonic",
  "arby's", "arbys", "hardee's", "hardees", "carl's jr", "carls jr", "jack in the box",
  "white castle", "whataburger", "bojangles", "culver's", "culvers", "church's chicken",
  "churchs chicken", "raising cane's", "raising canes", "zaxby's", "zaxbys", "del taco",
  "in-n-out", "checkers", "rally's", "rallys", "long john silver's", "long john silvers",
  "captain d's", "captain ds", "subway",
  // donut shops (chains and the category in general)
  "dunkin", "krispy kreme", "donut", "doughnut",
  // pizza franchises
  "domino's", "dominos", "pizza hut", "papa john's", "papa johns", "little caesars",
  "papa murphy's", "papa murphys", "marco's pizza", "marcos pizza", "jet's pizza",
  "jets pizza", "blaze pizza", "mod pizza", "hungry howie's", "hungry howies", "cicis",
  "round table pizza", "godfather's pizza", "godfathers pizza"
];
function isExcluded(r) {
  const types = r.types || [];
  if (types.some(t => EXCLUDED_TYPES.has(t))) return true;
  const name = (r.name || '').toLowerCase();
  return EXCLUDED_NAME_KEYWORDS.some(k => name.includes(k));
}

module.exports = async function handler(req, res) {
  const { lat, lng, radiusMiles } = req.query;
  if (!lat || !lng) {
    res.status(400).json({ error: 'Missing lat/lng' });
    return;
  }
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'Server is missing GOOGLE_MAPS_API_KEY' });
    return;
  }
  const radiusMeters = Math.round((parseFloat(radiusMiles) || 8) * 1609.34);

  try {
    let allResults = [];
    let pageToken = null;
    let pageCount = 0;

    do {
      let url;
      if (pageToken) {
        url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${pageToken}&key=${key}`;
        await delay(2000); // Google requires a short delay before a page token becomes valid
      } else {
        // opennow=true: only surface places that are open at the moment of searching.
        url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&type=restaurant&opennow=true&key=${key}`;
      }
      const r = await fetch(url);
      const data = await r.json();
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        res.status(400).json({ error: `Search failed (status: ${data.status})` });
        return;
      }
      allResults = allResults.concat(data.results || []);
      pageToken = data.next_page_token || null;
      pageCount++;
    } while (pageToken && allResults.length < 60 && pageCount < 3);

    allResults = allResults.filter(r => !isExcluded(r));

    res.status(200).json({ results: allResults });
  } catch (err) {
    res.status(500).json({ error: 'Nearby search failed: ' + err.message });
  }
};
