// WubSync is E & B's only booking system. Every booking CTA points here and opens
// in the same tab. A specific service opens on WubSync's own service route
// (/book/eandb/service/<slug>), which starts the booking with that service; there
// is no query-string preselection, so never append one.
export const BOOKING_URL = "https://booking.eandbhair.co.uk/book/eandb";

export function serviceBookingUrl(slug?: string) {
  return slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? `${BOOKING_URL}/service/${slug}` : BOOKING_URL;
}

// WubSync's own "manage my booking" page (reference + mobile lookup).
export const MANAGE_BOOKING_URL = "https://booking.eandbhair.co.uk/book/lookup";
