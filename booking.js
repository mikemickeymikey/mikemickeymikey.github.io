// ── BOOKING WIDGET ───────────────────────────────────────────────────────────

const BOOKING_API = 'https://reservas-api-seven.vercel.app';

const BOATS = {
  1: { name: 'Capelli Tempest 625', seasonStart: '2026-05-18', seasonEnd: '2026-10-31', sunset: true },
  2: { name: 'Zodiac Medline II', seasonStart: '2026-05-18', seasonEnd: '2026-10-31', sunset: true },
  3: { name: 'Faeton 980 Sport', seasonStart: '2026-05-01', seasonEnd: '2026-10-31', sunset: false },
};

const TURNO_LABELS = {
  completo: { es: 'Día completo', en: 'Full day', ca: 'Dia complet' },
  manana: { es: 'Mañana', en: 'Morning', ca: 'Matí' },
  tarde: { es: 'Tarde', en: 'Afternoon', ca: 'Tarda' },
  sunset: { es: 'Sunset', en: 'Sunset', ca: 'Sunset' },
};

const BOOKING_MSG = {
  notAvailable: { es: 'No disponible', en: 'Not available', ca: 'No disponible' },
  loadingAvailability: { es: 'Comprobando disponibilidad...', en: 'Checking availability...', ca: 'Comprovant disponibilitat...' },
  networkError: { es: 'Error de conexión. Inténtalo de nuevo.', en: 'Connection error. Please try again.', ca: 'Error de connexió. Torna-ho a intentar.' },
  slotTaken: { es: 'Esta franja ya no está disponible.', en: 'This slot is no longer available.', ca: 'Aquesta franja ja no està disponible.' },
  retry: { es: 'Reintentar', en: 'Retry', ca: 'Torna-ho a intentar' },
  discountApplied: { es: 'descuento aplicado', en: 'discount applied', ca: 'de descompte aplicat' },
};

const WEEKDAY_LABELS = {
  es: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
  en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  ca: ['dl', 'dt', 'dc', 'dj', 'dv', 'ds', 'dg'],
};

const LOCALE_MAP = { es: 'es-ES', en: 'en-GB', ca: 'ca-ES' };

function bookingLang() {
  return (typeof currentLang !== 'undefined' && currentLang) ? currentLang : 'ca';
}

const bookingState = {
  step: 1,
  boatId: null,
  date: null,
  turno: null,
  precio: null,
  calendarMonth: null,
  notice: null,
  diasNoDisponibles: [],
  descuento: null,
  precioFinal: null,
  descuentoCodigo: null,
};

function pad2(n) { return String(n).padStart(2, '0'); }

function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayISO() {
  return toISODate(new Date());
}

// ── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const widget = document.getElementById('bookingWidget');
  if (!widget) return;

  document.querySelectorAll('.booking-boat-card').forEach(card => {
    card.addEventListener('click', () => selectBoat(Number(card.dataset.boatId)));
  });

  document.getElementById('calPrev').addEventListener('click', () => shiftCalendarMonth(-1));
  document.getElementById('calNext').addEventListener('click', () => shiftCalendarMonth(1));

  document.getElementById('bookingBack').addEventListener('click', () => goToStep(bookingState.step - 1));
  document.getElementById('bookingNext').addEventListener('click', handleNextClick);
  document.getElementById('bookingPayBtn').addEventListener('click', submitBooking);
  document.getElementById('bookingDiscountBtn').addEventListener('click', applyDescuento);
  document.getElementById('bookingDiscountCode').addEventListener('keydown', e => {
    if (e.key === 'Enter') applyDescuento();
  });

  if (typeof setLang === 'function') {
    const originalSetLang = setLang;
    window.setLang = function (lang) {
      originalSetLang(lang);
      refreshBookingLangDependentUI();
    };
  }

  goToStep(1);
});

function refreshBookingLangDependentUI() {
  if (bookingState.step === 2) renderCalendar();
  if (bookingState.step === 3) fetchAvailability();
  if (bookingState.step === 4 || bookingState.step === 5) renderSummary();
}

// ── GLOBAL ENTRY POINT (called from CTA buttons elsewhere on the page) ───────

function startBookingWithBoat(boatId, turnoHint) {
  bookingState.boatId = boatId;
  bookingState.date = null;
  bookingState.turno = null;
  bookingState.precio = null;
  bookingState.calendarMonth = null;
  markSelectedBoatCard();
  goToStep(2);
}

// ── STEP NAVIGATION ──────────────────────────────────────────────────────────

