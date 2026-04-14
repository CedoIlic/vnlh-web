// ====================== POČETAK: APP MENU (RESPONSIVE + 4 RAZINE) ======================
(() => {
  const MENU = [
    { label: "Početna", href: "#" },
    { label: "Postavke", children: [
      { label: "Profil", href: "#" },
      { label: "Sigurnost", children: [
        { label: "Lozinka", href: "#" },
        { label: "2FA", children: [
          { label: "SMS", href: "#" },
          { label: "Authenticator", href: "#" },
          { label: "Backup kodovi", href: "#" },
        ]},
        { label: "Sesije", href: "#" },
      ]},
      { label: "Tema", children: [
        { label: "Svijetla", href: "#" },
        { label: "Tamna", href: "#" },
      ]},
    ]},
    { label: "Dokumenti", children: [
      { label: "Izvještaji", href: "#" },
      { label: "Arhiva", href: "#" },
    ]},
    { label: "Kontakt", href: "#" },
  ];

  function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // Elements
  const desktopBar = document.getElementById("appDesktopBar");
  const hamburger = document.getElementById("appHamburger");
  const overlay = document.getElementById("appOverlay");
  const drawer = document.getElementById("appDrawer");
  const dClose = document.getElementById("appClose");
  const dBack = document.getElementById("appBack");
  const dTitle = document.getElementById("appTitle");
  const dList = document.getElementById("appList");

  if (!desktopBar || !hamburger || !overlay || !drawer || !dClose || !dBack || !dTitle || !dList) {
    // Ako nešto fali u HTML-u, ne rušimo stranicu.
    return;
  }

  // ===== Desktop build (dropdown klikom, do 4 razine) =====
  function buildDesktop(items, depth=1){
    const ul = document.createElement("ul");
    ul.className = depth === 1 ? "app-bar" : "app-sub";
    items.forEach(item => {
      const li = document.createElement("li");
      const hasChildren = !!(item.children && item.children.length);

      if (hasChildren) {
        li.classList.add("app-node");
        li.dataset.open = "false";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.innerHTML = `${esc(item.label)} <span class="app-caret">${depth===1 ? "▾" : "▸"}</span>`;
        btn.setAttribute("aria-expanded","false");

        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isOpen = li.dataset.open === "true";
          closeAllDesktop(li);
          li.dataset.open = String(!isOpen);
          btn.setAttribute("aria-expanded", String(!isOpen));
        });

        li.appendChild(btn);
        li.appendChild(buildDesktop(item.children, depth+1));
      } else {
        const a = document.createElement("a");
        a.href = item.href || "#";
        a.textContent = item.label;
        li.appendChild(a);
      }

      ul.appendChild(li);
    });
    return ul;
  }

  function closeAllDesktop(except){
    desktopBar.querySelectorAll(".app-node[data-open='true']").forEach(li => {
      if (except && (li === except || li.contains(except))) return;
      li.dataset.open = "false";
      const btn = li.querySelector(":scope > button");
      if (btn) btn.setAttribute("aria-expanded","false");
    });
  }

  // inject desktop root
  desktopBar.replaceWith(buildDesktop(MENU, 1));
  // update reference after replace
  const newDesktopRoot = document.querySelector(".app-bar");

  document.addEventListener("click", (e) => {
    if (!newDesktopRoot.contains(e.target)) closeAllDesktop();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllDesktop();
      if (drawer.classList.contains("open")) closeDrawer();
    }
  });

  // ===== Mobile drill-down drawer =====
  const stack = [{ title: "Meni", items: MENU }];

  function renderMobile(){
    const cur = stack[stack.length - 1];
    dTitle.textContent = cur.title;
    dBack.style.visibility = (stack.length > 1) ? "visible" : "hidden";

    dList.innerHTML = cur.items.map(item => {
      const hasChildren = !!item.children?.length;
      const right = hasChildren ? `<span class="app-chev">›</span>` : ``;
      if (hasChildren){
        return `<button class="app-item" type="button" data-open="${esc(item.label)}">
                  <span>${esc(item.label)}</span>${right}
                </button>`;
      }
      return `<a class="app-item" href="${item.href || '#'}"><span>${esc(item.label)}</span></a>`;
    }).join("");

    dList.querySelectorAll("button[data-open]").forEach(btn => {
      btn.addEventListener("click", () => {
        const label = btn.getAttribute("data-open");
        const cur2 = stack[stack.length - 1];
        const found = cur2.items.find(x => x.label === label);
        if (!found?.children) return;
        stack.push({ title: found.label, items: found.children });
        renderMobile();
      });
    });
  }

  function openDrawer(){
    drawer.classList.add("open");
    overlay.classList.add("open");
    hamburger.setAttribute("aria-expanded","true");
    document.body.style.overflow = "hidden";
    // reset uvijek na root (preglednije)
    stack.splice(1);
    renderMobile();
    dClose.focus();
  }

  function closeDrawer(){
    drawer.classList.remove("open");
    overlay.classList.remove("open");
    hamburger.setAttribute("aria-expanded","false");
    document.body.style.overflow = "";
  }

  hamburger.addEventListener("click", openDrawer);
  dClose.addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer);
  dBack.addEventListener("click", () => { if (stack.length > 1) stack.pop(); renderMobile(); });

})();
// ====================== KRAJ: APP MENU (RESPONSIVE + 4 RAZINE) ======================

