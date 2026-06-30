function lockScroll() {
  document.body.style.overflow = "hidden";
}

function unlockScroll() {
  document.body.style.overflow = "";
}

/**
 * @param {object} options
 * @param {string} options.title
 * @param {string | Node | ((bodyEl: HTMLElement) => void)} [options.content]
 * @param {{ label: string, variant?: "primary" | "secondary", onClick?: () => void, close?: boolean }[]} [options.actions]
 * @param {() => void} [options.onClose]
 * @returns {{ close: () => void, dialog: HTMLDialogElement }}
 */
export function openModal({ title, content, actions = [], onClose }) {
  const previousFocus = document.activeElement;

  const dialog = document.createElement("dialog");
  dialog.className = "modal";

  const panel = document.createElement("div");
  panel.className = "modal__panel";

  const titleEl = document.createElement("h2");
  titleEl.className = "modal__title";
  const titleId = `modal-title-${Date.now()}`;
  titleEl.id = titleId;
  titleEl.textContent = title;
  dialog.setAttribute("aria-labelledby", titleId);

  const bodyEl = document.createElement("div");
  bodyEl.className = "modal__body";

  if (typeof content === "function") {
    content(bodyEl);
  } else if (content instanceof Node) {
    bodyEl.appendChild(content);
  } else if (content != null) {
    const paragraph = document.createElement("p");
    paragraph.textContent = String(content);
    bodyEl.appendChild(paragraph);
  }

  const actionsEl = document.createElement("div");
  actionsEl.className = "modal__actions";

  function closeModal() {
    if (!dialog.open) return;
    dialog.close();
  }

  for (const action of actions) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      action.variant === "primary" ? "btn btn-primary" : "btn btn-secondary";
    btn.textContent = action.label;
    btn.addEventListener("click", () => {
      action.onClick?.();
      if (action.close !== false) {
        closeModal();
      }
    });
    actionsEl.appendChild(btn);
  }

  panel.appendChild(titleEl);
  panel.appendChild(bodyEl);
  if (actions.length > 0) {
    panel.appendChild(actionsEl);
  }
  dialog.appendChild(panel);
  document.body.appendChild(dialog);

  dialog.addEventListener("close", () => {
    dialog.remove();
    unlockScroll();
    onClose?.();
    if (previousFocus instanceof HTMLElement) {
      previousFocus.focus();
    }
  });

  lockScroll();
  dialog.showModal();

  const firstButton = actionsEl.querySelector("button");
  if (firstButton instanceof HTMLButtonElement) {
    firstButton.focus();
  }

  return { close: closeModal, dialog };
}

/**
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.message
 * @returns {Promise<void>}
 */
export function alert({ title, message }) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    openModal({
      title,
      content: message,
      actions: [{ label: "Okay", variant: "primary", onClick: settle }],
      onClose: settle,
    });
  });
}
