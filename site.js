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
    EVENTS: "utsavpass:events",
    TICKETS: "utsavpass:tickets",
    CHECKINS: "utsavpass:checkins",
    AUTH: "utsavpass:auth"
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
      price: 0,
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
      utr: "FREE-PASS",
      amount: 0,
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
    email: "admin@utsavpass.local",
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
        eventName: ticket.eventName || "UTSAVPASS",
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
  // 2. STORY GALLERY LIGHTBOX
  // =========================================================================
  function initStoryGallery() {
    const gallery = $(".story-gallery");
    if (!gallery) return;
    const items = $all(".story-gallery__item", gallery);
    const lightbox = $(".story-lightbox");
    const lightboxImg = $(".story-lightbox__image", lightbox);
    const lightboxTitle = $(".story-lightbox__title", lightbox);
    const lightboxDate = $(".story-lightbox__date", lightbox);
    const lightboxCaption = $(".story-lightbox__caption", lightbox);

    function open(item) {
      if (!lightbox || !lightboxImg) return;
      const img = $("img", item);
      const title = $(".story-gallery__copy span", item)?.textContent || "আমাদের গল্প";
      const date = $(".story-gallery__copy strong", item)?.textContent || "";
      const caption = $(".story-gallery__copy p", item)?.textContent || "";
      lightboxImg.src = img?.src || "";
      lightboxImg.alt = img?.alt || title;
      if (lightboxTitle) lightboxTitle.textContent = title;
      if (lightboxDate) lightboxDate.textContent = date;
      if (lightboxCaption) lightboxCaption.textContent = caption;
      lightbox.hidden = false;
      document.body.style.overflow = "hidden";
    }

    function close() {
      if (!lightbox) return;
      lightbox.hidden = true;
      document.body.style.overflow = "";
    }

    items.forEach((item) => item.addEventListener("click", () => open(item)));
    const panel = $(".story-lightbox__panel", lightbox);
    const closeBtn = $(".story-lightbox__close", lightbox);
    closeBtn?.addEventListener("click", close);
    panel?.addEventListener("click", (event) => event.stopPropagation());
    lightbox?.addEventListener("click", close);
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
  }

  // =========================================================================
  // 3. REGISTRATION FORMS
  // =========================================================================
  function initRegistrationForms() {
    const forms = $all("form[data-vanilla-registration]");
    forms.forEach((form) => {
      const status = $(".form-status", form);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(form);

        const eventSlug = form.dataset.eventSlug || "general";
        const matchedEvent = UtsavDB.getEvent(eventSlug) || {};
        const prefix = form.dataset.ticketPrefix || (eventSlug.slice(0, 3).toUpperCase());

        const ticket = {
          token: uniqueToken(prefix),
          eventSlug: eventSlug,
          eventName: form.dataset.eventName || matchedEvent.name || "Community Event",
          venue: form.dataset.eventVenue || matchedEvent.venue || "Campus Venue",
          participantName: String(data.get("full_name") || data.get("name") || "Attendee").trim(),
          collegeId: String(data.get("college_id") || "N/A").trim(),
          phone: String(data.get("phone") || "N/A").trim(),
          email: String(data.get("email") || "N/A").trim(),
          utr: String(data.get("utr") || data.get("transaction_id") || (matchedEvent.price === 0 ? "FREE-PASS" : "MOCK-UTR-" + Math.floor(100000 + Math.random() * 900000))).trim(),
          amount: matchedEvent.price !== undefined ? matchedEvent.price : 250,
          createdAt: new Date().toISOString(),
          paymentStatus: matchedEvent.price === 0 ? "APPROVED" : "APPROVED", // instant approval for seamless offline testing
          status: "UNUSED",
          gate: "Gate 1"
        };

        UtsavDB.saveTicket(ticket);
        showToast(`Registration confirmed for ${ticket.participantName}!`, "success");

        if (status) {
          status.className = "form-status form-status--success";
          status.innerHTML = `<strong>Registration successful!</strong><br>Generated Pass Token: <code>${ticket.token}</code><br>Redirecting to your digital pass preview...`;
        }

        const target = form.dataset.passTarget || "pass/?token=";
        window.setTimeout(() => {
          window.location.href = `${target}${encodeURIComponent(ticket.token)}`;
        }, 700);
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
        eventName: "UTSAVPASS",
        venue: "Campus Venue",
        participantName: "Guest Attendee",
        collegeId: "2026-GUEST",
        createdAt: new Date().toISOString(),
        paymentStatus: "APPROVED",
        status: "UNUSED"
      };
    }

    // Populate Pass Metadata
    $all(".pass-world__event", root).forEach((el) => (el.textContent = ticket.eventName || "UTSAVPASS"));
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
      window.location.href = `admin/scanner/?token=${encodeURIComponent(ticket.token)}`;
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
          window.location.href = `pass/?token=${encodeURIComponent(found.token)}`;
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
            <td><a class="token-link" href="pass/?token=${encodeURIComponent(t.token)}" title="View Pass"><code>${escapeHtml(t.token)}</code></a></td>
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
      if (confirm("Reset all UTSAVPASS local data back to initial sample state?")) {
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
                <a class="btn btn-sm btn-secondary" href="events/${encodeURIComponent(evt.slug)}/" title="View public page">View Page</a>
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
        window.location.href = "admin/events/";
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
          <td><a class="token-link" href="pass/?token=${encodeURIComponent(t.token)}" target="_blank" title="Open Digital Pass"><code>${escapeHtml(t.token)}</code></a></td>
          <td><strong>${formatCurrency(t.amount)}</strong><br><small class="text-muted">${escapeHtml(t.utr || "Verified")}</small></td>
          <td><span class="badge badge--${t.status.toLowerCase()}">${escapeHtml(t.status)}</span></td>
          <td><small>${formatDate(t.createdAt)}</small></td>
          <td>
            <div class="action-btn-group">
              <a class="btn btn-sm btn-secondary" href="pass/?token=${encodeURIComponent(t.token)}" target="_blank">Pass</a>
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
      link.setAttribute("download", `utsavpass_registrations_${new Date().toISOString().slice(0, 10)}.csv`);
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
          <td><a class="token-link" href="pass/?token=${encodeURIComponent(c.token)}" target="_blank"><code>${escapeHtml(c.token)}</code></a></td>
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
        window.location.href = "admin/";
      }, 600);
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const emailInput = $("#email", form);
      const email = (emailInput?.value || "admin@utsavpass.local").trim();
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
          window.location.href = `pass/?token=${encodeURIComponent(ticket.token)}`;
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
        <a class="events-scene__card" href="events/${encodeURIComponent(evt.slug)}/">
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const reveals = $all("[data-reveal]");
    if (!("IntersectionObserver" in window) || !reveals.length) return;
    reveals.forEach((node) => node.classList.add("is-reveal"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    reveals.forEach((node) => observer.observe(node));
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
  });
})();


