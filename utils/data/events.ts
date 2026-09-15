export const staticEvents = [
  {
    "id": "11111111-1111-1111-1111-111111111111",
    "slug": "mahalaya",
    "name": "Mahalaya Bhoj",
    "event_date": "2026-10-12",
    "venue": "Community Courtyard",
    "capacity": 120,
    "price": 250,
    "category": "Neighbourhood bhoj",
    "description": "Shared tables, smoke, brass, and a warm autumn gathering built around authentic Bengali food, adda, and ritual warmth.",
    "image_url": "assets/mahalaya-bhoj.webp",
    "status": "OPEN",
    "created_at": "2026-08-23T22:00:00.043761+00:00"
  },
  {
    "id": "22222222-2222-2222-2222-222222222222",
    "slug": "saraswati",
    "name": "Saraswati Puja",
    "event_date": "2027-01-21",
    "venue": "College Campus",
    "capacity": 180,
    "price": 0,
    "category": "Campus celebration",
    "description": "A serene campus procession with fresh yellow flowers, alpona, morning anjali, recitation, music, and student gathering.",
    "image_url": "assets/saraswati-puja.webp",
    "status": "OPEN",
    "created_at": "2026-08-23T22:00:00.043761+00:00"
  }
];

export function getEventBySlug(slug: string) {
  return staticEvents.find(e => e.slug === slug);
}

export function getEventById(id: string) {
  return staticEvents.find(e => e.id === id);
}
