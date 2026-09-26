# Durga Puja Hyderabad 2026

A standalone aesthetic directory/map page designed to fit the Bangiya Samiti IIITH visual language.

## Important
The shared Google Maps short link could not be programmatically opened in this environment, so no puja names or coordinates have been invented. The page is intentionally data-driven.

Populate `pujas` in `durga-puja.js` with the 65 verified locations from the source map.

Example:
```js
{
  name: "Example Puja",
  locality: "Madhapur, Hyderabad",
  region: "west",
  lat: 17.4483,
  lng: 78.3915,
  directions: "https://www.google.com/maps/dir/?api=1&destination=17.4483,78.3915"
}
```

The page already includes:
- responsive editorial hero
- Hyderabad map
- custom puja markers
- search
- region filters
- directory cards
- marker/card interaction
- Google Maps directions links
- link to the original source map
- mobile layout
