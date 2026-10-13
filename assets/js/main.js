/* MC Karting: page behaviour: header, price board, booking and enquiries. */
(function () {
  'use strict';

  var WA_NUMBER = '27823217804';
  var EMAIL = 'janswanepoel69@yahoo.com';
  var PRICES = {
    single: { 5: 140, 10: 190, 15: 240, 20: 340, 30: 440 },
    double: { 5: 160, 10: 210, 15: 260, 20: 360, 30: 460 }
  };
  var LAPS = { 5: 10, 10: 20, 15: 30, 20: 40, 30: 60 };
  var KART_NAME = { single: 'Single kart', double: 'Double kart (two-seater)' };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- header ---------- */
  var header = $('[data-header]');
  // solid header once the top of the hero has scrolled away
  new IntersectionObserver(function (entries) { header.classList.toggle('is-solid', !entries[0].isIntersecting); }).observe($('[data-hero-sentinel]'));

  var toggle = $('[data-nav-toggle]');
  var nav = $('#site-nav');
  var setMenu = function (open) {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    header.classList.toggle('menu-open', open);
  };
  toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true'); });
  $$('a', nav).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- price board ---------- */
  var board = $('[data-board]');
  var boardNote = $('[data-board-note]');
  var NOTE = { single: 'One driver per kart.', double: 'Two-seater: ride together. Good for a parent with a younger child.' };
  var list = $('[data-board-list]');
  var tabs = $$('[data-kart-tab]');
  var currentKart = 'single';

  function renderBoard(kart) {
    list.innerHTML = Object.keys(PRICES[kart]).map(function (m) {
      return '<li class="lap"><span class="lap-time"><b>' + m + '</b> min</span>' +
        '<span class="lap-laps">about ' + LAPS[m] + ' laps</span>' +
        '<span class="lap-price">R' + PRICES[kart][m] + '</span>' +
        '<a class="lap-book" href="#book" data-pick-kart="' + kart + '" data-pick-mins="' + m + '">Book<span class="sr-only"> ' + m + ' minutes, ' + KART_NAME[kart] + '</span></a></li>';
    }).join('');
    boardNote.textContent = NOTE[kart];
  }
  function selectTab(kart, focus) {
    currentKart = kart;
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-kart-tab') === kart;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on) { board.setAttribute('aria-labelledby', t.id); if (focus) t.focus(); }
    });
    board.classList.add('is-switching');
    setTimeout(function () { renderBoard(kart); board.classList.remove('is-switching'); }, reduceMotion ? 0 : 160);
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t.getAttribute('data-kart-tab')); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        selectTab(next.getAttribute('data-kart-tab'), true);
      }
    });
  });
  renderBoard('single');

  /* ---------- booking ---------- */
  var form = $('[data-booking]');
  var ticket = $('[data-ticket]');
  var t = function (k) { return $('[data-t="' + k + '"]', ticket); };
  var dateIn = $('#b-date');
  var timeIn = $('#b-time');
  var kartsIn = $('#b-karts');

  function isoDate(d) { var z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); }
  var today = isoDate(new Date());
  dateIn.min = today;
  $('#e-date').min = today;

  function parseDate(v) { if (!v) return null; var p = v.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function prettyDate(d) { return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' }); }

  function readBooking() {
    var kart = (form.querySelector('[name="kart"]:checked') || {}).value || 'single';
    var mins = +((form.querySelector('[name="mins"]:checked') || {}).value || 10);
    var karts = Math.min(12, Math.max(1, parseInt(kartsIn.value, 10) || 1));
    var d = parseDate(dateIn.value);
    var friday = !!d && d.getDay() === 5;
    var bonus = friday && mins === 10;
    return { kart: kart, mins: mins, karts: karts, date: d, time: timeIn.value, friday: friday, bonus: bonus,
      each: PRICES[kart][mins], total: PRICES[kart][mins] * karts,
      driveMins: bonus ? 15 : mins, laps: bonus ? 30 : LAPS[mins] };
  }

  function updateTicket() {
    var b = readBooking();
    t('kart').textContent = KART_NAME[b.kart];
    t('mins').textContent = b.bonus ? '15 minutes (pay for 10)' : b.mins + ' minutes';
    t('laps').textContent = 'about ' + b.laps;
    t('karts').textContent = b.karts + (b.karts > 1 ? ' × R' + b.each : '');
    t('when').textContent = b.date ? prettyDate(b.date) + (b.time ? ', ' + b.time : '') : 'Pick a date';
    t('total').textContent = 'R' + b.total.toLocaleString('en-ZA');
    var bonusEl = t('bonus');
    if (b.bonus) {
      bonusEl.hidden = false; bonusEl.classList.remove('is-hint');
      bonusEl.textContent = 'Friday Madness: 5 extra minutes added free.';
    } else if (b.friday) {
      bonusEl.hidden = false; bonusEl.classList.add('is-hint');
      bonusEl.textContent = 'It’s a Friday. Choose 10 minutes to get 5 minutes free.';
    } else {
      bonusEl.hidden = true;
    }
  }
  form.addEventListener('input', updateTicket);
  form.addEventListener('change', updateTicket);
  $$('[data-step]', form).forEach(function (btn) {
    btn.addEventListener('click', function () {
      kartsIn.value = Math.min(12, Math.max(1, (parseInt(kartsIn.value, 10) || 1) + +btn.getAttribute('data-step')));
      updateTicket();
    });
  });

  function setRadio(name, value) {
    var r = form.querySelector('[name="' + name + '"][value="' + value + '"]');
    if (r) r.checked = true;
  }
  document.addEventListener('click', function (e) {
    var pick = e.target.closest('[data-pick-kart]');
    if (pick) {
      setRadio('kart', pick.getAttribute('data-pick-kart'));
      setRadio('mins', pick.getAttribute('data-pick-mins'));
      updateTicket();
    }
  });
  var fridayBtn = $('[data-friday-book]');
  fridayBtn.addEventListener('click', function () {
    var d = new Date();
    d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
    dateIn.value = isoDate(d);
    setRadio('mins', '10');
    setRadio('kart', currentKart);
    updateTicket();
  });

  function showError(f, msg, field) {
    var el = $('[data-form-error]', f);
    $$('.is-invalid', f).forEach(function (x) { x.classList.remove('is-invalid'); x.removeAttribute('aria-invalid'); });
    if (!msg) { el.hidden = true; return; }
    el.textContent = msg; el.hidden = false;
    if (field) { field.classList.add('is-invalid'); field.setAttribute('aria-invalid', 'true'); field.focus(); }
  }
  function validPhone(v) { return (v.replace(/\D/g, '').length >= 9); }

  $('[data-book-send]').addEventListener('click', function () {
    var b = readBooking();
    var name = $('#b-name'), phone = $('#b-phone');
    if (!b.date) return showError(form, 'Choose the date you want to race.', dateIn);
    if (dateIn.value < today) return showError(form, 'That date has passed. Choose today or a later date.', dateIn);
    if (!b.time) return showError(form, 'Choose a preferred time. We’ll confirm the closest open slot.', timeIn);
    if (!name.value.trim()) return showError(form, 'Add your name so we know who’s racing.', name);
    if (!validPhone(phone.value)) return showError(form, 'Add a cellphone number we can reply to.', phone);
    showError(form, '');
    var notes = $('#b-notes').value.trim();
    var msg = [
      'Hi MC Karting, I’d like to book a race.',
      '',
      'Kart: ' + KART_NAME[b.kart],
      'Time on track: ' + (b.bonus ? '10 minutes + 5 free (Friday Madness)' : b.mins + ' minutes'),
      'Number of karts: ' + b.karts,
      'Date: ' + prettyDate(b.date) + ' at ' + b.time,
      'Price shown: R' + b.total + ' (R' + b.each + ' per kart)',
      '',
      'Name: ' + name.value.trim(),
      'Cell: ' + phone.value.trim()
    ];
    if (notes) msg.push('Notes: ' + notes);
    window.open('https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg.join('\n')), '_blank', 'noopener');
  });
  updateTicket();

  /* ---------- events ---------- */
  var enquiry = $('[data-enquiry]');
  var typeSel = $('#e-type');
  var driversIn = $('#e-drivers');
  var RULES = {
    'Kiddies birthday party': { min: 10, msg: 'Kiddies birthday parties need at least 10 drivers.' },
    'Mini Grand Prix': { min: 4, max: 20, msg: 'A Mini Grand Prix is for 4 to 20 drivers. For more, choose Super Grand Prix.' },
    'Super Grand Prix': { min: 12, msg: 'A Super Grand Prix is for 12 drivers or more. For fewer, choose Mini Grand Prix.' }
  };

  $$('.slot').forEach(function (slot) {
    $('.slot-pick', slot).addEventListener('click', function () {
      typeSel.value = slot.getAttribute('data-event');
      var r = RULES[typeSel.value];
      if (r && (+driversIn.value < r.min)) driversIn.value = r.min;
      if (typeSel.value === 'Kiddies birthday party') $('#e-ages').value = 'Kids';
      enquiry.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      enquiry.classList.remove('flash'); void enquiry.offsetWidth; enquiry.classList.add('flash');
      setTimeout(function () { typeSel.focus({ preventScroll: true }); }, reduceMotion ? 0 : 600);
    });
  });

  enquiry.addEventListener('submit', function (e) {
    e.preventDefault();
    var via = (e.submitter && e.submitter.getAttribute('data-via')) || 'wa';
    var f = function (id) { return $('#' + id); };
    var date = f('e-date'), name = f('e-name'), phone = f('e-phone'), email = f('e-email');
    var n = parseInt(driversIn.value, 10);
    var rule = RULES[typeSel.value];
    if (!date.value) return showError(enquiry, 'Choose the date of your event.', date);
    if (date.value < today) return showError(enquiry, 'That date has passed. Choose today or a later date.', date);
    if (!n || n < 1) return showError(enquiry, 'Add how many drivers are coming.', driversIn);
    if (rule && (n < rule.min || (rule.max && n > rule.max))) return showError(enquiry, rule.msg, driversIn);
    if (!name.value.trim()) return showError(enquiry, 'Add your name so we know who to reply to.', name);
    if (!validPhone(phone.value)) return showError(enquiry, 'Add a cellphone number we can reply to.', phone);
    if (email.value && !email.checkValidity()) return showError(enquiry, 'Check the email address, or leave it empty.', email);
    showError(enquiry, '');

    var lines = [
      'Event: ' + typeSel.value,
      'Date: ' + prettyDate(parseDate(date.value)),
      'Drivers: ' + n + ' (' + f('e-ages').value.toLowerCase() + ')',
      'Name: ' + name.value.trim()
    ];
    if (f('e-org').value.trim()) lines.push('Company or school: ' + f('e-org').value.trim());
    lines.push('Cell: ' + phone.value.trim());
    if (email.value.trim()) lines.push('Email: ' + email.value.trim());
    if (f('e-notes').value.trim()) lines.push('Notes: ' + f('e-notes').value.trim());

    if (via === 'email') {
      var subject = 'Event enquiry: ' + typeSel.value + ', ' + n + ' drivers';
      var body = 'Hi MC Karting,\n\nI’d like a quote for an event.\n\n' + lines.join('\n') + '\n\nThank you.';
      window.location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    } else {
      var text = 'Hi MC Karting, I’d like a quote for an event.\n\n' + lines.join('\n');
      window.open('https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
    }
  });
})();
