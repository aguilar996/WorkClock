const C = window.CLOCK_CONFIG;
const API = C.API_URL.replace(/\/$/, "");

const $ = (selector) =>
  document.querySelector(selector);

let shifts = [];
let currentRateCents = 0;


// ========================================
// AUTH
// ========================================

function getToken() {
  return sessionStorage.getItem(
    "clockAdminToken"
  );
}

function isAdmin() {
  return Boolean(getToken());
}


// ========================================
// FORMATTING
// ========================================

function money(cents) {
  return new Intl.NumberFormat(
    C.locale,
    {
      style: "currency",
      currency: C.currency
    }
  ).format((cents || 0) / 100);
}

function duration(minutes) {
  const safeMinutes = Math.max(
    0,
    Math.round(minutes || 0)
  );

  const hours =
    Math.floor(safeMinutes / 60);

  const remaining =
    safeMinutes % 60;

  return `${hours}h ${String(
    remaining
  ).padStart(2, "0")}m`;
}

function localDateParts(isoDate) {
  const date = new Date(isoDate);

  const dateValue =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: C.timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    ).format(date);

  const timeValue =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: C.timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }
    ).format(date);

  return {
    date: dateValue,
    time: timeValue
  };
}


// ========================================
// API
// ========================================

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const token = getToken();

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  const response = await fetch(
    API + path,
    {
      ...options,
      headers
    }
  );

  let responseData = {};

  try {
    responseData =
      await response.json();
  } catch {
    responseData = {};
  }

  if (!response.ok) {
    throw new Error(
      responseData.error ||
      `Request failed (${response.status})`
    );
  }

  return responseData;
}


// ========================================
// LOAD
// ========================================

