const supabase =
  window.supabaseClient;

const {
  data: {
    session
  }
} = await supabase.auth.getSession();

if (
  !session
) {

  window.location.href =
    "login.html";

  throw new Error(
    "No active session"
  );

}

const user =
  session.user;

/* ========================= */
/* FETCH VENDOR */
/* ========================= */

const {
  data: vendor,
  error
} = await supabase
  .from("vendors")
  .select(
    "id, business_type"
  )
  .eq(
    "auth_user_id",
    user.id
  )
  .single();

if (
  error ||
  !vendor
) {

  alert(
    "Unable to load vendor profile."
  );

  throw error;

}

/* ========================= */
/* ALREADY SELECTED */
/* ========================= */

if (
  vendor.business_type
) {

  window.location.href =
    "vendordashboard.html";

}

/* ========================= */
/* CONTINUE */
/* ========================= */

const continueBtn =
  document.getElementById(
    "businessTypeContinueBtn"
  );

continueBtn.addEventListener(
  "click",
  async () => {

    const selected =
      document.querySelector(
        'input[name="businessType"]:checked'
      );

    if (
      !selected
    ) {

      alert(
        "Select a business type."
      );

      return;

    }

    continueBtn.disabled =
      true;

    try {

      const {
        error
      } = await supabase
        .from(
          "vendors"
        )
        .update({

          business_type:
            selected.value

        })
        .eq(
          "id",
          vendor.id
        );

      if (error) {
        throw error;
      }

      window.location.href =
        "vendordashboard.html";

    } catch (err) {

      console.error(
        err
      );

      alert(
        "Unable to save business type."
      );

      continueBtn.disabled =
        false;

    }

  }
);