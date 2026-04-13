// =====================================================
// index.js
// Dinamičko generiranje tipki na index.html iz SQL tablice "meni"
//
// Izvor podataka:
//   php/meni_list_index.php
//
// Pravila:
// - caption tipke = naziv
// - odredište = putanja + html_fajl
// - POVRATAK: u URL se dodaje ref = postojeći ?ref= ove stranice ili pathname (vidi vnlhRefZaLinkSljedecaStranica u 0-Common.js)
// - ref iz baze spremi se kao data-ref i šalje kao mref (opcionalno, korisno za debug)
// =====================================================

document.addEventListener('DOMContentLoaded', () => {

    const API_LIST = 'php/meni_list_index.php';

    const wrap = document.getElementById('meniButtons');
    const statusEl = document.getElementById('meniStatus');

    function setStatus(t) {
        if (!statusEl) return;
        statusEl.textContent = t || '';
    }

    function safeStr(v) {
        return String(v ?? '').trim();
    }

    // Spoji putanja + html_fajl u jedan relativni URL (iz roota aplikacije, ne http://localhost/)
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

    // Dodaj ref (povratna putanja) + opcionalno mref (ref iz baze)
    function withReturnRef(relPath, returnToPath, menuRef) {
        if (!relPath) return relPath;

        const path = typeof window.vnlhBuildMenuTargetHref === 'function'
            ? window.vnlhBuildMenuTargetHref(relPath)
            : relPath;
        if (!path || path === '#') return relPath;

        const u = new URL(path, window.location.origin);

        // ref = povratna putanja (npr. /vnlh/index.html ili /vnlh/)
        u.searchParams.set('ref', returnToPath);

        // mref = ref iz baze (nije obavezno, ali korisno)
        if (menuRef) u.searchParams.set('mref', menuRef);

        // vrati kao "site-root" putanju (bez origin)
        return u.pathname + (u.search || '') + (u.hash || '');
    }

    function makeBtn(item) {
        const naziv = safeStr(item.naziv);
        const menuRef = safeStr(item.ref);
        const hrefRaw = joinPath(item.putanja, item.html_fajl);

        if (!naziv || !hrefRaw) return null;

        const returnTo = typeof window.vnlhRefZaLinkSljedecaStranica === 'function'
            ? window.vnlhRefZaLinkSljedecaStranica('/')
            : (window.location.pathname || '/');

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

        // ref iz baze kao data-ref (debug / buduće)
        if (menuRef) a.dataset.ref = menuRef;

        // hint (korisno u testu)
        a.title = hrefRaw;

        return a;
    }

    async function loadMeni() {
        if (!wrap) return;

        wrap.innerHTML = '';
        setStatus('Učitavam meni...');

        try {
            const r = await fetch(API_LIST, { cache: 'no-store', credentials: 'same-origin' });
            if (r.status === 401) {
                window.location.href = typeof window.vnlhLoginPageUrl === 'function'
                    ? window.vnlhLoginPageUrl()
                    : new URL('php/Login.php', window.location.href).href;
                return;
            }
            if (!r.ok) throw new Error('HTTP_' + r.status);

            const d = await r.json();
            if (!Array.isArray(d)) throw new Error('JSON_NOT_ARRAY');

            // sigurnosno: preskoči "mrtve"
            let items = d.filter(x => safeStr(x.html_fajl) !== '');
            // sortiraj po abecednom redu naziva
            items = items.sort((a, b) => String(a.naziv || '').localeCompare(String(b.naziv || ''), 'hr'));

            if (items.length === 0) {
                setStatus('Nema stavki menija za prikaz.');
                return;
            }

            const frag = document.createDocumentFragment();
            items.forEach(item => {
                const btn = makeBtn(item);
                if (btn) frag.appendChild(btn);
            });

            wrap.appendChild(frag);
            setStatus('');

        } catch (e) {
            setStatus('Greška kod učitavanja menija.');
        }
    }

    loadMeni();

});
