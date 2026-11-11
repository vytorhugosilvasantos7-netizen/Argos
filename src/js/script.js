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

const projectForm = document.querySelector("#project-form");
const formStatus = document.querySelector("#form-status");
const config = window.ARGOS_CONFIG;

projectForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!projectForm.reportValidity()) {
    return;
  }

  if (!config?.whatsappNumber || !/^\d{10,15}$/.test(config.whatsappNumber)) {
    formStatus.textContent = "O WhatsApp da equipe ainda não está configurado.";
    formStatus.classList.add("form-status-error");
    formStatus.classList.remove("form-status-success");
    return;
  }

  const formData = new FormData(projectForm);
  const name = String(formData.get("name") ?? "").trim();
  const service = String(formData.get("service") ?? "").trim();
  const details = String(formData.get("message") ?? "").trim();
  if (!name) {
    formStatus.textContent = "Informe seu nome ou o nome da empresa para continuar.";
    formStatus.classList.add("form-status-error");
    projectForm.querySelector("#name").focus();
    return;
  }

  const message =
    `Olá! Meu nome é ${name} e tenho interesse em: ${service}. ` +
    `Detalhes rápidos: ${details || "Não informado"}.`;
  const whatsappUrl =
    `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(message)}`;

  formStatus.textContent = "Abrindo o WhatsApp com sua mensagem...";
  formStatus.classList.remove("form-status-error", "form-status-success");

  const whatsappWindow = window.open(whatsappUrl, "_blank");
  if (whatsappWindow) {
    whatsappWindow.opener = null;
  } else {
    window.location.assign(whatsappUrl);
  }
});
