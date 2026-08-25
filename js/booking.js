/* ─────────────────────────────────────────
   DJ LitKick Booking — booking.js
   Calendar rendering + booking form submit flow
   Supports selecting multiple dates, persisted across month navigation.
   See README.md for EmailJS setup instructions.
───────────────────────────────────────── */

/* Paste your EmailJS public key + IDs below. See README.md section "EmailJS setup". */
const EMAILJS_PUBLIC_KEY = "BUya2SJnz4W6GAoDcT7JT";
const EMAILJS_SERVICE_ID = "service_r3m65ho";
const EMAILJS_TEMPLATE_CUSTOMER = "template_m28l8nq";
const EMAILJS_TEMPLATE_OWNER = "template_c12ce5f";

emailjs.init(EMAILJS_PUBLIC_KEY);

const EVENT_TYPE_LABELS = {
  club: "Club Night",
  wedding: "Wedding",
  private: "Private Event",
  business: "Business Event",
};

const WEEKDAY_OFFSET = 1; // week starts Monday (JS getDay(): 0=Sun..6=Sat)
const MAX_YEAR = 2030;
const MAX_MONTH = 11; // December, 0-indexed

const today = new Date();
today.setHours(0, 0, 0, 0);
const MIN_YEAR = today.getFullYear();
const MIN_MONTH = today.getMonth();

let viewYear = MIN_YEAR;
let viewMonth = MIN_MONTH;
let selectedDates = new Set(); // persists across month navigation — not reset by renderCalendar()
let bookedDates = new Set();

/* ── ELEMENT REFS ── */
const siteHeader = document.getElementById("site-header");
const calGrid = document.getElementById("cal-grid");
const calMonthLabel = document.getElementById("cal-month-label");
const calPrevBtn = document.getElementById("cal-prev");
const calNextBtn = document.getElementById("cal-next");
const selectedDatesContainer = document.getElementById("selected-dates");
const confirmedDatesList = document.getElementById("confirmed-dates-list");
const bookingForm = document.getElementById("booking-form");
const formFields = document.getElementById("form-fields");
const formConfirmation = document.getElementById("form-confirmation");
const formError = document.getElementById("form-error");
const formStatus = document.getElementById("form-status");
const formSubmit = document.getElementById("form-submit");

/* ── DATE HELPERS ── */
function formatDateISO(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDateHuman(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function formatDateShort(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function getMonthMatrix(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 7 - WEEKDAY_OFFSET) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/* ── SUPABASE ── */
async function fetchBookedDates() {
  try {
    const { data, error } = await supabaseClient.from("booked_dates").select("event_date");
    if (error) {
      console.error("Failed to load booked dates:", error);
      return new Set();
    }
    return new Set(data.map((row) => row.event_date));
  } catch (err) {
    console.error("Failed to load booked dates:", err);
    return new Set();
  }
}

/* ── CALENDAR RENDERING ── */
function renderCalendar() {
  const label = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", {
    month: "long", year: "numeric",
  });
  calMonthLabel.textContent = label;

  calPrevBtn.disabled = viewYear === MIN_YEAR && viewMonth === MIN_MONTH;
  calNextBtn.disabled = viewYear === MAX_YEAR && viewMonth === MAX_MONTH;

  calGrid.innerHTML = "";
  const cells = getMonthMatrix(viewYear, viewMonth);

  cells.forEach((day) => {
    const cell = document.createElement("div");
    cell.classList.add("cal-day");

    if (day === null) {
      cell.classList.add("cal-day--other-month");
      calGrid.appendChild(cell);
      return;
    }

    const iso = formatDateISO(viewYear, viewMonth, day);
    const cellDate = new Date(viewYear, viewMonth, day);
    cell.textContent = String(day);

    const isPast = cellDate < today;
    const isBooked = bookedDates.has(iso);
    const isToday = cellDate.getTime() === today.getTime();
    const isSelected = selectedDates.has(iso);

    if (isToday) cell.classList.add("cal-day--today");

    if (isPast || isBooked) {
      cell.classList.add(isPast ? "cal-day--past" : "cal-day--booked");
    } else {
      if (isSelected) cell.classList.add("cal-day--selected");
      cell.addEventListener("click", () => toggleDate(iso));
    }

    calGrid.appendChild(cell);
  });
}

/* ── SELECTED DATES (multi-select, persists across months) ── */
function toggleDate(iso) {
  if (selectedDates.has(iso)) {
    selectedDates.delete(iso);
  } else {
    selectedDates.add(iso);
  }
  formError.textContent = "";
  renderSelectedDatesList();
  renderCalendar();
}

function renderSelectedDatesList() {
  selectedDatesContainer.innerHTML = "";

  if (selectedDates.size === 0) {
    const msg = document.createElement("span");
    msg.className = "no-dates-msg";
    msg.textContent = "No dates selected yet — click one or more available dates on the calendar.";
    selectedDatesContainer.appendChild(msg);
    return;
  }

  Array.from(selectedDates).sort().forEach((iso) => {
    const chip = document.createElement("span");
    chip.className = "date-chip";
    chip.textContent = formatDateShort(iso);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "date-chip-remove";
    removeBtn.setAttribute("aria-label", `Remove ${formatDateShort(iso)}`);
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => toggleDate(iso));

    chip.appendChild(removeBtn);
    selectedDatesContainer.appendChild(chip);
  });
}