async function loadPage() {
  try {
    const [shiftResponse, statusResponse] =
      await Promise.all([
        api("/api/shifts"),
        api("/api/status")
      ]);

    shifts =
      shiftResponse.shifts || [];

    currentRateCents =
      statusResponse.currentRateCents || 0;

    render();

  } catch (error) {
    console.error(error);

    $("#shiftList").innerHTML = `
      <div class="empty">
        Could not load shifts:
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}


// ========================================
// DISPLAY
// ========================================

function render() {
  $("#shiftTotal").textContent =
    `${shifts.length} ${
      shifts.length === 1
        ? "record"
        : "records"
    }`;

  $("#addShiftBtn").classList.toggle(
    "hidden",
    !isAdmin()
  );

  $("#unlockBtn").classList.toggle(
    "hidden",
    isAdmin()
  );

  if (!shifts.length) {
    $("#shiftList").innerHTML = `
      <div class="empty">
        No shifts yet.
      </div>
    `;

    return;
  }

  $("#shiftList").innerHTML =
    shifts.map((shift) => {
      const start =
        localDateParts(shift.clock_in);

      const end = shift.clock_out
        ? localDateParts(shift.clock_out)
        : null;

      const dateLabel =
        new Date(
          shift.clock_in
        ).toLocaleDateString(
          C.locale,
          {
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: C.timeZone
          }
        );

      return `
        <article
          class="shift-editor-card"
          data-shift-id="${shift.id}">

          <button
            type="button"
            class="shift-card-button"
            data-action="edit"
            data-shift-id="${shift.id}"
            ${isAdmin() ? "" : "disabled"}>

            <div class="shift-card-date">
              ${escapeHtml(dateLabel)}
            </div>

            <div class="shift-cell-grid">

              <div class="shift-cell">
                <span>In</span>
                <strong>
                  ${escapeHtml(start.time)}
                </strong>
              </div>

              <div class="shift-cell">
                <span>Out</span>
                <strong>
                  ${
                    end
                      ? escapeHtml(end.time)
                      : "Working"
                  }
                </strong>
              </div>

              <div class="shift-cell">
                <span>Rate</span>
                <strong>
                  ${money(
                    shift.hourly_rate_cents
                  )}
                </strong>
              </div>

            </div>

            <div class="shift-card-summary">

              <span>
                ${duration(
                  shift.duration_minutes
                )}
              </span>

              <strong>
                ${money(
                  shift.earnings_cents
                )}
              </strong>

            </div>

          </button>

        </article>
      `;
    }).join("");

  document
    .querySelectorAll(
      '[data-action="edit"]'
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          openEditDialog(
            Number(
              button.dataset.shiftId
            )
          );
        }
      );
    });
}


// ========================================
// ADD DIALOG
// ========================================

function openAddDialog() {
  if (!isAdmin()) {
    return;
  }

  const today =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: C.timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    ).format(new Date());

  $("#shiftDialogTitle").textContent =
    "Add shift";

  $("#shiftId").value = "";
  $("#shiftDate").value = today;
  $("#shiftStart").value = "08:00";
  $("#shiftEnd").value = "16:00";

  $("#shiftRate").value =
    (currentRateCents / 100)
      .toFixed(2);

  $("#shiftError").textContent = "";

  $("#deleteShiftBtn")
    .classList.add("hidden");

  $("#shiftDialog").showModal();
}


// ========================================
// EDIT DIALOG
// ========================================

function openEditDialog(shiftId) {
  if (!isAdmin()) {
    return;
  }

  const shift = shifts.find(
    (item) => item.id === shiftId
  );

  if (!shift) {
    return;
  }

  if (!shift.clock_out) {
    alert(
      "Active shifts should be closed from the main Clock page before editing."
    );

    return;
  }

  const start =
    localDateParts(shift.clock_in);

  const end =
    localDateParts(shift.clock_out);

  $("#shiftDialogTitle").textContent =
    "Edit shift";

  $("#shiftId").value =
    String(shift.id);

  $("#shiftDate").value =
    start.date;

  $("#shiftStart").value =
    start.time;

  $("#shiftEnd").value =
    end.time;

  $("#shiftRate").value =
    (
      shift.hourly_rate_cents / 100
    ).toFixed(2);

  $("#shiftError").textContent = "";

  $("#deleteShiftBtn")
    .classList.remove("hidden");

  $("#shiftDialog").showModal();
}


// ========================================
// SAVE
// ========================================

$("#shiftForm").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    if (!isAdmin()) {
      return;
    }

    const shiftId =
      $("#shiftId").value.trim();

    const date =
      $("#shiftDate").value;

    const startTime =
      $("#shiftStart").value;

    const endTime =
      $("#shiftEnd").value;

    const rate =
      Number($("#shiftRate").value);

    if (
      !date ||
      !startTime ||
      !endTime
    ) {
      $("#shiftError").textContent =
        "Complete the date and both times.";

      return;
    }

    if (
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      $("#shiftError").textContent =
        "Enter a valid hourly rate.";

      return;
    }

    const start =
      new Date(
        `${date}T${startTime}:00`
      );

    const end =
      new Date(
        `${date}T${endTime}:00`
      );

    if (end <= start) {
      $("#shiftError").textContent =
        "Clock out must be after clock in.";

      return;
    }

    const payload = {
      clock_in: start.toISOString(),
      clock_out: end.toISOString(),
      hourly_rate_cents:
        Math.round(rate * 100)
    };

    $("#saveShiftBtn").disabled = true;
    $("#saveShiftBtn").textContent =
      "Saving...";

    try {
      if (shiftId) {
        await api(
          `/api/shifts/${shiftId}`,
          {
            method: "PUT",
            body: JSON.stringify(payload)
          }
        );
      } else {
        await api(
          "/api/shifts",
          {
            method: "POST",
            body: JSON.stringify(payload)
          }
        );
      }

      $("#shiftDialog").close();

      await loadPage();

    } catch (error) {
      $("#shiftError").textContent =
        error.message;

      if (
        error.message === "Unauthorized"
      ) {
        sessionStorage.removeItem(
          "clockAdminToken"
        );

        render();
      }

    } finally {
      $("#saveShiftBtn").disabled = false;
      $("#saveShiftBtn").textContent =
        "Save";
    }
  }
);


// ========================================
// DELETE
// ========================================

$("#deleteShiftBtn").addEventListener(
  "click",
  async () => {
    const shiftId =
      $("#shiftId").value.trim();

    if (!shiftId || !isAdmin()) {
      return;
    }

    const confirmed = confirm(
      "Delete this shift permanently?"
    );

    if (!confirmed) {
      return;
    }

    $("#deleteShiftBtn").disabled = true;
    $("#deleteShiftBtn").textContent =
      "Deleting...";

    try {
      await api(
        `/api/shifts/${shiftId}`,
        {
          method: "DELETE"
        }
      );

      $("#shiftDialog").close();

      await loadPage();

    } catch (error) {
      $("#shiftError").textContent =
        error.message;

    } finally {
      $("#deleteShiftBtn").disabled = false;
      $("#deleteShiftBtn").textContent =
        "Delete";
    }
  }
);


// ========================================
// BUTTONS
// ========================================

$("#addShiftBtn").addEventListener(
  "click",
  openAddDialog
);

$("#cancelShiftBtn").addEventListener(
  "click",
  () => {
    $("#shiftDialog").close();
  }
);

$("#unlockBtn").addEventListener(
  "click",
  () => {
    window.location.href =
      "index.html";
  }
);


// ========================================
// SECURITY HELPER
// ========================================

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// ========================================
// START
// ========================================

loadPage();