function goToStep(step) {
  bookingState.step = step;

  document.querySelectorAll('.booking-panel').forEach(panel => {
    panel.classList.toggle('active', Number(panel.dataset.panel) === step);
  });

  document.querySelectorAll('.booking-step').forEach(el => {
    const n = Number(el.dataset.step);
    el.classList.toggle('active', n === step);
    el.classList.toggle('done', n < step);
  });

  document.getElementById('bookingBack').hidden = step === 1;
  document.getElementById('bookingNext').hidden = step === 5;

  if (step === 2) fetchDiasDisponibles();
  if (step === 3) fetchAvailability();
  if (step === 4 || step === 5) renderSummary();

  if (step > 1) {
    setTimeout(() => {
      const section = document.getElementById('nauticmanager');
      if (section) {
        const headerHeight = document.getElementById('mainHeader')?.offsetHeight || 70;
        const y = section.getBoundingClientRect().top + window.scrollY - headerHeight;
        window.scrollTo({ behavior: 'smooth', top: y });
      }
    }, 50);
  }

  updateNextButtonState();
}

function handleNextClick() {
  if (bookingState.step === 4) {
    const form = document.getElementById('bookingForm');
    if (!form.reportValidity()) return;
  }
  goToStep(bookingState.step + 1);
}

function updateNextButtonState() {
  const nextBtn = document.getElementById('bookingNext');
  let enabled = false;
  switch (bookingState.step) {
    case 1: enabled = !!bookingState.boatId; break;
    case 2: enabled = !!bookingState.date; break;
    case 3: enabled = !!bookingState.turno; break;
    case 4: enabled = true; break;
    default: enabled = true;
  }
  nextBtn.disabled = !enabled;
}

// ── STEP 1: BOAT ─────────────────────────────────────────────────────────────

function selectBoat(boatId) {
  if (bookingState.boatId !== boatId) {
    bookingState.date = null;
    bookingState.turno = null;
    bookingState.precio = null;
    bookingState.calendarMonth = null;
    bookingState.diasNoDisponibles = [];
  }
  bookingState.boatId = boatId;
  markSelectedBoatCard();
  updateNextButtonState();
}

function markSelectedBoatCard() {
  document.querySelectorAll('.booking-boat-card').forEach(card => {
    card.classList.toggle('selected', Number(card.dataset.boatId) === bookingState.boatId);
  });
}

// ── STEP 2: CALENDAR ─────────────────────────────────────────────────────────

function seasonBounds() {
  const boat = BOATS[bookingState.boatId];
  const today = todayISO();
  return {
    min: boat.seasonStart > today ? boat.seasonStart : today,
    max: boat.seasonEnd,
  };
}

function shiftCalendarMonth(delta) {
  const m = bookingState.calendarMonth;
  bookingState.calendarMonth = new Date(m.getFullYear(), m.getMonth() + delta, 1);
  bookingState.diasNoDisponibles = [];
  fetchDiasDisponibles();
}

async function fetchDiasDisponibles() {
  if (!bookingState.boatId) return;

  if (!bookingState.calendarMonth) {
    const { min } = seasonBounds();
    const [y, mo] = min.split('-').map(Number);
    bookingState.calendarMonth = new Date(y, mo - 1, 1);
  }

  renderCalendar();

  const year = bookingState.calendarMonth.getFullYear();
  const month = bookingState.calendarMonth.getMonth() + 1;

  try {
    const res = await fetch(
      `${BOOKING_API}/api/dias-disponibles?barco_id=${bookingState.boatId}&year=${year}&month=${month}`
    );
    if (!res.ok) throw new Error('bad response');
    const data = await res.json();
    bookingState.diasNoDisponibles = data.diasNoDisponibles || [];
  } catch {
    bookingState.diasNoDisponibles = [];
  }

  renderCalendar();
}

