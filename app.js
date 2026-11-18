const C = window.CLOCK_CONFIG;
const API = C.API_URL.replace(/\/$/, "");

const $ = (selector) => document.querySelector(selector);

let data = {
  activeShift: null,
  weekMinutes: 0,
  weekEarningsCents: 0,
  currentRateCents: 0,
  recent: [],
};


// ========================================
// AUTH
// ========================================

function getToken() {
  return sessionStorage.getItem("clockAdminToken");
}

function isAdmin() {
  return Boolean(getToken());
}


// ========================================
// FORMATTING
// ========================================

function money(cents) {
  return new Intl.NumberFormat(C.locale, {
    style: "currency",
    currency: C.currency
  }).format((cents || 0) / 100);
}

function duration(milliseconds) {
  const minutes = Math.max(
    0,
    Math.floor(milliseconds / 60000)
  );

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m`;
}

function calculateLiveEarnings(shift) {
  if (!shift) {
    return 0;
  }

  const milliseconds =
    Date.now() - new Date(shift.clock_in).getTime();

  return Math.round(
    (milliseconds / 3600000) *
    shift.hourly_rate_cents
  );
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
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    API + path,
    {
      ...options,
      headers
    }
  );

  let responseData;

  try {
    responseData = await response.json();
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
// LOAD STATUS
// ========================================

async function refresh() {
  try {
    data = await api("/api/status");

    render();
  } catch (error) {
    console.error("API error:", error);

    $("#status").textContent = "API NOT CONNECTED";

    $("#recent").innerHTML = `
      <div class="empty">
        Could not connect to the Cloudflare Worker.
      </div>
    `;
  }
}


// ========================================
// RENDER
// ========================================

function render() {
  const active = data.activeShift;

  // Status
  $("#status").textContent =
    active ? "CLOCKED IN" : "CLOCKED OUT";


  // Current rate
  $("#rate").textContent =
    `${money(data.currentRateCents)}/hr`;


  // Completed pay-week time
  let totalMilliseconds =
    (data.weekMinutes || 0) * 60000;


  // Add current running shift
  if (active) {
    totalMilliseconds +=
      Date.now() -
      new Date(active.clock_in).getTime();
  }


  $("#weekHours").textContent =
    duration(totalMilliseconds);


  // Earnings
  const currentShiftEarnings =
    calculateLiveEarnings(active);

  const totalWeekEarnings =
    (data.weekEarningsCents || 0) +
    currentShiftEarnings;

  $("#weekPay").textContent =
    money(totalWeekEarnings);


  // Admin controls
  $("#clockBtn").classList.toggle(
    "hidden",
    !isAdmin()
  );

  $("#publicHint").classList.toggle(
    "hidden",
    isAdmin()
  );


  if (isAdmin()) {
    $("#adminBtn").textContent = "🔓";
  } else {
    $("#adminBtn").textContent = "🔒";
  }


  // Clock button
  $("#clockBtn").textContent =
    active ? "Clock Out" : "Clock In";


  // Live timer
  $("#liveBlock").classList.toggle(
    "hidden",
    !active
  );


  // Recent activity
  renderRecent();

  updateLiveDisplay();
}


// ========================================
// RECENT SHIFTS
// ========================================

function renderRecent() {
  const recent = data.recent || [];

  if (!recent.length) {
    $("#recent").innerHTML = `
      <div class="empty">
        No shifts yet.
      </div>
    `;

    return;
  }

  $("#recent").innerHTML = recent
    .map((shift) => {

      const clockIn =
        new Date(shift.clock_in);

      const dateLabel =
        clockIn.toLocaleDateString(
          C.locale,
          {
            weekday: "short",
            month: "short",
            day: "numeric",
            timeZone: C.timeZone
          }
        );

      const startTime =
        clockIn.toLocaleTimeString(
          C.locale,
          {
            hour: "numeric",
            minute: "2-digit",
            timeZone: C.timeZone
          }
        );

      let endTime = "working";

      if (shift.clock_out) {
        endTime =
          new Date(
            shift.clock_out
          ).toLocaleTimeString(
            C.locale,
            {
              hour: "numeric",
              minute: "2-digit",
              timeZone: C.timeZone
            }
          );
      }

      let shiftDuration;
      let earnings;

      if (shift.clock_out) {

        shiftDuration =
          duration(
            (shift.duration_minutes || 0) *
            60000
          );

        earnings =
          money(
            shift.earnings_cents || 0
          );

      } else {

        const milliseconds =
          Date.now() -
          new Date(
            shift.clock_in
          ).getTime();

        shiftDuration =
          duration(milliseconds);

        earnings =
          money(
            calculateLiveEarnings(shift)
          );
      }


      return `
        <div class="row">

          <div>
            <strong>
              ${dateLabel}
            </strong>

            <small>
              ${startTime} → ${endTime}
            </small>
          </div>

          <div>
            <strong>
              ${shiftDuration}
            </strong>

            <small>
              ${earnings}
            </small>
          </div>

        </div>
      `;
    })
    .join("");
}


// ========================================
// LIVE TIMER
// ========================================

function updateLiveDisplay() {
  const active = data.activeShift;

  if (!active) {
    return;
  }

  const milliseconds =
    Date.now() -
    new Date(active.clock_in).getTime();

  const totalSeconds =
    Math.max(
      0,
      Math.floor(milliseconds / 1000)
    );

  const hours =
    Math.floor(totalSeconds / 3600);

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60
    );

  const seconds =
    totalSeconds % 60;


  $("#liveTime").textContent =
    `${String(hours).padStart(2, "0")}:` +
    `${String(minutes).padStart(2, "0")}:` +
    `${String(seconds).padStart(2, "0")}`;


  $("#livePay").textContent =
    `${money(
      calculateLiveEarnings(active)
    )} current shift`;
}


// ========================================
// LIVE REFRESH
// ========================================

setInterval(() => {

  if (!data.activeShift) {
    return;
  }

  updateLiveDisplay();


  // Update main earnings continuously
  const currentShiftEarnings =
    calculateLiveEarnings(
      data.activeShift
    );

  $("#weekPay").textContent =
    money(
      (data.weekEarningsCents || 0) +
      currentShiftEarnings
    );


  const currentMilliseconds =
    Date.now() -
    new Date(
      data.activeShift.clock_in
    ).getTime();

  const totalMilliseconds =
    ((data.weekMinutes || 0) * 60000) +
    currentMilliseconds;

  $("#weekHours").textContent =
    duration(totalMilliseconds);

}, 1000);


// ========================================
// ADMIN BUTTON
// ========================================

$("#adminBtn").addEventListener(
  "click",
  () => {

    if (isAdmin()) {

      // Clicking unlocked icon logs out
      sessionStorage.removeItem(
        "clockAdminToken"
      );

      render();

      return;
    }


    $("#loginError").textContent = "";

    $("#loginDialog").showModal();

    setTimeout(() => {
      $("#password").focus();
    }, 100);
  }
);

$("#loginCancel").addEventListener(
  "click",
  () => {
    $("#password").value = "";
    $("#loginError").textContent = "";
    $("#loginDialog").close();
  }
);
// ========================================
// LOGIN
// ========================================

$("#loginForm").addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    const password =
      $("#password").value;

    if (!password) {
      $("#loginError").textContent =
        "Enter your password.";

      return;
    }


    $("#loginSubmit").disabled = true;
    $("#loginSubmit").textContent =
      "Unlocking...";


    try {

      const result =
        await api(
          "/api/login",
          {
            method: "POST",

            body: JSON.stringify({
              password
            })
          }
        );


      sessionStorage.setItem(
        "clockAdminToken",
        result.token
      );


      $("#password").value = "";
      $("#loginError").textContent = "";

      $("#loginDialog").close();

      await refresh();


    } catch (error) {

      console.error(
        "Login error:",
        error
      );

      $("#loginError").textContent =
        error.message;

    } finally {

      $("#loginSubmit").disabled = false;

      $("#loginSubmit").textContent =
        "Unlock";
    }
  }
);


// ========================================
// CLOCK IN / CLOCK OUT
// ========================================

$("#clockBtn").addEventListener(
  "click",
  async () => {

    if (!isAdmin()) {
      return;
    }


    const button = $("#clockBtn");

    button.disabled = true;


    try {

      if (data.activeShift) {

        button.textContent =
          "Clocking out...";

        await api(
          "/api/clock-out",
          {
            method: "POST"
          }
        );

      } else {

        button.textContent =
          "Clocking in...";

        await api(
          "/api/clock-in",
          {
            method: "POST"
          }
        );
      }


      await refresh();


    } catch (error) {

      console.error(
        "Clock error:",
        error
      );

      alert(error.message);

      // If token expired
      if (
        error.message === "Unauthorized"
      ) {
        sessionStorage.removeItem(
          "clockAdminToken"
        );

        render();
      }

    } finally {

      button.disabled = false;
    }
  }
);


// ========================================
// START APP
// ========================================

refresh();
