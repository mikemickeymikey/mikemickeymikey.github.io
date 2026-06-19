// ── TRANSLATIONS ─────────────────────────────────────────────────────────────

const LANGS = ['ca', 'en', 'es'];
let currentLang = 'ca';

function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  currentLang = lang;
  localStorage.setItem('mb_lang', lang);
  document.documentElement.lang = lang;

  // Translate all data-* elements
  document.querySelectorAll('[data-' + lang + ']').forEach(el => {
    el.textContent = el.getAttribute('data-' + lang);
  });

  // Active lang button
  LANGS.forEach(l => {
    const btn = document.getElementById('btn-' + l);
    if (btn) btn.classList.toggle('active', l === lang);
  });

  // Update ticker
  buildTicker(lang);
}

// Apply saved or default lang on load
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('mb_lang');
  const lang = (saved && LANGS.includes(saved)) ? saved : 'ca';
  setLang(lang);
  initHeader();
  buildTicker(lang);
});

// ── HEADER SCROLL ────────────────────────────────────────────────────────────

function initHeader() {
  const header = document.getElementById('mainHeader');
  if (!header) return;
  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 55);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ── TICKER ───────────────────────────────────────────────────────────────────

const tickerPhrases = {
  ca: ['birreta?', "quin color te l'aigua tuu", 'miraa! peixets!', 'fot-li gas', "l'aigua està bonissima", 'posem musiqueta'],
  es: ['¿birra?', 'qué color tiene el agua tío', '¡mira! ¡pececitos!', 'dale caña', 'el agua está buenísima', 'ponemos musiquita'],
  en: ['beer?', 'the water looks insane bro', 'look! fishies!', 'floor it!', 'the water is amazing', "let's put some music on"],
};

function buildTicker(lang) {
  const track = document.getElementById('tickerTrack');
  if (!track) return;
  const phrases = tickerPhrases[lang] || tickerPhrases.ca;
  const items = phrases.flatMap(p => [
    { text: p, cls: 'ticker-item' },
    { text: '✦', cls: 'ticker-sep' },
    { text: 'Mambo Boats', cls: 'ticker-brand' },
    { text: '✦', cls: 'ticker-sep' },
  ]);
  const doubled = [...items, ...items];
  track.innerHTML = doubled.map(item =>
    `<span class="${item.cls}">${item.text}</span>`
  ).join('');
}

// ── FAQ ACCORDION ─────────────────────────────────────────────────────────────

function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  const isOpen = item.classList.contains('open');
  // Close all
  document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
  // Open clicked if it was closed
  if (!isOpen) item.classList.add('open');
}

// ── MODALS ────────────────────────────────────────────────────────────────────

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(e, id) {
  // Only close if clicking the overlay itself (not the modal box)
  if (e.target !== e.currentTarget) return;
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

// Close modals on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(modal => {
      modal.classList.remove('active');
    });
    document.body.style.overflow = '';
  }
});

// ── SMOOTH SCROLL FOR ANCHOR LINKS ───────────────────────────────────────────

document.addEventListener('click', e => {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;
  const id = link.getAttribute('href').slice(1);
  const target = document.getElementById(id);
  if (!target) return;
  e.preventDefault();
  window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 76, behavior: 'smooth' });
  // Close mobile nav if open
  const nav = document.getElementById('mainNavbar');
  if (nav && nav.classList.contains('show')) {
    const toggle = document.querySelector('.navbar-toggler');
    if (toggle) toggle.click();
  }
});
