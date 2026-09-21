/* ============================================================
   THE POSTPARTUM SUITE, the booking flow

   A port of the live booking app (C:\dev\postpartum-booking) into this
   prototype. That app is Next.js and React; this is one script on a static
   page. The steps, the order, the wording, the validation ladder, the
   scroll choreography and the two dialogs are all the same, because the
   point of the port is to see that flow on this site, not to redesign it.

   WHAT IS NOT HERE, DELIBERATELY

   The booking. SimplyBook is the third party being connected, and it is
   going to own making the appointment and taking the money. So nothing in
   this file writes an appointment, and there is no card form. Step five of
   the real app — Stripe Elements — does not exist here: the terms dialog
   is the last thing before the confirmation, and the confirmation says
   plainly on the screen that nothing was booked and nothing was charged.

   The reference on that screen is generated locally and means nothing.

   WHAT IS REAL

   The postcode check. postcodes.io is ONS and Ordnance Survey open data,
   free and keyless, so the browser can ask it directly. The answer is
   ray-cast against the M25 ring in booking-m25.js exactly as the server
   does it, which means the Service Area Notice fires on a genuine verdict
   about a genuine postcode rather than on a list of test cases.

   Availability. The real app asks SimplyBook which slots are free. Nothing
   here can, so the practice's own rules — the ones that live in the app's
   schedule.ts rather than in SimplyBook — generate the calendar instead:
   the booking window, no Sundays, 48 hours' notice, no start after 18:00,
   and the two-hour gap after every appointment. On top of that a
   deterministic mask stands in for the appointments already in the diary,
   seeded from the date and the treatment so the same day always shows the
   same times rather than reshuffling on every render.
   ============================================================ */

/* ============================================================
   THE CATALOGUE

   SimplyBook is the catalogue of record in the real app and this is a
   transcription of what it currently holds, read off the live booking
   page. Ids are SimplyBook's own, so this reads against the app's
   treatments.ts without translation.

   The photographs are this repository's own. The app serves SimplyBook's
   600x600 PNGs from an origin that throttles; these are the same four
   treatments already shot for the accordion on v1.html.
   ============================================================ */

const SERVICES = [
  {
    id: 2,
    name: "Postpartum massage",
    duration: 60,
    price: 120,
    currency: "GBP",
    imageUrl: "assets/img/tb-postpartum.webp",
    description:
      "A full body massage working through the back, shoulders and hips, with warm oils used throughout. Eases the tension that builds from feeding and carrying, and supports your body's recovery after birth.",
  },
  {
    id: 5,
    name: "Traditional massage",
    duration: 60,
    price: 120,
    currency: "GBP",
    imageUrl: "assets/img/tb-traditional.webp",
    description:
      "A classic full body massage using warm oils. Available to everyone, whether or not you've recently had a baby.",
  },
  {
    id: 3,
    name: "Postpartum massage with traditional hot stone",
    duration: 90,
    price: 150,
    currency: "GBP",
    imageUrl: "assets/img/tb-hotstone.webp",
    description:
      "Our full postpartum massage combined with traditional hot stone therapy. Heated stones are worked along the entire body, releasing the tension held through the neck, shoulders and back.",
  },
  {
    id: 4,
    name: "Postpartum massage with traditional hot stone and belly binding",
    duration: 120,
    price: 180,
    currency: "GBP",
    imageUrl: "assets/img/tb-bellybinding.webp",
    description:
      "The complete recovery treatment. Our full postpartum massage and hot stone therapy, finished with traditional cloth belly binding wrapped to support the abdomen and lower back.",
  },
];

const ADDONS = [
  {
    id: 1,
    name: "Full body scrub for exfoliation",
    description:
      "A gentle full body scrub to exfoliate and refresh the skin, the perfect add-on to any treatment.",
    price: 40,
    currency: "GBP",
    duration: 30,
    serviceIds: [2, 5, 3, 4],
    imageUrl: "assets/img/scrub.webp",
  },
];

/* The one intake question the account asks, the same for all four
   treatments. The app matches the address field on its label rather than
   its id, because the id is a hash that changes if the question is deleted
   and remade in SimplyBook while the wording survives being edited. */
const INTAKE_FIELDS = [
  {
    key: "location",
    label: "Treatment location",
    type: "textarea",
    required: true,
    defaultValue: "We travel to addresses inside the M25.",
  },
];

/* ============================================================
   WHAT THE PRACTICE SAYS

   Straight from the app's site.ts. The cancellation terms especially: they
   are stated once and every surface prints the same sentences, so what
   somebody agreed to and what they are later reminded of cannot be two
   different promises.
   ============================================================ */

const NOTICE_HOURS = 48;

const site = {
  name: "The Postpartum Suite",
  phone: "+44 7477 693300",
  email: "info@thepostpartumsuite.com",
  /* Phrased as the scope of the service rather than as a verdict on
     whoever is reading it. It offers no way onward, by the practice's
     decision: an earlier version pointed at the enquiries address and they
     asked for that sentence out. */
  notEligible: "Our massage and body treatments are only available to women.",
  hours: "Monday to Saturday, 9am to 6pm",
  area: "London only (Zones 1-5)",
  cancellation: {
    heading: "Before you book",
    terms: [
      `Appointments may be moved or cancelled free of charge up to ${NOTICE_HOURS} hours before your appointment.`,
      `Within ${NOTICE_HOURS} hours of your appointment, it cannot be moved, and cancellations are non-refundable.`,
    ],
    acknowledgement: `I understand the ${NOTICE_HOURS}-hour cancellation policy.`,
  },
};

/* ============================================================
   DATES

   Plain "YYYY-MM-DD" strings throughout, and all arithmetic through
   Date.UTC where the offset is always zero. Parsing a booking date with
   new Date("2026-09-11") reads it as UTC and renders it in the viewer's
   zone, which shifts a date across midnight for anyone west of London.
   The only place a real clock is consulted is todayInLondon.
   ============================================================ */

const COMPANY_TIME_ZONE = "Europe/London";
const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/** Today's date in the company's timezone, not the viewer's. */
function todayInLondon(now = new Date()) {
  // en-CA formats as YYYY-MM-DD, which is the shape we want everywhere.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: COMPANY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The wall clock in the company's timezone, not the viewer's. */
function nowInLondon(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COMPANY_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);

  const part = (type) => parts.find((p) => p.type === type)?.value ?? "00";

  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

/**
 * A wall-clock date and time, that many hours later.
 *
 * Wall clock rather than elapsed time: "48 hours' notice" means the same
 * two sleeps to a client whichever side of a clock change it falls, and
 * the one night a year the two readings differ by an hour is not worth the
 * machinery.
 */
function addHours({ date, time }, hours) {
  const { year, month, day } = parseDate(date);
  const [hour, minute] = time.split(":").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day, hour + hours, minute));
  return {
    date: shifted.toISOString().slice(0, 10),
    time: shifted.toISOString().slice(11, 16),
  };
}

function parseDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function toDateString({ year, month }, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthOf(date) {
  const { year, month } = parseDate(date);
  return { year, month };
}

function addMonths({ year, month }, delta) {
  // Month is 1-based here and 0-based in Date, hence the shift either side.
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

/** Ordered comparison, which works directly on the string form. */
function isBeforeMonth(a, b) {
  return a.year !== b.year ? a.year < b.year : a.month < b.month;
}

function daysInMonth({ year, month }) {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The day of the week, 0 being Sunday, for a "YYYY-MM-DD" date. */
function weekdayOf(date) {
  const { year, month, day } = parseDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Weekday with Monday as 0 — the UK convention, and the header's order. */
function weekdayIndex(date) {
  return (weekdayOf(date) + 6) % 7;
}

function formatMonth({ year, month }) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

/** "Friday 11 September" — used to confirm the chosen day back to the reader. */
function formatLongDate(date) {
  const { year, month, day } = parseDate(date);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * "9am", or "9:30am" when there are minutes to state. The site writes its
 * opening hours as "9am to 6pm", so times follow that rather than padding
 * every hour with ":00".
 */
function formatTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours < 12 ? "am" : "pm";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0
    ? `${hour12}${suffix}`
    : `${hour12}:${String(minutes).padStart(2, "0")}${suffix}`;
}

/**
 * The cells of a month grid, padded at the front so the first day lands
 * under its weekday. The trailing week is not padded — an empty cell at
 * the end has nothing to line up with.
 */
function buildMonthGrid(month) {
  const blanks = weekdayIndex(toDateString(month, 1));
  const total = daysInMonth(month);
  const cells = Array.from({ length: blanks }, () => ({ date: null, day: null }));
  for (let day = 1; day <= total; day++) {
    cells.push({ date: toDateString(month, day), day });
  }
  return cells;
}

/* ============================================================
   SCHEDULING

   The practice's own rules, as distinct from SimplyBook's. In the real app
   these live in schedule.ts and SimplyBook's calendar stays the authority
   on what is actually free; here they are the whole of it.
   ============================================================ */

/** No treatment starts after this, whatever it is and whenever it ends. */
const LAST_START = "18:00";
/** The working day runs to here, so an 18:00 two-hour treatment can finish. */
const DAY_END = "19:00";
/** Sunday. She does not work it, and neither does the site. */
const CLOSED_WEEKDAY = 0;
/** Two clear days: nobody books today or tomorrow, whatever the diary says. */
const MIN_NOTICE_HOURS = 48;
/** The gap after every appointment, mirroring buffer_time_after in SimplyBook. */
const BUFFER_MINUTES = 120;

/**
 * The only dates on offer, inclusive at both ends.
 *
 * The app holds a fixed run — a deliberately short opening window rather
 * than an open diary — and this is that run. The rolling fallback below it
 * is the one concession this prototype makes: a hardcoded window shows an
 * empty calendar to anyone who opens the page after it closes, and a
 * prototype that has gone blank teaches nobody anything. The real app has
 * no such fallback and should not grow one.
 */
const BOOKING_WINDOW = { from: "2026-09-28", to: "2026-10-10" };

function bookingWindow(today) {
  if (today <= BOOKING_WINDOW.to) return BOOKING_WINDOW;
  return { from: addDays(today, 2), to: addDays(today, 15) };
}

function addDays(date, days) {
  const { year, month, day } = parseDate(date);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Minutes since midnight. "18:00" and "18:00:00" both read as 1080. */
function minutesFromTime(time) {
  const [hours, minutes] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

/** Whether the site sells this date at all: inside the run, not a Sunday. */
function isBookableDate(date, today) {
  const window = bookingWindow(today);
  return (
    date >= window.from && date <= window.to && weekdayOf(date) !== CLOSED_WEEKDAY
  );
}

/**
 * Whether an appointment is far enough ahead to be worth offering.
 *
 * Compared as plain strings, which sort correctly in this shape, so the
 * boundary needs no arithmetic.
 */
function hasEnoughNotice(date, time, now = new Date()) {
  const earliest = addHours(nowInLondon(now), MIN_NOTICE_HOURS);
  return (
    date > earliest.date ||
    (date === earliest.date && time.slice(0, 5) >= earliest.time)
  );
}

/**
 * A stable pseudo-random number in [0, 1) for a date and a treatment.
 *
 * This is what stands in for the diary. It has to be deterministic or the
 * times would reshuffle every time the step re-rendered, and a slot that
 * moves while somebody is reaching for it is worse than no slot at all.
 */
function seeded(key) {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

/**
 * The free starts on one day for one treatment.
 *
 * Every half hour from 09:00, kept only if the practice would start then,
 * if the whole appointment and its two-hour gap fit before the day ends,
 * and if it is far enough ahead. Then roughly a third are dropped as
 * already taken, which is what makes the grid look like a diary rather
 * than like a timetable.
 */
function timesFor(date, service, now = new Date()) {
  if (!isBookableDate(date, todayInLondon(now))) return [];

  const footprint = service.duration + BUFFER_MINUTES;
  const lastStart = Math.min(
    minutesFromTime(LAST_START),
    minutesFromTime(DAY_END) - service.duration,
  );

  const times = [];
  for (let start = minutesFromTime("09:00"); start <= lastStart; start += 30) {
    const time = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}:00`;
    if (!hasEnoughNotice(date, time, now)) continue;
    // The footprint has to land inside the day plus its gap; the gap may
    // run past close, since she is travelling rather than treating.
    if (start + footprint > minutesFromTime(DAY_END) + BUFFER_MINUTES) continue;
    if (seeded(`${date}|${service.id}|${time}`) < 0.38) continue;
    times.push(time);
  }
  return times;
}

/* ============================================================
   PHONE

   UK numbers, with the country code taken as read. The form fixes +44
   beside the box, so what gets typed into it is the national number and
   nothing else. People will still write it every way they know, and all of
   those mean the same number, so they are absorbed rather than argued
   with. The only thing ever refused is a number of the wrong length.
   ============================================================ */

/**
 * The national number, stripped of everything that only decorates it. A UK
 * national number never begins with 4, so a leading 44 can only be the
 * country code.
 */
function nationalDigits(input) {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("0044")) digits = digits.slice(4);
  else if (digits.startsWith("44")) digits = digits.slice(2);
  // The trunk zero — dialled inside the UK, meaningless behind +44.
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

/**
 * Ten digits, which covers every mobile and nearly every landline, or nine
 * for the handful of rural areas that never grew one. Length is the whole
 * test: guessing at which ranges are in service would turn a working
 * number away the week Ofcom opens a new one. Mobiles are held to ten
 * exactly — a nine-digit 07 is a number typed a digit short.
 */
function isValidNational(digits) {
  if (!/^[1-9]\d{8,9}$/.test(digits)) return false;
  if (digits.startsWith("7")) return digits.length === 10;
  return true;
}

/**
 * The national number spaced the way it is written down. Mobiles and most
 * landlines break after four; London breaks after two; the nine-digit
 * rural numbers break after five, since their area codes are the long
 * ones. Anything else is left as one run rather than spaced wrongly.
 */
function formatNational(digits) {
  if (digits.length === 10) {
    return digits.startsWith("2")
      ? `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`
      : `${digits.slice(0, 4)} ${digits.slice(4)}`;
  }
  if (digits.length === 9) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return digits;
}

function formatFull(digits) {
  return `+44 ${formatNational(digits)}`;
}

/**
 * What the box shows once it has been left. A number that is not whole yet
 * is left exactly as typed, so whoever is fixing it can still see what
 * they wrote.
 */
function tidyNational(input) {
  const digits = nationalDigits(input);
  return isValidNational(digits) ? formatNational(digits) : input;
}

/* ============================================================
   POSTCODES

   postcodes.io is ONS and Ordnance Survey open data. Free, no key, and it
   answers "is this a real postcode, and where is it". It cannot answer
   "which houses are in it" — door-level addresses are Royal Mail's PAF,
   which is licensed, so the street address is typed by hand here as it is
   in the app when no PAF key is configured.
   ============================================================ */

const POSTCODES_IO = "https://api.postcodes.io";
const POSTCODE_PATTERN = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

/** "e48dl" and "E4  8DL" are the same postcode; the API wants the spaced form. */
function normalisePostcode(input) {
  const bare = input.replace(/\s+/g, "").toUpperCase();
  if (bare.length < 5) return bare;
  return `${bare.slice(0, -3)} ${bare.slice(-3)}`;
}

function looksLikePostcode(input) {
  return POSTCODE_PATTERN.test(input.replace(/\s+/g, ""));
}

/**
 * Whether the address sits inside the M25.
 *
 * Ray casting against the motorway ring. The obvious shortcut — checking
 * region === "London" — is wrong in both directions, and not rarely:
 * Upminster and North Ockendon are Greater London but outside the M25,
 * while Esher, Loughton, Potters Bar and Dartford are inside it and not
 * London at all. Neither group is small enough to wave away.
 *
 * Accurate to the width of a polygon segment, roughly 470m, so an address
 * within a few hundred metres of the motorway itself may fall either way.
 * There is no exact answer there anyway.
 */
function isInsideM25(lat, lng) {
  let inside = false;
  for (let i = 0, j = M25_RING.length - 1; i < M25_RING.length; j = i++) {
    const [latI, lngI] = M25_RING[i];
    const [latJ, lngJ] = M25_RING[j];

    // Does a ray cast east from the point cross this edge?
    const straddles = latI > lat !== latJ > lat;
    if (!straddles) continue;

    const crossingLng = lngI + ((lat - latI) / (latJ - latI)) * (lngJ - lngI);
    if (lng < crossingLng) inside = !inside;
  }
  return inside;
}

/**
 * The verdict on a postcode, or an error to show.
 *
 * In the app this is a route on our own server, which keeps the third
 * party behind us and lets the server check the answer again at booking
 * time. Here the browser asks postcodes.io itself, because there is no
 * server and nothing downstream to protect.
 */
async function lookupPostcode(raw) {
  const postcode = normalisePostcode(raw);

  if (!looksLikePostcode(postcode)) {
    return { error: "That does not look like a UK postcode." };
  }

  let response;
  try {
    response = await fetch(
      `${POSTCODES_IO}/postcodes/${encodeURIComponent(postcode)}`,
      { signal: AbortSignal.timeout(8000) },
    );
  } catch {
    return { error: "We could not check that postcode. Please try again." };
  }

  if (response.status === 404) {
    return { error: "We could not find that postcode. Please check it." };
  }
  if (!response.ok) {
    return { error: "We could not check that postcode. Please try again." };
  }

  const body = await response.json();
  const result = body.result;
  if (!result) return { error: "We could not find that postcode. Please check it." };

  return {
    postcode: result.postcode,
    district: result.admin_district ?? "",
    inServiceArea: isInsideM25(result.latitude, result.longitude),
  };
}

/**
 * One block of text, because SimplyBook stores one block of text. House
 * number and street share a line the way they would on an envelope;
 * everything else gets its own.
 */
function composeAddress(value, check) {
  return [
    [value.house.trim(), value.line1.trim()].filter(Boolean).join(" "),
    value.line2.trim(),
    value.town.trim(),
    check?.postcode ?? value.postcode.trim().toUpperCase(),
  ]
    .filter(Boolean)
    .join("\n");
}

/* ============================================================
   FORMATTING
   ============================================================ */

function formatPrice(amount, currency) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    // Every price in this catalogue is whole pounds. A trailing ".00" on a
    // treatment reads like a checkout, which this is not.
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * The house way of saying a length. Plain minutes throughout — the
 * practice quotes its treatments in minutes, and "90 minutes" needs no
 * arithmetic done to it on the way past.
 */
function formatMinutes(minutes) {
  return `${minutes} minutes`;
}

/* ============================================================
   VALIDATION

   Each message names the answer it wants rather than reporting a fault,
   and gives the shape of it where the shape is the thing people get wrong.
   Somebody who typed a half-remembered phone number is in the same
   position as somebody who typed nothing: being told off first for leaving
   it blank and then for getting it wrong reads as two problems when there
   is only one.
   ============================================================ */

/** Loose on purpose: an address is proved by the confirmation arriving. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ASK = {
  bookingFor: "Choose whether the treatment is for you or someone else",
  name: "Enter your full name",
  email: "Enter an email address, for example name@example.com",
  phone: "Enter a UK phone number, for example 07700 900 982",
  recipient: "Enter the name of the person you are booking for",
  recipientSex: "Choose female or male to continue",
  house: "Enter your house number or name",
  street: "Enter your street address",
  town: "Enter your town or city",
  postcode: "Enter your postcode",
};

function detailsErrors(contact, address, needsAddress) {
  const errors = {};

  // The same ladder the form draws, in the same order. Each rung is the
  // only thing on screen for somebody who has not passed it, so each
  // returns alone rather than reporting on fields that are not there yet.
  if (!contact.name.trim()) return { name: ASK.name };
  if (!contact.bookingFor) return { bookingFor: ASK.bookingFor };
  if (!contact.recipientSex) return { recipientSex: ASK.recipientSex };
  if (contact.recipientSex === "male") return { recipientSex: site.notEligible };

  // Past the gate, and everything below it is on screen at once, so what
  // is still missing is named together rather than a field at a time.
  if (contact.bookingFor === "other" && !contact.recipient.trim()) {
    errors.recipient = ASK.recipient;
  }
  if (!contact.email.trim() || !EMAIL_PATTERN.test(contact.email.trim())) {
    errors.email = ASK.email;
  }
  if (!contact.phone.trim() || !isValidNational(nationalDigits(contact.phone))) {
    errors.phone = ASK.phone;
  }

  if (needsAddress) {
    if (!address.house.trim()) errors.house = ASK.house;
    if (!address.line1.trim()) errors.street = ASK.street;
    if (!address.town.trim()) errors.town = ASK.town;
    if (!address.postcode.trim()) errors.postcode = ASK.postcode;
  }

  return errors;
}

/**
 * The name of the person being treated, whichever branch the form is on.
 * The one place that decides what "the recipient" means, so the question
 * put to the client and the review screen cannot come to two answers.
 */
function recipientNameOf(contact) {
  return contact.bookingFor === "other"
    ? contact.recipient.trim()
    : contact.name.trim();
}

/* ============================================================
   STATE
   ============================================================ */

const STEP_NAMES = [
  "Choose your treatment",
  "Choose a date and time",
  "Your details",
  "Review your booking",
];

const STEP_TREATMENT = 1;
const STEP_WHEN = 2;
const STEP_DETAILS = 3;
const STEP_REVIEW = 4;

/** How long the rejected treatment cards take to fold away. Matches the
    transition on .bk-services > li; they have to agree. */
const FOLD_MS = 300;

/** The breathing room left above the card and below the button, in pixels. */
const SNAP_GAP = 24;

const REQUIRED_PLACEHOLDER = "Required";

const today = todayInLondon();

const state = {
  step: STEP_TREATMENT,
  serviceId: null,
  addonIds: [],
  month: monthOf(bookingWindow(today).from),
  date: null,
  time: null,
  contact: {
    bookingFor: "",
    name: "",
    email: "",
    phone: "",
    recipient: "",
    recipientSex: "",
  },
  address: { house: "", line1: "", line2: "", town: "", postcode: "" },
  addressCheck: null,
  /** Whether the town in the box was put there by a lookup rather than typed. */
  townFromLookup: false,
  otherAnswers: {},
  /**
   * Whether the details step is naming what it is missing yet. Nothing is
   * marked while the form is still being filled in — the messages arrive
   * when Continue is pressed on an incomplete form, and from then on each
   * clears itself as its own field is answered.
   */
  showDetailsErrors: false,
  isCheckingPostcode: false,
  postcodeError: null,
  booked: null,
};

/** Where the page should go once the new markup is on it. */
let pendingScroll = null;
let pendingTreatmentSnap = false;
/** The step the scroll effect has already answered for. */
let answeredStep = STEP_TREATMENT;
let postcodeTimer = null;

/* ============================================================
   DERIVED
   ============================================================ */

const selectedService = () => SERVICES.find((s) => s.id === state.serviceId) ?? null;

function availableAddons() {
  const service = selectedService();
  return service ? ADDONS.filter((a) => a.serviceIds.includes(service.id)) : [];
}

function chosenAddons() {
  return availableAddons().filter((a) => state.addonIds.includes(a.id));
}

function total() {
  return (
    (selectedService()?.price ?? 0) +
    chosenAddons().reduce((sum, a) => sum + a.price, 0)
  );
}

const currency = () => selectedService()?.currency ?? SERVICES[0].currency;

/** Whether this step asks for an address at all. */
function isAddressField(field) {
  return field.type === "textarea" && /\b(location|address)\b/i.test(field.label);
}

const needsAddress = () => INTAKE_FIELDS.some(isAddressField);

function timesForDate() {
  const service = selectedService();
  if (!service || !state.date) return [];
  return timesFor(state.date, service);
}

function bookableDatesIn(month) {
  const service = selectedService();
  if (!service) return new Set();
  const dates = new Set();
  for (const cell of buildMonthGrid(month)) {
    if (cell.date && timesFor(cell.date, service).length > 0) dates.add(cell.date);
  }
  return dates;
}

/* ============================================================
   MARKUP HELPERS
   ============================================================ */

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The asterisk after a required field's name. Marked aria-hidden and
 * paired with the input's own required, so a screen reader is told once
 * rather than read a stray star.
 */
const req = () => '<span class="bk-req" aria-hidden="true">*</span>';

function fieldError(message) {
  if (!message) return "";
  return `<span class="bk-error" role="alert" data-field-error="true">${esc(message)}</span>`;
}

const TICK_SVG = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>`;
const BACK_SVG = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>`;
const CLOSE_SVG = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>`;

function tile(src, alt = "") {
  return `<div class="bk-tile" aria-hidden="true">${
    src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" />` : ""
  }</div>`;
}

/* ============================================================
   THE STEPS
   ============================================================ */

function renderServicePicker() {
  const hasChosen = state.serviceId !== null;
  const addons = availableAddons();

  const cards = SERVICES.map((service) => {
    const isSelected = service.id === state.serviceId;
    // Once a treatment is chosen the others fold away. The chosen one is
    // what this step is now about, and the add-on below belongs to it —
    // leaving the rejected options on screen only invites a second-guess
    // at the moment somebody has just decided.
    const isFolded = hasChosen && !isSelected;

    return `
      <li${isFolded ? " data-folded inert" : ""}${isSelected ? " data-chosen" : ""}>
        <div>
          <label class="bk-pick">
            <input type="radio" name="service" value="${service.id}"${isSelected ? " checked" : ""} data-service />
            <div class="bk-card">
              ${tile(service.imageUrl)}
              <div class="bk-card__body">
                <div class="bk-card__top">
                  <span class="bk-card__name">${esc(service.name)}</span>
                  <span class="bk-card__price">${esc(formatPrice(service.price, service.currency))}</span>
                </div>
                <p class="bk-card__len">${esc(formatMinutes(service.duration))}</p>
                <p class="bk-card__desc">${esc(service.description)}</p>
              </div>
            </div>
          </label>
        </div>
      </li>`;
  }).join("");

  const addonMarkup =
    addons.length === 0
      ? ""
      : `
    <fieldset class="bk-fieldset bk-addons bk-reveal">
      <legend class="bk-eyebrow">Add to your treatment</legend>
      <ul>
        ${addons
          .map((addon) => {
            const isChecked = state.addonIds.includes(addon.id);
            return `
          <li>
            <label class="bk-pick">
              <input type="checkbox" value="${addon.id}"${isChecked ? " checked" : ""} data-addon />
              <div class="bk-card">
                ${tile(addon.imageUrl)}
                <div class="bk-card__body">
                  <div class="bk-addon__top">
                    <span class="bk-addon__name">
                      <span class="bk-tick" aria-hidden="true">${TICK_SVG}</span>
                      <span>${esc(addon.name)}</span>
                    </span>
                    <span class="bk-card__price">+ ${esc(formatPrice(addon.price, addon.currency))}</span>
                  </div>
                  ${addon.duration > 0 ? `<p class="bk-addon__len">Adds ${esc(formatMinutes(addon.duration))}</p>` : ""}
                  <p class="bk-addon__desc">${esc(addon.description)}</p>
                </div>
              </div>
            </label>
          </li>`;
          })
          .join("")}
      </ul>
    </fieldset>`;

  return `
    <fieldset class="bk-fieldset">
      <legend class="bk-eyebrow">${hasChosen ? "Your treatment" : "Choose your treatment"}</legend>
      <ul class="bk-services">${cards}</ul>
      ${
        hasChosen
          ? `<button type="button" class="bk-back-to-list" data-clear-service>${BACK_SVG}Choose a different treatment</button>`
          : ""
      }
    </fieldset>
    ${addonMarkup}`;
}

function renderCalendar() {
  const month = state.month;
  const bookable = bookableDatesIn(month);
  // There is nothing to see in a past month, so the back arrow stops at
  // this one rather than letting someone wander into empty grids.
  const canGoBack = !isBeforeMonth(addMonths(month, -1), monthOf(today));

  const weekdays = WEEKDAY_LABELS.map(
    (label) => `<div class="bk-cal__wd" aria-hidden="true">${label}</div>`,
  ).join("");

  const cells = buildMonthGrid(month)
    .map((cell) => {
      if (!cell.date) return `<div></div>`;
      const isBookable = bookable.has(cell.date);
      const isSelected = cell.date === state.date;
      const isToday = cell.date === today;
      return `<button type="button" class="bk-day" data-date="${cell.date}"${
        isBookable ? "" : " disabled"
      }${isToday ? ' aria-current="date"' : ""} aria-pressed="${isSelected}">${cell.day}</button>`;
    })
    .join("");

  return `
    <div class="bk-anchor" data-calendar>
      <div class="bk-cal__head">
        <button type="button" class="bk-cal__step" data-month="-1"${canGoBack ? "" : " disabled"} aria-label="Previous month"><span aria-hidden="true">&larr;</span></button>
        <p class="bk-cal__month" aria-live="polite">${esc(formatMonth(month))}</p>
        <button type="button" class="bk-cal__step" data-month="1" aria-label="Next month"><span aria-hidden="true">&rarr;</span></button>
      </div>
      <div class="bk-cal__grid" role="grid" aria-label="Available dates in ${esc(formatMonth(month))}">
        ${weekdays}${cells}
      </div>
    </div>`;
}

function renderTimes() {
  if (!state.date) return "";
  const times = timesForDate();

  const body =
    times.length === 0
      ? `<p class="bk-times__none">Nothing free on this day. Try another.</p>`
      : `<ul>${times
          .map(
            (time) =>
              `<li><button type="button" class="bk-time" data-time="${time}" aria-pressed="${time === state.time}">${esc(formatTime(time))}</button></li>`,
          )
          .join("")}</ul>`;

  return `
    <fieldset class="bk-fieldset bk-times bk-anchor" data-timegrid>
      <legend class="bk-eyebrow">${esc(formatLongDate(state.date))}</legend>
      ${body}
      <p class="bk-times__clock">All times UK</p>
    </fieldset>`;
}

function renderDetails(errors) {
  const c = state.contact;

  /**
   * How far down the ladder the form has been answered. Each rung carries
   * the ones above it rather than testing only the answer directly before
   * it: otherwise going back and emptying the name hides the question
   * under it while leaving everything below that still on screen — a form
   * with a hole in the middle, asking about a branch it is no longer
   * showing. Answers further down are kept, not cleared.
   */
  const hasName = c.name.trim() !== "";
  const hasBranch = hasName && c.bookingFor !== "";
  const isEligible = hasBranch && c.recipientSex === "female";

  const radios = (name, options, current, invalid) => `
    <div class="bk-radios" role="radiogroup"${invalid ? ' aria-invalid="true"' : ""}>
      ${options
        .map(
          ([value, label]) => `
        <label class="bk-radio">
          <input type="radio" name="${name}" value="${value}"${current === value ? " checked" : ""} data-contact="${name}" />
          ${esc(label)}
        </label>`,
        )
        .join("")}
    </div>`;

  let out = `
    <label class="bk-field">
      <span>Your name${req()}</span>
      <input type="text" class="bk-input" value="${esc(c.name)}" autocomplete="name" required
        ${errors.name ? 'aria-invalid="true"' : ""} placeholder="${REQUIRED_PLACEHOLDER}" data-contact="name" />
      ${fieldError(errors.name)}
    </label>`;

  // Each answer opens the next question and nothing further, so the form
  // is only ever asking one thing of somebody who has not answered the
  // thing before it. detailsErrors returns early down the same ladder; if
  // the two ever disagree, Continue will name a field nobody can see.
  if (hasName) {
    out += `
      <fieldset class="bk-fieldset bk-field">
        <legend>Who is this treatment for?${req()}</legend>
        ${radios("bookingFor", [["self", "Me"], ["other", "Someone else"]], c.bookingFor, errors.bookingFor)}
        ${fieldError(errors.bookingFor)}
      </fieldset>`;
  }

  // Asked before the name of the person it is about, on the someone-else
  // branch. That order is deliberate: it is the answer that decides whether
  // there is a booking to make at all, and asking for somebody's name first
  // would collect a third party's details only to refuse a moment later.
  if (hasBranch) {
    const question =
      c.bookingFor === "other"
        ? "Is the person you're booking for male or female?"
        : "Are you male or female?";
    out += `
      <fieldset class="bk-fieldset bk-field">
        <legend>${esc(question)}${req()}</legend>
        ${radios("recipientSex", [["female", "Female"], ["male", "Male"]], c.recipientSex, errors.recipientSex)}
        ${
          c.recipientSex === "male"
            ? `<p class="bk-refusal" role="alert" data-field-error="true">${esc(site.notEligible)}</p>`
            : fieldError(errors.recipientSex)
        }
      </fieldset>`;
  }

  if (isEligible) {
    if (c.bookingFor === "other") {
      out += `
        <label class="bk-field">
          <span>Name of the person you're booking for${req()}</span>
          <input type="text" class="bk-input" value="${esc(c.recipient)}" required
            ${errors.recipient ? 'aria-invalid="true"' : ""} placeholder="${REQUIRED_PLACEHOLDER}" data-contact="recipient" />
          ${fieldError(errors.recipient)}
        </label>`;
    }

    out += `
      <label class="bk-field">
        <span>Email${req()}</span>
        <input type="email" class="bk-input" value="${esc(c.email)}" autocomplete="email" inputmode="email" required
          ${errors.email ? 'aria-invalid="true"' : ""} placeholder="${REQUIRED_PLACEHOLDER}" data-contact="email" />
        ${fieldError(errors.email)}
      </label>

      <label class="bk-field">
        <span>Phone${req()}</span>
        <div class="bk-shell">
          <span class="bk-shell__code">+44</span>
          <input type="tel" value="${esc(c.phone)}" autocomplete="tel-national" inputmode="tel" required
            ${errors.phone ? 'aria-invalid="true"' : ""} placeholder="${REQUIRED_PLACEHOLDER}" data-contact="phone" data-tidy />
        </div>
        ${fieldError(errors.phone)}
      </label>`;

    out += INTAKE_FIELDS.map((field) =>
      isAddressField(field) ? renderAddress(field, errors) : renderIntake(field),
    ).join("");
  }

  return out;
}

/**
 * Address entry, written out in the order someone would say it: house
 * number, street, second line, town, postcode.
 *
 * There is no button to press. The postcode is looked up quietly a moment
 * after typing stops, and the verdict is reported upward rather than
 * shown: the step refuses to be left on a postcode we do not travel to,
 * and says so in a dialog at that point.
 */
function renderAddress(field, errors) {
  const a = state.address;

  const line = (label, key, value, autocomplete, error, optional) => `
    <label class="bk-field">
      <span>${esc(label)}${optional ? "" : req()}</span>
      <input type="text" class="bk-input" value="${esc(value)}" autocomplete="${autocomplete}"
        ${optional ? "" : "required"} ${error ? 'aria-invalid="true"' : ""}
        placeholder="${optional ? "Optional" : REQUIRED_PLACEHOLDER}" data-address="${key}" />
      ${fieldError(error)}
    </label>`;

  return `
    <div class="bk-address">
      <span>${esc(field.label)}</span>
      <p class="bk-address__note">${esc(field.defaultValue)}</p>
      ${line("House number or name", "house", a.house, "address-line1", errors.house)}
      ${line("Street", "line1", a.line1, "address-line2", errors.street)}
      ${line("Address line 2", "line2", a.line2, "address-line3", null, true)}
      ${line("Town or city", "town", a.town, "address-level2", errors.town)}
      <label class="bk-field">
        <span>Postcode${req()}</span>
        <input type="text" class="bk-input bk-input--pc" value="${esc(a.postcode)}" autocomplete="postal-code"
          spellcheck="false" required ${errors.postcode ? 'aria-invalid="true"' : ""}
          placeholder="${REQUIRED_PLACEHOLDER}" data-address="postcode" />
        ${fieldError(errors.postcode)}
      </label>
    </div>`;
}

function renderIntake(field) {
  const value = state.otherAnswers[field.key] ?? field.defaultValue;
  return `
    <label class="bk-field">
      <span>${esc(field.label)}</span>
      <textarea class="bk-input" rows="3" data-intake="${esc(field.key)}">${esc(value)}</textarea>
    </label>`;
}

/**
 * The last look before anything is written. Everything chosen so far, in
 * one place, with the total.
 */
function renderReview() {
  const service = selectedService();
  const addons = chosenAddons();
  const c = state.contact;
  const minutes = addons.reduce((sum, a) => sum + a.duration, service.duration);
  const recipient = recipientNameOf(c);

  const row = (label, value) => `
    <div class="bk-row">
      <span class="bk-row__label">${esc(label)}</span>
      <span class="bk-row__value">${esc(value)}</span>
    </div>`;

  return `
    <div class="bk-review">
      ${row("Treatment", service.name)}
      ${addons.map((a) => row("Add-on", a.name)).join("")}
      ${row("Length", formatMinutes(minutes))}
      ${row("When", `${formatLongDate(state.date)} at ${formatTime(state.time)}`)}
      ${row("Name", c.name)}
      ${
        // Only worth a line of its own when it says something the line
        // above did not. A booking for oneself puts the same name in both,
        // and repeating it back reads as a mistake.
        recipient !== "" && recipient !== c.name.trim()
          ? row("Treatment for", recipient)
          : ""
      }
      ${row("Email", c.email)}
      ${row("Phone", formatFull(nationalDigits(c.phone)))}
      ${row("Address", composeAddress(state.address, state.addressCheck))}
      ${row("Total", formatPrice(total(), currency()))}
    </div>

    <button type="button" class="bk-btn bk-btn--go bk-btn--confirm" data-open-policy>Confirm and pay</button>
    <p class="bk-terms">${esc(site.cancellation.terms.join(" "))}</p>
    <button type="button" class="bk-btn bk-btn--back bk-btn--wide" data-back>Back</button>`;
}

/**
 * Booked, on our own page — except that in this prototype it is not.
 *
 * The real screen can say so plainly: the card has been taken and the
 * appointment written. This one has done neither, so the same card carries
 * a note saying which parts of it are theatre. Everything above that note
 * is the app's own screen, word for word.
 */
function renderConfirmation() {
  const b = state.booked;
  const addons = b.addons;

  return `
    <div class="bk-done bk-anchor" role="status" tabindex="-1" data-done>
      <p class="bk-eyebrow" style="margin-bottom:0">You are booked</p>
      <p class="bk-done__when">${esc(formatLongDate(b.date))} at ${esc(formatTime(b.time))}</p>
      <p class="bk-done__what">
        ${esc(b.serviceName)}${b.amount > 0 ? `, ${esc(formatPrice(b.amount, b.currency))}` : ""}.
        <span style="display:block">${esc(formatMinutes(b.minutes))}.</span>
      </p>
      ${
        addons.length > 0
          ? `<div class="bk-done__addons">
               <p>${addons.length > 1 ? "Add-ons" : "Add-on"}</p>
               <div class="bk-done__chips">${addons.map((a) => `<span>${esc(a.name)}</span>`).join("")}</div>
             </div>`
          : ""
      }
      <p class="bk-done__what">Paid in full. We have sent a confirmation to your email.</p>
      <p class="bk-done__ref-label">Booking reference</p>
      <p class="bk-done__ref">${esc(b.code)}</p>
      <div class="bk-done__manage">
        <a href="#" data-restart>Manage your booking&nbsp;<span style="text-decoration:underline;text-underline-offset:4px">here</span></a>
      </div>
      <p class="bk-done__terms">${esc(site.cancellation.terms.join(" "))}</p>
    </div>

    <p class="bk-proto">
      Prototype. Nothing was booked and no card was taken &mdash; the reference above is
      generated in the browser. The real flow hands this step to SimplyBook.
    </p>`;
}

/* ============================================================
   WHAT EACH STEP STILL NEEDS BEFORE IT CAN BE LEFT
   ============================================================ */

function blockedReason() {
  if (state.step === STEP_TREATMENT) {
    return selectedService() ? null : "Choose a treatment to continue.";
  }
  if (state.step === STEP_WHEN) {
    if (!state.date) return "Choose a date to continue.";
    if (!state.time) return "Choose a time to continue.";
    return null;
  }
  if (state.step === STEP_DETAILS) {
    // The missing answers are named at the fields themselves, so all that
    // is left to say here is what no single field can explain.
    return needsAddress() ? state.postcodeError : null;
  }
  return null;
}

/* ============================================================
   RENDER
   ============================================================ */

const root = document.querySelector("[data-booking]");

function render() {
  if (state.booked) {
    root.innerHTML = renderConfirmation();
    const card = root.querySelector("[data-done]");
    /* Land on the booking, not on the top of the page. Instantly rather
       than smoothly: html scrolls smoothly on this site, and that is right
       for a reader who clicked something and can follow the journey.
       Nobody clicked this. */
    card.scrollIntoView({ behavior: "instant", block: "start" });
    card.focus({ preventScroll: true });
    return;
  }

  const problems = detailsErrors(state.contact, state.address, needsAddress());
  const incomplete = Object.keys(problems).length > 0;
  const visible = state.showDetailsErrors ? problems : {};

  let body = "";
  if (state.step === STEP_TREATMENT) body = renderServicePicker();
  else if (state.step === STEP_WHEN) body = renderCalendar() + renderTimes();
  else if (state.step === STEP_DETAILS) body = renderDetails(visible);
  else if (state.step === STEP_REVIEW) body = renderReview();

  const service = selectedService();
  const blocked = blockedReason();
  // Whether what is holding the step up is a failure rather than a nudge.
  const blockedIsError = blocked !== null && blocked === state.postcodeError;

  const footer =
    state.step === STEP_REVIEW
      ? ""
      : `
    ${
      // The running total follows the reader from the moment there is one,
      // so the price is never a surprise waiting at the end.
      service
        ? `<div class="bk-total">
             <span class="bk-total__label">Total</span>
             <span class="bk-total__value">${esc(formatPrice(total(), currency()))}</span>
           </div>`
        : ""
    }
    <div class="bk-actions" data-actions>
      <div class="bk-actions__row">
        ${state.step > STEP_TREATMENT ? `<button type="button" class="bk-btn bk-btn--back" data-back>Back</button>` : ""}
        <button type="button" class="bk-btn bk-btn--go" data-continue${
          blocked !== null || state.isCheckingPostcode ? " disabled" : ""
        }>${state.isCheckingPostcode ? "Checking…" : "Continue"}</button>
      </div>
      <p class="bk-blocked" role="status"${blockedIsError ? " data-error" : ""}>${blocked ? esc(blocked) : ""}</p>
    </div>`;

  root.innerHTML = `
    <p class="bk-sr bk-anchor" tabindex="-1" aria-live="polite" data-step-name>${esc(STEP_NAMES[state.step - 1])}</p>
    <div>${body}</div>
    ${footer}`;

  // Nothing below this line changes what is on the page; it decides where
  // the reader is left standing on it.
  afterRender(incomplete);
}

/**
 * Put `lead` at the top of the frame with `tail` still inside it.
 *
 * The two only argue when the block between them is taller than the frame —
 * on a phone the chosen treatment, its add-on, the total and the button
 * together are — and then the top alignment gives way by exactly as much as
 * it takes to bring the button in, and not a pixel more.
 */
function snapIntoFrame(lead, tail) {
  if (!lead) return;
  const frame = window.innerHeight;
  const top = lead.getBoundingClientRect().top + window.scrollY - SNAP_GAP;
  const bottom = tail
    ? tail.getBoundingClientRect().bottom + window.scrollY + SNAP_GAP
    : top;
  const furthest = document.documentElement.scrollHeight - frame;
  const target = Math.min(
    Math.max(Math.max(top, bottom - frame), 0),
    Math.max(furthest, 0),
  );
  window.scrollTo({ top: target, behavior: "smooth" });
}

function afterRender() {
  // Each step replaces the last, so the reader is moved to the top of the
  // new one rather than left wherever the previous step happened to end.
  if (answeredStep !== state.step) {
    answeredStep = state.step;
    // On the date and time step the calendar itself is what the reader came
    // for, so that is what is put at the top of the frame; focus still
    // lands on the step name, without dragging the page back up to it.
    const anchor =
      (state.step === STEP_WHEN && root.querySelector("[data-calendar]")) ||
      root.querySelector("[data-step-name]");
    anchor?.scrollIntoView({ behavior: "smooth", block: "start" });
    root.querySelector("[data-step-name]")?.focus({ preventScroll: true });
  }

  // Follow a date or time choice down the page. The times only exist once
  // a date is chosen and the button only matters once a time is.
  if (pendingScroll === "times") {
    root.querySelector("[data-timegrid]")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (pendingScroll === "continue") {
    // The button need not lead the page — it only has to be in the frame —
    // so "nearest" leaves the times where they are if it already is.
    root.querySelector("[data-actions]")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  pendingScroll = null;

  if (pendingTreatmentSnap) {
    pendingTreatmentSnap = false;
    snapToTreatment();
  }

  // Bring the first unanswered field into view the moment Continue turns
  // the messages on. Without this a button at the foot of the form sends
  // the reader back up it to find what it meant on their own.
  if (state.showDetailsErrors && state.step === STEP_DETAILS) {
    root.querySelector("[data-field-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

/**
 * Snap to the treatment that was just chosen, so the step reads the same
 * whether it was the first card that was picked or the last one.
 *
 * The wait is not decoration: the rejected cards fold away over a third of
 * a second, and everything below them — the chosen card included — is
 * still moving while they do. Measuring before that settles aims the
 * scroll at where the card was rather than where it lands.
 */
function snapToTreatment() {
  const card = root.querySelector("[data-chosen]");
  const list = card?.parentElement;
  if (!card) return;

  let spent = false;

  function snap() {
    if (spent) return;
    spent = true;
    list?.removeEventListener("transitionend", onFolded);
    window.clearTimeout(timer);
    // A frame's grace after the event: the last of the fold lands in the
    // frame the event is dispatched in, and measuring inside that frame
    // catches the page a few pixels short of where it comes to rest.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        snapIntoFrame(card, root.querySelector("[data-actions]")),
      ),
    );
  }

  // The rows all fold together, so the first one to report itself done
  // speaks for the rest. The timer is only there for the cases the event
  // never comes: a single treatment, or a reader who has asked for no
  // motion and gets no transition to end.
  function onFolded(event) {
    if (event.propertyName === "grid-template-rows") snap();
  }

  const timer = window.setTimeout(snap, FOLD_MS + 120);
  list?.addEventListener("transitionend", onFolded);
}

/* ============================================================
   EVENTS

   One delegated listener per kind, on the mount, because every step's
   markup is thrown away and rebuilt on each render.
   ============================================================ */

root.addEventListener("click", (event) => {
  const target = event.target;

  const clear = target.closest("[data-clear-service]");
  if (clear) {
    // Back to the full list. Everything downstream depended on the choice.
    state.serviceId = null;
    state.addonIds = [];
    state.date = null;
    state.time = null;
    render();
    return;
  }

  const monthStep = target.closest("[data-month]");
  if (monthStep) {
    state.month = addMonths(state.month, Number(monthStep.dataset.month));
    state.date = null;
    state.time = null;
    render();
    return;
  }

  const day = target.closest("[data-date]");
  if (day && !day.disabled) {
    state.date = day.dataset.date;
    state.time = null;
    pendingScroll = "times";
    render();
    return;
  }

  const time = target.closest("[data-time]");
  if (time) {
    state.time = time.dataset.time;
    pendingScroll = "continue";
    render();
    return;
  }

  if (target.closest("[data-back]")) {
    state.step -= 1;
    render();
    return;
  }

  if (target.closest("[data-continue]")) {
    void goForward();
    return;
  }

  if (target.closest("[data-open-policy]")) {
    openPolicy();
    return;
  }

  const restart = target.closest("[data-restart]");
  if (restart) {
    // There is no booking to manage, so the offer restarts the flow rather
    // than pointing at a lookup page this prototype does not have.
    event.preventDefault();
    resetFlow();
    return;
  }
});

root.addEventListener("change", (event) => {
  const target = event.target;

  if (target.matches("[data-service]")) {
    handleSelectService(Number(target.value));
    return;
  }

  if (target.matches("[data-addon]")) {
    const id = Number(target.value);
    state.addonIds = state.addonIds.includes(id)
      ? state.addonIds.filter((a) => a !== id)
      : [...state.addonIds, id];
    render();
    return;
  }

  if (target.matches('[data-contact="bookingFor"]')) {
    // Changing branch clears what the other branch asked. The sex question
    // especially: it was answered about one person, and carrying that
    // answer to a different one would be the form deciding something
    // nobody told it.
    state.contact.bookingFor = target.value;
    if (target.value === "self") state.contact.recipient = "";
    state.contact.recipientSex = "";
    render();
    return;
  }

  if (target.matches('[data-contact="recipientSex"]')) {
    state.contact.recipientSex = target.value;
    render();
  }
});

/**
 * Typing. Nothing re-renders on a keystroke: rebuilding the step would
 * take the caret out of the box being typed into. The value is recorded,
 * any message under that field is cleared, and Continue is re-checked.
 */
root.addEventListener("input", (event) => {
  const target = event.target;

  const contactKey = target.dataset.contact;
  if (contactKey && target.type !== "radio") {
    state.contact[contactKey] = target.value;
    clearFieldError(target);
    refreshContinue();
    // The name is the rung that opens the next question, so it is the one
    // keystroke that does have to redraw the step — but only when it
    // crosses between empty and not, which is when the ladder moves.
    if (contactKey === "name" && nameGateMoved(target.value)) {
      render();
      focusField(`[data-contact="name"]`, target.value.length);
    }
    return;
  }

  const addressKey = target.dataset.address;
  if (addressKey) {
    state.address[addressKey] = target.value;
    if (addressKey === "town") state.townFromLookup = false;
    if (addressKey === "postcode") {
      // The old verdict belonged to the old postcode, and a new postcode
      // deserves a fresh one rather than the last failure.
      state.addressCheck = null;
      state.postcodeError = null;
      schedulePostcodeLookup();
    }
    clearFieldError(target);
    refreshContinue();
    return;
  }

  const intakeKey = target.dataset.intake;
  if (intakeKey) state.otherAnswers[intakeKey] = target.value;
});

/* Tidied on the way out rather than as it is typed: taking the trunk zero
   away mid-number reads as the box eating a keystroke. */
root.addEventListener(
  "blur",
  (event) => {
    if (!event.target.matches("[data-tidy]")) return;
    const tidied = tidyNational(state.contact.phone);
    state.contact.phone = tidied;
    event.target.value = tidied;
  },
  true,
);

/** Whether the name box just crossed between empty and not. */
let nameWasEmpty = true;
function nameGateMoved(value) {
  const isEmpty = value.trim() === "";
  if (isEmpty === nameWasEmpty) return false;
  nameWasEmpty = isEmpty;
  return true;
}

function focusField(selector, caret) {
  const field = root.querySelector(selector);
  if (!field) return;
  field.focus();
  if (typeof caret === "number") field.setSelectionRange(caret, caret);
}

/** Each message clears itself as its own field is answered. */
function clearFieldError(input) {
  input.removeAttribute("aria-invalid");
  const holder = input.closest("label, .bk-field");
  holder?.querySelector("[data-field-error]")?.remove();
}

/** Continue's own state, without redrawing the step around the caret. */
function refreshContinue() {
  const button = root.querySelector("[data-continue]");
  const line = root.querySelector(".bk-blocked");
  if (!button) return;
  const blocked = blockedReason();
  button.disabled = blocked !== null || state.isCheckingPostcode;
  button.textContent = state.isCheckingPostcode ? "Checking…" : "Continue";
  if (line) {
    line.textContent = blocked ?? "";
    line.toggleAttribute("data-error", blocked !== null && blocked === state.postcodeError);
  }
}

function handleSelectService(id) {
  pendingTreatmentSnap = true;
  state.serviceId = id;
  state.addonIds = state.addonIds.filter((addonId) =>
    ADDONS.find((a) => a.id === addonId)?.serviceIds.includes(id),
  );
  // Availability is per service, so a day free for the old one may not be
  // free for the new.
  state.date = null;
  state.time = null;
  render();
}

/**
 * Look the postcode up once typing has settled. Debounced because this
 * fires on every keystroke otherwise, and abandoned on the next keystroke
 * so a stale reply from a postcode since edited cannot land on the current
 * one.
 */
function schedulePostcodeLookup() {
  window.clearTimeout(postcodeTimer);
  const postcode = state.address.postcode;
  if (!postcode.trim()) return;

  postcodeTimer = window.setTimeout(async () => {
    const outcome = await lookupPostcode(postcode);
    // The box has moved on since this was asked.
    if (state.address.postcode !== postcode) return;
    // Silent on failure: Continue runs the check again and reports what
    // went wrong.
    if (outcome.error) return;

    state.addressCheck = outcome;

    // Take the tidied postcode, and the town the lookup knows — but only
    // over a box that is empty or that a previous lookup filled in.
    const takeTown =
      (!state.address.town.trim() || state.townFromLookup) && outcome.district !== "";
    state.address.postcode = outcome.postcode;
    if (takeTown) {
      state.address.town = outcome.district;
      state.townFromLookup = true;
    }

    // Written straight into the boxes rather than through a render, so a
    // lookup landing mid-form cannot take the caret out of whatever is
    // being typed into next.
    const postcodeBox = root.querySelector('[data-address="postcode"]');
    if (postcodeBox && document.activeElement !== postcodeBox) {
      postcodeBox.value = outcome.postcode;
    }
    const townBox = root.querySelector('[data-address="town"]');
    if (takeTown && townBox && document.activeElement !== townBox) {
      townBox.value = outcome.district;
      clearFieldError(townBox);
    }
    refreshContinue();
  }, 500);
}

/* ============================================================
   MOVING ON
   ============================================================ */

async function goForward() {
  if (state.step === STEP_DETAILS) {
    await continueFromDetails();
    return;
  }
  state.step += 1;
  render();
}

/**
 * Leaving the details step. The postcode is settled here rather than by a
 * button of its own: if it has not been looked up yet, Continue waits for
 * the lookup, and a postcode outside the area we travel to stops the step
 * with a dialog instead of moving on.
 */
async function continueFromDetails() {
  if (state.isCheckingPostcode) return;

  // Continue is what asks for the missing answers: it names them in place
  // rather than moving on, so the form is never left silently refusing.
  const problems = detailsErrors(state.contact, state.address, needsAddress());
  if (Object.keys(problems).length > 0) {
    state.showDetailsErrors = true;
    render();
    return;
  }
  state.showDetailsErrors = false;

  if (!needsAddress()) {
    state.step += 1;
    render();
    return;
  }

  let verdict = state.addressCheck;

  if (!verdict) {
    state.isCheckingPostcode = true;
    refreshContinue();
    const outcome = await lookupPostcode(state.address.postcode);
    state.isCheckingPostcode = false;

    if (outcome.error) {
      state.postcodeError = outcome.error;
      refreshContinue();
      return;
    }
    verdict = outcome;
    state.addressCheck = verdict;
  }

  state.postcodeError = null;

  if (!verdict.inServiceArea) {
    openServiceArea();
    refreshContinue();
    return;
  }

  state.step += 1;
  render();
}

/* ============================================================
   DIALOGS
   ============================================================ */

const policyDialog = document.querySelector("[data-policy-dialog]");
const areaDialog = document.querySelector("[data-area-dialog]");
const policyAck = policyDialog.querySelector("[data-ack]");
const policyGo = policyDialog.querySelector("[data-agree]");

function openPolicy() {
  // An acknowledgement carried over from a previous visit is not one.
  policyAck.checked = false;
  policyGo.disabled = true;
  policyDialog.showModal();
}

policyAck.addEventListener("change", () => {
  policyGo.disabled = !policyAck.checked;
});

policyGo.addEventListener("click", () => {
  policyDialog.close();
  confirmBooking();
});

policyDialog.querySelector("[data-decline]").addEventListener("click", () => {
  policyDialog.close();
});

/* Escape is a decline, and it is left to close the dialog natively. */
policyDialog.addEventListener("close", () => {
  policyAck.checked = false;
  policyGo.disabled = true;
});

function openServiceArea() {
  areaDialog.showModal();
}

areaDialog.querySelector("[data-close]").addEventListener("click", () => {
  areaDialog.close();
});

/* ============================================================
   THE END OF THE ROAD

   In the real app this is where the card is taken and SimplyBook is asked
   to make the appointment. Here it makes a reference and shows the screen
   that would have followed, so the whole flow can be walked without any of
   it leaving the browser.
   ============================================================ */

function confirmBooking() {
  const service = selectedService();
  const addons = chosenAddons();

  state.booked = {
    // SimplyBook issues lower-case codes and the confirmation email quotes
    // them that way, so this one is shaped the same.
    code: Math.random().toString(36).slice(2, 10),
    serviceName: service.name,
    addons: addons.map((a) => ({ name: a.name })),
    minutes: addons.reduce((sum, a) => sum + a.duration, service.duration),
    date: state.date,
    time: state.time,
    amount: total(),
    currency: currency(),
  };

  render();
}

function resetFlow() {
  state.booked = null;
  state.step = STEP_TREATMENT;
  state.serviceId = null;
  state.addonIds = [];
  state.month = monthOf(bookingWindow(today).from);
  state.date = null;
  state.time = null;
  state.contact = {
    bookingFor: "",
    name: "",
    email: "",
    phone: "",
    recipient: "",
    recipientSex: "",
  };
  state.address = { house: "", line1: "", line2: "", town: "", postcode: "" };
  state.addressCheck = null;
  state.townFromLookup = false;
  state.otherAnswers = {};
  state.showDetailsErrors = false;
  state.postcodeError = null;
  nameWasEmpty = true;
  answeredStep = STEP_TREATMENT;
  render();
  document.querySelector(".bk-head")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

render();
