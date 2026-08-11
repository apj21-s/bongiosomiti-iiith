(function () {
  "use strict";

  // =========================================================================
  // DOM & UTILITY HELPERS
  // =========================================================================
  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $all(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(isoStr) {
    if (!isoStr) return "N/A";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return isoStr;
    }
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    } catch {
      return dateStr;
    }
  }

  function formatCurrency(amount) {
    const num = Number(amount) || 0;
    return num === 0 ? "Free" : `₹${num.toLocaleString("en-IN")}`;
  }

  function showToast(message, type = "info") {
    let container = $(".utsav-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "utsav-toast-container";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `utsav-toast utsav-toast--${type}`;
    toast.innerHTML = `<span class="utsav-toast__icon">${type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("is-fading");
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  }

  function uniqueToken(prefix) {
    const p = (prefix || "UTSAV").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const time = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${p}-${time}-${rand}`;
  }

  // =========================================================================
  // UTSAV DATABASE (Client-Side LocalStorage Engine)
  // =========================================================================
  const STORAGE_KEYS = {
    EVENTS: "BONGIO.SOMITI:events",
    TICKETS: "BONGIO.SOMITI:tickets",
    CHECKINS: "BONGIO.SOMITI:checkins",
    AUTH: "BONGIO.SOMITI:auth"
  };

  const SEED_EVENTS = [
    {
      slug: "mahalaya",
      name: "Mahalaya Bhoj",
      date: "2026-10-12",
      dateFormatted: "12 Oct 2026",
      venue: "Community Courtyard",
      capacity: 120,
      price: 250,
      category: "Neighbourhood bhoj",
      description: "Shared tables, smoke, brass, and a warm autumn gathering built around authentic Bengali food, adda, and ritual warmth.",
      image: "assets/mahalaya-bhoj.svg",
      status: "OPEN"
    },
    {
      slug: "saraswati",
      name: "Saraswati Puja",
      date: "2027-01-21",
      dateFormatted: "21 Jan 2027",
      venue: "College Campus",
      capacity: 180,
      price: 250,
      category: "Campus celebration",
      description: "A serene campus procession with fresh yellow flowers, alpona, morning anjali, recitation, music, and student gathering.",
      image: "assets/saraswati-puja.svg",
      status: "OPEN"
    }
  ];

  const SEED_TICKETS = [
    {
      token: "MBH-DEMO-001",
      eventSlug: "mahalaya",
      eventName: "Mahalaya Bhoj",
      venue: "Community Courtyard",
      participantName: "Arka Mukhopadhyay",
      collegeId: "202401042",
      email: "arka.m@research.iiit.ac.in",
      phone: "+91 98765 43210",
      utr: "UPI-429810294812",
      amount: 250,
      createdAt: "2026-08-08T10:30:00.000Z",
      paymentStatus: "APPROVED",
      status: "UNUSED",
      gate: "Gate 1"
    },
    {
      token: "SPJ-DEMO-001",
      eventSlug: "saraswati",
      eventName: "Saraswati Puja",
      venue: "College Campus",
      participantName: "Ananya Sen",
      collegeId: "202402118",
      email: "ananya.sen@students.iiit.ac.in",
      phone: "+91 98301 22334",
      utr: "UPI-551920837412",
      amount: 250,
      createdAt: "2026-08-09T14:15:00.000Z",
      paymentStatus: "APPROVED",
      status: "UNUSED",
      gate: "Gate 2"
    },
    {
      token: "MBH-2026-USED1",
      eventSlug: "mahalaya",
      eventName: "Mahalaya Bhoj",
      venue: "Community Courtyard",
      participantName: "Debjit Roy",
      collegeId: "202301994",
      email: "debjit.roy@iiit.ac.in",
      phone: "+91 98111 55667",
      utr: "UPI-884920194821",
      amount: 250,
      createdAt: "2026-08-07T09:00:00.000Z",
      paymentStatus: "APPROVED",
      status: "USED",
      redeemedAt: "2026-08-10T11:45:00.000Z",
      redeemedGate: "Gate 1"
    },
    {
      token: "MBH-2026-PEND1",
      eventSlug: "mahalaya",
      eventName: "Mahalaya Bhoj",
      venue: "Community Courtyard",
      participantName: "Priyanka Banerjee",
      collegeId: "202401887",
      email: "priyanka.b@iiit.ac.in",
      phone: "+91 98777 66554",
      utr: "UPI-992817263541",
      amount: 250,
      createdAt: "2026-08-10T12:00:00.000Z",
      paymentStatus: "PENDING",
      status: "PENDING_PAYMENT",
      gate: "Gate 1"
    }
  ];

  const SEED_CHECKINS = [
    {
      id: "chk-1",
      token: "MBH-2026-USED1",
      participantName: "Debjit Roy",
      eventName: "Mahalaya Bhoj",
      gate: "Gate 1",
      timestamp: "2026-08-10T11:45:00.000Z"
    }
  ];

  const SEED_AUTH = {
    email: "admin@BONGIO.SOMITI.local",
    name: "IIIT Bongio Samiti Admin",
    role: "Organiser",
    loggedIn: true
  };

  const UtsavDB = {
    _read(key, defaultValue) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return defaultValue;
        return JSON.parse(raw);
      } catch {
        return defaultValue;
      }
    },
    _write(key, data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (err) {
        console.warn("Storage write failed", err);
      }
    },
    init() {
      if (!localStorage.getItem(STORAGE_KEYS.EVENTS)) {
        this._write(STORAGE_KEYS.EVENTS, SEED_EVENTS);
      }
      if (!localStorage.getItem(STORAGE_KEYS.TICKETS)) {
        this._write(STORAGE_KEYS.TICKETS, SEED_TICKETS);
      }
      if (!localStorage.getItem(STORAGE_KEYS.CHECKINS)) {
        this._write(STORAGE_KEYS.CHECKINS, SEED_CHECKINS);
      }
      if (!localStorage.getItem(STORAGE_KEYS.AUTH)) {
        this._write(STORAGE_KEYS.AUTH, SEED_AUTH);
      }
    },
    getEvents() {
      return this._read(STORAGE_KEYS.EVENTS, SEED_EVENTS);
    },
    getEvent(slug) {
      const events = this.getEvents();
      return events.find((e) => e.slug === slug) || null;
    },
    saveEvent(eventData) {
      const events = this.getEvents();
      const idx = events.findIndex((e) => e.slug === eventData.slug);
      if (idx >= 0) {
        events[idx] = { ...events[idx], ...eventData };
      } else {
        events.push(eventData);
      }
      this._write(STORAGE_KEYS.EVENTS, events);
      return eventData;
    },
    deleteEvent(slug) {
      const events = this.getEvents().filter((e) => e.slug !== slug);
      this._write(STORAGE_KEYS.EVENTS, events);
    },
    getTickets() {
      return this._read(STORAGE_KEYS.TICKETS, SEED_TICKETS);
    },
    getTicket(token) {
      if (!token) return null;
      const normalized = token.trim().toUpperCase();
      const tickets = this.getTickets();
      return tickets.find((t) => t.token.toUpperCase() === normalized) || null;
    },
    findTicketByAttendee(query) {
      if (!query) return null;
      const q = query.trim().toLowerCase();
      const tickets = this.getTickets();
      return tickets.find(
        (t) =>
          t.token.toLowerCase() === q ||
          (t.collegeId && t.collegeId.toLowerCase() === q) ||
          (t.email && t.email.toLowerCase() === q) ||
          (t.phone && t.phone.toLowerCase() === q)
      ) || null;
    },
    saveTicket(ticket) {
      const tickets = this.getTickets();
      const idx = tickets.findIndex((t) => t.token === ticket.token);
      if (idx >= 0) {
        tickets[idx] = { ...tickets[idx], ...ticket };
      } else {
        tickets.unshift(ticket);
      }
      this._write(STORAGE_KEYS.TICKETS, tickets);
      return ticket;
    },
    deleteTicket(token) {
      const tickets = this.getTickets().filter((t) => t.token !== token);
      this._write(STORAGE_KEYS.TICKETS, tickets);
    },
    updatePaymentStatus(token, status) {
      const ticket = this.getTicket(token);
      if (!ticket) return null;
      ticket.paymentStatus = status;
      if (status === "APPROVED") {
        ticket.status = ticket.status === "USED" ? "USED" : "UNUSED";
      } else if (status === "REJECTED") {
        ticket.status = "PAYMENT_REJECTED";
      } else {
        ticket.status = "PENDING_PAYMENT";
      }
      this.saveTicket(ticket);
      return ticket;
    },
    getCheckins() {
      return this._read(STORAGE_KEYS.CHECKINS, SEED_CHECKINS);
    },
    recordCheckin(ticket, gate = "Gate 1") {
      ticket.status = "USED";
      ticket.redeemedAt = new Date().toISOString();
      ticket.redeemedGate = gate;
      this.saveTicket(ticket);

      const checkins = this.getCheckins();
      const checkinEntry = {
        id: "chk-" + Date.now(),
        token: ticket.token,
        participantName: ticket.participantName || "Guest",
        eventName: ticket.eventName || "BONGIO.SOMITI",
        gate: gate,
        timestamp: new Date().toISOString()
      };
      checkins.unshift(checkinEntry);
      this._write(STORAGE_KEYS.CHECKINS, checkins);
      return checkinEntry;
    },
    undoCheckin(checkinId) {
      const checkins = this.getCheckins();
      const item = checkins.find((c) => c.id === checkinId);
      if (item) {
        const ticket = this.getTicket(item.token);
        if (ticket) {
          ticket.status = "UNUSED";
          delete ticket.redeemedAt;
          delete ticket.redeemedGate;
          this.saveTicket(ticket);
        }
      }
      const next = checkins.filter((c) => c.id !== checkinId);
      this._write(STORAGE_KEYS.CHECKINS, next);
    },
    getCouponRedemptions(code) {
      const key = "utsav_coupon_" + String(code).trim().toLowerCase() + "_count";
      const val = localStorage.getItem(key);
      return val ? parseInt(val, 10) : 0;
    },
    incrementCouponRedemptions(code) {
      const key = "utsav_coupon_" + String(code).trim().toLowerCase() + "_count";
      const current = this.getCouponRedemptions(code);
      localStorage.setItem(key, String(current + 1));
      return current + 1;
    },
    validateCoupon(code) {
      const normalized = String(code || "").trim().toLowerCase();
      if (!normalized) {
        return { valid: false, discount: 50, message: "Please enter a coupon code." };
      }
      if (normalized === "mahalaya26" || normalized === "saraswati27" || normalized === "saraswati26") {
        const couponKey = normalized === "saraswati26" ? "saraswati27" : normalized;
        const count = this.getCouponRedemptions(couponKey);
        if (count < 100) {
          return {
            valid: true,
            code: couponKey,
            discount: 50,
            message: "Coupon applied · ₹50 saved",
            remaining: 100 - count
          };
        } else {
          return {
            valid: false,
            code: couponKey,
            discount: 0,
            message: "This offer has ended (limit of 100 redemptions reached)."
          };
        }
      }
      return { valid: false, discount: 0, message: "Invalid coupon code." };
    },
    getStats() {
      const events = this.getEvents();
      const tickets = this.getTickets();
      const checkins = this.getCheckins();

      const totalRevenue = tickets.reduce((sum, t) => {
        if (t.paymentStatus === "APPROVED" && Number(t.amount)) {
          return sum + Number(t.amount);
        }
        return sum;
      }, 0);

      const verifiedCount = tickets.filter((t) => t.status === "USED" || t.paymentStatus === "APPROVED").length;
      const checkinCount = tickets.filter((t) => t.status === "USED").length;

      return {
        eventCount: events.length,
        ticketCount: tickets.length,
        revenue: totalRevenue,
        verifiedCount: verifiedCount,
        checkinCount: checkinCount
      };
    },
    getAuth() {
      return this._read(STORAGE_KEYS.AUTH, SEED_AUTH);
    },
    setAuth(authData) {
      this._write(STORAGE_KEYS.AUTH, authData);
    },
    resetDatabase() {
      this._write(STORAGE_KEYS.EVENTS, SEED_EVENTS);
      this._write(STORAGE_KEYS.TICKETS, SEED_TICKETS);
      this._write(STORAGE_KEYS.CHECKINS, SEED_CHECKINS);
      this._write(STORAGE_KEYS.AUTH, SEED_AUTH);
    }
  };

  // Initialize data store on load
  UtsavDB.init();

  // Make DB accessible for developer debugging in console
  window.UtsavDB = UtsavDB;

  // =========================================================================
  // 1. PRIMARY NAVIGATION & SCROLL
  // =========================================================================
  function initPrimaryNav() {
    const nav = $(".home-strip__nav");
    if (!nav) return;
    const links = $all(".home-strip__link", nav);
    const sections = links
      .map((link) => document.getElementById((link.getAttribute("href") || "").replace("#", "")))
      .filter(Boolean);

    const sync = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        links.forEach((link) => link.removeAttribute("aria-current"));
        const active = links.find((link) => link.getAttribute("href") === `#${hash}`);
        if (active) active.setAttribute("aria-current", "page");
        return;
      }

      if (window.scrollY < 180) {
        links.forEach((link) => {
          link.removeAttribute("aria-current");
          if (link.getAttribute("href") === "#home") link.setAttribute("aria-current", "page");
        });
      }
    };

    if ("IntersectionObserver" in window && sections.length) {
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
          if (!visible) return;
          links.forEach((link) => link.removeAttribute("aria-current"));
          const active = links.find((link) => link.getAttribute("href") === `#${visible.target.id}`);
          if (active) active.setAttribute("aria-current", "page");
        },
        { rootMargin: "-40% 0px -48% 0px", threshold: [0.08, 0.15, 0.28, 0.4, 0.55] }
      );
      sections.forEach((section) => observer.observe(section));
    }

    window.addEventListener("hashchange", sync);
    window.addEventListener("scroll", sync, { passive: true });
    sync();
  }

  // =========================================================================
  // 2. PHOTO ALBUM — dynamic grid builder + lightbox viewer
  // =========================================================================
  function initStoryGallery() {
    const albumEl = document.getElementById("photo-album");
    const lightbox = $(".story-lightbox");
    if (!albumEl || !lightbox) return;

    // ── 1. Read photo data from hidden <ul> ─────────────────────────────────
    const dataItems = $all("li", $(".photo-album__data", albumEl));
    if (dataItems.length === 0) return;

    const photos = dataItems.map((li) => ({
      src: li.dataset.src || "",
      alt: li.dataset.alt || "",
      title: li.dataset.title || li.dataset.alt || "",
      date: li.dataset.date || "",
      pos: li.dataset.pos || "center center",
    }));

    const total = photos.length;
    const VISIBLE = 4; // cells shown in the mosaic grid

    // ── 2. Update album count label ──────────────────────────────────────────
    // Convert number to Bengali digits
    function toBn(n) {
      return String(n).replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
    }
    const countEl = document.getElementById("photo-album-count");
    if (countEl) countEl.textContent = toBn(total) + "টি স্মৃতি";

    // ── 3. Build the mosaic grid ─────────────────────────────────────────────
    const grid = $(".photo-album__grid", albumEl);
    if (!grid) return;

    // Layout:
    //  [photo 0 — featured, left 62%] [side column right 38%]
    //                                    [photo 1]
    //                                    [photo 2]
    //                                    [photo 3 or "+N more"]

    // Helper: build an <img> element
    function makeImg(photo) {
      const img = document.createElement("img");
      img.className = "photo-album__img";
      img.src = photo.src;
      img.alt = photo.alt;
      img.style.objectPosition = photo.pos;
      return img;
    }

    // Helper: build the gradient caption overlay inside a photo cell
    function makeLabel(photo, hero) {
      const label = document.createElement("div");
      label.className = "photo-album__label";
      label.setAttribute("aria-hidden", "true");
      const titleEl = document.createElement("span");
      titleEl.className = "photo-album__label-title";
      titleEl.textContent = photo.title;
      label.appendChild(titleEl);
      if (photo.date) {
        const dateEl = document.createElement("span");
        dateEl.className = "photo-album__label-date";
        dateEl.textContent = photo.date;
        label.appendChild(dateEl);
      }
      return label;
    }

    // Helper: build a +N more overlay
    function makeMoreOverlay(n) {
      const overlay = document.createElement("div");
      overlay.className = "photo-album__more-overlay";
      overlay.setAttribute("aria-hidden", "true");
      const txt = document.createElement("span");
      txt.className = "photo-album__more-text";
      txt.textContent = "+" + n;
      overlay.appendChild(txt);
      return overlay;
    }

    const moreCount = total > VISIBLE ? total - VISIBLE : 0;

    // ── Hero cell (photo 0) ────────────────────────────────────────────────
    const hero = document.createElement("button");
    hero.type = "button";
    hero.className = "photo-album__hero scroll-reveal";
    hero.setAttribute("aria-label", photos[0].title + (photos[0].date ? " — " + photos[0].date : ""));
    hero.addEventListener("click", () => openLightbox(0));
    hero.appendChild(makeImg(photos[0]));
    hero.appendChild(makeLabel(photos[0], true));
    grid.appendChild(hero);

    // ── Thumb row (photos 1–3) ─────────────────────────────────────────────
    if (total > 1) {
      const thumbRow = document.createElement("div");
      thumbRow.className = "photo-album__thumb-row";

      const thumbCount = Math.min(3, total - 1);
      for (let i = 1; i <= thumbCount; i++) {
        const isLast = i === thumbCount;
        const showMore = isLast && moreCount > 0;
        const openIdx = showMore ? (VISIBLE - 1) : i;

        const thumb = document.createElement("button");
        thumb.type = "button";
        thumb.className = "photo-album__thumb scroll-reveal scroll-reveal--delay-" + i;
        thumb.setAttribute("aria-label", photos[i].title + (showMore ? " and " + moreCount + " more" : ""));
        thumb.addEventListener("click", () => openLightbox(openIdx));
        thumb.appendChild(makeImg(photos[i]));

        if (showMore) {
          thumb.appendChild(makeMoreOverlay(moreCount));
        } else {
          thumb.appendChild(makeLabel(photos[i], false));
        }

        thumbRow.appendChild(thumb);
      }

      grid.appendChild(thumbRow);
    }

    // Observe new cells for scroll-reveal
    [hero, ...$all(".photo-album__thumb", grid)].forEach((el) => {
      if (window.reobserveReveal) window.reobserveReveal(el);
    });

    // ── 4. Lightbox ─────────────────────────────────────────────────────────
    const lightboxImg = $(".story-lightbox__image", lightbox);
    const lightboxTitle = $(".story-lightbox__title", lightbox);
    const lightboxDate = $(".story-lightbox__date", lightbox);
    const lightboxCounter = $(".story-lightbox__counter", lightbox);
    const panel = $(".story-lightbox__panel", lightbox);
    const closeBtn = $(".story-lightbox__close", lightbox);
    const prevBtn = $(".story-lightbox__prev", lightbox);
    const nextBtn = $(".story-lightbox__next", lightbox);
    if (!lightboxImg) return;

    let current = 0;
    let touchStartX = 0;
    let touchStartY = 0;

    function updateCounter() {
      if (lightboxCounter) lightboxCounter.textContent = (current + 1) + " / " + total;
      if (prevBtn) {
        prevBtn.disabled = current <= 0;
        prevBtn.setAttribute("aria-disabled", current <= 0 ? "true" : "false");
      }
      if (nextBtn) {
        nextBtn.disabled = current >= total - 1;
        nextBtn.setAttribute("aria-disabled", current >= total - 1 ? "true" : "false");
      }
    }

    function renderActivePhoto(instant = false) {
      const p = photos[current];
      if (!p) return;

      updateCounter();

      if (instant) {
        lightboxImg.src = p.src;
        lightboxImg.alt = p.alt;
        if (lightboxTitle) lightboxTitle.textContent = p.title;
        if (lightboxDate) {
          lightboxDate.textContent = p.date || "";
          lightboxDate.style.display = p.date ? "" : "none";
        }
        lightboxImg.classList.remove("is-changing");
        return;
      }

      lightboxImg.classList.add("is-changing");
      setTimeout(() => {
        lightboxImg.src = p.src;
        lightboxImg.alt = p.alt;
        if (lightboxTitle) lightboxTitle.textContent = p.title;
        if (lightboxDate) {
          lightboxDate.textContent = p.date || "";
          lightboxDate.style.display = p.date ? "" : "none";
        }
        lightboxImg.classList.remove("is-changing");
      }, 90);
    }

    function goToPhoto(index) {
      if (index < 0 || index >= total) return;
      current = index;
      renderActivePhoto(false);
    }

    function goPrev() {
      if (current > 0) {
        goToPhoto(current - 1);
      }
    }

    function goNext() {
      if (current < total - 1) {
        goToPhoto(current + 1);
      }
    }

    function openLightbox(index) {
      current = Math.max(0, Math.min(index, total - 1));
      renderActivePhoto(true);
      lightbox.hidden = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          lightbox.classList.add("is-open");
        });
      });
      document.body.style.overflow = "hidden";
      closeBtn?.focus();
    }

    function closeLightbox() {
      lightbox.classList.remove("is-open");
      const done = () => {
        lightbox.hidden = true;
        lightbox.removeEventListener("transitionend", done);
      };
      lightbox.addEventListener("transitionend", done);
      document.body.style.overflow = "";
    }

    // Button event bindings (with stopPropagation so backdrop listener is not triggered)
    closeBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeLightbox();
    });

    prevBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      goPrev();
    });

    nextBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      goNext();
    });

    // Close only when clicking directly on the backdrop (outside panel & controls)
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) {
        closeLightbox();
      }
    });

    panel?.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    // Keyboard navigation
    window.addEventListener("keydown", (e) => {
      if (lightbox.hidden || !lightbox.classList.contains("is-open")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeLightbox();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    });

    // Touch swipe support (left = next, right = prev)
    lightbox.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    lightbox.addEventListener("touchend", (e) => {
      if (e.changedTouches.length === 1) {
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        // Check horizontal swipe gesture (at least 36px horizontal & more horizontal than vertical)
        if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0) goNext();
          else goPrev();
        }
      }
    }, { passive: true });
  }

  // =========================================================================
  // 3. REGISTRATION FORMS
  // =========================================================================
  function initRegistrationForms() {
    const forms = $all("form[data-vanilla-registration]");
    forms.forEach((form) => {
      const status = $(".form-status", form);
      const confContainer = $(".mahalaya-confirmation", form.parentElement) || $("#mahalaya-confirmation") || $("#saraswati-confirmation") || $(".registration-confirmation", form.parentElement);
      const formHeading = $(".mahalaya-card__registerHeader", form.parentElement) || $(".mahalaya-card__registerLabel", form.parentElement);

      const eventSlug = form.dataset.eventSlug || "general";
      const matchedEvent = UtsavDB.getEvent(eventSlug) || {};
      const isFreeEvent = matchedEvent.price === 0;

      // Affiliation switching: IIIT Hyderabad vs Outside
      const affiliationRadios = $all('input[name="is_iiit"]', form);
      const iiitFields = $("#iiit-fields", form);
      const outsideFields = $("#outside-fields", form);
      const rateDisplay = $("#rate-display", form);

      // Quantity & Pricing elements
      const numPassesSelect = $("#num_passes", form);
      const totalAmountDisplay = $("#total-amount-display", form);
      const payNowBtn = $("#pay-now-upi-btn", form);
      const qrBox = $("#mahalaya-qr-box", form) || $("#saraswati-qr-box", form);
      const copyUpiBtn = $("#copy-upi-btn", form);
      const upiIdText = "utsav.iiit@okhdfcbank";

      // Coupon elements
      const couponInput = $("#coupon_code", form);
      const applyCouponBtn = $("#apply-coupon-btn", form);
      const couponMessage = $("#coupon-message", form);
      const couponDiscountTag = $("#coupon-discount-tag", form);

      let appliedCoupon = null; // { code: 'mahalaya26', discount: 50 }

      function isIiitSelected() {
        const checked = $('input[name="is_iiit"]:checked', form);
        return !checked || checked.value === "yes";
      }

      function getPassPrice() {
        if (isFreeEvent) return 0;
        return isIiitSelected() ? 250 : 350;
      }

      function updateAffiliationView() {
        const isIiit = isIiitSelected();
        if (iiitFields && outsideFields) {
          if (isIiit) {
            iiitFields.style.display = "grid";
            outsideFields.style.display = "none";
            $("#full_name", form)?.setAttribute("required", "");
            $("#email", form)?.setAttribute("required", "");
            $("#phone", form)?.setAttribute("required", "");
            $("#college_id", form)?.setAttribute("required", "");
            $("#outside_full_name", form)?.removeAttribute("required");
            $("#outside_email", form)?.removeAttribute("required");
            $("#outside_phone", form)?.removeAttribute("required");
            $("#organization", form)?.removeAttribute("required");
            $("#city", form)?.removeAttribute("required");
          } else {
            iiitFields.style.display = "none";
            outsideFields.style.display = "grid";
            $("#outside_full_name", form)?.setAttribute("required", "");
            $("#outside_email", form)?.setAttribute("required", "");
            $("#outside_phone", form)?.setAttribute("required", "");
            $("#organization", form)?.setAttribute("required", "");
            $("#city", form)?.setAttribute("required", "");
            $("#full_name", form)?.removeAttribute("required");
            $("#email", form)?.removeAttribute("required");
            $("#phone", form)?.removeAttribute("required");
            $("#college_id", form)?.removeAttribute("required");
          }
        }
        if (rateDisplay) {
          rateDisplay.textContent = `₹${getPassPrice()} / pass`;
        }
        updateUpiCheckout();
      }

      affiliationRadios.forEach((radio) => {
        radio.addEventListener("change", updateAffiliationView);
      });

      let currentAmount = 0;

      function animateAmount(elem, from, to, duration = 240) {
        if (!elem) return;
        if (from === to || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          elem.textContent = formatCurrency(to);
          return;
        }
        const start = performance.now();
        function frame(now) {
          const progress = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 3);
          const val = Math.round(from + (to - from) * ease);
          elem.textContent = formatCurrency(val);
          if (progress < 1) {
            requestAnimationFrame(frame);
          }
        }
        requestAnimationFrame(frame);
      }

      function updateUpiCheckout(shouldAnimate = false) {
        const passes = parseInt(numPassesSelect?.value || "1", 10);
        const passPrice = getPassPrice();
        const subtotal = passes * passPrice;
        const discount = appliedCoupon ? appliedCoupon.discount : 0;
        const finalAmount = Math.max(0, subtotal - discount);

        if (totalAmountDisplay) {
          if (shouldAnimate && currentAmount !== finalAmount) {
            animateAmount(totalAmountDisplay, currentAmount, finalAmount);
          } else {
            totalAmountDisplay.textContent = formatCurrency(finalAmount);
          }
        }
        currentAmount = finalAmount;

        if (couponDiscountTag) {
          if (appliedCoupon && appliedCoupon.discount > 0) {
            couponDiscountTag.textContent = `✓ Coupon Applied (−₹${appliedCoupon.discount})`;
            couponDiscountTag.style.display = "block";
          } else {
            couponDiscountTag.style.display = "none";
          }
        }

        const noteText = `${matchedEvent.name || "Event"} Pass (${passes} attendee${passes > 1 ? "s" : ""}${appliedCoupon ? " - " + appliedCoupon.code : ""})`;
        const upiUri = `upi://pay?pa=${encodeURIComponent(upiIdText)}&pn=BANGIYA.SAMITI&am=${finalAmount}&cu=INR&tn=${encodeURIComponent(noteText)}`;

        if (payNowBtn) {
          payNowBtn.setAttribute("href", upiUri);
        }

        if (qrBox && typeof QRCode !== "undefined" && QRCode.toDataURL) {
          QRCode.toDataURL(upiUri, { width: 140, margin: 1, color: { dark: "#281208", light: "#ffffff" } })
            .then((dataUrl) => {
              qrBox.innerHTML = `<img src="${dataUrl}" alt="UPI Payment QR Code for ₹${finalAmount}" />`;
            })
            .catch(() => {
              qrBox.innerHTML = `<span style="font-size:0.7rem;color:#8c3b1a;">QR Code Ready</span>`;
            });
        }
      }

      if (numPassesSelect) {
        numPassesSelect.addEventListener("change", () => updateUpiCheckout(true));
      }

      // Coupon application handler
      applyCouponBtn?.addEventListener("click", () => {
        const rawCode = couponInput?.value || "";
        const result = UtsavDB.validateCoupon(rawCode);

        if (!couponMessage) return;

        if (result.valid) {
          appliedCoupon = { code: result.code, discount: result.discount };
          applyCouponBtn.textContent = "✓ APPLIED";
          applyCouponBtn.style.background = "#2b6e35";
          applyCouponBtn.style.color = "#ffffff";
          couponMessage.className = "mahalaya-coupon-msg mahalaya-coupon-msg--success";
          couponMessage.textContent = `✓ Coupon applied · ₹${result.discount} saved (${result.remaining} offer slots left)`;
          couponMessage.style.display = "block";
          showToast(`Coupon applied! Saved ₹${result.discount}`, "success");
        } else {
          appliedCoupon = null;
          applyCouponBtn.textContent = "APPLY";
          applyCouponBtn.style.background = "";
          applyCouponBtn.style.color = "";
          couponMessage.className = "mahalaya-coupon-msg mahalaya-coupon-msg--error";
          couponMessage.textContent = result.message;
          couponMessage.style.display = "block";
          showToast(result.message, "error");
        }
        updateUpiCheckout(true);
      });

      // Recalculate on coupon input clear
      couponInput?.addEventListener("input", () => {
        if (!couponInput.value.trim() && appliedCoupon) {
          appliedCoupon = null;
          if (applyCouponBtn) {
            applyCouponBtn.textContent = "APPLY";
            applyCouponBtn.style.background = "";
            applyCouponBtn.style.color = "";
          }
          if (couponMessage) couponMessage.style.display = "none";
          updateUpiCheckout(true);
        }
      });

      copyUpiBtn?.addEventListener("click", () => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(upiIdText).then(() => {
            showToast("UPI ID copied to clipboard: " + upiIdText, "success");
          });
        } else {
          showToast("UPI ID: " + upiIdText, "info");
        }
      });

      // Initial view setup
      updateAffiliationView();

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        
        // Remove previous validation highlights
        $all("input, select", form).forEach((el) => el.classList.remove("is-invalid"));

        const data = new FormData(form);
        const isIiit = data.get("is_iiit") !== "no";
        
        const fullName = String(
          isIiit ? data.get("full_name") || "" : data.get("outside_full_name") || ""
        ).trim();

        const email = String(
          isIiit ? data.get("email") || "" : data.get("outside_email") || ""
        ).trim();

        const phone = String(
          isIiit ? data.get("phone") || "" : data.get("outside_phone") || ""
        ).trim();

        const collegeId = isIiit
          ? String(data.get("college_id") || "").trim()
          : String(data.get("organization") || "").trim();

        const city = !isIiit ? String(data.get("city") || "").trim() : "";
        const utr = String(data.get("utr") || data.get("transaction_id") || "").trim();
        const numPasses = parseInt(data.get("num_passes") || "1", 10);
        const foodPref = String(data.get("food_pref") || "").trim();

        // Validation checks
        if (!fullName) {
          showToast("Please enter your full name.", "error");
          const el = isIiit ? $("#full_name", form) : $("#outside_full_name", form);
          el?.classList.add("is-invalid");
          el?.focus();
          return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          showToast("Please provide a valid email address.", "error");
          const el = isIiit ? $("#email", form) : $("#outside_email", form);
          el?.classList.add("is-invalid");
          el?.focus();
          return;
        }

        if (!phone || phone.replace(/\D/g, "").length < 10) {
          showToast("Please enter a valid 10-digit phone number.", "error");
          const el = isIiit ? $("#phone", form) : $("#outside_phone", form);
          el?.classList.add("is-invalid");
          el?.focus();
          return;
        }

        if (isIiit && !collegeId) {
          showToast("Please enter your IIIT Hyderabad Roll Number or ID.", "error");
          const el = $("#college_id", form);
          el?.classList.add("is-invalid");
          el?.focus();
          return;
        }

        if (!isIiit && !collegeId) {
          showToast("Please enter your College or Organization name.", "error");
          const el = $("#organization", form);
          el?.classList.add("is-invalid");
          el?.focus();
          return;
        }

        if (!isIiit && !city) {
          showToast("Please enter your City.", "error");
          const el = $("#city", form);
          el?.classList.add("is-invalid");
          el?.focus();
          return;
        }

        const eventSlug = form.dataset.eventSlug || "general";
        const matchedEvent = UtsavDB.getEvent(eventSlug) || {};

        if ((matchedEvent.price > 0 || eventSlug === "mahalaya" || eventSlug === "saraswati") && (!utr || utr.length < 6)) {
          showToast("Please complete payment and enter your 12-digit UPI UTR / Transaction reference number.", "error");
          const el = $("#utr", form);
          el?.classList.add("is-invalid");
          el?.focus();
          return;
        }

        const confirmCheck = $("#confirm_details", form);
        if (confirmCheck && !confirmCheck.checked) {
          showToast("Please confirm that your payment and registration details are accurate.", "error");
          confirmCheck.focus();
          return;
        }

        const passPrice = getPassPrice();
        const subtotal = numPasses * passPrice;
        const discount = appliedCoupon ? appliedCoupon.discount : 0;
        const totalAmount = Math.max(0, subtotal - discount);

        const prefix = form.dataset.ticketPrefix || (eventSlug.slice(0, 3).toUpperCase());

        const ticket = {
          token: uniqueToken(prefix),
          eventSlug: eventSlug,
          eventName: form.dataset.eventName || matchedEvent.name || "Mahalaya Bhoj",
          venue: form.dataset.eventVenue || matchedEvent.venue || "Community Courtyard",
          participantName: fullName,
          collegeId: collegeId + (city ? ` (${city})` : ""),
          phone: phone,
          email: email,
          numPasses: numPasses,
          isIiit: isIiit,
          couponCode: appliedCoupon ? appliedCoupon.code : "",
          discountAmount: discount,
          utr: utr || (matchedEvent.price === 0 ? "FREE-ENTRY" : "UTR-" + Math.floor(100000000000 + Math.random() * 900000000000)),
          amount: totalAmount,
          createdAt: new Date().toISOString(),
          paymentStatus: "PENDING",
          status: "UNUSED",
          gate: "Gate 1",
          notes: foodPref ? `${foodPref} (${numPasses} pass${numPasses > 1 ? "es" : ""})` : ""
        };

        // If coupon was applied, increment backend redemption count
        if (appliedCoupon && appliedCoupon.code) {
          UtsavDB.incrementCouponRedemptions(appliedCoupon.code);
        }

        UtsavDB.saveTicket(ticket);
        showToast(`Registration received! QR Pass will be dispatched to ${ticket.email} after verification.`, "success");

        // If inline confirmation is available, display it cleanly in the same parchment card
        if (confContainer) {
          form.style.display = "none";
          if (formHeading) formHeading.style.display = "none";

          const confName = $("#conf-name", confContainer);
          const confId = $("#conf-id", confContainer);
          const confEmail = $("#conf-email", confContainer);
          const confToken = $("#conf-token", confContainer);
          const confPasses = $("#conf-passes", confContainer);
          const confUtr = $("#conf-utr", confContainer);
          const resetBtn = $("#conf-reset-btn", confContainer);

          if (confName) confName.textContent = ticket.participantName;
          if (confId) confId.textContent = ticket.collegeId;
          if (confEmail) confEmail.textContent = ticket.email;
          if (confToken) confToken.textContent = ticket.token;
          if (confPasses) confPasses.textContent = `${numPasses} Pass${numPasses > 1 ? "es" : ""} (${formatCurrency(totalAmount)})`;
          if (confUtr) confUtr.textContent = ticket.utr;

          confContainer.style.display = "flex";

          resetBtn?.addEventListener("click", () => {
            confContainer.style.display = "none";
            form.reset();
            appliedCoupon = null;
            if (couponMessage) couponMessage.style.display = "none";
            updateAffiliationView();
            form.style.display = "block";
            if (formHeading) formHeading.style.display = "block";
          }, { once: true });

          return;
        }

        if (status) {
          status.className = "form-status form-status--success";
          status.innerHTML = `<strong>Registration submitted for verification!</strong><br>Generated Pass Token: <code>${ticket.token}</code><br>Your verified QR Pass will be emailed to <strong>${escapeHtml(ticket.email)}</strong>.`;
        }
      });
    });
  }

  // =========================================================================
  // 4. DIGITAL PASS PAGE (/pass/)
  // =========================================================================
  function initPassPage() {
    const root = $("[data-pass-page]");
    if (!root) return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || "MBH-DEMO-001";
    let ticket = UtsavDB.getTicket(token);

    if (!ticket) {
      ticket = {
        token: token,
        eventSlug: "general",
        eventName: "BONGIO.SOMITI",
        venue: "Campus Venue",
        participantName: "Guest Attendee",
        collegeId: "2026-GUEST",
        createdAt: new Date().toISOString(),
        paymentStatus: "APPROVED",
        status: "UNUSED"
      };
    }

    // Populate Pass Metadata
    $all(".pass-world__event", root).forEach((el) => (el.textContent = ticket.eventName || "BONGIO.SOMITI"));
    $all(".pass-world__venue", root).forEach((el) => (el.textContent = ticket.venue || "Campus Venue"));
    $all(".pass-world__attendee", root).forEach((el) => (el.textContent = ticket.participantName || "Guest"));
    $all(".pass-world__token", root).forEach((el) => (el.textContent = ticket.token));

    const dateNode = $(".pass-world__date", root);
    if (dateNode) dateNode.textContent = formatShortDate(ticket.createdAt);

    const statusBadge = $(".pass-world__status", root);
    if (statusBadge) {
      statusBadge.textContent = ticket.status;
      statusBadge.className = `badge pass-world__status badge--${ticket.status.toLowerCase()}`;
    }

    // Additional fields if pass template has them
    const collegeIdNode = $(".pass-world__collegeId", root);
    if (collegeIdNode) collegeIdNode.textContent = ticket.collegeId || "N/A";
    const phoneNode = $(".pass-world__phone", root);
    if (phoneNode) phoneNode.textContent = ticket.phone || "N/A";
    const utrNode = $(".pass-world__utr", root);
    if (utrNode) utrNode.textContent = ticket.utr || "Verified";

    // QR Code Frame
    const qrFrame = $(".pass-world__qr", root);
    if (qrFrame && window.QRCode?.toDataURL) {
      window.QRCode.toDataURL(ticket.token, { width: 240, margin: 2 }).then((url) => {
        const img = document.createElement("img");
        img.alt = `${ticket.eventName} QR Code for ${ticket.token}`;
        img.src = url;
        img.className = "pass-world__qrImage";
        qrFrame.replaceChildren(img);
      });
    }

    // Print Pass Action
    const printBtn = $(".pass-world__print", root);
    printBtn?.addEventListener("click", () => window.print());

    // Scanner shortcut
    const scanBtn = $(".pass-world__openScanner", root);
    scanBtn?.addEventListener("click", () => {
      window.location.href = `admin/scanner/index.html?token=${encodeURIComponent(ticket.token)}`;
    });

    // Pass Lookup Box (if present)
    const lookupForm = $(".pass-lookup-form", root);
    if (lookupForm) {
      lookupForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = $("#pass-lookup-input", lookupForm);
        const query = (input?.value || "").trim();
        const found = UtsavDB.findTicketByAttendee(query);
        if (found) {
          window.location.href = `pass/index.html?token=${encodeURIComponent(found.token)}`;
        } else {
          showToast("No pass found matching that token or ID.", "error");
        }
      });
    }
  }

  // =========================================================================
  // 5. GATE SCANNER PAGE (/admin/scanner/ & /scanner/)
  // =========================================================================
  function initScannerPage() {
    const root = $("[data-scanner-page]");
    if (!root) return;

    const video = $(".scan-video", root);
    const startButton = $(".scanner-start", root);
    const stopButton = $(".scanner-stop", root);
    const resetButton = $(".scanner-reset", root);
    const lookupButton = $(".scanner-lookup", root);
    const checkinButton = $(".scanner-checkin", root);
    const tokenInput = $("#scanner-token", root);
    const gateInput = $("#scanner-gate", root);
    const quickSelect = $("#scanner-quick-select", root);
    const status = $(".scanner-status", root);
    const detail = $(".scanner-detailCard", root);
    const message = $(".scanner-message", root);
    const resultName = $(".scanner-resultName", root);
    const resultMeta = $(".scanner-resultMeta", root);
    const resultPills = $all(".scanner-resultPill", root);

    let stream = null;
    let timer = null;
    let detector = null;
    let activeToken = "";
    let currentTicket = null;

    function setStatus(title, body) {
      if (!status) return;
      const titleNode = $(".scanner-status__title", status);
      const bodyNode = $(".scanner-status__body", status);
      if (titleNode) titleNode.textContent = title;
      if (bodyNode) bodyNode.textContent = body;
    }

    function populateQuickSelect() {
      if (!quickSelect) return;
      const tickets = UtsavDB.getTickets();
      quickSelect.innerHTML = `<option value="">-- Quick Test Preset Tokens --</option>` +
        tickets
          .map(
            (t) =>
              `<option value="${escapeHtml(t.token)}">${escapeHtml(t.token)} - ${escapeHtml(t.participantName)} (${escapeHtml(t.status)})</option>`
          )
          .join("");
    }
    populateQuickSelect();

    quickSelect?.addEventListener("change", () => {
      if (quickSelect.value) {
        if (tokenInput) tokenInput.value = quickSelect.value;
        lookupCurrent();
      }
    });

    function lookupTicket(token, eventSlug) {
      const ticket = UtsavDB.getTicket(token);
      if (!ticket) {
        return { outcome: "INVALID", message: "No pass found for this token in system records.", ticket: null };
      }
      if (eventSlug && ticket.eventSlug && ticket.eventSlug !== eventSlug && eventSlug !== "all") {
        return {
          outcome: "BLOCKED",
          message: `This pass is registered for ${ticket.eventName}, not ${eventSlug}.`,
          ticket
        };
      }
      if (ticket.status === "USED") {
        return {
          outcome: "ALREADY_USED",
          message: `Already checked in at ${ticket.redeemedGate || "Gate"} on ${formatDate(ticket.redeemedAt)}.`,
          ticket
        };
      }
      if (ticket.status === "PENDING_PAYMENT" || ticket.paymentStatus === "PENDING") {
        return {
          outcome: "PAYMENT_PENDING",
          message: `Payment verification is pending for UTR ${ticket.utr || "N/A"}.`,
          ticket
        };
      }
      return { outcome: "VALID", message: "Pass verified & valid for entry.", ticket };
    }

    function renderResult(payload, token) {
      currentTicket = payload.ticket || null;
      if (!detail || !message) return;

      if (payload.outcome === "VALID") {
        detail.dataset.state = "valid";
        detail.style.borderColor = "#2e7d32";
        detail.style.backgroundColor = "rgba(46, 125, 50, 0.08)";
        if (checkinButton) checkinButton.disabled = false;
      } else if (payload.outcome === "ALREADY_USED") {
        detail.dataset.state = "used";
        detail.style.borderColor = "#ed6c02";
        detail.style.backgroundColor = "rgba(237, 108, 2, 0.08)";
        if (checkinButton) checkinButton.disabled = true;
      } else {
        detail.dataset.state = "bad";
        detail.style.borderColor = "#d32f2f";
        detail.style.backgroundColor = "rgba(211, 47, 47, 0.08)";
        if (checkinButton) checkinButton.disabled = true;
      }

      if (resultName) resultName.textContent = payload.ticket?.participantName || (payload.outcome === "INVALID" ? "Pass Not Found" : "Attendee");
      if (resultMeta) resultMeta.textContent = payload.message;
      if (resultPills[0]) resultPills[0].textContent = payload.ticket?.eventName || "Event";
      if (resultPills[1]) resultPills[1].textContent = payload.ticket?.collegeId ? `ID: ${payload.ticket.collegeId}` : "Guest";
      if (resultPills[2]) resultPills[2].textContent = token.slice(0, 16).toUpperCase();
      if (resultPills[3]) resultPills[3].textContent = payload.ticket?.status || payload.outcome;
      if (resultPills[4]) resultPills[4].textContent = payload.ticket?.venue || "Venue";
      if (resultPills[5]) resultPills[5].textContent = gateInput?.value || "Gate 1";
      message.textContent = payload.message;
    }

    async function scanFrame() {
      if (!detector || !video || video.readyState < 2) return;
      try {
        const codes = await detector.detect(video);
        const raw = codes[0]?.rawValue?.trim();
        if (raw && raw !== activeToken) {
          activeToken = raw;
          if (tokenInput) tokenInput.value = raw;
          lookupCurrent();
          setStatus("SCANNED", "QR code detected from live camera.");
        }
      } catch {
        // Transient camera read error
      }
    }

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera API not supported in this browser. Use manual lookup or preset token picker.");
        }
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false
        });
        stream = media;
        if (video) {
          video.srcObject = media;
          await video.play();
        }
        setStatus("SCANNING", "Camera is active and searching for QR codes.");
        const BarcodeDetector = window.BarcodeDetector;
        if (BarcodeDetector) {
          detector = detector || new BarcodeDetector({ formats: ["qr_code"] });
          timer = window.setInterval(scanFrame, 800);
        } else {
          setStatus("READY", "Camera is active. (BarcodeDetector API not native in this browser; use manual lookup / preset picker).");
        }
      } catch (error) {
        setStatus("BLOCKED", (error && error.message) || "Unable to access camera.");
        showToast("Camera access unavailable. You can use manual token lookup or test presets.", "info");
      }
    }

    function stopCamera() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      if (video) video.srcObject = null;
      setStatus("READY", "Press start to request camera access.");
    }

    function lookupCurrent() {
      const token = (tokenInput?.value || "").trim();
      if (!token) {
        showToast("Please enter or scan a pass token.", "info");
        return;
      }
      const eventSlug = root.dataset.eventSlug || "all";
      const payload = lookupTicket(token, eventSlug);
      renderResult(payload, token);
      setStatus(
        payload.outcome === "VALID" ? "VALID PASS" : payload.outcome === "ALREADY_USED" ? "ALREADY REDEEMED" : "FLAGGED",
        payload.message
      );
    }

    function redeemCurrent() {
      const token = (tokenInput?.value || "").trim();
      if (!token) return;
      const ticket = UtsavDB.getTicket(token);
      if (!ticket) {
        showToast("Cannot check in: Ticket not found.", "error");
        return;
      }
      if (ticket.status === "USED") {
        showToast("Ticket has already been redeemed!", "error");
        return;
      }

      const gate = gateInput?.value || "Gate 1";
      UtsavDB.recordCheckin(ticket, gate);
      showToast(`✓ Checked in ${ticket.participantName} at ${gate}!`, "success");
      renderResult({ outcome: "ALREADY_USED", message: `Checked in successfully at ${gate}.`, ticket }, token);
      setStatus("CHECKED IN", `Entry recorded at ${gate} for ${ticket.participantName}.`);
      populateQuickSelect();
    }

    startButton?.addEventListener("click", startCamera);
    stopButton?.addEventListener("click", stopCamera);
    resetButton?.addEventListener("click", () => {
      activeToken = "";
      if (tokenInput) tokenInput.value = "";
      currentTicket = null;
      if (detail) {
        detail.dataset.state = "";
        detail.style.borderColor = "";
        detail.style.backgroundColor = "";
      }
      if (resultName) resultName.textContent = "Participant";
      if (message) message.textContent = "Enter or scan a token to validate pass.";
      setStatus("READY", "Press start to request camera access.");
    });
    lookupButton?.addEventListener("click", lookupCurrent);
    checkinButton?.addEventListener("click", redeemCurrent);

    // Initial check from URL parameter if token was passed in
    const urlParams = new URLSearchParams(window.location.search);
    const initialToken = urlParams.get("token");
    if (initialToken && tokenInput) {
      tokenInput.value = initialToken;
      lookupCurrent();
    }
  }

  // =========================================================================
  // 6. ADMIN SUITE CONTROLLERS
  // =========================================================================

  // A. Admin Dashboard (/admin/)
  function initAdminDashboard() {
    const root = $("[data-admin-dashboard]");
    if (!root) return;

    const stats = UtsavDB.getStats();

    const statEvents = $("#stat-events", root);
    const statTickets = $("#stat-tickets", root);
    const statRevenue = $("#stat-revenue", root);
    const statCheckins = $("#stat-checkins", root);

    if (statEvents) statEvents.textContent = stats.eventCount;
    if (statTickets) statTickets.textContent = stats.ticketCount;
    if (statRevenue) statRevenue.textContent = formatCurrency(stats.revenue);
    if (statCheckins) statCheckins.textContent = stats.checkinCount;

    // Render Recent Registrations
    const recentRegTable = $("#admin-recent-registrations", root);
    if (recentRegTable) {
      const tickets = UtsavDB.getTickets().slice(0, 5);
      recentRegTable.innerHTML = tickets
        .map(
          (t) => `
          <tr>
            <td><strong>${escapeHtml(t.participantName)}</strong><br><small>${escapeHtml(t.collegeId || "")}</small></td>
            <td>${escapeHtml(t.eventName)}</td>
            <td><a class="token-link" href="pass/index.html?token=${encodeURIComponent(t.token)}" title="View Pass"><code>${escapeHtml(t.token)}</code></a></td>
            <td><span class="badge badge--${t.status.toLowerCase()}">${escapeHtml(t.status)}</span></td>
            <td>${formatDate(t.createdAt)}</td>
          </tr>`
        )
        .join("");
    }

    // Render Recent Check-ins
    const recentCheckinTable = $("#admin-recent-checkins", root);
    if (recentCheckinTable) {
      const checkins = UtsavDB.getCheckins().slice(0, 5);
      if (checkins.length === 0) {
        recentCheckinTable.innerHTML = `<tr><td colspan="4" class="text-muted">No check-in entries yet.</td></tr>`;
      } else {
        recentCheckinTable.innerHTML = checkins
          .map(
            (c) => `
            <tr>
              <td><strong>${escapeHtml(c.participantName)}</strong></td>
              <td>${escapeHtml(c.eventName)}</td>
              <td><span class="pill">${escapeHtml(c.gate)}</span></td>
              <td>${formatDate(c.timestamp)}</td>
            </tr>`
          )
          .join("");
      }
    }

    // Reset Demo Data Button
    const resetBtn = $("#admin-reset-db", root);
    resetBtn?.addEventListener("click", () => {
      if (confirm("Reset all BONGIO.SOMITI local data back to initial sample state?")) {
        UtsavDB.resetDatabase();
        showToast("Database reset to sample state.", "success");
        setTimeout(() => window.location.reload(), 600);
      }
    });
  }

  // B. Admin Events List (/admin/events/)
  function initAdminEventsPage() {
    const root = $("[data-admin-events]");
    if (!root) return;

    const tbody = $("#admin-events-tbody", root);
    if (!tbody) return;

    function render() {
      const events = UtsavDB.getEvents();
      const tickets = UtsavDB.getTickets();

      tbody.innerHTML = events
        .map((evt) => {
          const registered = tickets.filter((t) => t.eventSlug === evt.slug).length;
          const percent = Math.min(100, Math.round((registered / (evt.capacity || 100)) * 100));

          return `
          <tr>
            <td>
              <div class="event-row-info">
                <strong>${escapeHtml(evt.name)}</strong>
                <span class="text-muted">${escapeHtml(evt.category || "Community")}</span>
              </div>
            </td>
            <td>${formatShortDate(evt.date)}</td>
            <td>${escapeHtml(evt.venue)}</td>
            <td><strong>${formatCurrency(evt.price)}</strong></td>
            <td>
              <div class="capacity-meter">
                <div class="capacity-bar"><div class="capacity-fill" style="width:${percent}%"></div></div>
                <span>${registered} / ${evt.capacity || 100}</span>
              </div>
            </td>
            <td><span class="badge badge--${evt.status.toLowerCase()}">${escapeHtml(evt.status)}</span></td>
            <td>
              <div class="action-btn-group">
                <a class="btn btn-sm btn-secondary" href="events/${encodeURIComponent(evt.slug)}/index.html" title="View public page">View Page</a>
                <button class="btn btn-sm btn-danger delete-event-btn" data-slug="${escapeHtml(evt.slug)}">Delete</button>
              </div>
            </td>
          </tr>`;
        })
        .join("");

      $all(".delete-event-btn", tbody).forEach((btn) => {
        btn.addEventListener("click", () => {
          const slug = btn.dataset.slug;
          if (confirm(`Are you sure you want to delete event "${slug}"?`)) {
            UtsavDB.deleteEvent(slug);
            showToast("Event deleted.", "info");
            render();
          }
        });
      });
    }

    render();
  }

  // C. Admin Create New Event (/admin/events/new/)
  function initAdminNewEventPage() {
    const form = $("#admin-new-event-form");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);

      const name = String(data.get("name") || "").trim();
      let slug = String(data.get("slug") || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
      if (!slug) slug = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

      const newEvent = {
        slug: slug,
        name: name,
        date: String(data.get("date") || new Date().toISOString().slice(0, 10)),
        dateFormatted: formatShortDate(String(data.get("date"))),
        venue: String(data.get("venue") || "Campus Venue").trim(),
        capacity: Number(data.get("capacity")) || 100,
        price: Number(data.get("price")) || 0,
        category: String(data.get("category") || "Campus Celebration").trim(),
        description: String(data.get("description") || "Community celebration at IIIT Hyderabad.").trim(),
        image: "assets/community-puja.svg",
        status: "OPEN"
      };

      UtsavDB.saveEvent(newEvent);
      showToast(`Event "${newEvent.name}" created successfully!`, "success");

      setTimeout(() => {
        window.location.href = "admin/events/index.html";
      }, 700);
    });
  }

  // D. Admin Registrations List (/admin/registrations/)
  function initAdminRegistrationsPage() {
    const root = $("[data-admin-registrations]");
    if (!root) return;

    const tbody = $("#admin-registrations-tbody", root);
    const searchInput = $("#admin-reg-search", root);
    const eventFilter = $("#admin-reg-filter-event", root);
    const statusFilter = $("#admin-reg-filter-status", root);
    const exportBtn = $("#admin-reg-export", root);

    // Populate event filter options
    if (eventFilter) {
      const events = UtsavDB.getEvents();
      eventFilter.innerHTML = `<option value="">All Events</option>` +
        events.map((e) => `<option value="${escapeHtml(e.slug)}">${escapeHtml(e.name)}</option>`).join("");
    }

    function render() {
      if (!tbody) return;
      const query = (searchInput?.value || "").trim().toLowerCase();
      const selectedEvent = eventFilter?.value || "";
      const selectedStatus = statusFilter?.value || "";

      let tickets = UtsavDB.getTickets();

      if (query) {
        tickets = tickets.filter(
          (t) =>
            t.participantName.toLowerCase().includes(query) ||
            (t.collegeId && t.collegeId.toLowerCase().includes(query)) ||
            (t.email && t.email.toLowerCase().includes(query)) ||
            (t.phone && t.phone.toLowerCase().includes(query)) ||
            t.token.toLowerCase().includes(query)
        );
      }

      if (selectedEvent) {
        tickets = tickets.filter((t) => t.eventSlug === selectedEvent);
      }

      if (selectedStatus) {
        tickets = tickets.filter((t) => t.status === selectedStatus);
      }

      if (tickets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 2rem;">No registrations matching the filter criteria.</td></tr>`;
        return;
      }

      tbody.innerHTML = tickets
        .map(
          (t) => `
        <tr>
          <td>
            <strong>${escapeHtml(t.participantName)}</strong><br>
            <small class="text-muted">${escapeHtml(t.collegeId || "N/A")}</small>
          </td>
          <td>
            <small>${escapeHtml(t.email || "N/A")}</small><br>
            <small class="text-muted">${escapeHtml(t.phone || "")}</small>
          </td>
          <td>${escapeHtml(t.eventName)}</td>
          <td><a class="token-link" href="pass/index.html?token=${encodeURIComponent(t.token)}" target="_blank" title="Open Digital Pass"><code>${escapeHtml(t.token)}</code></a></td>
          <td><strong>${formatCurrency(t.amount)}</strong><br><small class="text-muted">${escapeHtml(t.utr || "Verified")}</small></td>
          <td><span class="badge badge--${t.status.toLowerCase()}">${escapeHtml(t.status)}</span></td>
          <td><small>${formatDate(t.createdAt)}</small></td>
          <td>
            <div class="action-btn-group">
              <a class="btn btn-sm btn-secondary" href="pass/index.html?token=${encodeURIComponent(t.token)}" target="_blank">Pass</a>
              <button class="btn btn-sm btn-danger delete-ticket-btn" data-token="${escapeHtml(t.token)}">✕</button>
            </div>
          </td>
        </tr>`
        )
        .join("");

      $all(".delete-ticket-btn", tbody).forEach((btn) => {
        btn.addEventListener("click", () => {
          const token = btn.dataset.token;
          if (confirm(`Delete registration for pass ${token}?`)) {
            UtsavDB.deleteTicket(token);
            showToast("Registration deleted.", "info");
            render();
          }
        });
      });
    }

    searchInput?.addEventListener("input", render);
    eventFilter?.addEventListener("change", render);
    statusFilter?.addEventListener("change", render);

    exportBtn?.addEventListener("click", () => {
      const tickets = UtsavDB.getTickets();
      const csvRows = [
        ["Token", "Name", "College ID", "Email", "Phone", "Event", "Amount", "UTR", "Status", "Created At"]
      ];
      tickets.forEach((t) => {
        csvRows.push([
          t.token,
          t.participantName,
          t.collegeId || "",
          t.email || "",
          t.phone || "",
          t.eventName,
          t.amount,
          t.utr || "",
          t.status,
          t.createdAt
        ]);
      });
      const csvContent = "data:text/csv;charset=utf-8," + csvRows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `BONGIO.SOMITI_registrations_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast("CSV export downloaded.", "success");
    });

    render();
  }

  // E. Admin Payments List (/admin/payments/)
  function initAdminPaymentsPage() {
    const root = $("[data-admin-payments]");
    if (!root) return;

    const tbody = $("#admin-payments-tbody", root);
    const statusFilter = $("#admin-payments-filter-status", root);

    function render() {
      if (!tbody) return;
      const selectedStatus = statusFilter?.value || "";

      let tickets = UtsavDB.getTickets();
      if (selectedStatus) {
        tickets = tickets.filter((t) => (t.paymentStatus || "APPROVED") === selectedStatus);
      }

      if (tickets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">No payment transactions recorded.</td></tr>`;
        return;
      }

      tbody.innerHTML = tickets
        .map(
          (t) => `
        <tr>
          <td><code>${escapeHtml(t.utr || "FREE-PASS")}</code></td>
          <td><strong>${escapeHtml(t.participantName)}</strong><br><small class="text-muted">${escapeHtml(t.collegeId || "")}</small></td>
          <td>${escapeHtml(t.eventName)}</td>
          <td><strong>${formatCurrency(t.amount)}</strong></td>
          <td><span class="badge badge--${(t.paymentStatus || "approved").toLowerCase()}">${escapeHtml(t.paymentStatus || "APPROVED")}</span></td>
          <td><small>${formatDate(t.createdAt)}</small></td>
          <td>
            <div class="action-btn-group">
              ${
                t.paymentStatus === "PENDING"
                  ? `<button class="btn btn-sm btn-success approve-pay-btn" data-token="${escapeHtml(t.token)}">✓ Approve</button>
                     <button class="btn btn-sm btn-danger reject-pay-btn" data-token="${escapeHtml(t.token)}">✕ Reject</button>`
                  : `<button class="btn btn-sm btn-secondary toggle-pay-btn" data-token="${escapeHtml(t.token)}">Toggle Status</button>`
              }
            </div>
          </td>
        </tr>`
        )
        .join("");

      $all(".approve-pay-btn", tbody).forEach((btn) => {
        btn.addEventListener("click", () => {
          UtsavDB.updatePaymentStatus(btn.dataset.token, "APPROVED");
          showToast("Payment approved and pass activated!", "success");
          render();
        });
      });

      $all(".reject-pay-btn", tbody).forEach((btn) => {
        btn.addEventListener("click", () => {
          UtsavDB.updatePaymentStatus(btn.dataset.token, "REJECTED");
          showToast("Payment rejected.", "info");
          render();
        });
      });

      $all(".toggle-pay-btn", tbody).forEach((btn) => {
        btn.addEventListener("click", () => {
          const t = UtsavDB.getTicket(btn.dataset.token);
          const next = t.paymentStatus === "APPROVED" ? "PENDING" : "APPROVED";
          UtsavDB.updatePaymentStatus(btn.dataset.token, next);
          showToast(`Payment status updated to ${next}.`, "info");
          render();
        });
      });
    }

    statusFilter?.addEventListener("change", render);
    render();
  }

  // F. Admin Check-ins List (/admin/check-ins/)
  function initAdminCheckinsPage() {
    const root = $("[data-admin-checkins]");
    if (!root) return;

    const tbody = $("#admin-checkins-tbody", root);

    function render() {
      if (!tbody) return;
      const checkins = UtsavDB.getCheckins();

      if (checkins.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 2rem;">No check-ins recorded at the gate yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = checkins
        .map(
          (c) => `
        <tr>
          <td><small>${formatDate(c.timestamp)}</small></td>
          <td><strong>${escapeHtml(c.participantName)}</strong></td>
          <td>${escapeHtml(c.eventName)}</td>
          <td><a class="token-link" href="pass/index.html?token=${encodeURIComponent(c.token)}" target="_blank"><code>${escapeHtml(c.token)}</code></a></td>
          <td><span class="pill">${escapeHtml(c.gate || "Gate 1")}</span></td>
          <td>
            <button class="btn btn-sm btn-secondary undo-checkin-btn" data-id="${escapeHtml(c.id)}">Undo Entry</button>
          </td>
        </tr>`
        )
        .join("");

      $all(".undo-checkin-btn", tbody).forEach((btn) => {
        btn.addEventListener("click", () => {
          if (confirm("Undo this check-in entry and reset pass to unused?")) {
            UtsavDB.undoCheckin(btn.dataset.id);
            showToast("Check-in undone. Pass is now UNUSED.", "info");
            render();
          }
        });
      });
    }

    render();
  }

  // G. Admin Login Page (/admin/login/)
  function initAdminLoginPage() {
    const form = $("form[data-vanilla-login]");
    if (!form) return;

    const status = $(".form-status", form);
    const demoBtn = $("#admin-quick-login-btn");

    function doLogin(email, name = "Admin") {
      UtsavDB.setAuth({
        email: email,
        name: name,
        role: "Organiser",
        loggedIn: true
      });
      showToast(`Welcome, ${name}! Redirecting to Admin Dashboard...`, "success");
      if (status) {
        status.className = "form-status form-status--success";
        status.innerHTML = `<strong>Signed in successfully!</strong> Redirecting to dashboard...`;
      }
      setTimeout(() => {
        window.location.href = "admin/index.html";
      }, 600);
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const emailInput = $("#email", form);
      const email = (emailInput?.value || "admin@BONGIO.SOMITI.local").trim();
      doLogin(email, email.split("@")[0]);
    });

    demoBtn?.addEventListener("click", () => {
      doLogin("admin@iiit.ac.in", "Bongio Samiti Organiser");
    });
  }

  // H. Public Login / Pass Lookup (/login/)
  function initPublicLoginPage() {
    const root = $("[data-public-login-page]");
    if (!root) return;

    const lookupForm = $("#public-pass-lookup-form", root);
    const status = $(".form-status", lookupForm);

    lookupForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const query = ($("#public-lookup-query", lookupForm)?.value || "").trim();
      if (!query) {
        showToast("Please enter your College ID or Pass Token.", "info");
        return;
      }

      const ticket = UtsavDB.findTicketByAttendee(query);
      if (ticket) {
        showToast(`Pass found for ${ticket.participantName}! Redirecting...`, "success");
        if (status) {
          status.className = "form-status form-status--success";
          status.innerHTML = `<strong>Pass Found!</strong> Redirecting to pass preview...`;
        }
        setTimeout(() => {
          window.location.href = `pass/index.html?token=${encodeURIComponent(ticket.token)}`;
        }, 600);
      } else {
        showToast("No pass found matching that College ID or Token.", "error");
        if (status) {
          status.className = "form-status form-status--error";
          status.innerHTML = `No pass found matching <code>${escapeHtml(query)}</code>. Please check your details or register for an event.`;
        }
      }
    });
  }

  // =========================================================================
  // 7. PUBLIC EVENTS CATALOG DYNAMIC INJECTION
  // =========================================================================
  function initPublicEventsCatalog() {
    const container = $("#public-events-catalog");
    if (!container) return;

    const events = UtsavDB.getEvents();
    container.innerHTML = events
      .map(
        (evt) => `
        <a class="events-scene__card" href="events/${encodeURIComponent(evt.slug)}/index.html">
          <div class="events-scene__card-media">
            <img class="events-scene__card-image" src="${escapeHtml(evt.image || 'assets/community-puja.svg')}" alt="${escapeHtml(evt.name)}" style="object-position:center 30%" />
          </div>
          <div class="events-scene__card-body">
            <div class="events-scene__card-meta">
              <span>${escapeHtml(evt.dateFormatted || evt.date)}</span>
              <span>${escapeHtml(evt.category || "Community Event")}</span>
            </div>
            <h3>${escapeHtml(evt.name)}</h3>
            <p>${escapeHtml(evt.description)}</p>
            <div class="events-scene__card-footer">
              <strong class="events-scene__card-price">${formatCurrency(evt.price)}</strong>
              <span class="events-scene__card-link">REGISTER NOW &rarr;</span>
            </div>
          </div>
        </a>`
      )
      .join("");
  }

  // =========================================================================
  // 8. SCROLL & MOTION POLISH
  // =========================================================================
  function initScrollPolish() {
    // 1. Smooth section scrolling for internal anchor links
    const anchorLinks = $all('a[href^="#"]');
    anchorLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        const href = link.getAttribute("href");
        if (!href || href === "#") return;
        const target = $(href);
        if (target) {
          e.preventDefault();
          const strip = $(".home-strip");
          const stripOffset = strip ? strip.offsetHeight + 10 : 46;
          const targetY = target.getBoundingClientRect().top + window.pageYOffset - stripOffset;
          window.scrollTo({
            top: Math.max(0, targetY),
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
          });
          if (history.pushState) {
            history.pushState(null, null, href);
          }
        }
      });
    });

    // 2. Viewport-based One-Time Scroll Reveal Animations
    const reveals = $all(".scroll-reveal, [data-reveal]");
    if (!reveals.length) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      reveals.forEach((el) => el.classList.add("is-revealed", "is-visible"));
      // Expose a no-op for dynamic elements too
      window.reobserveReveal = (el) => el.classList.add("is-revealed", "is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed", "is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
    );

    reveals.forEach((el) => observer.observe(el));

    // Expose helper so dynamically-rendered elements (e.g. photo album grid) can be observed
    window.reobserveReveal = (el) => observer.observe(el);
  }

  // =========================================================================
  // 9. EVENT MENU CARD MODALS (MAHALAYA & SARASWATI PUJA)
  // =========================================================================
  function initMenuCardModal() {
    const modalConfigs = [
      {
        trigger: $("#open-menu-modal-btn"),
        modal: $("#mahalaya-menu-modal"),
        closeBtn: $("#close-menu-modal-btn"),
        backdrop: $("#close-menu-modal-backdrop")
      },
      {
        trigger: $("#open-saraswati-menu-btn"),
        modal: $("#saraswati-menu-modal"),
        closeBtn: $("#close-saraswati-menu-btn"),
        backdrop: $("#close-saraswati-menu-backdrop")
      }
    ];

    modalConfigs.forEach(({ trigger, modal, closeBtn, backdrop }) => {
      if (!trigger || !modal) return;

      function openModal() {
        modal.removeAttribute("hidden");
        trigger.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
        if (closeBtn) closeBtn.focus();
      }

      function closeModal() {
        modal.setAttribute("hidden", "");
        trigger.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
        trigger.focus();
      }

      trigger.addEventListener("click", (e) => {
        e.preventDefault();
        openModal();
      });

      if (closeBtn) closeBtn.addEventListener("click", closeModal);
      if (backdrop) backdrop.addEventListener("click", closeModal);

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !modal.hasAttribute("hidden")) {
          closeModal();
        }
      });
    });
  }

  // =========================================================================
  // DOM READY DISPATCHER
  // =========================================================================
  document.addEventListener("DOMContentLoaded", () => {
    initPrimaryNav();
    initStoryGallery();
    initRegistrationForms();
    initPassPage();
    initScannerPage();
    initAdminDashboard();
    initAdminEventsPage();
    initAdminNewEventPage();
    initAdminRegistrationsPage();
    initAdminPaymentsPage();
    initAdminCheckinsPage();
    initAdminLoginPage();
    initPublicLoginPage();
    initPublicEventsCatalog();
    initScrollPolish();
    initMenuCardModal();
  });
})();


