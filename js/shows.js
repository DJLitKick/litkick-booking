/* ─────────────────────────────────────────
   DJ LitKick Booking — shows.js
   Public "Upcoming Shows" list on index.html
   Reads from the public.upcoming_shows view (see README.md).
───────────────────────────────────────── */

const SHOWS_EVENT_TYPE_LABELS = {
  club: "Club Night",
  wedding: "Wedding",
  business: "Business Event",
};

const showsList = document.getElementById("shows-list");

function formatShowDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function renderShows(shows) {
  showsList.innerHTML = "";

  if (!shows.length) {
    const empty = document.createElement("p");
    empty.className = "shows-empty";
    empty.textContent = "No upcoming shows listed right now — check back soon.";
    showsList.appendChild(empty);
    return;
  }

  shows.forEach((show) => {
    const row = document.createElement("div");
    row.className = "show-row";

    const date = document.createElement("span");
    date.className = "show-date";
    date.textContent = formatShowDate(show.event_date);

    const detail = document.createElement("span");
    detail.className = "show-detail";
    detail.textContent = show.event_type === "private"
      ? "Private Event"
      : `${SHOWS_EVENT_TYPE_LABELS[show.event_type] || show.event_type} — ${show.location}`;

    row.appendChild(date);
    row.appendChild(detail);
    showsList.appendChild(row);
  });
}

async function loadShows() {
  const { data, error } = await supabaseClient
    .from("upcoming_shows")
    .select("event_date, event_type, location")
    .order("event_date", { ascending: true });

  if (error) {
    console.error("Failed to load upcoming shows:", error);
    showsList.innerHTML = "";
    const errMsg = document.createElement("p");
    errMsg.className = "shows-empty";
    errMsg.textContent = "Couldn't load upcoming shows right now.";
    showsList.appendChild(errMsg);
    return;
  }

  renderShows(data || []);
}

loadShows();
