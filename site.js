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
      paymentStatus: "verified",
      status: "UNUSED",
      passGenerated: true,
      emailSent: true,
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
      paymentStatus: "verification_pending",
      status: "PENDING_VERIFICATION",
      passGenerated: false,
      emailSent: false,
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
      paymentStatus: "verified",
      status: "USED",
      passGenerated: true,
      emailSent: true,
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
      paymentStatus: "verification_pending",
      status: "PENDING_VERIFICATION",
      passGenerated: false,
      emailSent: false,
      gate: "Gate 1"
    },
    {
      token: "MBH-2026-REJ1",
      eventSlug: "mahalaya",
      eventName: "Mahalaya Bhoj",
      venue: "Community Courtyard",
      participantName: "Souvik Ghosh",
      collegeId: "202301142",
      email: "souvik.g@iiit.ac.in",
      phone: "+91 98450 11223",
      utr: "UPI-001122334455",
      amount: 250,
      createdAt: "2026-08-11T16:00:00.000Z",
      paymentStatus: "rejected",
      status: "PAYMENT_REJECTED",
      passGenerated: false,
      emailSent: false,
      adminNotes: "UTR not found in bank settlement statement"
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
    findTicketByUtrAndEmail(utr, email) {
      if (!utr || !email) return null;
      const normUtr = String(utr).trim().toUpperCase();
      const normEmail = String(email).trim().toLowerCase();
      const tickets = this.getTickets();
      return tickets.find((t) => {
        const ticketEmail = String(t.email || "").trim().toLowerCase();
        const ticketUtr = String(t.utr || "").trim().toUpperCase();
        return ticketEmail === normEmail && (ticketUtr === normUtr || ticketUtr.includes(normUtr) || normUtr.includes(ticketUtr));
      }) || null;
    },
    findTicketByEmail(email) {
      if (!email) return null;
      const normEmail = String(email).trim().toLowerCase();
      const tickets = this.getTickets();
      return tickets.find((t) => String(t.email || "").trim().toLowerCase() === normEmail) || null;
    },
    submitVerificationRequest(utr, email) {
      const normUtr = String(utr || "").trim();
      const normEmail = String(email || "").trim().toLowerCase();
      if (!normUtr || !normEmail) {
        return { success: false, message: "Please provide both UPI Transaction ID / UTR and registered email address." };
      }

      const tickets = this.getTickets();
      // Match by email and UTR, or find registration with this email
      let ticket = tickets.find((t) => {
        const tEmail = String(t.email || "").trim().toLowerCase();
        const tUtr = String(t.utr || "").trim().toUpperCase();
        return tEmail === normEmail && (tUtr === normUtr.toUpperCase() || tUtr.includes(normUtr.toUpperCase()));
      });

      if (!ticket) {
        // Find by email to link/update UTR
        ticket = tickets.find((t) => String(t.email || "").trim().toLowerCase() === normEmail);
      }

      if (!ticket) {
        return {
          success: false,
          notFound: true,
          message: "No registration found matching this email address. Please make sure you entered the email used during registration."
        };
      }

      // Check if duplicate pending request
      const isSameUtr = String(ticket.utr || "").trim().toUpperCase() === normUtr.toUpperCase();
      const isAlreadyPending = ticket.paymentStatus === "verification_pending" || ticket.paymentStatus === "PENDING";
      const isDuplicate = isSameUtr && isAlreadyPending;

      ticket.utr = normUtr;
      ticket.paymentStatus = "verification_pending";
      ticket.status = "PENDING_VERIFICATION";
      ticket.verificationSubmittedAt = ticket.verificationSubmittedAt || new Date().toISOString();
      ticket.passGenerated = false; // Do not generate QR pass at this stage
      ticket.emailSent = false;     // Do not send pass email at this stage

      this.saveTicket(ticket);

      return {
        success: true,
        duplicate: isDuplicate,
        ticket: this.sanitizeTicketForParticipant(ticket)
      };
    },
    getPaymentVerificationStatus(utr, email) {
      const ticket = this.findTicketByUtrAndEmail(utr, email);
      if (!ticket) {
        return null;
      }
      return this.sanitizeTicketForParticipant(ticket);
    },
    sanitizeTicketForParticipant(ticket) {
      if (!ticket) return null;
      return {
        token: ticket.token,
        participantName: ticket.participantName || "Participant",
        eventName: ticket.eventName || "Event",
        venue: ticket.venue || "Campus Venue",
        email: ticket.email || "",
        utr: ticket.utr || "",
        amount: ticket.amount || 0,
        numPasses: ticket.numPasses || 1,
        paymentStatus: ticket.paymentStatus || "verification_pending",
        status: ticket.status || "PENDING_VERIFICATION",
        passGenerated: !!ticket.passGenerated,
        createdAt: ticket.createdAt,
        verificationSubmittedAt: ticket.verificationSubmittedAt || ticket.createdAt
        // NOTE: adminNotes and internal organizer data are strictly stripped
      };
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
    verifyPayment(token) {
      const ticket = this.getTicket(token);
      if (!ticket) return null;
      ticket.paymentStatus = "verified";
      ticket.status = ticket.status === "USED" ? "USED" : "UNUSED";
      ticket.passGenerated = true;
      ticket.passGeneratedAt = new Date().toISOString();
      ticket.emailSent = true;
      ticket.emailSentAt = new Date().toISOString();
      delete ticket.adminNotes;
      this.saveTicket(ticket);
      return ticket;
    },
    rejectPayment(token, internalReason = "") {
      const ticket = this.getTicket(token);
      if (!ticket) return null;
      ticket.paymentStatus = "rejected";
      ticket.status = "PAYMENT_REJECTED";
      ticket.passGenerated = false;
      ticket.adminNotes = internalReason || "Payment verification rejected by admin";
      this.saveTicket(ticket);
      return ticket;
    },
    updatePaymentStatus(token, status) {
      const normalizedStatus = String(status || "").toLowerCase();
      if (normalizedStatus === "verified" || normalizedStatus === "approved") {
        return this.verifyPayment(token);
      } else if (normalizedStatus === "rejected") {
        return this.rejectPayment(token);
      } else {
        const ticket = this.getTicket(token);
        if (!ticket) return null;
        ticket.paymentStatus = "verification_pending";
        ticket.status = "PENDING_VERIFICATION";
        ticket.passGenerated = false;
        this.saveTicket(ticket);
        return ticket;
      }
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
        const isVerified = t.paymentStatus === "verified" || t.paymentStatus === "APPROVED";
        if (isVerified && Number(t.amount)) {
          return sum + Number(t.amount);
        }
        return sum;
      }, 0);

      const verifiedCount = tickets.filter((t) => t.status === "USED" || t.paymentStatus === "verified" || t.paymentStatus === "APPROVED").length;
      const pendingCount = tickets.filter((t) => t.paymentStatus === "verification_pending" || t.paymentStatus === "PENDING").length;
      const checkinCount = tickets.filter((t) => t.status === "USED").length;

      return {
        eventCount: events.length,
        ticketCount: tickets.length,
        revenue: totalRevenue,
        verifiedCount: verifiedCount,
        pendingCount: pendingCount,
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
      img.loading = "lazy";
      img.decoding = "async";
      img.width = 600;
      img.height = 400;
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

        // Update Trustworthy Price Breakdown Receipt
        const receiptSubtotal = $("#receipt-subtotal", form);
        const receiptDiscount = $("#receipt-discount", form);
        const receiptTotal = $("#receipt-total", form);
        const receiptDiscountRow = $("#receipt-discount-row", form);

        if (receiptSubtotal) receiptSubtotal.textContent = formatCurrency(subtotal);
        if (receiptDiscount) {
          if (discount > 0) {
            receiptDiscount.textContent = `−${formatCurrency(discount)}`;
            if (receiptDiscountRow) receiptDiscountRow.style.color = "#2b6e35";
          } else {
            receiptDiscount.textContent = formatCurrency(0);
            if (receiptDiscountRow) receiptDiscountRow.style.color = "#736458";
          }
        }
        if (receiptTotal) receiptTotal.textContent = formatCurrency(finalAmount);

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
          paymentStatus: "verification_pending",
          status: "PENDING_VERIFICATION",
          passGenerated: false,
          emailSent: false,
          gate: "Gate 1",
          notes: foodPref ? `${foodPref} (${numPasses} pass${numPasses > 1 ? "es" : ""})` : ""
        };

        // If coupon was applied, increment backend redemption count
        if (appliedCoupon && appliedCoupon.code) {
          UtsavDB.incrementCouponRedemptions(appliedCoupon.code);
        }

        window.UtsavLoader?.show("ডিজিটাল পাস প্রস্তুত হচ্ছে...");
        setTimeout(() => {
          window.UtsavLoader?.hide();
        }, 750);

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
  // 4. PAYMENT STATUS VERIFICATION PAGE (/pass/)
  // =========================================================================
  function initPassPage() {
    const root = $("[data-pass-page]");
    if (!root) return;

    const form = $("#payment-verification-form", root);
    const utrInput = $("#verification-utr", root);
    const emailInput = $("#verification-email", root);
    const submitBtn = $("#verification-submit-btn", root);
    const resultBox = $("#verification-result-box", root);

    // Dynamic result panels
    const pendingPanel = $("#panel-pending", resultBox);
    const verifiedPanel = $("#panel-verified", resultBox);
    const rejectedPanel = $("#panel-rejected", resultBox);
    const notFoundPanel = $("#panel-not-found", resultBox);

    // QR & pass elements
    const qrFrame = $("#pass-qr-frame", root);
    const printBtn = $("#pass-print-btn", root);

    function hideAllPanels() {
      if (!resultBox) return;
      resultBox.style.display = "block";
      if (pendingPanel) pendingPanel.style.display = "none";
      if (verifiedPanel) verifiedPanel.style.display = "none";
      if (rejectedPanel) rejectedPanel.style.display = "none";
      if (notFoundPanel) notFoundPanel.style.display = "none";
    }

    function renderVerificationStatus(ticket) {
      if (!ticket) {
        hideAllPanels();
        if (notFoundPanel) {
          notFoundPanel.style.display = "block";
          const queryMsg = $("#not-found-message", notFoundPanel);
          if (queryMsg) {
            queryMsg.textContent = "No registration records found matching the provided UPI Transaction ID and Email address.";
          }
        }
        return;
      }

      hideAllPanels();

      const eventDateStr = ticket.eventDate || (String(ticket.eventSlug).includes("saraswati") ? "21 January 2027" : "12 October 2026");
      const passTypeStr = ticket.passType || (ticket.collegeId ? "IIIT Student / Faculty Pass" : "Community Guest Pass") + (ticket.numPasses > 1 ? ` (${ticket.numPasses} Attendees)` : " (1 Attendee)");

      // Populate common details across all views
      $all(".verify-val-token", root).forEach((el) => (el.textContent = ticket.token));
      $all(".verify-val-name", root).forEach((el) => (el.textContent = ticket.participantName));
      $all(".verify-val-email", root).forEach((el) => (el.textContent = ticket.email));
      $all(".verify-val-utr", root).forEach((el) => (el.textContent = ticket.utr));
      $all(".verify-val-event", root).forEach((el) => (el.textContent = ticket.eventName));
      $all(".verify-val-venue", root).forEach((el) => (el.textContent = ticket.venue));
      $all(".verify-val-eventdate", root).forEach((el) => (el.textContent = eventDateStr));
      $all(".verify-val-passtype", root).forEach((el) => (el.textContent = passTypeStr));
      $all(".verify-val-amount", root).forEach((el) => (el.textContent = formatCurrency(ticket.amount)));
      $all(".verify-val-date", root).forEach((el) => (el.textContent = formatDate(ticket.verificationSubmittedAt || ticket.createdAt)));

      const normStatus = String(ticket.paymentStatus || "").toLowerCase();

      if (normStatus === "verified" || normStatus === "approved") {
        // ==========================================
        // STATE: VERIFIED
        // ==========================================
        if (verifiedPanel) {
          verifiedPanel.style.display = "block";
        }

        const isUsed = ticket.status === "USED";
        const statusBadge = $("#pass-badge-status", verifiedPanel);
        const statusText = $(".verify-val-status-text", verifiedPanel);

        if (statusBadge) {
          if (isUsed) {
            statusBadge.className = "badge badge--rejected";
            statusBadge.textContent = "USED • REDEEMED AT GATE";
          } else {
            statusBadge.className = "badge badge--verified";
            statusBadge.textContent = "VERIFIED • READY FOR ENTRY";
          }
        }

        if (statusText) {
          if (isUsed) {
            statusText.style.color = "#c62828";
            statusText.textContent = `Used / Checked In at ${ticket.redeemedGate || "Gate"}`;
          } else {
            statusText.style.color = "#2e7d32";
            statusText.textContent = "Verified & Active Entry Pass";
          }
        }

        // Generate QR code encoding UNIQUE PASS IDENTIFIER (Not personal data)
        if (qrFrame && window.QRCode?.toDataURL) {
          qrFrame.innerHTML = '<div style="padding:1rem;color:var(--muted);font-size:0.85rem;">Generating QR Pass...</div>';
          const qrPayload = `UTSAV-PASS:${ticket.token}`;
          window.QRCode.toDataURL(qrPayload, { width: 240, margin: 2, color: { dark: "#281208", light: "#ffffff" } }).then((url) => {
            const img = document.createElement("img");
            img.alt = `${ticket.eventName} Official QR Pass for ${ticket.token}`;
            img.src = url;
            img.className = "pass-world__qrImage";
            img.style.maxWidth = "200px";
            img.style.height = "auto";
            img.style.borderRadius = "10px";
            img.style.display = "block";
            qrFrame.replaceChildren(img);
          });
        }

        if (printBtn) {
          printBtn.onclick = () => window.print();
        }
      } else if (normStatus === "rejected") {
        // ==========================================
        // STATE: REJECTED (Needs Attention)
        // ==========================================
        if (rejectedPanel) {
          rejectedPanel.style.display = "block";
        }
        if (qrFrame) qrFrame.innerHTML = "";
      } else {
        // ==========================================
        // STATE: VERIFICATION PENDING
        // ==========================================
        if (pendingPanel) {
          pendingPanel.style.display = "block";
        }
        // CRITICAL: Do not display a QR code while payment verification is pending
        if (qrFrame) qrFrame.innerHTML = "";
      }

      // Smoothly scroll down to result box
      resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const utr = (utrInput?.value || "").trim();
      const email = (emailInput?.value || "").trim();

      if (!utr) {
        showToast("Please enter your UPI Transaction ID / UTR.", "error");
        utrInput?.focus();
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        showToast("Please enter a valid registered email address.", "error");
        emailInput?.focus();
        return;
      }

      // Check if ticket exists by both UTR and Email strictly
      let ticket = UtsavDB.findTicketByUtrAndEmail(utr, email);
      if (ticket) {
        renderVerificationStatus(ticket);
        showToast("Payment status retrieved.", "info");
        return;
      }

      // Otherwise submit/create verification request
      const res = UtsavDB.submitVerificationRequest(utr, email);
      if (res.success && res.ticket) {
        if (res.duplicate) {
          showToast("Payment status retrieved for this transaction.", "info");
        } else {
          showToast("✓ Verification request submitted successfully!", "success");
        }
        renderVerificationStatus(res.ticket);
      } else {
        showToast(res.message || "No registration found with this email.", "error");
        hideAllPanels();
        if (notFoundPanel) {
          notFoundPanel.style.display = "block";
          const queryMsg = $("#not-found-message", notFoundPanel);
          if (queryMsg) {
            queryMsg.textContent = res.message || "We could not find a registration matching this email and UTR combination. Please check your details or register for the event.";
          }
          notFoundPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    });

    // Support query parameters in URL (requires BOTH utr and email for security)
    const params = new URLSearchParams(window.location.search);
    const qUtr = params.get("utr");
    const qEmail = params.get("email");

    if (qUtr && qEmail) {
      if (utrInput) utrInput.value = qUtr;
      if (emailInput) emailInput.value = qEmail;
      const t = UtsavDB.findTicketByUtrAndEmail(qUtr, qEmail);
      if (t) {
        renderVerificationStatus(t);
      } else {
        const res = UtsavDB.submitVerificationRequest(qUtr, qEmail);
        if (res.success && res.ticket) {
          renderVerificationStatus(res.ticket);
        }
      }
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

    function lookupTicket(rawToken, eventSlug) {
      if (!rawToken) {
        return { outcome: "INVALID", message: "Please enter or scan a pass QR code.", ticket: null };
      }
      const cleanToken = String(rawToken).replace(/^UTSAV-PASS:/i, "").trim();
      const ticket = UtsavDB.getTicket(cleanToken) || UtsavDB.findTicket(cleanToken);

      if (!ticket) {
        return { outcome: "INVALID", message: "INVALID PASS: No matching registration found in system database.", ticket: null };
      }
      if (eventSlug && ticket.eventSlug && ticket.eventSlug !== eventSlug && eventSlug !== "all") {
        return {
          outcome: "BLOCKED",
          message: `EVENT MISMATCH: This pass is registered for ${ticket.eventName}, not ${eventSlug}.`,
          ticket
        };
      }
      if (ticket.status === "USED") {
        return {
          outcome: "ALREADY_USED",
          message: `ALREADY USED: This pass was already scanned and admitted at ${ticket.redeemedGate || "Gate 1"} on ${formatDate(ticket.redeemedAt)}. Re-use blocked.`,
          ticket
        };
      }
      const isVerified = ticket.paymentStatus === "verified" || ticket.paymentStatus === "APPROVED" || ticket.amount === 0;
      if (!isVerified) {
        return {
          outcome: "INVALID",
          message: `PAYMENT UNVERIFIED: Status is ${ticket.paymentStatus || "verification_pending"}. Gate entry denied until verified.`,
          ticket
        };
      }
      return { outcome: "VALID", message: "VALID PASS: Verified & approved for admission.", ticket };
    }

    function renderResult(payload, token) {
      currentTicket = payload.ticket || null;
      if (!detail || !message) return;

      const cleanToken = String(token).replace(/^UTSAV-PASS:/i, "").trim();

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
      if (resultPills[2]) resultPills[2].textContent = cleanToken.slice(0, 16).toUpperCase();
      if (resultPills[3]) resultPills[3].textContent = payload.ticket?.status === "USED" ? "ALREADY USED" : payload.outcome;
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
      const rawToken = (tokenInput?.value || "").trim();
      if (!rawToken) {
        showToast("Please enter or scan a pass token.", "info");
        return;
      }
      const eventSlug = root.dataset.eventSlug || "all";
      const payload = lookupTicket(rawToken, eventSlug);
      renderResult(payload, rawToken);
      setStatus(
        payload.outcome === "VALID" ? "VALID PASS ✓" : payload.outcome === "ALREADY_USED" ? "ALREADY USED ⚠" : "INVALID PASS ✕",
        payload.message
      );
    }

    function redeemCurrent() {
      const rawToken = (tokenInput?.value || "").trim();
      if (!rawToken) return;
      const cleanToken = String(rawToken).replace(/^UTSAV-PASS:/i, "").trim();
      const ticket = UtsavDB.getTicket(cleanToken) || UtsavDB.findTicket(cleanToken);
      if (!ticket) {
        showToast("Cannot check in: Ticket not found.", "error");
        return;
      }
      if (ticket.status === "USED") {
        showToast("Pass has already been used and redeemed!", "error");
        return;
      }
      const isVerified = ticket.paymentStatus === "verified" || ticket.paymentStatus === "APPROVED" || ticket.amount === 0;
      if (!isVerified) {
        showToast("Cannot check in unverified pass!", "error");
        return;
      }

      const gate = gateInput?.value || "Gate 1";
      UtsavDB.recordCheckin(ticket, gate);
      showToast(`✓ Checked in ${ticket.participantName} at ${gate}! Pass marked as USED.`, "success");
      renderResult({ outcome: "ALREADY_USED", message: `Checked in successfully at ${gate}. Pass marked as USED.`, ticket }, cleanToken);
      setStatus("CHECKED IN ✓", `Entry recorded at ${gate} for ${ticket.participantName}. Pass marked as USED.`);
      populateQuickSelect();
    }

    lookupButton?.addEventListener("click", lookupCurrent);
    checkinButton?.addEventListener("click", redeemCurrent);

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
            <td><a class="token-link" href="pass/index.html?utr=${encodeURIComponent(t.utr || '')}&email=${encodeURIComponent(t.email || '')}" title="Check Status / Pass"><code>${escapeHtml(t.token)}</code></a></td>
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
              <a class="btn btn-sm btn-secondary" href="pass/index.html?utr=${encodeURIComponent(t.utr || '')}&email=${encodeURIComponent(t.email || '')}" target="_blank">Status / Pass</a>
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
    const modal = $("#admin-review-modal");
    const modalClose = $("#admin-review-modal-close");
    const modalBody = $("#admin-review-modal-content");
    const modalVerifyBtn = $("#admin-modal-verify-btn");
    const modalRejectBtn = $("#admin-modal-reject-btn");

    let currentReviewToken = null;

    function openReviewModal(token) {
      const ticket = UtsavDB.getTicket(token);
      if (!ticket || !modal || !modalBody) return;
      currentReviewToken = token;

      modalBody.innerHTML = `
        <table class="verification-meta-table" style="margin:0;">
          <tbody>
            <tr><td>Registration ID</td><td><code>${escapeHtml(ticket.token)}</code></td></tr>
            <tr><td>Participant Name</td><td><strong>${escapeHtml(ticket.participantName)}</strong></td></tr>
            <tr><td>College ID / Org</td><td>${escapeHtml(ticket.collegeId || "N/A")}</td></tr>
            <tr><td>Registered Email</td><td><a href="mailto:${escapeHtml(ticket.email)}">${escapeHtml(ticket.email)}</a></td></tr>
            <tr><td>Phone Number</td><td>${escapeHtml(ticket.phone || "N/A")}</td></tr>
            <tr><td>Event &amp; Venue</td><td>${escapeHtml(ticket.eventName)} (${escapeHtml(ticket.venue)})</td></tr>
            <tr><td>Passes / Details</td><td>${escapeHtml(ticket.numPasses || 1)} Pass${(ticket.numPasses || 1) > 1 ? "es" : ""} ${ticket.notes ? `&bull; ${escapeHtml(ticket.notes)}` : ""}</td></tr>
            <tr><td>UPI Transaction UTR</td><td><strong style="color:var(--terracotta);letter-spacing:0.05em;">${escapeHtml(ticket.utr || "N/A")}</strong></td></tr>
            <tr><td>Expected Amount</td><td><strong style="color:#2e7d32;font-size:1.05rem;">${formatCurrency(ticket.amount)}</strong></td></tr>
            <tr><td>Submitted At</td><td>${formatDate(ticket.verificationSubmittedAt || ticket.createdAt)}</td></tr>
            <tr><td>Payment Status</td><td><span class="badge badge--${(ticket.paymentStatus || "verification_pending").toLowerCase()}">${escapeHtml(ticket.paymentStatus || "verification_pending")}</span></td></tr>
            ${ticket.adminNotes ? `<tr><td>Admin Notes</td><td style="color:#c62828;">${escapeHtml(ticket.adminNotes)}</td></tr>` : ""}
          </tbody>
        </table>
      `;

      if (modalVerifyBtn) {
        modalVerifyBtn.style.display = (ticket.paymentStatus === "verified" || ticket.paymentStatus === "APPROVED") ? "none" : "inline-flex";
      }
      if (modalRejectBtn) {
        modalRejectBtn.style.display = (ticket.paymentStatus === "rejected") ? "none" : "inline-flex";
      }

      modal.classList.add("is-active");
    }

    function closeReviewModal() {
      if (modal) modal.classList.remove("is-active");
      currentReviewToken = null;
    }

    modalClose?.addEventListener("click", closeReviewModal);
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) closeReviewModal();
    });

    modalVerifyBtn?.addEventListener("click", () => {
      if (!currentReviewToken) return;
      const t = UtsavDB.verifyPayment(currentReviewToken);
      showToast(`✓ Payment verified for ${t?.participantName || "participant"}! Digital pass generated and emailed.`, "success");
      closeReviewModal();
      render();
    });

    modalRejectBtn?.addEventListener("click", () => {
      if (!currentReviewToken) return;
      const reason = prompt("Optional internal note for rejection (internal only):", "UTR not matching bank records");
      UtsavDB.rejectPayment(currentReviewToken, reason || "Payment verification rejected");
      showToast(`Payment rejected for registration ${currentReviewToken}.`, "info");
      closeReviewModal();
      render();
    });

    function render() {
      if (!tbody) return;
      const selectedStatus = (statusFilter?.value || "").toLowerCase();

      let tickets = UtsavDB.getTickets();
      if (selectedStatus) {
        tickets = tickets.filter((t) => {
          const s = (t.paymentStatus || "verification_pending").toLowerCase();
          if (selectedStatus === "verified" || selectedStatus === "approved") {
            return s === "verified" || s === "approved";
          }
          if (selectedStatus === "verification_pending" || selectedStatus === "pending") {
            return s === "verification_pending" || s === "pending" || s === "pending_verification";
          }
          return s === selectedStatus;
        });
      }

      if (tickets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 2rem;">No payment transactions recorded for the selected filter.</td></tr>`;
        return;
      }

      tbody.innerHTML = tickets
        .map(
          (t) => {
            const rawStatus = (t.paymentStatus || "verification_pending").toLowerCase();
            const displayStatus = rawStatus === "approved" || rawStatus === "verified"
              ? "VERIFIED"
              : rawStatus === "rejected"
              ? "REJECTED"
              : "VERIFICATION_PENDING";

            return `
        <tr>
          <td><code style="font-weight:700;">${escapeHtml(t.token)}</code></td>
          <td><strong>${escapeHtml(t.participantName)}</strong><br><small class="text-muted">${escapeHtml(t.collegeId || "")}</small></td>
          <td><small><a href="mailto:${escapeHtml(t.email)}">${escapeHtml(t.email)}</a></small></td>
          <td><strong style="font-family:monospace;letter-spacing:0.04em;">${escapeHtml(t.utr || "FREE-PASS")}</strong></td>
          <td><strong>${formatCurrency(t.amount)}</strong></td>
          <td><small>${formatDate(t.verificationSubmittedAt || t.createdAt)}</small></td>
          <td><span class="badge badge--${displayStatus.toLowerCase()}">${escapeHtml(displayStatus)}</span></td>
          <td>
            <div class="action-btn-group" style="display:flex;gap:6px;flex-wrap:wrap;">
              ${displayStatus !== "VERIFIED" ? `<button class="btn btn-sm btn-success verify-pay-btn" data-token="${escapeHtml(t.token)}" title="Verify payment and generate digital QR pass">VERIFY PAYMENT</button>` : ""}
              ${displayStatus !== "REJECTED" ? `<button class="btn btn-sm btn-danger reject-pay-btn" data-token="${escapeHtml(t.token)}" title="Reject this payment">REJECT</button>` : ""}
              <button class="btn btn-sm btn-secondary review-pay-btn" data-token="${escapeHtml(t.token)}" title="Review registration &amp; transaction details">REVIEW</button>
            </div>
          </td>
        </tr>`;
          }
        )
        .join("");

      $all(".verify-pay-btn", tbody).forEach((btn) => {
        btn.addEventListener("click", () => {
          const t = UtsavDB.verifyPayment(btn.dataset.token);
          showToast(`✓ Payment verified for ${t?.participantName || "participant"}! Digital QR pass generated & dispatched.`, "success");
          render();
        });
      });

      $all(".reject-pay-btn", tbody).forEach((btn) => {
        btn.addEventListener("click", () => {
          if (confirm(`Reject payment verification for registration ${btn.dataset.token}?`)) {
            UtsavDB.rejectPayment(btn.dataset.token, "Rejected by admin");
            showToast("Payment rejected.", "info");
            render();
          }
        });
      });

      $all(".review-pay-btn", tbody).forEach((btn) => {
        btn.addEventListener("click", () => {
          openReviewModal(btn.dataset.token);
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
        window.UtsavLoader?.show("ডিজিটাল পাস অনুসন্ধান সফল... লোড হচ্ছে...");
        setTimeout(() => {
          window.location.href = `pass/index.html?token=${encodeURIComponent(ticket.token)}`;
        }, 750);
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
    // 1. Top Viewport Reading Progress Bar
    let progressBar = $("#utsav-scroll-progress");
    if (!progressBar) {
      progressBar = document.createElement("div");
      progressBar.id = "utsav-scroll-progress";
      document.body.appendChild(progressBar);
    }

    let ticking = false;
    function updateScrollProgress() {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (scrollHeight > 0 && progressBar) {
        const progress = Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100));
        progressBar.style.width = `${progress}%`;
      }
      ticking = false;
    }

    window.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollProgress);
        ticking = true;
      }
    }, { passive: true });
    updateScrollProgress();

    // 2. Smooth section scrolling for internal anchor links with sticky navbar offset
    const anchorLinks = $all('a[href^="#"]');
    anchorLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        const href = link.getAttribute("href");
        if (!href || href === "#") return;
        const target = $(href);
        if (target) {
          e.preventDefault();
          const strip = $(".home-strip");
          const stripOffset = strip ? strip.offsetHeight + 12 : 54;
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

    // 3. Viewport-based One-Time Scroll Reveal Animations with silky easing
    const reveals = $all(".scroll-reveal, [data-reveal]");
    if (!reveals.length) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      reveals.forEach((el) => el.classList.add("is-revealed", "is-visible", "in-view"));
      window.reobserveReveal = (el) => el.classList.add("is-revealed", "is-visible", "in-view");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed", "is-visible", "in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -25px 0px" }
    );

    reveals.forEach((el) => observer.observe(el));

    // Expose helper so dynamically-rendered elements (e.g. photo album grid) can be observed
    window.reobserveReveal = (el) => observer.observe(el);
  }

  // =========================================================================
  // 9. EVENT MENU CARD MODALS (MAHALAYA & SARASWATI PUJA)
  // =========================================================================

  /* ---- Mahalaya Bhoj Menu Data ---- */
  const MAHALAYA_MENU = [
    {
      nameBn: "বাসন্তী পোলাও",
      nameEn: "Fragrant Basanti Pulao",
      description: "Slow-cooked Gobindobhog rice with ghee, cashews and raisins.",
      type: "veg",
      image: "assets/menu-basanti-pulao.jpg",
      searchQuery: "Basanti Pulao Bengali dish"
    },
    {
      nameBn: "ঝুরি আলু ভাজা",
      nameEn: "Crispy Jhuri Aloo Bhaja",
      description: "Golden shredded potato crispies, seasoned with salt and a touch of chilli.",
      type: "veg",
      image: "assets/menu-jhuri-aloo.jpg",
      searchQuery: "Jhuri Aloo Bhaja Bengali dish"
    },
    {
      nameBn: "মুচমুচে বেগুনী",
      nameEn: "Crispy Beguni",
      description: "Traditional batter-fried spiced eggplant slices.",
      type: "veg",
      image: "assets/menu-beguni.jpg",
      searchQuery: "Beguni Bengali dish"
    },
    {
      nameBn: "দুধ শুক্তো",
      nameEn: "Traditional Dudh Shukto",
      description: "Classic Bengali bittersweet vegetable medley in milk gravy.",
      type: "veg",
      image: "assets/menu-shukto.jpg",
      searchQuery: "Dudh Shukto Bengali dish"
    },
    {
      nameBn: "ছানার ডালনা",
      nameEn: "Traditional Chhanar Dalna",
      description: "Fresh cottage cheese koftas in rich cumin gravy.",
      type: "veg",
      image: "assets/menu-chhanar-dalna.jpg",
      searchQuery: "Chhanar Dalna Bengali dish"
    },
    {
      nameBn: "ধোঁকার ডালনা",
      nameEn: "Dhokar Dalna",
      description: "Spiced lentil cakes simmered in aromatic gravy.",
      type: "veg",
      image: "assets/menu-dhokar-dalna.jpg",
      searchQuery: "Dhokar Dalna Bengali dish"
    },
    {
      nameBn: "নারকেল দিয়ে ছোলার ডাল",
      nameEn: "Narkel diye Chholar Dal",
      description: "Bengal gram with coconut crisps and warm spices.",
      type: "veg",
      image: "assets/menu-chholar-dal.jpg",
      searchQuery: "Chholar Dal Bengali dish"
    },
    {
      nameBn: "গরম ফুলকো লুচি",
      nameEn: "Garam Luchi / Radhaballabhi",
      description: "Puffed golden deep-fried puris served piping hot.",
      type: "veg",
      image: "assets/menu-luchi.jpg",
      searchQuery: "Bengali Luchi puri"
    },
    {
      nameBn: "টমেটো খেজুর চাটনি",
      nameEn: "Tomato-Khejur Sweet Chutney",
      description: "Rich spiced dates and tomato relish.",
      type: "veg",
      image: "assets/menu-chutney.jpg",
      searchQuery: "Tomato Khejur Chutney Bengali"
    },
    {
      nameBn: "মুচমুচে পাপড় ভাজা",
      nameEn: "Crispy Roasted Papad",
      description: "Traditional crispy lentil wafers, flame-roasted.",
      type: "veg",
      image: "assets/menu-papad.jpg",
      searchQuery: "Papad Indian crispy wafer"
    },
    {
      nameBn: "নলেন গুড়ের রসগোল্লা",
      nameEn: "Spongy Nolen Gur Rosogolla",
      description: "Soft cottage cheese balls in date palm jaggery syrup.",
      type: "veg",
      image: "assets/menu-rosogolla.jpg",
      searchQuery: "Nolen Gur Rosogolla Bengali sweet"
    },
    {
      nameBn: "কলকাতার খাঁটি মিষ্টি দই",
      nameEn: "Authentic Kolkata Mishti Doi",
      description: "Caramelised sweetened yoghurt set in earthen pots.",
      type: "veg",
      image: "assets/menu-rosogolla.jpg",
      searchQuery: "Mishti Doi Kolkata Bengali sweet"
    },
    {
      nameBn: "গোবিন্দভোগ চালের পায়েস",
      nameEn: "Gobindobhog Chaler Payesh",
      description: "Creamy slow-cooked rice pudding with aromatic Gobindobhog rice.",
      type: "veg",
      image: "assets/menu-rosogolla.jpg",
      searchQuery: "Payesh Bengali rice pudding"
    },
    {
      nameBn: "নরোম পাকের সন্দেশ",
      nameEn: "Traditional Bengali Sandesh",
      description: "Delicate fresh cottage cheese confection with cardamom.",
      type: "veg",
      image: "assets/menu-rosogolla.jpg",
      searchQuery: "Bengali Sandesh sweet"
    },
    {
      nameBn: "কাতলা / রুই মাছের কালিয়া",
      nameEn: "Katla Machher Kalia",
      description: "Rich river carp in spiced onion-ginger gravy.",
      type: "nonveg",
      image: "assets/menu-katla-kalia.jpg",
      searchQuery: "Katla Machher Kalia Bengali fish curry"
    },
    {
      nameBn: "কষা মাংস",
      nameEn: "Traditional Bengali Kosha Mangsho",
      description: "Slow-cooked rich spiced mutton curry with potatoes.",
      type: "nonveg",
      image: "assets/menu-kosha-mangsho.jpg",
      searchQuery: "Kosha Mangsho Bengali mutton curry"
    }
  ];

  /**
   * Render the illustrated menu catalogue into the #mahalaya-menu-sections container.
   * Separates dishes into Vegetarian and Non-Vegetarian editorial sections
   * with FSSAI-style dietary symbols, small inset thumbnails, and Google search links.
   */
  function renderMahalayaMenu() {
    const container = $("#mahalaya-menu-sections");
    if (!container) return;

    const vegDishes = MAHALAYA_MENU.filter(d => d.type === "veg");
    const nonvegDishes = MAHALAYA_MENU.filter(d => d.type === "nonveg");

    function buildDishHTML(dish, index) {
      const searchUrl = "https://www.google.com/search?q=" + encodeURIComponent(dish.searchQuery);
      const dietClass = dish.type === "veg" ? "veg" : "nonveg";
      return `
        <a class="mahalaya-menu-dish" href="${searchUrl}" target="_blank" rel="noopener noreferrer"
           style="animation-delay: ${index * 0.06}s" title="Search: ${dish.nameEn}">
          <div class="mahalaya-menu-dish__thumb">
            <img src="${dish.image}" alt="${dish.nameBn}" width="48" height="48" loading="lazy" decoding="async" />
          </div>
          <div class="mahalaya-menu-dish__info">
            <div class="mahalaya-menu-dish__name-row">
              <span class="mahalaya-menu-dish__diet-mark mahalaya-menu-dish__diet-mark--${dietClass}"></span>
              <span class="mahalaya-menu-dish__name-bn">${dish.nameBn}</span>
            </div>
            <span class="mahalaya-menu-dish__name-en">${dish.nameEn}</span>
            ${dish.description ? `<span class="mahalaya-menu-dish__desc">${dish.description}</span>` : ""}
          </div>
          <span class="mahalaya-menu-dish__learn">↗</span>
        </a>`;
    }

    function buildSectionHTML(type, labelBn, labelEn, dishes) {
      const symbolClass = type === "veg" ? "veg" : "nonveg";
      return `
        <div class="mahalaya-menu-diet-section">
          <div class="mahalaya-menu-diet-section__header">
            <span class="mahalaya-menu-diet-symbol mahalaya-menu-diet-symbol--${symbolClass}"></span>
            <span class="mahalaya-menu-diet-section__label">
              <span class="mahalaya-menu-diet-section__label-bn">${labelBn}</span> · ${labelEn}
            </span>
          </div>
          <div class="mahalaya-menu-dish-grid">
            ${dishes.map((d, i) => buildDishHTML(d, i)).join("")}
          </div>
        </div>`;
    }

    container.innerHTML =
      buildSectionHTML("veg", "নিরামিষ", "VEGETARIAN", vegDishes) +
      buildSectionHTML("nonveg", "আমিষ", "NON-VEGETARIAN", nonvegDishes);
  }

  function initMenuCardModal() {
    // Render the data-driven Mahalaya menu catalogue
    renderMahalayaMenu();

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
  // 10. BENGALI FESTIVE TROUPE (DHAKI & DHUNUCHI DANCERS) SLEEK LOADER
  // =========================================================================
  function initUtsavLoader() {
    let loader = $("#utsav-loader");
    if (!loader) {
      loader = document.createElement("div");
      loader.id = "utsav-loader";
      loader.className = "utsav-loader";
      loader.setAttribute("aria-hidden", "false");
      loader.setAttribute("role", "status");
      loader.innerHTML = `
        <div class="utsav-loader__backdrop"></div>
        
        <div class="utsav-loader__stage">
          <!-- Handcrafted Editorial Dhaki & Dhunuchi Troupe SVG -->
          <div class="utsav-loader__graphic">
            <svg viewBox="0 0 720 380" class="utsav-loader-svg" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="dhak-wood" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#5a2210" />
                  <stop offset="50%" stop-color="#8a3c20" />
                  <stop offset="100%" stop-color="#4a180a" />
                </linearGradient>
                <linearGradient id="dhak-drumhead" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="#e8d5b5" />
                  <stop offset="50%" stop-color="#fdf3df" />
                  <stop offset="100%" stop-color="#cbb592" />
                </linearGradient>
                <linearGradient id="terracotta-pot" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="#8f3c1d" />
                  <stop offset="50%" stop-color="#be582d" />
                  <stop offset="100%" stop-color="#6e2b12" />
                </linearGradient>
                <radialGradient id="ember-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="#ffe680" />
                  <stop offset="50%" stop-color="#ff7700" />
                  <stop offset="100%" stop-color="#801c00" />
                </radialGradient>
              </defs>

              <!-- 1. LEFT DHUNUCHI DANCER -->
              <g id="dancer-left" class="dancer-left">
                <!-- Smoke Plume -->
                <g class="smoke-group-left">
                  <path class="smoke-path-1" d="M128 32 C120 18 108 14 116 2 C122 -8 138 -6 130 -22 C124 -34 110 -30 118 -44" fill="none" stroke="rgba(195, 175, 155, 0.7)" stroke-width="6" stroke-linecap="round" />
                  <path class="smoke-path-2" d="M132 30 C140 16 150 12 144 0 C138 -12 124 -10 132 -26" fill="none" stroke="rgba(215, 195, 175, 0.5)" stroke-width="4" stroke-linecap="round" />
                </g>
                <!-- Dhunuchi Pot -->
                <g class="dhunuchi-left-pot">
                  <ellipse cx="128" cy="36" rx="14" ry="4" fill="url(#ember-glow)" class="dhuno-fire-left" />
                  <path d="M112 36 C112 36 116 54 128 54 C140 54 144 36 144 36 Z" fill="url(#terracotta-pot)" />
                  <ellipse cx="128" cy="36" rx="16" ry="3.5" fill="#a44622" stroke="#5a1e0b" stroke-width="1" />
                  <path d="M125 54 L123 68 L118 74 L138 74 L133 68 L131 54 Z" fill="url(#terracotta-pot)" />
                </g>
                <!-- Raised Arm holding Dhunuchi -->
                <path class="dancer-arm-right" d="M122 72 L128 105 L116 128" fill="none" stroke="#d5926c" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
                <circle cx="126" cy="73" r="7" fill="#c48058" />
                <!-- Outstretched Left Arm -->
                <path class="dancer-arm-left" d="M72 135 L42 152 L12 148" fill="none" stroke="#d5926c" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" />
                <circle cx="12" cy="148" r="6" fill="#c48058" />
                <!-- Head & Hair -->
                <g class="dancer-head-left">
                  <path d="M78 88 C70 96 68 112 80 118 C85 110 92 105 96 102 Z" fill="#2c2724" />
                  <path d="M84 92 C88 84 100 84 106 90 C112 96 112 108 106 116 C98 122 88 120 84 112 Z" fill="#e0a37e" />
                  <path d="M82 92 C80 80 94 72 104 74 C112 76 114 84 112 90 C104 84 92 84 86 92 Z" fill="#201b18" />
                  <path d="M98 96 C100 94 104 95 106 98" fill="none" stroke="#4a2612" stroke-width="1.8" stroke-linecap="round" />
                  <path d="M96 106 Q102 112 108 106" fill="none" stroke="#872917" stroke-width="2" stroke-linecap="round" />
                  <path d="M92 115 L92 128 L102 128 L102 116 Z" fill="#d5926c" />
                </g>
                <!-- White Kurta with Red Accents -->
                <g class="dancer-kurta-left">
                  <path d="M82 128 C74 150 68 200 60 270 C80 274 120 274 140 268 C132 200 124 150 118 128 Z" fill="#ffffff" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.06))" />
                  <path d="M94 128 L94 154 C94 158 102 158 102 154 L102 128 Z" fill="#c0392b" />
                  <path d="M120 124 L126 132" stroke="#c0392b" stroke-width="3" stroke-linecap="round" />
                  <path d="M90 170 Q100 210 88 250" fill="none" stroke="#e8e4dc" stroke-width="2.5" />
                  <path d="M110 165 Q106 210 114 252" fill="none" stroke="#e8e4dc" stroke-width="2" />
                </g>
                <!-- Pleated Dhoti -->
                <g class="dancer-dhoti-left">
                  <path d="M60 268 C56 310 74 348 88 358 C96 348 94 300 96 270 Z" fill="#f5f2eb" />
                  <path d="M140 268 C144 310 126 348 112 358 C104 348 106 300 104 270 Z" fill="#ede9e1" />
                  <path d="M88 272 L76 348 L84 356" fill="none" stroke="#c0392b" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M112 272 L124 348 L116 356" fill="none" stroke="#c0392b" stroke-width="3" stroke-linecap="round" />
                </g>
                <!-- Bare Feet -->
                <g class="dancer-feet-left">
                  <path d="M84 354 C80 358 70 366 66 370 C72 372 86 370 90 364 Z" fill="#c48058" />
                  <path d="M114 354 C118 358 128 366 136 368 C132 372 118 370 112 364 Z" fill="#c48058" />
                  <path d="M66 370 C72 372 82 371 88 367" stroke="#c0392b" stroke-width="2.5" fill="none" stroke-linecap="round" />
                  <path d="M136 368 C130 371 122 371 114 367" stroke="#c0392b" stroke-width="2.5" fill="none" stroke-linecap="round" />
                </g>
              </g>

              <!-- 2. CENTER DHAKI (DHAK DRUMMER) -->
              <g id="dhaki-center" class="dhaki-center">
                <!-- Sound Rhythm Ripples -->
                <g class="dhak-sound-waves">
                  <circle cx="435" cy="180" r="48" fill="none" stroke="rgba(217, 147, 59, 0.45)" stroke-width="2.5" class="wave-1" />
                  <circle cx="435" cy="180" r="70" fill="none" stroke="rgba(192, 57, 43, 0.35)" stroke-width="2" class="wave-2" />
                  <circle cx="435" cy="180" r="92" fill="none" stroke="rgba(243, 156, 18, 0.25)" stroke-width="1.8" class="wave-3" />
                </g>
                <!-- Feathers Plume -->
                <g class="dhak-feathers">
                  <path d="M344 76 C340 50 332 40 338 28 C342 40 348 56 348 76 Z" fill="#1c2833" />
                  <path d="M348 76 C348 46 346 34 354 22 C356 36 354 52 352 76 Z" fill="#2c3e50" />
                  <path d="M352 76 C356 48 362 38 368 26 C364 42 358 58 354 76 Z" fill="#1c2833" />
                  <ellipse cx="350" cy="76" rx="8" ry="3" fill="#c0392b" />
                </g>
                <!-- Dhak Body -->
                <g class="dhak-drum-body">
                  <path d="M360 82 L428 128 C416 182 396 216 360 226 L302 168 C324 130 344 98 360 82 Z" fill="#ffffff" stroke="#5a2210" stroke-width="2" />
                  <path d="M366 86 L376 93 L324 186 L312 178 Z" fill="#c0392b" />
                  <path d="M386 100 L398 108 L346 200 L334 192 Z" fill="#c0392b" />
                  <path d="M408 115 L420 123 L370 215 L358 207 Z" fill="#c0392b" />
                  <path d="M302 168 C308 152 338 108 360 82" fill="none" stroke="#78281f" stroke-width="5" stroke-linecap="round" />
                  <ellipse cx="396" cy="180" rx="34" ry="46" fill="url(#dhak-wood)" stroke="#3e1407" stroke-width="2.5" />
                  <ellipse cx="396" cy="180" rx="28" ry="38" fill="url(#dhak-drumhead)" stroke="#78281f" stroke-width="2" />
                  <ellipse cx="396" cy="180" rx="9" ry="12" fill="#542310" opacity="0.65" />
                  <path d="M336 108 C354 116 368 136 360 162" fill="none" stroke="#922b21" stroke-width="10" stroke-linecap="round" />
                </g>
                <!-- Dhaki Head -->
                <g class="dhaki-head">
                  <path d="M330 90 C324 74 340 64 354 66 C368 68 374 78 370 94 C364 86 356 82 344 84 Z" fill="#1a1412" />
                  <path d="M336 86 C336 78 350 78 358 84 C366 92 364 104 358 112 C350 118 340 114 336 104 Z" fill="#be7a54" />
                  <ellipse cx="334" cy="98" rx="4" ry="6" fill="#af6c48" />
                  <path d="M344 110 L346 125 L358 125 L356 112 Z" fill="#af6c48" />
                </g>
                <!-- Dhaki Torso in Orange Kurta -->
                <g class="dhaki-torso">
                  <path d="M332 124 C318 160 300 200 292 248 C320 252 358 246 376 220 C370 180 366 148 358 124 Z" fill="#e67e22" />
                  <path d="M342 124 L348 142 L356 124 Z" fill="#d35400" />
                  <path d="M312 210 Q334 226 352 208" fill="none" stroke="#d35400" stroke-width="2.5" />
                </g>
                <!-- Drumming Arms & Sticks -->
                <g class="dhaki-arm-drumming">
                  <path d="M360 134 L384 158 L374 190" fill="none" stroke="#be7a54" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" />
                  <circle cx="374" cy="190" r="6" fill="#af6c48" />
                  <line class="drumstick-left" x1="374" y1="190" x2="402" y2="182" stroke="#d4ac0d" stroke-width="4.5" stroke-linecap="round" />
                </g>
                <g class="dhaki-arm-right">
                  <path d="M326 138 L348 184 L372 216" fill="none" stroke="#be7a54" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" />
                  <circle cx="372" cy="216" r="6" fill="#af6c48" />
                  <line class="drumstick-right" x1="372" y1="216" x2="396" y2="226" stroke="#d4ac0d" stroke-width="4.5" stroke-linecap="round" />
                </g>
                <!-- Dhoti & Legs -->
                <g class="dhaki-dhoti">
                  <path d="M292 246 C284 278 300 316 324 330 C344 326 370 300 376 250 Z" fill="#fdfbf7" />
                  <path d="M324 330 C346 332 378 322 396 290 C388 266 380 252 374 246 Z" fill="#f4efe6" />
                  <path d="M312 250 Q306 290 326 328" fill="none" stroke="#c0392b" stroke-width="2.5" />
                  <path d="M344 250 Q348 290 372 322" fill="none" stroke="#a04000" stroke-width="2" />
                  <path d="M324 330 Q358 334 394 290" fill="none" stroke="#c0392b" stroke-width="3" />
                </g>
                <g class="dhaki-legs">
                  <path d="M312 320 L296 352 L282 368 C290 372 304 368 312 358 Z" fill="#be7a54" />
                  <path d="M380 308 L404 348 L426 358 C424 364 410 366 398 356 Z" fill="#be7a54" />
                </g>
              </g>

              <!-- 3. RIGHT DHUNUCHI DANCER -->
              <g id="dancer-right" class="dancer-right">
                <!-- Smoke Plume -->
                <g class="smoke-group-right">
                  <path class="smoke-path-3" d="M592 32 C600 18 612 14 604 2 C598 -8 582 -6 590 -22 C596 -34 610 -30 602 -44" fill="none" stroke="rgba(195, 175, 155, 0.7)" stroke-width="6" stroke-linecap="round" />
                  <path class="smoke-path-4" d="M588 30 C580 16 570 12 576 0 C582 -12 596 -10 588 -26" fill="none" stroke="rgba(215, 195, 175, 0.5)" stroke-width="4" stroke-linecap="round" />
                </g>
                <!-- Dhunuchi Pot -->
                <g class="dhunuchi-right-pot">
                  <ellipse cx="592" cy="36" rx="14" ry="4" fill="url(#ember-glow)" class="dhuno-fire-right" />
                  <path d="M576 36 C576 36 580 54 592 54 C604 54 608 36 608 36 Z" fill="url(#terracotta-pot)" />
                  <ellipse cx="592" cy="36" rx="16" ry="3.5" fill="#a44622" stroke="#5a1e0b" stroke-width="1" />
                  <path d="M589 54 L587 68 L582 74 L602 74 L597 68 L595 54 Z" fill="url(#terracotta-pot)" />
                </g>
                <!-- Raised Left Arm -->
                <path class="dancer-right-arm-up" d="M598 72 L592 105 L604 128" fill="none" stroke="#d5926c" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
                <circle cx="594" cy="73" r="7" fill="#c48058" />
                <!-- Outstretched Right Arm -->
                <path class="dancer-right-arm-out" d="M648 135 L678 152 L708 148" fill="none" stroke="#d5926c" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" />
                <circle cx="708" cy="148" r="6" fill="#c48058" />
                <!-- Head & Face -->
                <g class="dancer-head-right">
                  <path d="M642 88 C650 96 652 112 640 118 C635 110 628 105 624 102 Z" fill="#2c2724" />
                  <path d="M636 92 C632 84 620 84 614 90 C608 96 608 108 614 116 C622 122 632 120 636 112 Z" fill="#e0a37e" />
                  <path d="M638 92 C640 80 626 72 616 74 C608 76 606 84 608 90 C616 84 628 84 634 92 Z" fill="#201b18" />
                  <path d="M622 96 C620 94 616 95 614 98" fill="none" stroke="#4a2612" stroke-width="1.8" stroke-linecap="round" />
                  <path d="M624 106 Q618 112 612 106" fill="none" stroke="#872917" stroke-width="2" stroke-linecap="round" />
                  <path d="M628 115 L628 128 L618 128 L618 116 Z" fill="#d5926c" />
                </g>
                <!-- Kurta & Dhoti -->
                <g class="dancer-kurta-right">
                  <path d="M638 128 C646 150 652 200 660 270 C640 274 600 274 580 268 C588 200 596 150 602 128 Z" fill="#ffffff" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.06))" />
                  <path d="M626 128 L626 154 C626 158 618 158 618 154 L618 128 Z" fill="#c0392b" />
                  <path d="M600 124 L594 132" stroke="#c0392b" stroke-width="3" stroke-linecap="round" />
                  <path d="M630 170 Q620 210 632 250" fill="none" stroke="#e8e4dc" stroke-width="2.5" />
                  <path d="M610 165 Q614 210 606 252" fill="none" stroke="#e8e4dc" stroke-width="2" />
                </g>
                <g class="dancer-dhoti-right">
                  <path d="M660 268 C664 310 646 348 632 358 C624 348 626 300 624 270 Z" fill="#f5f2eb" />
                  <path d="M580 268 C576 310 594 348 608 358 C616 348 614 300 616 270 Z" fill="#ede9e1" />
                  <path d="M632 272 L644 348 L636 356" fill="none" stroke="#c0392b" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M608 272 L596 348 L604 356" fill="none" stroke="#c0392b" stroke-width="3" stroke-linecap="round" />
                </g>
                <g class="dancer-feet-right">
                  <path d="M636 354 C640 358 650 366 654 370 C648 372 634 370 630 364 Z" fill="#c48058" />
                  <path d="M606 354 C602 358 592 366 584 368 C588 372 602 370 608 364 Z" fill="#c48058" />
                  <path d="M654 370 C648 372 638 371 632 367" stroke="#c0392b" stroke-width="2.5" fill="none" stroke-linecap="round" />
                  <path d="M584 368 C590 371 598 371 606 367" stroke="#c0392b" stroke-width="2.5" fill="none" stroke-linecap="round" />
                </g>
              </g>
            </svg>
          </div>

          <!-- Sleek Festive Branding & Bengali Caption -->
          <div class="utsav-loader__text-wrap">
            <h3 class="utsav-loader__brand">BANGIYA.SAMITI</h3>
            <p class="utsav-loader__sub">IIIT HYDERABAD &bull; উৎসব পোর্টাল</p>
          </div>
        </div>
      `;
      document.body.prepend(loader);
    }

    const startTime = Date.now();
    const MIN_LOADER_DISPLAY_MS = 400;

    function hideLoader() {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_LOADER_DISPLAY_MS - elapsed);
      setTimeout(() => {
        if (loader) {
          loader.classList.add("utsav-loader--hidden");
          loader.setAttribute("aria-hidden", "true");
        }
      }, remaining);
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
      hideLoader();
    } else {
      document.addEventListener("DOMContentLoaded", hideLoader, { once: true });
      window.addEventListener("load", hideLoader, { once: true });
      setTimeout(hideLoader, 900); // hard fallback maximum 900ms
    }

    // Expose programmatic API for any async actions or page buffering
    window.UtsavLoader = {
      show(bengaliText) {
        if (!loader) return;
        const msgEl = $("#utsav-loader-msg", loader);
        if (msgEl && bengaliText) msgEl.textContent = bengaliText;
        loader.classList.remove("utsav-loader--hidden");
        loader.setAttribute("aria-hidden", "false");
      },
      hide() {
        if (!loader) return;
        loader.classList.add("utsav-loader--hidden");
        loader.setAttribute("aria-hidden", "true");
      }
    };
  }

  // Auto-init loader early if DOM is ready or as soon as script runs
  if (document.body) {
    initUtsavLoader();
  }

  /* =========================================================================
     PUJA LIVING ILLUSTRATION PURE CROSS-DISSOLVE LOOP & LAZY LOADER
     True 100% solid cross-dissolve with zero luminance dip or background bleed
     Lazy loads 9.8MB video only when approaching viewport (rootMargin: 350px)
     ========================================================================= */
  function initPujaSeamlessCrossfadeVideo() {
    const heroHolders = document.querySelectorAll(".events-scene__hero");
    if (!heroHolders.length) return;

    heroHolders.forEach((hero) => {
      const video1 = hero.querySelector(".events-scene__hero-video--1");
      const video2 = hero.querySelector(".events-scene__hero-video--2");
      if (!video1 || !video2) return;

      // Strictly ensure both videos are muted, inline, and native loop disabled
      [video1, video2].forEach((v) => {
        v.muted = true;
        v.playsInline = true;
        v.loop = false;
        v.setAttribute("muted", "");
        v.setAttribute("playsinline", "");
        v.removeAttribute("loop");
      });

      let baseVideo = video1;
      let topVideo = video2;
      let isDissolving = false;
      let isVisible = false;
      let isLoaded = false;
      const DISSOLVE_SEC = 0.4; // 400ms pure linear cross-dissolve

      baseVideo.className = "events-scene__hero-video events-scene__hero-video--1 is-hidden";
      topVideo.className = "events-scene__hero-video events-scene__hero-video--2 is-hidden";

      function loadAndStartVideos() {
        if (isLoaded) return;
        isLoaded = true;

        const src1 = video1.dataset.src || video1.getAttribute("src");
        const src2 = video2.dataset.src || video2.getAttribute("src");

        if (src1 && !video1.getAttribute("src")) video1.src = src1;
        if (src2 && !video2.getAttribute("src")) video2.src = src2;

        video1.load();
        video2.load();

        const onReady = () => {
          video1.removeEventListener("canplay", onReady);
          video1.removeEventListener("loadeddata", onReady);

          baseVideo.className = "events-scene__hero-video events-scene__hero-video--1 is-base";
          topVideo.className = "events-scene__hero-video events-scene__hero-video--2 is-hidden";

          if (isVisible) {
            const p = baseVideo.play();
            if (p !== undefined) p.catch(() => {});
          }
        };

        video1.addEventListener("canplay", onReady, { once: true });
        video1.addEventListener("loadeddata", onReady, { once: true });

        // Fallback safety timeout if cached
        setTimeout(() => {
          if (baseVideo.classList.contains("is-hidden") && baseVideo.readyState >= 2) {
            onReady();
          }
        }, 300);
      }

      function triggerDissolve() {
        if (isDissolving || !isLoaded) return;
        const dur = baseVideo.duration;
        if (!dur || isNaN(dur) || dur <= 0) return;

        const timeLeft = dur - baseVideo.currentTime;
        if (timeLeft <= DISSOLVE_SEC && timeLeft > 0) {
          isDissolving = true;

          // 1. Prepare top video at frame 0 with opacity 0
          topVideo.currentTime = 0;
          topVideo.className = "events-scene__hero-video is-hidden";

          // Force layout reflow before transitioning opacity
          void topVideo.offsetWidth;

          const playPromise = topVideo.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {});
          }

          // 2. Smoothly fade in top video directly over the solid 100% opaque base video
          topVideo.className = "events-scene__hero-video is-top-fading-in";

          // 3. When top video reaches 100% opacity, finalize swap
          setTimeout(() => {
            baseVideo.pause();
            baseVideo.currentTime = 0;
            baseVideo.className = "events-scene__hero-video is-hidden";

            topVideo.className = "events-scene__hero-video is-base";

            const oldBase = baseVideo;
            baseVideo = topVideo;
            topVideo = oldBase;

            isDissolving = false;
          }, Math.round(DISSOLVE_SEC * 1000) + 40);
        }
      }

      function onTimeUpdate(e) {
        if (e.target === baseVideo && !isDissolving) {
          triggerDissolve();
        }
      }

      video1.addEventListener("timeupdate", onTimeUpdate);
      video2.addEventListener("timeupdate", onTimeUpdate);

      video1.addEventListener("ended", () => {
        if (baseVideo === video1 && !isDissolving) triggerDissolve();
      });
      video2.addEventListener("ended", () => {
        if (baseVideo === video2 && !isDissolving) triggerDissolve();
      });

      // Lazy Loading & Playback Visibility IntersectionObserver
      if ("IntersectionObserver" in window) {
        // 1. Preload Observer: starts loading video when 350px near viewport
        const preloadObserver = new IntersectionObserver(
          (entries, obs) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                loadAndStartVideos();
                obs.unobserve(entry.target);
              }
            });
          },
          { rootMargin: "350px 0px" }
        );
        preloadObserver.observe(hero);

        // 2. Playback Observer: plays/pauses based on actual visibility
        const playbackObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              isVisible = entry.isIntersecting;
              if (isVisible) {
                if (isLoaded && baseVideo.paused && baseVideo.readyState >= 2) {
                  baseVideo.play().catch(() => {});
                }
              } else {
                if (isLoaded) {
                  if (!baseVideo.paused) baseVideo.pause();
                  if (!topVideo.paused) topVideo.pause();
                }
              }
            });
          },
          { threshold: 0.08 }
        );
        playbackObserver.observe(hero);
      } else {
        // Fallback: load immediately if IntersectionObserver not available
        isVisible = true;
        loadAndStartVideos();
      }

      // Autoplay unlock for strict browser gesture policies
      const unlock = () => {
        if (isLoaded && isVisible && baseVideo.paused && baseVideo.readyState >= 2) {
          baseVideo.play().catch(() => {});
        }
        window.removeEventListener("scroll", unlock);
        window.removeEventListener("touchstart", unlock);
        window.removeEventListener("click", unlock);
      };
      window.addEventListener("scroll", unlock, { passive: true, once: true });
      window.addEventListener("touchstart", unlock, { passive: true, once: true });
      window.addEventListener("click", unlock, { passive: true, once: true });

      // Page Visibility handling (tab backgrounding)
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          if (isLoaded) {
            if (!baseVideo.paused) baseVideo.pause();
            if (!topVideo.paused) topVideo.pause();
          }
        } else {
          if (isLoaded && isVisible && baseVideo.paused && baseVideo.readyState >= 2) {
            baseVideo.play().catch(() => {});
          }
        }
      });
    });
  }

  // =========================================================================
  // DOM READY DISPATCHER
  // =========================================================================
  document.addEventListener("DOMContentLoaded", () => {
    initUtsavLoader();
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
    initPujaSeamlessCrossfadeVideo();
  });
})();


