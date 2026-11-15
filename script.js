
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let complaints = [];
let notices = [];
let currentRole = "resident";
let rwaRealtimeChannel = null;

function toast(message) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.rwaToastTimer);
  window.rwaToastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 3200);
}

function showPage(pageName) {
  const target = document.getElementById(pageName);
  if (!target) return;

  if (target.hasAttribute("data-auth-only") && !window.rwaCurrentUser) {
    toast("Please sign in to access this section.");
    openModal("authModal");
    return;
  }

  $$(".page").forEach(page => page.classList.remove("active"));
  target.classList.add("active");

  $$(".nav-link").forEach(button => {
    button.classList.toggle("active", button.dataset.page === pageName);
  });

  const activeButton = $(`[data-page="${pageName}"]`);
  if (activeButton && $("#pageCrumb")) {
    $("#pageCrumb").textContent = activeButton.textContent.trim();
  }

  $("#sidebar")?.classList.remove("open");
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

function applyAuthVisibility(signedIn) {
  document.querySelectorAll("[data-auth-only]").forEach(node => {
    node.hidden = !signedIn;
  });

  if (!signedIn) showPage("dashboard");
}

function populateResidentProfile(profile) {
  const name = profile?.full_name || "Resident";
  const flat = profile?.flat_number || "Not added";
  const block = profile?.block || "—";

  const title = $("#welcomeTitle");
  if (title) title.textContent = `Welcome, ${name}.`;

  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };

  setText("profileChipName", name);
  setText(
    "profileFlatLabel",
    flat === "Not added" ? "Resident account" : `Flat ${flat}`
  );

  const initials = name.trim().split(/\s+/)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  setText("profileAvatar", initials || "GH");
  setText("residentFlat", flat);
  setText("residentBlock", `BLOCK ${block}`);
  setText("residentFullName", name);
  setText("maintenanceFlat", `${flat} · Block ${block}`);

  const floorMatch = flat.match(/(?:-|\s)(\d)\d{2}$/);
  setText(
    "residentFloor",
    floorMatch
      ? `${Number(floorMatch[1])} Floor`
      : "Not available"
  );
}

function clearResidentProfile() {
  const title = $("#welcomeTitle");

  if (title) {
    title.innerHTML = "Welcome to Global Heights<span>.</span>";
  }

  [
    "profileChipName",
    "profileFlatLabel",
    "profileAvatar",
    "residentFlat",
    "residentBlock",
    "residentFullName",
    "residentFloor",
    "maintenanceFlat"
  ].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.textContent = "";
  });
}

/* ==========================================
   COMPLAINTS - UPDATED DESIGN
========================================== */

function renderComplaints() {
  const container = $("#complaintList");
  if (!container) return;

  const search = ($("#complaintSearch")?.value || "").toLowerCase();
  const filter = $("#complaintFilter")?.value || "all";

  const filtered = complaints.filter(complaint => {
    const title = String(complaint.title || "").toLowerCase();
    const category = String(complaint.category || "").toLowerCase();

    const matchesSearch =
      title.includes(search) || category.includes(search);

    const matchesFilter =
      filter === "all" || complaint.status === filter;

    return matchesSearch && matchesFilter;
  });

  container.innerHTML = "";

  if (!filtered.length) {
    container.innerHTML =
      '<div class="empty-state">No complaints found.</div>';
  } else {
    filtered.forEach(complaint => {
      const row = document.createElement("div");
      row.className = "complaint-row";

      const symbol = document.createElement("div");
      symbol.className = "complaint-symbol";
      symbol.textContent = "◉";

      const main = document.createElement("div");
      main.className = "complaint-main";

      const heading = document.createElement("h3");
      heading.textContent = complaint.title || "Untitled complaint";

      const description = document.createElement("p");
      description.textContent =
        complaint.description || "No description provided.";

      const meta = document.createElement("small");
      meta.textContent =
        `${complaint.category || "Other"} · ${complaint.date || ""}`;

      main.append(heading, description, meta);

      const status = document.createElement("span");

      const statusClass =
        complaint.status === "Resolved"
          ? "success"
          : complaint.status === "Pending"
            ? "warning"
            : "info";

      status.className = `status-pill ${statusClass}`;
      status.textContent = complaint.status || "Pending";

      row.append(symbol, main, status);
      container.appendChild(row);
    });
  }

  const total = complaints.length;

  const pending = complaints.filter(
    item => item.status === "Pending"
  ).length;

  const resolved = complaints.filter(
    item => item.status === "Resolved"
  ).length;

  const open = complaints.filter(
    item => item.status !== "Resolved"
  ).length;

  if ($("#totalComplaints")) $("#totalComplaints").textContent = total;
  if ($("#pendingComplaints")) $("#pendingComplaints").textContent = pending;
  if ($("#resolvedComplaints")) $("#resolvedComplaints").textContent = resolved;
  if ($("#openStat")) $("#openStat").textContent = open;
}