function renderConfirmedDatesList(dates) {
  confirmedDatesList.innerHTML = "";
  dates.forEach((iso) => {
    const chip = document.createElement("span");
    chip.className = "date-chip date-chip--static";
    chip.textContent = formatDateShort(iso);
    confirmedDatesList.appendChild(chip);
  });
}

function goPrevMonth() {
  if (calPrevBtn.disabled) return;
  viewMonth -= 1;
  if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
  renderCalendar();
}

function goNextMonth() {
  if (calNextBtn.disabled) return;
  viewMonth += 1;
  if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
  renderCalendar();
}

/* ── FORM VALIDATION ── */
function validateForm() {
  if (selectedDates.size === 0) {
    return "Please select at least one available date on the calendar.";
  }

  const firstName = document.getElementById("first-name").value.trim();
  const lastName = document.getElementById("last-name").value.trim();
  const location = document.getElementById("location").value.trim();
  const eventType = document.getElementById("event-type").value;
  const email = document.getElementById("email").value.trim();

  if (!firstName || !lastName || !location || !eventType || !email) {
    return "Please fill in all required fields.";
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return "Please enter a valid email address.";
  }
  return null;
}

function getCommonFields() {
  return {
    first_name: document.getElementById("first-name").value.trim(),
    last_name: document.getElementById("last-name").value.trim(),
    location: document.getElementById("location").value.trim(),
    event_type: document.getElementById("event-type").value,
    technique_needed: document.getElementById("technique-needed").checked,
    email: document.getElementById("email").value.trim(),
  };
}

/* ── EMAIL ── */
async function sendConfirmationEmails(common, dates) {
  const eventTypeLabel = EVENT_TYPE_LABELS[common.event_type] || common.event_type;
  const datesLabel = dates.map(formatDateHuman).join("; ");

  const customerParams = {
    email: common.email,
    first_name: common.first_name,
    last_name: common.last_name,
    event_dates: datesLabel,
    event_type: eventTypeLabel,
    location: common.location,
  };
  const ownerParams = {
    first_name: common.first_name,
    last_name: common.last_name,
    location: common.location,
    event_type: eventTypeLabel,
    event_dates: datesLabel,
    technique_needed: common.technique_needed ? "Yes" : "No",
    email: common.email,
    reply_to: common.email,
  };

  const results = await Promise.allSettled([
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_CUSTOMER, customerParams),
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_OWNER, ownerParams),
  ]);
  results.forEach((result) => {
    if (result.status === "rejected") console.error("EmailJS send failed:", result.reason);
  });
}

/* ── SUBMIT FLOW ── */
async function handleSubmit(event) {
  event.preventDefault();
  formError.textContent = "";
  formStatus.textContent = "";
  formStatus.classList.remove("is-error");

  const validationError = validateForm();
  if (validationError) {
    formError.textContent = validationError;
    return;
  }

  formSubmit.disabled = true;
  formStatus.textContent = "Sending your request…";

  const common = getCommonFields();
  const dates = Array.from(selectedDates).sort();
  const rows = dates.map((iso) => ({ ...common, event_date: iso, status: "pending" }));

  // Single multi-row INSERT — Postgres runs it as one statement, so a unique-violation
  // on any date rolls back the whole batch (no dates end up half-booked).
  let error;
  try {
    ({ error } = await supabaseClient.from("bookings").insert(rows));
  } catch (err) {
    error = err;
  }

  if (error) {
    formSubmit.disabled = false;
    if (error.code === "23505") {
      bookedDates = await fetchBookedDates();
      const conflicted = dates.filter((iso) => bookedDates.has(iso));
      conflicted.forEach((iso) => selectedDates.delete(iso));
      renderSelectedDatesList();
      renderCalendar();
      formStatus.textContent = conflicted.length
        ? `Sorry, ${conflicted.length > 1 ? "some of your selected dates were" : "one of your selected dates was"} just booked by someone else and ${conflicted.length > 1 ? "have" : "has"} been removed from your selection. Please review and send again.`
        : "Something went wrong — please try again.";
      formStatus.classList.add("is-error");
    } else {
      console.error("Booking insert failed:", error);
      formStatus.textContent = "Something went wrong sending your request. Please try again.";
      formStatus.classList.add("is-error");
    }
    return;
  }

  dates.forEach((iso) => bookedDates.add(iso));
  selectedDates.clear();
  renderCalendar();

  renderConfirmedDatesList(dates);
  formFields.style.display = "none";
  formConfirmation.classList.add("is-visible");

  sendConfirmationEmails(common, dates);
}

/* ── HEADER SCROLL EFFECT ── */
window.addEventListener("scroll", () => {
  siteHeader.classList.toggle("scrolled", window.scrollY > 40);
}, { passive: true });

/* ── INIT ── */
async function init() {
  calPrevBtn.addEventListener("click", goPrevMonth);
  calNextBtn.addEventListener("click", goNextMonth);
  bookingForm.addEventListener("submit", handleSubmit);

  renderCalendar();
  renderSelectedDatesList();
  bookedDates = await fetchBookedDates();
  renderCalendar();
}

init();
