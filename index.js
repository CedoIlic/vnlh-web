// =====================================================
// index.js
// Dinamičko generiranje tipki na index.html iz SQL tablice "meni"
//
// Izvor podataka:
//   php/meni_list_index.php?device=0 — svi aktivni redovi; filtriranje device 1/2 u pregledniku (640px).
//
// Pravila:
// - caption tipke = naziv
// - odredište = putanja + html_fajl
// - POVRATAK: u URL se dodaje ref = postojeći ?ref= ove stranice ili pathname (vidi vnlhRefZaLinkSljedecaStranica u 0-Common.js)
// - ref iz baze spremi se kao data-ref i šalje kao mref (opcionalno, korisno za debug)
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
  const API_LIST = 'php/meni_list_index.php';

  /** Cijeli JSON nakon jednog GET-a (device=0). */
  let indexMeniItemsRaw = null;
  /** Izbjegni crtanje kad se mobitel/desktop nije promijenio pri istoj širinskoj skupini. */
  let indexMeniLastIsMobile = null;

  const wrap = document.getElementById('meniButtons');
  const statusEl = document.getElementById('meniStatus');

  function setStatus(t) {
    if (!statusEl) return;
    statusEl.textContent = t || '';
  }

  function safeStr(v) {
    return String(v ?? '').trim();
  }

  function joinPath(putanja, fajl) {
    if (typeof window.vnlhJoinAppRelativePath === 'function') {
      return window.vnlhJoinAppRelativePath(putanja, fajl);
    }
    let p = safeStr(putanja).replace(/\\/g, '/').replace(/^\/+/, '');
    let f = safeStr(fajl).replace(/\\/g, '/').replace(/^\/+/, '');
    if (!f) return '';
    if (f.includes('/')) return f;
    if (!p) return f;
    if (!p.endsWith('/')) p += '/';
    return p + f;
  }

  function withReturnRef(relPath, returnToPath, menuRef) {
    if (!relPath) return relPath;

    const path =
      typeof window.vnlhBuildMenuTargetHref === 'function'
        ? window.vnlhBuildMenuTargetHref(relPath)
        : relPath;
    if (!path || path === '#') return relPath;

    const u = new URL(path, window.location.origin);
    u.searchParams.set('ref', returnToPath);
    if (menuRef) u.searchParams.set('mref', menuRef);
    return u.pathname + (u.search || '') + (u.hash || '');
  }

  function makeBtn(item) {
    const naziv = safeStr(item.naziv);
    const menuRef = safeStr(item.ref);
    const hrefRaw = joinPath(item.putanja, item.html_fajl);

    if (!naziv || !hrefRaw) return null;

    const returnTo =
      typeof window.vnlhRefZaLinkSljedecaStranica === 'function'
        ? window.vnlhRefZaLinkSljedecaStranica('/')
        : window.location.pathname || '/';

    const href = withReturnRef(hrefRaw, returnTo, menuRef);

    const a = document.createElement('a');
    a.className = 'kontrola-btn';
    a.href = href;

    const label = document.createElement('span');
    label.className = 'kontrola-btn__label';
    label.textContent = naziv;

    const inner = document.createElement('span');
    inner.className = 'kontrola-btn__inner';
    inner.appendChild(label);

    const outer = document.createElement('span');
    outer.className = 'kontrola-btn__outer';
    outer.appendChild(inner);

    a.appendChild(outer);
    if (menuRef) a.dataset.ref = menuRef;
    a.title = hrefRaw;

    return a;
  }

  function parsirajDeviceStupanjMeniIndex(item) {
    if (!item || item.device == null || item.device === '') return 0;
    const x = parseInt(String(item.device), 10);
    return Number.isNaN(x) ? 0 : x;
  }

  function indexJeUskiViewport() {
    return window.matchMedia('(max-width: 640px)').matches;
  }

  /** Na mobitelu bez device===1 (samo desktop); na desktopu bez device===2 (samo mobitel). */
  function indexFiltrirajStavkeZaViewport(items) {
    const mob = indexJeUskiViewport();
    return (items || []).filter((it) => {
      const dv = parsirajDeviceStupanjMeniIndex(it);
      if (mob) return dv !== 1;
      return dv !== 2;
    });
  }

  let indexMeniResizeTimer = null;

  function indexPrimijeniFilterICrtaj() {
    if (!wrap) return;
    if (!indexMeniItemsRaw) {
      loadMeniIndex();
      return;
    }
    const filtered = indexFiltrirajStavkeZaViewport(indexMeniItemsRaw).filter((x) => safeStr(x.html_fajl) !== '');
    const sorted = [...filtered].sort((a, b) =>
      String(a.naziv || '').localeCompare(String(b.naziv || ''), 'hr')
    );
    wrap.innerHTML = '';
    if (sorted.length === 0) {
      setStatus('Nema stavki menija za prikaz.');
      indexMeniLastIsMobile = indexJeUskiViewport();
      return;
    }
    const frag = document.createDocumentFragment();
    sorted.forEach((item) => {
      const btn = makeBtn(item);
      if (btn) frag.appendChild(btn);
    });
    wrap.appendChild(frag);
    setStatus('');
    indexMeniLastIsMobile = indexJeUskiViewport();
  }

  async function loadMeniIndex() {
    if (!wrap) return;

    wrap.innerHTML = '';
    setStatus('Učitavam meni...');

    try {
      const r = await fetch(`${API_LIST}?device=${encodeURIComponent(0)}`, {
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (r.status === 401) {
        window.location.href =
          typeof window.vnlhLoginPageUrl === 'function'
            ? window.vnlhLoginPageUrl()
            : new URL('php/Login.php', window.location.href).href;
        return;
      }
      if (!r.ok) throw new Error('HTTP_' + r.status);

      const d = await r.json();
      if (!Array.isArray(d)) throw new Error('JSON_NOT_ARRAY');

      indexMeniItemsRaw = d;
      indexPrimijeniFilterICrtaj();
    } catch (e) {
      indexMeniItemsRaw = null;
      setStatus('Greška kod učitavanja menija.');
    }
  }

  loadMeniIndex();

  const mqIdx = window.matchMedia('(max-width: 640px)');
  function scheduleIndexMeniViewportRedraw() {
    const mob = indexJeUskiViewport();
    if (indexMeniLastIsMobile === mob && indexMeniItemsRaw != null) return;
    if (indexMeniResizeTimer) clearTimeout(indexMeniResizeTimer);
    indexMeniResizeTimer = setTimeout(() => {
      indexMeniResizeTimer = null;
      indexPrimijeniFilterICrtaj();
    }, 200);
  }
  if (typeof mqIdx.addEventListener === 'function') {
    mqIdx.addEventListener('change', scheduleIndexMeniViewportRedraw);
  } else if (typeof mqIdx.addListener === 'function') {
    mqIdx.addListener(scheduleIndexMeniViewportRedraw);
  }
});
