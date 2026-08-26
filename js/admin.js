/* ─────────────────────────────────────────
   DJ LitKick Booking — admin.js
   Password-gated bookings list: confirm / decline / delete / add manually
   See README.md for how to set/rotate the admin password.
───────────────────────────────────────── */

const SESSION_KEY = "litkick_admin_password";
const MAX_DATE = "2030-12-31";

const EVENT_TYPE_LABELS = {
  club: "Club Night",
  wedding: "Wedding",
  private: "Private Event",
  business: "Business Event",
};

const STATUS_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  declined: "Declined",
};

const adminGate = document.getElementById("admin-gate");
const adminPasswordInput = document.getElementById("admin-password");
const adminGateError = document.getElementById("admin-gate-error");
const adminGateSubmit = document.getElementById("admin-gate-submit");
const adminStatus = document.getElementById("admin-status");
const adminList = document.getElementById("admin-list");

const addForm = document.getElementById("admin-add-form");
const addFirstName = document.getElementById("add-first-name");
const addLastName = document.getElementById("add-last-name");
const addLocation = document.getElementById("add-location");
const addEventType = document.getElementById("add-event-type");
const addEventDate = document.getElementById("add-event-date");
const addTechniqueNeeded = document.getElementById("add-technique-needed");
const addEmail = document.getElementById("add-email");
const addError = document.getElementById("admin-add-error");
const addStatus = document.getElementById("admin-add-status");
const addSubmit = document.getElementById("admin-add-submit");

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

function renderBookingRow(booking, password) {
  const row = document.createElement("div");
  row.classList.add("admin-row");
  row.dataset.id = booking.id;

  const fields = [
    ["Status", STATUS_LABELS[booking.status] || booking.status, `status-${booking.status}`],
    ["Name", `${booking.first_name} ${booking.last_name}`],
    ["Date", formatDateHuman(booking.event_date)],
    ["Event Type", EVENT_TYPE_LABELS[booking.event_type] || booking.event_type],
    ["Location", booking.location],
    ["Technique Needed", booking.technique_needed ? "Yes" : "No"],
    ["Email", booking.email],
  ];

  fields.forEach(([k, v, extraClass]) => {
    const field = document.createElement("div");
    field.classList.add("admin-field");
    field.innerHTML = `<span class="k">${k}</span><span class="v${extraClass ? " " + extraClass : ""}">${v}</span>`;
    row.appendChild(field);
  });

  const actions = document.createElement("div");
  actions.classList.add("admin-actions");
  const allButtons = [];

  if (booking.status === "pending") {
    const confirmBtn = document.createElement("button");
    confirmBtn.className = "admin-btn admin-btn--confirm";
    confirmBtn.textContent = "Confirm";
    allButtons.push(confirmBtn);

    const declineBtn = document.createElement("button");
    declineBtn.className = "admin-btn admin-btn--decline";
    declineBtn.textContent = "Decline";
    allButtons.push(declineBtn);

    confirmBtn.addEventListener("click", () => handleStatusChange(booking.id, "confirmed", password, row, allButtons));
    declineBtn.addEventListener("click", () => handleStatusChange(booking.id, "declined", password, row, allButtons));

    actions.appendChild(confirmBtn);
    actions.appendChild(declineBtn);
  }

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "admin-btn admin-btn--delete";
  deleteBtn.textContent = "Delete";
  allButtons.push(deleteBtn);
  deleteBtn.addEventListener("click", () => handleDelete(booking.id, password, row, allButtons));
  actions.appendChild(deleteBtn);

  row.appendChild(actions);
  return row;
}

function renderBookingList(bookings, password) {
  adminList.innerHTML = "";
  if (!bookings.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = "No bookings yet.";
    adminList.appendChild(empty);
    return;
  }
  bookings.forEach((booking) => {
    adminList.appendChild(renderBookingRow(booking, password));
  });
}

function showEmptyIfNeeded() {
  if (!adminList.children.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = "No bookings yet.";
    adminList.appendChild(empty);
  }
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
  loadBookings(password);
}

async function handleDelete(bookingId, password, rowEl, buttons) {
  if (!window.confirm("Delete this booking permanently? This cannot be undone.")) return;

  buttons.forEach((btn) => (btn.disabled = true));
  const { error } = await supabaseClient.rpc("admin_delete_booking", {
    p_password: password,
    p_booking_id: bookingId,
  });

  if (error) {
    console.error("Delete failed:", error);
    adminStatus.textContent = "Could not delete that booking. Please try again.";
    adminStatus.classList.add("is-error");
    buttons.forEach((btn) => (btn.disabled = false));
    return;
  }

  adminStatus.textContent = "";
  adminStatus.classList.remove("is-error");
  rowEl.remove();
  showEmptyIfNeeded();
}

async function loadBookings(password) {
  adminStatus.textContent = "Loading bookings…";
  adminStatus.classList.remove("is-error");

  const { data, error } = await supabaseClient.rpc("admin_list_all_bookings", { p_password: password });

  if (error) {
    clearStoredPassword();
    showGate("Incorrect password.");
    adminStatus.textContent = "";
    return;
  }

  setStoredPassword(password);
  hideGate();
  adminStatus.textContent = "";
  renderBookingList(data || [], password);
}

/* ── ADD BOOKING ── */
function validateAddForm() {
  if (
    !addFirstName.value.trim() ||
    !addLastName.value.trim() ||
    !addLocation.value.trim() ||
    !addEventType.value ||
    !addEventDate.value ||
    !addEmail.value.trim()
  ) {
    return "Please fill in all required fields.";
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(addEmail.value.trim())) {
    return "Please enter a valid email address.";
  }
  return null;
}

async function handleAddSubmit(event) {
  event.preventDefault();
  addError.textContent = "";
  addStatus.textContent = "";
  addStatus.classList.remove("is-error");

  const validationError = validateAddForm();
  if (validationError) {
    addError.textContent = validationError;
    return;
  }

  const password = getStoredPassword();
  addSubmit.disabled = true;
  addStatus.textContent = "Adding booking…";

  const { error } = await supabaseClient.rpc("admin_add_booking", {
    p_password: password,
    p_first_name: addFirstName.value.trim(),
    p_last_name: addLastName.value.trim(),
    p_location: addLocation.value.trim(),
    p_event_type: addEventType.value,
    p_technique_needed: addTechniqueNeeded.checked,
    p_email: addEmail.value.trim(),
    p_event_date: addEventDate.value,
  });

  addSubmit.disabled = false;

  if (error) {
    console.error("Add booking failed:", error);
    addStatus.textContent = "";
    addError.textContent = error.message.includes("duplicate")
      ? "That date is already booked."
      : "Could not add that booking. Please try again.";
    return;
  }

  addStatus.textContent = "Booking added.";
  addForm.reset();
  loadBookings(password);
}

function initAddForm() {
  const todayIso = new Date().toISOString().slice(0, 10);
  addEventDate.min = todayIso;
  addEventDate.max = MAX_DATE;
  addForm.addEventListener("submit", handleAddSubmit);
}

function init() {
  adminGateSubmit.addEventListener("click", () => {
    const password = adminPasswordInput.value;
    if (!password) {
      adminGateError.textContent = "Please enter the admin password.";
      return;
    }
    loadBookings(password);
  });

  adminPasswordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") adminGateSubmit.click();
  });

  initAddForm();

  const storedPassword = getStoredPassword();
  if (storedPassword) {
    loadBookings(storedPassword);
  } else {
    showGate();
  }
}

init();
