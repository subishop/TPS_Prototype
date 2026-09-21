/* Walks the single treatments booking flow end to end and checks that each
   step gates on what it is supposed to gate on. Added 2026-09-21 with the
   port of the booking app's flow onto single-treatments.html.

   Needs the network: the address step checks the postcode against
   postcodes.io for real, and two of the assertions below are about what it
   answers. A run with no network will fail on the address step, and that
   is a true failure of what this page does rather than noise. */
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';

const PAGE = 'single-treatments.html';

/* Bloomsbury: inside the M25, so the flow should pass. Exeter: plainly
   outside it, so the Service Area Notice should stop the step. Both are
   real postcodes, because the check is a real lookup. */
const IN_AREA = 'WC1N 1AL';
const OUT_OF_AREA = 'EX4 4QJ';

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });

const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : '<<< '} ${name}${ok || !detail ? '' : '  ' + detail}`);
}

/* Click the way a person does.

   Two things get in the way of a plain Playwright click on this page, and
   both are the design working rather than failing. The treatment and
   add-on inputs are screen-reader-only so the whole card stays the click
   target, so the card is what gets clicked. And the nav is fixed, so a
   control the page has scrolled under it is "visible" to Playwright and
   covered in fact; bringing the target to the middle of the window first
   is what a reader's own scrolling does. */
async function tap(locator) {
  await locator.evaluate((el) =>
    el.scrollIntoView({ block: 'center', behavior: 'instant' }),
  );
  await p.waitForTimeout(120);
  await locator.click();
}

/** The card standing in for a screen-reader-only radio or checkbox. */
const cardFor = (selector) => p.locator(selector).locator('xpath=..').locator('.bk-card');

const stepName = () => p.locator('[data-step-name]').innerText();
const blocked = () => p.locator('.bk-blocked').innerText();

await p.goto(pathToFileURL(PAGE).href, { waitUntil: 'load' });
await p.waitForSelector('.bk-services');

// Step one. Nothing is chosen, so Continue must refuse and say why.
check('step 1 refuses with no treatment',
  await p.locator('[data-continue]').isDisabled() &&
  (await blocked()).includes('Choose a treatment'));

// Choosing folds the rest away and opens the add-on.
await tap(cardFor('[data-service][value="2"]'));
await p.waitForTimeout(600);
check('choosing a treatment folds the others away',
  await p.locator('.bk-services > li[data-folded]').count() === 3);
check('the add-on appears with the treatment',
  await p.locator('[data-addon]').count() === 1);

// The total is the treatment plus whatever is ticked.
const totalNow = () => p.locator('.bk-total__value').innerText();
check('total reads the treatment alone', (await totalNow()) === '£120', await totalNow());
await tap(cardFor('[data-addon]'));
await p.waitForTimeout(400);
check('ticking the add-on moves the total', (await totalNow()) === '£160', await totalNow());

await tap(p.locator('[data-continue]'));
await p.waitForTimeout(700);
check('step 2 is the calendar', (await stepName()) === 'Choose a date and time');

// Step two. A date is needed, then a time, and each is named in turn.
check('step 2 refuses with no date', (await blocked()).includes('Choose a date'));
const firstOpen = p.locator('.bk-day:not([disabled])').first();
check('the calendar offers at least one date', await firstOpen.count() > 0);
await tap(firstOpen);
await p.waitForTimeout(700);
check('step 2 then refuses with no time', (await blocked()).includes('Choose a time'));
check('picking a date shows its times', await p.locator('.bk-time').count() > 0);

await tap(p.locator('.bk-time').first());
await p.waitForTimeout(500);
await tap(p.locator('[data-continue]'));
await p.waitForTimeout(700);
check('step 3 is the details form', (await stepName()) === 'Your details');

// Step three. The form is a ladder: only the name is asked until it is
// answered, and Continue names what is missing rather than moving on.
check('the form asks only for the name at first',
  await p.locator('[data-contact="bookingFor"]').count() === 0);
await tap(p.locator('[data-continue]'));
await p.waitForTimeout(400);
check('Continue names the missing name',
  (await p.locator('[data-field-error]').first().innerText()) === 'Enter your full name');

await p.locator('[data-contact="name"]').fill('Amara Osei');
await p.waitForTimeout(400);
check('the name opens the next question',
  await p.locator('[data-contact="bookingFor"]').count() === 2);

await tap(p.locator('[data-contact="bookingFor"][value="self"]'));
await p.waitForTimeout(300);
await tap(p.locator('[data-contact="recipientSex"][value="male"]'));
await p.waitForTimeout(300);
check('a male recipient is refused in place',
  (await p.locator('.bk-refusal').innerText()).includes('only available to women'));
check('the refusal closes the rest of the form',
  await p.locator('[data-contact="email"]').count() === 0);

await tap(p.locator('[data-contact="recipientSex"][value="female"]'));
await p.waitForTimeout(300);
check('answering female opens the rest of the form',
  await p.locator('[data-contact="email"]').count() === 1);

await p.locator('[data-contact="email"]').fill('amara@example.com');
await p.locator('[data-contact="phone"]').fill('07700900982');
await p.locator('[data-contact="phone"]').blur();
await p.waitForTimeout(300);
check('the phone is tidied on the way out',
  (await p.locator('[data-contact="phone"]').inputValue()) === '7700 900982',
  await p.locator('[data-contact="phone"]').inputValue());

await p.locator('[data-address="house"]').fill('14');
await p.locator('[data-address="line1"]').fill('Marchmont Street');

// The out-of-area postcode first: the lookup is real, and so is the refusal.
await p.locator('[data-address="postcode"]').fill(OUT_OF_AREA);
await p.waitForTimeout(2000);
check('the lookup fills the town in from the postcode',
  (await p.locator('[data-address="town"]').inputValue()) === 'Exeter',
  await p.locator('[data-address="town"]').inputValue());

await tap(p.locator('[data-continue]'));
await p.waitForTimeout(2000);
check('an out-of-area postcode opens the Service Area Notice',
  await p.locator('[data-area-dialog]').evaluate((d) => d.open));
check('and the step does not move on', (await stepName()) === 'Your details');

await p.locator('[data-area-dialog] [data-close]').click();
await p.locator('[data-address="postcode"]').fill(IN_AREA);
await p.waitForTimeout(2000);
await tap(p.locator('[data-continue]'));
await p.waitForTimeout(1500);
check('an in-area postcode passes the step', (await stepName()) === 'Review your booking');

// Step four. Everything chosen, read back, and the terms in the way.
const review = await p.locator('.bk-review').innerText();
check('the review states the treatment', review.includes('Postpartum massage'));
check('the review states the add-on', review.includes('Full body scrub'));
check('the review states the whole length', review.includes('90 minutes'), review.match(/\d+ minutes/)?.[0]);
check('the review states the dialled number', review.includes('+44 7700 900982'));
check('the review states the composed address', review.includes('14 Marchmont Street'));
check('the review totals the add-on in', review.includes('£160'));

await tap(p.locator('[data-open-policy]'));
await p.waitForTimeout(500);
check('Confirm opens the terms', await p.locator('[data-policy-dialog]').evaluate((d) => d.open));
check('and the terms hold the button until they are ticked',
  await p.locator('[data-agree]').isDisabled());

await p.locator('[data-ack]').check();
await p.waitForTimeout(300);
check('ticking the acknowledgement releases it',
  !(await p.locator('[data-agree]').isDisabled()));

await p.locator('[data-agree]').click();
await p.waitForTimeout(900);
check('the flow ends on the confirmation', await p.locator('.bk-done').count() === 1);
check('the confirmation carries a reference',
  /^[a-z0-9]{8}$/.test((await p.locator('.bk-done__ref').innerText()).trim()));
check('the confirmation names the add-on',
  (await p.locator('.bk-done__chips').innerText()).includes('Full body scrub'));

// The one thing this prototype must never fail to say.
check('the confirmation says nothing was booked',
  (await p.locator('.bk-proto').first().innerText()).includes('Nothing was booked'));

check('no page errors', errs.length === 0, errs.join(' | '));

await b.close();

const bad = checks.filter((c) => !c.ok);
console.log(
  bad.length
    ? `\n${bad.length} of ${checks.length} checks failed.`
    : `\nAll ${checks.length} checks passed: the flow gates, refuses and confirms as the booking app does.`,
);
process.exit(bad.length ? 1 : 0);
