const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector("#main-nav");

menuToggle?.addEventListener("click", () => {
  const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isExpanded));
  menuToggle.setAttribute("aria-label", isExpanded ? "Abrir menu" : "Fechar menu");
  mainNav.classList.toggle("is-open", !isExpanded);
});

mainNav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    menuToggle?.setAttribute("aria-expanded", "false");
    menuToggle?.setAttribute("aria-label", "Abrir menu");
    mainNav.classList.remove("is-open");
  });
});

document.querySelectorAll("[data-service]").forEach((link) => {
  link.addEventListener("click", () => {
    const serviceField = document.querySelector("#service");
    if (serviceField) {
      serviceField.value = link.dataset.service;
    }
  });
});

const contactEmail = "";
const projectForm = document.querySelector("#project-form");
const formStatus = document.querySelector("#form-status");

projectForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!projectForm.reportValidity()) {
    return;
  }

  if (!contactEmail) {
    formStatus.textContent =
      "Seu pedido não foi enviado: o e-mail oficial da equipe ainda não foi configurado.";
    formStatus.classList.add("form-status-error");
    formStatus.classList.remove("form-status-success");
    return;
  }

  const formData = new FormData(projectForm);
  const subject = `Pedido de orçamento — ${formData.get("service")}`;
  const body = [
    `Nome: ${formData.get("name")}`,
    `Empresa: ${formData.get("company") || "Não informado"}`,
    `E-mail: ${formData.get("email")}`,
    `Serviço: ${formData.get("service")}`,
    "",
    "Sobre o projeto:",
    formData.get("message"),
  ].join("\n");

  window.location.href = `mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  formStatus.textContent =
    "Seu aplicativo de e-mail deve abrir com o pedido preparado. Confira e envie para concluir.";
  formStatus.classList.add("form-status-success");
  formStatus.classList.remove("form-status-error");
});
