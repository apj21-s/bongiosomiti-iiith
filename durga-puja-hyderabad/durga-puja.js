/*
  DURGA PUJA DATA
  ----------------
  Replace the array below with the 65 locations from the source map.

  Each item should have:
    name: "Puja / organiser name",
    locality: "Locality, Hyderabad",
    region: "west" | "central" | "north" | "east",
    lat: 17.000000,
    lng: 78.000000,
    directions: "https://www.google.com/maps/dir/?api=1&destination=LAT,LNG"

  Do not invent coordinates. Paste the actual coordinates from the source map.
*/
const pujas = [];

const HYDERABAD = [17.3850, 78.4867];
const map = L.map('map', { zoomControl: false, scrollWheelZoom: true }).setView(HYDERABAD, 10.8);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);

L.control.zoom({ position: 'bottomright' }).addTo(map);

const markers = new Map();
const cardsEl = document.getElementById('cards');
const emptyEl = document.getElementById('empty');
const searchEl = document.getElementById('search');
const countHero = document.getElementById('countHero');
const countList = document.getElementById('countList');
let activeRegion = 'all';

function markerIcon() {
  return L.divIcon({
    className: '',
    html: '<div class="puja-marker">✦</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -15]
  });
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function directionsFor(puja) {
  if (puja.directions) return puja.directions;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${puja.lat},${puja.lng}`)}`;
}

function popupHTML(puja) {
  return `<div class="popup">
    <small>DURGA PUJA · 2026</small>
    <h3>${escapeHTML(puja.name)}</h3>
    <p>${escapeHTML(puja.locality || 'Hyderabad')}</p>
    <a href="${directionsFor(puja)}" target="_blank" rel="noopener">GET DIRECTIONS ↗</a>
  </div>`;
}

function renderMarkers() {
  markers.forEach(marker => map.removeLayer(marker));
  markers.clear();
  pujas.forEach((puja, index) => {
    if (typeof puja.lat !== 'number' || typeof puja.lng !== 'number') return;
    const marker = L.marker([puja.lat, puja.lng], { icon: markerIcon() })
      .bindPopup(popupHTML(puja));
    marker.addTo(map);
    marker.on('click', () => selectCard(index));
    markers.set(index, marker);
  });
}

function filteredPujas() {
  const q = searchEl.value.trim().toLowerCase();
  return pujas.map((p, i) => ({ ...p, __index:i })).filter(p => {
    const regionOK = activeRegion === 'all' || p.region === activeRegion;
    const text = `${p.name} ${p.locality}`.toLowerCase();
    return regionOK && (!q || text.includes(q));
  });
}

function renderCards() {
  const list = filteredPujas();
  cardsEl.innerHTML = '';
  countList.textContent = list.length;
  countHero.textContent = pujas.length;
  emptyEl.classList.toggle('hidden', list.length !== 0);

  list.forEach((puja, displayIndex) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.index = puja.__index;
    card.innerHTML = `
      <div class="card-top">
        <div>
          <h3>${escapeHTML(puja.name)}</h3>
          <p>${escapeHTML(puja.locality || 'Hyderabad')}</p>
        </div>
        <span class="card-number">${String(displayIndex + 1).padStart(2,'0')}</span>
      </div>
      <span class="card-tag">VIEW ON MAP ↗</span>
    `;
    card.addEventListener('click', () => selectCard(puja.__index));
    cardsEl.appendChild(card);
  });
}

function selectCard(index) {
  const marker = markers.get(index);
  if (marker) {
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 13), { animate:true });
    marker.openPopup();
  }
  document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
  const card = document.querySelector(`.card[data-index="${index}"]`);
  if (card) {
    card.classList.add('selected');
    card.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }
}

document.getElementById('filters').addEventListener('click', e => {
  const btn = e.target.closest('.filter');
  if (!btn) return;
  activeRegion = btn.dataset.region;
  document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCards();
});

searchEl.addEventListener('input', renderCards);
document.getElementById('reset').addEventListener('click', () => {
  searchEl.value = '';
  activeRegion = 'all';
  document.querySelectorAll('.filter').forEach(b => b.classList.toggle('active', b.dataset.region === 'all'));
  map.setView(HYDERABAD, 10.8);
  renderCards();
});

renderMarkers();
renderCards();