/* ==========================================
   ANNOUNCEMENTS
========================================== */

function renderNotices() {
  const full = $("#announcementList");
  const dashboard = $("#dashboardAnnouncements");

  if (full) full.innerHTML = "";
  if (dashboard) dashboard.innerHTML = "";

  if (!notices.length) {
    if (full) {
      full.innerHTML =
        '<div class="empty-state">No announcements have been published yet.</div>';
    }

    if (dashboard) {
      dashboard.innerHTML =
        '<p class="subtle">No new announcements.</p>';
    }

    if ($("#noticeStat")) $("#noticeStat").textContent = "0";
    return;
  }

  notices.forEach(notice => {
    const card = document.createElement("article");
    card.className = "notice-card";

    const icon = document.createElement("div");
    icon.className = "notice-icon";
    icon.textContent = "▤";

    const content = document.createElement("div");

    const heading = document.createElement("h3");
    heading.textContent = notice.title;

    const body = document.createElement("p");
    body.textContent = notice.body;

    const meta = document.createElement("small");
    meta.textContent =
      `${notice.tag || "NOTICE"} · ${notice.date}`;

    content.append(heading, body, meta);
    card.append(icon, content);

    if (full) full.appendChild(card);

    if (dashboard) {
      const shortCard = document.createElement("div");
      shortCard.className = "announcement-item";

      const shortTitle = document.createElement("b");
      shortTitle.textContent = notice.title;

      const shortDate = document.createElement("small");
      shortDate.textContent = notice.date;

      shortCard.append(shortTitle, shortDate);
      dashboard.appendChild(shortCard);
    }
  });

  if ($("#noticeStat")) {
    $("#noticeStat").textContent = notices.length;
  }
}

function renderAll() {
  renderComplaints();
  renderNotices();
}

/* ==========================================
   SUPABASE DATA
========================================== */

async function loadSharedData() {
  const db = window.rwaSupabase;
  const user = window.rwaCurrentUser;

  if (!db || !user) {
    complaints = [];
    notices = [];
    renderAll();
    return;
  }

  let complaintQuery = db
    .from("complaints")
    .select("ticket_no,title,category,description,status,created_at,user_id")
    .order("created_at", { ascending: false });

  // Residents only request their own complaints.
  // Admin can request all complaints if RLS allows it.
  if (currentRole !== "admin") {
    complaintQuery = complaintQuery.eq("user_id", user.id);
  }

  const [
    { data: complaintRows, error: complaintError },
    { data: noticeRows, error: noticeError }
  ] = await Promise.all([
    complaintQuery,
    db.from("notices")
      .select("id,title,body,tag,created_at")
      .order("created_at", { ascending: false })
  ]);

  if (complaintError) {
    console.error("Complaint loading error:", complaintError);
  }

  if (noticeError) {
    console.error("Notice loading error:", noticeError);
  }

  complaints = (complaintRows || []).map(item => ({
    id: item.ticket_no,
    title: item.title,
    category: item.category,
    description: item.description,
    status: item.status,
    date: new Date(item.created_at).toLocaleDateString("en-IN")
  }));

  notices = (noticeRows || []).map(item => ({
    id: item.id,
    title: item.title,
    body: item.body,
    tag: item.tag,
    date: new Date(item.created_at).toLocaleDateString("en-IN")
  }));

  renderAll();
}

