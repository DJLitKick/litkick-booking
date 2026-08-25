/* ─────────────────────────────────────────
   DJ LitKick Booking — admin.js
   Password-gated pending bookings list: confirm / decline
   See README.md for how to set/rotate the admin password.
───────────────────────────────────────── */

const SESSION_KEY = "litkick_admin_password";

const EVENT_TYPE_LABELS = {
  club: "Club Night",
  wedding: "Wedding",
  private: "Private Event",
  business: "Business Event",
};

const adminGate = document.getElementById("admin-gate");
const adminPasswordInput = document.getElementById("admin-password");
const adminGateError = document.getElementById("admin-gate-error");
const adminGateSubmit = document.getElementById("admin-gate-submit");
const adminStatus = document.getElementById("admin-status");
const adminList = document.getElementById("admin-list");

function getStoredPassword() {
  return sessionStorage.getItem(SESSION_KEY);
}
function setStoredPassword(password) {
  sessionStorage.setItem(SESSION_KEY, password);
}
function clearStoredPassword() {
  sessionStorage.removeItem(SESSION_KEY);
}

function showGate(errorMessage) {
  adminGate.classList.remove("is-hidden");
  adminGateError.textContent = errorMessage || "";
  adminPasswordInput.value = "";
  adminPasswordInput.focus();
}
function hideGate() {
  adminGate.classList.add("is-hidden");
}

function formatDateHuman(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function renderPendingRow(booking, password) {
  const row = document.createElement("div");
  row.classList.add("admin-row");
  row.dataset.id = booking.id;

  const fields = [
    ["Name", `${booking.first_name} ${booking.last_name}`],
    ["Date", formatDateHuman(booking.event_date)],
    ["Event Type", EVENT_TYPE_LABELS[booking.event_type] || booking.event_type],
    ["Location", booking.location],
    ["Technique Needed", booking.technique_needed ? "Yes" : "No"],
    ["Email", booking.email],
  ];

  fields.forEach(([k, v]) => {
    const field = document.createElement("div");
    field.classList.add("admin-field");
    field.innerHTML = `<span class="k">${k}</span><span class="v">${v}</span>`;
    row.appendChild(field);
  });

  const actions = document.createElement("div");
  actions.classList.add("admin-actions");

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "admin-btn admin-btn--confirm";
  confirmBtn.textContent = "Confirm";
  confirmBtn.addEventListener("click", () => handleStatusChange(booking.id, "confirmed", password, row, [confirmBtn, declineBtn]));

  const declineBtn = document.createElement("button");
  declineBtn.className = "admin-btn admin-btn--decline";
  declineBtn.textContent = "Decline";
  declineBtn.addEventListener("click", () => handleStatusChange(booking.id, "declined", password, row, [confirmBtn, declineBtn]));

  actions.appendChild(confirmBtn);
  actions.appendChild(declineBtn);
  row.appendChild(actions);

  return row;
}

function renderPendingList(bookings, password) {
  adminList.innerHTML = "";
  if (!bookings.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = "No pending requests right now.";
    adminList.appendChild(empty);
    return;
  }
  bookings.forEach((booking) => {
    adminList.appendChild(renderPendingRow(booking, password));
  });
}

async function handleStatusChange(bookingId, newStatus, password, rowEl, buttons) {
  buttons.forEach((btn) => (btn.disabled = true));
  const { error } = await supabaseClient.rpc("admin_update_booking_status", {
    p_password: password,
    p_booking_id: bookingId,
    p_new_status: newStatus,
  });

  if (error) {
    console.error("Status update failed:", error);
    adminStatus.textContent = "Could not update that request. Please try again.";
    adminStatus.classList.add("is-error");
    buttons.forEach((btn) => (btn.disabled = false));
    return;
  }

  adminStatus.textContent = "";
  adminStatus.classList.remove("is-error");
  rowEl.remove();
  if (!adminList.children.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = "No pending requests right now.";
    adminList.appendChild(empty);
  }
}

async function loadPendingBookings(password) {
  adminStatus.textContent = "Loading pending requests…";
  adminStatus.classList.remove("is-error");

  const { data, error } = await supabaseClient.rpc("admin_list_pending", { p_password: password });

  if (error) {
    clearStoredPassword();
    showGate("Incorrect password.");
    adminStatus.textContent = "";
    return;
  }

  setStoredPassword(password);
  hideGate();
  adminStatus.textContent = "";
  renderPendingList(data || [], password);
}

function init() {
  adminGateSubmit.addEventListener("click", () => {
    const password = adminPasswordInput.value;
    if (!password) {
      adminGateError.textContent = "Please enter the admin password.";
      return;
    }
    loadPendingBookings(password);
  });

  adminPasswordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") adminGateSubmit.click();
  });

  const storedPassword = getStoredPassword();
  if (storedPassword) {
    loadPendingBookings(storedPassword);
  } else {
    showGate();
  }
}

init();