// --- Test chata (test.html): POST na php/test_chat_virtual_umetak.php ---
(function () {
  const btn = document.getElementById("testChatVirtualBtn");
  const inpPos = document.getElementById("testChatPosiljatelji");
  const inpBroj = document.getElementById("testChatPorukaPo");
  const inpInt = document.getElementById("testChatIntervalS");
  const out = document.getElementById("testChatVirtualRezultat");
  if (!btn || !inpPos || !inpBroj || !inpInt || !out) return;

  function apiUrl() {
    const p = window.location.pathname || "";
    if (/\/html\//i.test(p) || /\/html$/i.test(p)) return "../php/test_chat_virtual_umetak.php";
    return "php/test_chat_virtual_umetak.php";
  }

  btn.addEventListener("click", async function () {
    const pos = (inpPos.value || "").trim();
    const po = Math.max(1, Math.min(20, parseInt(String(inpBroj.value), 10) || 5));
    const intervalS = Math.max(0, Math.min(60, parseInt(String(inpInt.value), 10) || 0));
    if (!pos) {
      out.textContent = "Upiši barem jedan ID pošiljatelja.";
      return;
    }
    out.textContent =
      intervalS > 0
        ? "Šaljem (može potrajati zbog pauze između poruka; ne zatvaraj stranicu)…"
        : "Šaljem…";
    btn.disabled = true;
    try {
      const fd = new FormData();
      fd.append("posiljatelji", pos);
      fd.append("poruka_po", String(po));
      fd.append("interval_sekundi", String(intervalS));
      const r = await fetch(apiUrl(), {
        method: "POST",
        body: fd,
        credentials: "same-origin",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      const t = await r.text();
      let j;
      try {
        j = JSON.parse(t);
      } catch (e) {
        out.textContent = "Odgovor nije JSON (HTTP " + r.status + "):\n" + t.slice(0, 800);
        return;
      }
      if (j && j.ok) {
        out.textContent =
          "Uspjeh. Umetnuto poruka: " +
          j.ukupno +
          ".\nPrimatelj (ti): " +
          j.primatelj +
          ".\nPauza između poruka: " +
          (typeof j.interval_sekundi === "number" ? j.interval_sekundi : intervalS) +
          " s\n\n" +
          JSON.stringify(j.poruke, null, 2);
      } else {
        out.textContent = "Greška: " + (j && j.error ? j.error : t);
      }
    } catch (err) {
      out.textContent = "Mrežna greška: " + (err && err.message ? err.message : String(err));
    } finally {
      btn.disabled = false;
    }
  });
})();
