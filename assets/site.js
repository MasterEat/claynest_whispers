(() => {
  'use strict';
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#site-navigation');
  const mobile = matchMedia('(max-width: 767px)');
  const closeMenu = () => { toggle.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); toggle.setAttribute('aria-label', 'Άνοιγμα μενού'); };
  toggle.hidden = false;
  document.documentElement.classList.add('js');
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Κλείσιμο μενού' : 'Άνοιγμα μενού');
    nav.classList.toggle('is-open', open);
  });
  nav.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('click', e => { if (!e.target.closest('.site-header')) closeMenu(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { closeMenu(); toggle.focus(); }
  });
  document.addEventListener('focusin', e => { if (!e.target.closest('.site-header')) closeMenu(); });
  mobile.addEventListener('change', closeMenu);

  // Static metadata is authoritative for crawlers. This override makes domain migration
  // consistent in the browser; update static metadata and sitemap as documented too.
  const base = window.CLAYNEST_CONFIG?.canonicalBase;
  if (base) {
    const file = location.pathname.split('/').pop();
    const canonical = new URL(file && file !== 'index.html' ? file : '', base).href;
    document.querySelector('link[rel="canonical"]').href = canonical;
    document.querySelector('meta[property="og:url"]').content = canonical;
  }

  // Keep original image sources. A failed external image is never replaced by stock art.
  document.querySelectorAll('.site-main img:not(#modal-image)').forEach(image => {
    image.parentElement.classList.add('image-pending');
    const showUnavailable = () => {
      const parent = image.parentElement;
      parent.classList.remove('image-pending');
      if (parent.querySelector('.image-fallback')) return;
      parent.classList.add('image-unavailable');
      const note = document.createElement('span'); note.className = 'image-fallback';
      note.textContent = 'Η εικόνα δεν είναι διαθέσιμη αυτή τη στιγμή.';
      parent.append(note);
    };
    image.addEventListener('error', showUnavailable);
    image.addEventListener('load', () => { image.parentElement.classList.remove('image-unavailable', 'image-pending'); image.parentElement.querySelector('.image-fallback')?.remove(); });
    if (image.complete && !image.naturalWidth) showUnavailable();
    else if (image.complete) image.parentElement.classList.remove('image-pending');
  });

  const cards = [...document.querySelectorAll('.artwork-card')];
  const pills = [...document.querySelectorAll('[data-filter]')];
  pills.forEach(button => button.addEventListener('click', () => {
    const category = button.dataset.filter;
    document.querySelectorAll('.filter-pill').forEach(p => {
      const active = p === button;
      p.setAttribute('aria-pressed', String(active));
      p.classList.toggle('bg-primary', active); p.classList.toggle('text-on-primary', active);
      p.classList.toggle('bg-surface-container-high', !active); p.classList.toggle('text-on-surface', !active);
    });
    cards.forEach(card => { card.hidden = category !== 'all' && !card.dataset.category.split(/\s+/).includes(category); });
    document.querySelector('#filter-empty').classList.toggle('hidden', cards.some(card => !card.hidden));
  }));
  const modal = document.querySelector('#artwork-modal');
  if (modal) {
    let opener, previousOverflow;
    const close = () => {
      if (modal.hidden) return;
      modal.hidden = true;
      document.body.style.overflow = previousOverflow;
      document.querySelectorAll('[data-modal-inert]').forEach(el => { el.inert = false; el.removeAttribute('data-modal-inert'); });
      opener?.focus();
    };
    const open = card => {
      opener = card;
      ['title','materials','dimensions','year','status'].forEach(key => { document.querySelector(`#modal-${key}`).textContent = card.dataset[key] || '—'; });
      document.querySelector('#modal-cat').textContent = card.dataset.categoryName;
      document.querySelector('#modal-description').textContent = card.dataset.desc;
      const image = document.querySelector('#modal-image'); image.src = card.dataset.img; image.alt = card.querySelector('img').alt;
      document.querySelector('#modal-inquire-btn').href = `contact.html?artwork=${encodeURIComponent(card.dataset.title)}`;
      modal.hidden = false; previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
      // Inert siblings along the ancestor chain, leaving the dialog interactive.
      let current = modal;
      while (current.parentElement && current !== document.body) {
        [...current.parentElement.children].filter(el => el !== current && !el.inert && !['SCRIPT','STYLE'].includes(el.tagName)).forEach(el => { el.inert = true; el.setAttribute('data-modal-inert', ''); });
        current = current.parentElement;
      }
      modal.querySelector('[data-close-modal]').focus();
    };
    cards.forEach(card => {
      card.addEventListener('click', () => open(card));
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(card); } });
    });
    modal.querySelector('[data-close-modal]').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.addEventListener('keydown', e => {
      if (modal.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Tab') {
        const items = [...modal.querySelectorAll('a[href],button:not([disabled]),[tabindex="0"]')];
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  const form = document.querySelector('#contact-form');
  if (form) {
    const status = document.querySelector('#form-status');
    const submit = document.querySelector('#submit-btn');
    submit.disabled = false;
    const endpoint = window.CLAYNEST_CONFIG?.formspreeEndpoint || '';
    const configured = /^https:\/\/formspree\.io\/f\/[a-zA-Z0-9]+$/.test(endpoint) && !/YOUR_FORM_ID|placeholder/i.test(endpoint);
    if (configured) { document.querySelector('#form-setup-note').hidden = true; form.action = endpoint; }
    else submit.setAttribute('aria-describedby', 'form-setup-note');
    const artwork = new URLSearchParams(location.search).get('artwork');
    if (artwork) form.elements.artwork.value = artwork.slice(0, 200);
    let pending = false;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (pending || !form.reportValidity()) return;
      if (!configured) { status.textContent = 'Η φόρμα δεν έχει ακόμη ενεργοποιηθεί. Επικοινωνήστε μέσω Instagram.'; status.focus(); return; }
      pending = true; submit.disabled = true; form.setAttribute('aria-busy', 'true');
      status.textContent = 'Αποστολή μηνύματος…';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' }, signal: controller.signal });
        const result = await response.json();
        if (!response.ok || result.ok !== true) throw new Error('Submission rejected');
        status.textContent = 'Το μήνυμά σας στάλθηκε επιτυχώς. Ευχαριστούμε για την επικοινωνία.';
        form.reset();
      } catch {
        status.textContent = 'Η αποστολή δεν επιβεβαιώθηκε. Τα στοιχεία σας διατηρούνται στη φόρμα. Ελέγξτε τη σύνδεσή σας ή επικοινωνήστε μέσω Instagram.';
      } finally {
        clearTimeout(timeout); pending = false; submit.disabled = false; form.removeAttribute('aria-busy'); status.focus();
      }
    });
  }
})();
