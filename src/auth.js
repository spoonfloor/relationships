import { getSupabase } from "./supabaseClient.js";
import { openModal } from "./modal.js";
import { setDisplayText } from "./display.js";

/** Last password entered in the edit prompt; sent with every write. Memory only. */
let editPassword = "";

export function getEditPassword() {
  return editPassword;
}

/** @param {string} password */
async function passwordIsValid(password) {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("verify_edit_password", {
    p_password: password,
  });
  if (error) throw error;
  return data === true;
}

function isLocalDev() {
  const host = location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/** @returns {Promise<boolean>} */
export function promptEditPassword() {
  const localDev = isLocalDev();

  return new Promise((resolve) => {
    let settled = false;
    const settle = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    const input = document.createElement("input");
    input.type = "password";
    input.className = "modal__input";
    input.autocomplete = "off";

    const errorEl = document.createElement("p");
    errorEl.className = "modal__error";
    errorEl.hidden = true;

    function showError(message = "Wrong password. Try again.") {
      setDisplayText(errorEl, message);
      errorEl.hidden = false;
      input.classList.add("modal__input--error");
      input.select();
    }

    function clearError() {
      errorEl.hidden = true;
      input.classList.remove("modal__input--error");
    }

    async function submitPassword() {
      clearError();
      let ok;
      try {
        // Local dev skips the check so the edit UI opens; writes still need the real password.
        ok = localDev || (await passwordIsValid(input.value));
      } catch (err) {
        console.error(err);
        showError("Could not check the password. Try again.");
        return;
      }
      if (ok) {
        editPassword = input.value;
        settle(true);
        closeModal();
        return;
      }
      showError();
    }

    const { close: closeModal } = openModal({
      title: "Password required",
      content: (body) => {
        const message = document.createElement("p");
        setDisplayText(message, "Enter the editing password in order to continue");
        body.appendChild(message);

        const label = document.createElement("label");
        label.className = "label";
        setDisplayText(label, "Password");
        body.appendChild(label);
        body.appendChild(input);
        body.appendChild(errorEl);
      },
      actions: [
        { label: "Cancel", variant: "secondary", onClick: () => settle(false) },
        {
          label: localDev ? "Open Sesame" : "Continue",
          variant: "primary",
          close: false,
          onClick: submitPassword,
        },
      ],
      onClose: () => {
        if (!settled) settle(false);
      },
    });

    input.addEventListener("input", clearError);

    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      submitPassword();
    });

    window.setTimeout(() => input.focus(), 0);
  });
}