function renderCalendar() {
  if (!bookingState.boatId) return;
  const lang = bookingLang();
  const { min, max } = seasonBounds();

  if (!bookingState.calendarMonth) {
    const [y, mo] = min.split('-').map(Number);
    bookingState.calendarMonth = new Date(y, mo - 1, 1);
  }

  const weekdaysEl = document.getElementById('calWeekdays');
  weekdaysEl.innerHTML = '';
  WEEKDAY_LABELS[lang].forEach(w => {
    const span = document.createElement('span');
    span.textContent = w;
    weekdaysEl.appendChild(span);
  });

  const monthDate = bookingState.calendarMonth;
  const monthLabel = document.getElementById('calMonthLabel');
  monthLabel.textContent = new Intl.DateTimeFormat(LOCALE_MAP[lang], { month: 'long', year: 'numeric' }).format(monthDate);

  const [minY, minM] = min.split('-').map(Number);
  const [maxY, maxM] = max.split('-').map(Number);
  document.getElementById('calPrev').disabled = monthDate.getFullYear() === minY && monthDate.getMonth() === minM - 1;
  document.getElementById('calNext').disabled = monthDate.getFullYear() === maxY && monthDate.getMonth() === maxM - 1;

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const leadingEmpty = (firstOfMonth.getDay() + 6) % 7; // Monday-first

  for (let i = 0; i < leadingEmpty; i++) {
    const empty = document.createElement('span');
    empty.className = 'booking-cal-day empty';
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    const iso = toISODate(d);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'booking-cal-day';
    btn.textContent = String(day);
    const disabled = iso < min || iso > max || bookingState.diasNoDisponibles.includes(iso);
    btn.disabled = disabled;
    if (iso === bookingState.date) btn.classList.add('selected');
    if (!disabled) btn.addEventListener('click', () => selectDate(iso));
    grid.appendChild(btn);
  }
}

function selectDate(iso) {
  bookingState.date = iso;
  bookingState.turno = null;
  bookingState.precio = null;
  renderCalendar();
  updateNextButtonState();
}

// ── STEP 3: TIME SLOTS ───────────────────────────────────────────────────────

async function fetchAvailability() {
  const lang = bookingLang();
  const statusEl = document.getElementById('bookingSlotsStatus');
  const grid = document.getElementById('bookingSlotsGrid');
  grid.innerHTML = '';
  statusEl.textContent = BOOKING_MSG.loadingAvailability[lang];

  try {
    const url = `${BOOKING_API}/api/disponibilidad?barco_id=${bookingState.boatId}&fecha=${bookingState.date}`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error('bad response');
    const data = await res.json();
    statusEl.textContent = bookingState.notice || '';
    bookingState.notice = null;

    const turnos = data.turnos || [];
    const stillValid = turnos.find(t => t.turno === bookingState.turno && t.disponible);
    if (stillValid) {
      bookingState.precio = stillValid.precio;
    } else {
      bookingState.turno = null;
      bookingState.precio = null;
    }
    renderSlots(turnos);
    updateNextButtonState();
  } catch (err) {
    statusEl.textContent = '';
    grid.innerHTML = '';
    const errBox = document.createElement('div');
    errBox.className = 'booking-error';
    errBox.textContent = BOOKING_MSG.networkError[bookingLang()];
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'booking-retry-btn';
    retryBtn.textContent = BOOKING_MSG.retry[bookingLang()];
    retryBtn.addEventListener('click', fetchAvailability);
    errBox.appendChild(document.createElement('br'));
    errBox.appendChild(retryBtn);
    grid.appendChild(errBox);
  }
}

function renderSlots(turnos) {
  const lang = bookingLang();
  const boat = BOATS[bookingState.boatId];
  const grid = document.getElementById('bookingSlotsGrid');
  grid.innerHTML = '';

  turnos
    .filter(t => boat.sunset || t.turno !== 'sunset')
    .forEach(t => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'booking-slot-btn';
      btn.disabled = !t.disponible;
      btn.dataset.turno = t.turno;

      const name = document.createElement('span');
      name.className = 'booking-slot-name';
      name.textContent = (TURNO_LABELS[t.turno] && TURNO_LABELS[t.turno][lang]) || t.turno;

      const price = document.createElement('span');
      price.className = 'booking-slot-price';
      price.textContent = t.disponible ? `${t.precio} €` : BOOKING_MSG.notAvailable[lang];

      btn.appendChild(name);
      btn.appendChild(price);

      if (t.disponible) {
        if (bookingState.turno === t.turno) btn.classList.add('selected');
        btn.addEventListener('click', () => selectSlot(t.turno, t.precio));
      }

      grid.appendChild(btn);
    });
}

function selectSlot(turno, precio) {
  bookingState.turno = turno;
  bookingState.precio = precio;
  bookingState.descuento = null;
  bookingState.precioFinal = null;
  bookingState.descuentoCodigo = null;
  document.querySelectorAll('.booking-slot-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.turno === turno);
  });
  updateNextButtonState();
}

// ── STEPS 4/5: SUMMARY ───────────────────────────────────────────────────────