/* ==========================================
   AUTHENTICATION STATE
========================================== */

async function refreshAuthState() {
  const db = window.rwaSupabase;
  if (!db) return;

  if (rwaRealtimeChannel) {
    await db.removeChannel(rwaRealtimeChannel);
    rwaRealtimeChannel = null;
  }

  const {
    data: { session }
  } = await db.auth.getSession();

  window.rwaCurrentUser = session?.user || null;

  const signedIn = Boolean(window.rwaCurrentUser);

  if ($("#authBtn")) $("#authBtn").hidden = signedIn;
  if ($("#logoutBtn")) $("#logoutBtn").hidden = !signedIn;

  applyAuthVisibility(signedIn);

  if (signedIn) {
    const { data: profile, error } = await db
      .from("profiles")
      .select("full_name,flat_number,block,role")
      .eq("id", window.rwaCurrentUser.id)
      .maybeSingle();

    if (error) console.error("Profile loading error:", error);

    window.rwaProfile = profile || null;

    currentRole = profile?.role === "admin" ? "admin" : "resident";

    populateResidentProfile(profile);

    document.body.classList.toggle("is-admin", currentRole === "admin");

    if ($("#roleLabel")) {
      $("#roleLabel").textContent =
        `${currentRole === "admin" ? "Admin" : "Resident"} · ${profile?.flat_number || "Flat pending verification"}`;
    }

    await loadSharedData();

    rwaRealtimeChannel = db
      .channel(`global-heights-${window.rwaCurrentUser.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "complaints" },
        loadSharedData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notices" },
        loadSharedData
      )
      .subscribe();

  } else {
    window.rwaProfile = null;
    currentRole = "resident";

    document.body.classList.remove("is-admin");

    if ($("#roleLabel")) {
      $("#roleLabel").textContent = "Not signed in";
    }

    clearResidentProfile();

    complaints = [];
    notices = [];

    renderAll();
    applyAuthVisibility(false);
  }
}

/* ==========================================
   NAVIGATION
========================================== */

$$("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.page);
  });
});

/* ==========================================
   COMPLAINT MODAL
========================================== */

$$("[data-action='new-complaint']").forEach(button => {
  button.addEventListener("click", () => {
    if (!window.rwaCurrentUser) {
      openModal("authModal");
      return;
    }

    openModal("complaintModal");
  });
});

$("#newComplaintBtn")?.addEventListener("click", () => {
  if (!window.rwaCurrentUser) {
    openModal("authModal");
    return;
  }

  openModal("complaintModal");
});

$$("[data-close-modal]").forEach(button => {
  button.addEventListener("click", () => {
    closeModal(button.closest(".modal-backdrop"));
  });
});

$$(".modal-backdrop").forEach(backdrop => {
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop) closeModal(backdrop);
  });
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    $$(".modal-backdrop.show").forEach(closeModal);
  }
});

/* ==========================================
   SUBMIT COMPLAINT
========================================== */

$("#complaintForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const db = window.rwaSupabase;
  const user = window.rwaCurrentUser;

  if (!db || !user) {
    toast("Please sign in first.");
    return;
  }

  const title = $("#complaintTitle").value.trim();
  const description = $("#complaintDescription").value.trim();

  if (!window.rwaProfile?.flat_number) {
    toast("Your resident profile needs a registered flat number.");
    return;
  }

  const { error } = await db.from("complaints").insert({
    user_id: user.id,
    title,
    description,
    category: $("#complaintCategory").value,
    status: "Pending"
  });

  if (error) {
    toast(`Could not submit: ${error.message}`);
    return;
  }

  await loadSharedData();

  event.target.reset();
  closeModal($("#complaintModal"));
  toast("Complaint saved successfully.");
});

$("#complaintSearch")?.addEventListener("input", renderComplaints);
$("#complaintFilter")?.addEventListener("change", renderComplaints);

/* ==========================================
   SIDEBAR AND APPEARANCE
========================================== */

$("#mobileMenu")?.addEventListener("click", () => {
  $("#sidebar")?.classList.toggle("open");
});

$("#themeToggle")?.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
});

$("#noticeBell")?.addEventListener("click", () => {
  showPage("announcements");
  toast("Showing community announcements.");
});

$("#paymentInfoBtn")?.addEventListener("click", () => {
  toast("Please ask the RWA office for verified payment details. No payment has been made.");
});

/* ==========================================
   PUBLISH NOTICE - ADMIN ONLY
========================================== */

$("#addNoticeBtn")?.addEventListener("click", () => {
  if (currentRole !== "admin") {
    toast("Only admins can publish announcements.");
    return;
  }

  openModal("noticeModal");
});

$("#noticeForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const db = window.rwaSupabase;
  const user = window.rwaCurrentUser;

  if (!db || !user || currentRole !== "admin") {
    toast("Only an authenticated RWA admin can publish notices.");
    return;
  }

  const { error } = await db.from("notices").insert({
    title: $("#noticeTitle").value.trim(),
    body: $("#noticeBody").value.trim(),
    tag: "MANAGEMENT",
    created_by: user.id
  });

  if (error) {
    toast(`Could not publish: ${error.message}`);
    return;
  }

  await loadSharedData();

  event.target.reset();
  closeModal($("#noticeModal"));
  toast("Announcement published.");
});

/* ==========================================
   RESIDENT SEARCH
========================================== */

$("#residentSearch")?.addEventListener("input", event => {
  const query = event.target.value.toLowerCase();

  $$("#residentRows tr").forEach(row => {
    row.hidden = !row.textContent.toLowerCase().includes(query);
  });
});

/* ==========================================
   SIGN IN / REGISTER
========================================== */

let authMode = "signin";

$("#authBtn")?.addEventListener("click", () => {
  openModal("authModal");
});

$("#authModeBtn")?.addEventListener("click", () => {
  authMode = authMode === "signin" ? "signup" : "signin";

  $("#registerFields").hidden = authMode !== "signup";

  $("#authHeading").textContent =
    authMode === "signup"
      ? "Create resident account"
      : "Resident sign in";

  $("#authSubmit").textContent =
    authMode === "signup" ? "Create account" : "Sign in";

  $("#authModeBtn").textContent =
    authMode === "signup"
      ? "Already registered? Sign in"
      : "Create resident account";
});

$("#authForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const db = window.rwaSupabase;

  if (!db) {
    toast("Add your Supabase URL and anon key in supabase-config.js first.");
    return;
  }

  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;

  let result;

  if (authMode === "signup") {
    result = await db.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: $("#authName").value.trim(),
          flat_number: $("#authFlat").value.trim(),
          block: $("#authBlock").value.trim()
        }
      }
    });
  } else {
    result = await db.auth.signInWithPassword({
      email,
      password
    });
  }

  if (result.error) {
    toast(result.error.message);
    return;
  }

  if (authMode === "signup" && !result.data.session) {
    toast("Account created. Verify your email, then sign in.");
  } else {
    toast("Signed in successfully.");
  }

  closeModal($("#authModal"));
  await refreshAuthState();
});

/* ==========================================
   SIGN OUT
========================================== */

$("#logoutBtn")?.addEventListener("click", async () => {
  if (window.rwaSupabase) {
    const { error } = await window.rwaSupabase.auth.signOut();

    if (error) {
      toast(error.message);
      return;
    }
  }

  await refreshAuthState();
  toast("Signed out successfully.");
});

/* ==========================================
   SUPABASE INITIALIZATION
========================================== */

window.addEventListener("rwa-db-ready", refreshAuthState);

/* ==========================================
   DATE
========================================== */

if ($("#todayDate")) {
  $("#todayDate").textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

/* ==========================================
   INITIAL LOAD
========================================== */

renderAll();

if (window.rwaSupabase) {
  refreshAuthState();
}
