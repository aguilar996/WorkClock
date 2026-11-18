const C = window.CLOCK_CONFIG;

const API =
  C.API_URL.replace(/\/$/, "");

const $ =
  (selector) =>
    document.querySelector(selector);


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
// MONEY
// ========================================

function money(cents) {

  return new Intl.NumberFormat(
    C.locale,
    {
      style: "currency",
      currency: C.currency
    }
  ).format(
    (cents || 0) / 100
  );
}


// ========================================
// API
// ========================================

async function api(
  path,
  options = {}
) {

  const headers = {

    "Content-Type":
      "application/json",

    ...(options.headers || {})
  };


  const token =
    getToken();


  if (token) {

    headers.Authorization =
      `Bearer ${token}`;

  }


  const response =
    await fetch(
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
// LOAD CURRENT RATE
// ========================================

async function loadSettings() {

  try {

    const status =
      await api(
        "/api/status"
      );


    const rateCents =
      status.currentRateCents || 0;


    $("#hourlyRate").value =
      (
        rateCents / 100
      ).toFixed(2);


    $("#oldRateExample")
      .textContent =
      `${money(rateCents)}/hr`;


    $("#newRateExample")
      .textContent =
      `${money(rateCents)}/hr`;


    updateAdminState();


  } catch (error) {

    console.error(
      error
    );


    $("#settingsError")
      .textContent =
      error.message;

  }
}


// ========================================
// ADMIN STATE
// ========================================

function updateAdminState() {

  const admin =
    isAdmin();


  $("#lockedCard")
    .classList.toggle(
      "hidden",
      admin
    );


  $("#rateForm")
    .classList.toggle(
      "hidden",
      !admin
    );

}


// ========================================
// RATE PREVIEW
// ========================================

$("#hourlyRate")
  .addEventListener(
    "input",
    () => {

      const rate =
        Number(
          $("#hourlyRate").value
        );


      if (
        Number.isFinite(rate) &&
        rate > 0
      ) {

        $("#newRateExample")
          .textContent =
          `${money(
            Math.round(
              rate * 100
            )
          )}/hr`;

      }

    }
  );


// ========================================
// SAVE RATE
// ========================================

$("#rateForm")
  .addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      if (!isAdmin()) {

        updateAdminState();

        return;
      }


      const rate =
        Number(
          $("#hourlyRate").value
        );


      if (
        !Number.isFinite(rate) ||
        rate <= 0
      ) {

        $("#settingsError")
          .textContent =
          "Enter a valid hourly rate.";

        return;
      }


      const cents =
        Math.round(
          rate * 100
        );


      $("#settingsError")
        .textContent = "";


      $("#settingsSuccess")
        .classList.add(
          "hidden"
        );


      $("#saveRateBtn")
        .disabled = true;


      $("#saveRateBtn")
        .textContent =
        "Saving...";


      try {

        const result =
          await api(
            "/api/settings/rate",
            {
              method: "PUT",

              body:
                JSON.stringify({
                  hourly_rate_cents:
                    cents
                })
            }
          );


        $("#hourlyRate")
          .value =
          (
            result.currentRateCents /
            100
          ).toFixed(2);


        $("#newRateExample")
          .textContent =
          `${money(
            result.currentRateCents
          )}/hr`;


        $("#settingsSuccess")
          .classList.remove(
            "hidden"
          );


        setTimeout(
          () => {

            $("#settingsSuccess")
              .classList.add(
                "hidden"
              );

          },
          3000
        );


      } catch (error) {


        $("#settingsError")
          .textContent =
          error.message;


        if (
          error.message ===
          "Unauthorized"
        ) {

          sessionStorage
            .removeItem(
              "clockAdminToken"
            );


          updateAdminState();

        }


      } finally {


        $("#saveRateBtn")
          .disabled = false;


        $("#saveRateBtn")
          .textContent =
          "Save new rate";

      }

    }
  );


// ========================================
// START
// ========================================

loadSettings();