function renderSummary() {
  const lang = bookingLang();
  const boat = BOATS[bookingState.boatId];
  const dateObj = bookingState.date ? new Date(`${bookingState.date}T00:00:00`) : null;
  const dateLabel = dateObj
    ? new Intl.DateTimeFormat(LOCALE_MAP[lang], { day: 'numeric', month: 'long', year: 'numeric' }).format(dateObj)
    : '—';
  const slotLabel = bookingState.turno
    ? ((TURNO_LABELS[bookingState.turno] && TURNO_LABELS[bookingState.turno][lang]) || bookingState.turno)
    : '—';

  document.querySelectorAll('.js-sum-boat').forEach(el => el.textContent = boat ? boat.name : '—');
  document.querySelectorAll('.js-sum-date').forEach(el => el.textContent = dateLabel);
  document.querySelectorAll('.js-sum-slot').forEach(el => el.textContent = slotLabel);

  if (bookingState.descuento && bookingState.precioFinal != null) {
    const badge = `<small class="booking-discount-badge">−${bookingState.descuento}% ${BOOKING_MSG.discountApplied[lang]}</small>`;
    document.querySelectorAll('.js-sum-total').forEach(el => {
      el.innerHTML = `<s>${bookingState.precio} €</s> ${bookingState.precioFinal} €${badge}`;
    });
  } else {
    const totalLabel = bookingState.precio != null ? `${bookingState.precio} €` : '—';
    document.querySelectorAll('.js-sum-total').forEach(el => el.textContent = totalLabel);
  }
}

async function applyDescuento() {
  const input = document.getElementById('bookingDiscountCode');
  const errorEl = document.getElementById('bookingDiscountError');
  const code = input.value.trim();
  if (!code) return;

  errorEl.hidden = true;

  try {
    const res = await fetch(
      `${BOOKING_API}/api/validar-descuento?codigo=${encodeURIComponent(code)}&fecha=${bookingState.date}`
    );
    if (!res.ok) throw new Error('bad response');
    const data = await res.json();

    if (data.valido) {
      bookingState.descuento = data.porcentaje;
      bookingState.precioFinal = Math.round(bookingState.precio * (1 - data.porcentaje / 100));
      bookingState.descuentoCodigo = code;
      errorEl.hidden = true;
    } else {
      bookingState.descuento = null;
      bookingState.precioFinal = null;
      bookingState.descuentoCodigo = null;
      errorEl.hidden = false;
    }
  } catch {
    bookingState.descuento = null;
    bookingState.precioFinal = null;
    bookingState.descuentoCodigo = null;
    errorEl.hidden = false;
  }

  renderSummary();
}

// ── STEP 5: PAYMENT ──────────────────────────────────────────────────────────

function setPayLoading(loading) {
  const btn = document.getElementById('bookingPayBtn');
  const spinner = document.getElementById('bookingPaySpinner');
  btn.disabled = loading;
  spinner.hidden = !loading;
}

function showPayError(message, onRetry) {
  const box = document.getElementById('bookingPayError');
  box.innerHTML = '';
  box.hidden = false;
  const p = document.createElement('p');
  p.textContent = message;
  box.appendChild(p);
  if (onRetry) {
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'booking-retry-btn';
    retryBtn.textContent = BOOKING_MSG.retry[bookingLang()];
    retryBtn.addEventListener('click', onRetry);
    box.appendChild(retryBtn);
  }
}

function hidePayError() {
  const box = document.getElementById('bookingPayError');
  box.hidden = true;
  box.innerHTML = '';
}

async function submitBooking() {
  hidePayError();
  setPayLoading(true);

  const form = document.getElementById('bookingForm');
  const data = new FormData(form);

  const payload = {
    barco_id: bookingState.boatId,
    fecha: bookingState.date,
    turno: bookingState.turno,
    precio_pagado: bookingState.precioFinal ?? bookingState.precio,
    descuento_codigo: bookingState.descuentoCodigo ?? null,
    nombre: data.get('nombre'),
    email: data.get('email'),
    telefono: data.get('telefono'),
    dni: data.get('dni'),
    direccion: data.get('direccion'),
    ciudad: data.get('ciudad'),
    codigo_postal: data.get('codigo_postal'),
    pais: data.get('pais'),
  };

  try {
    const res = await fetch(`${BOOKING_API}/api/crear-reserva`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 409) {
      setPayLoading(false);
      bookingState.notice = BOOKING_MSG.slotTaken[bookingLang()];
      goToStep(3);
      return;
    }

    if (!res.ok) throw new Error('bad response');

    const result = await res.json();
    submitToRedsys(result.form);
  } catch (err) {
    setPayLoading(false);
    showPayError(BOOKING_MSG.networkError[bookingLang()], submitBooking);
  }
}

function submitToRedsys({ url, body }) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  Object.entries(body).forEach(([key, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}
