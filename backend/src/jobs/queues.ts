// Queue names live in their own module so processors, producers and the
// Bull registration can all import them without circular imports.
export const RENEWAL_REMINDERS_QUEUE = "renewal-reminders";
export const RATING_RECALC_QUEUE = "rating-recalc";
