const config = window.ARGOS_CONFIG ?? {};
const token = new URLSearchParams(window.location.search).get("token");
const appShell = document.querySelector("#portal-app-shell");
const portalState = document.querySelector("#portal-state");
const preview = document.querySelector("#site-preview");
const previewFrame = document.querySelector("#live-preview");
const previewButtons = document.querySelectorAll("[data-viewport]");
const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let project;

function showPortalState(message, isError = false) {
  portalState.textContent = message;
  portalState.classList.toggle("is-error", isError);
  portalState.hidden = !message;
}

function safePreviewUrl(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function formatUpdatedAt(value) {
  const updated = new Date(value);
  if (Number.isNaN(updated.getTime())) return "Atualização recente";
  return `Atualizado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(updated)}`;
}

function formatDeadline(value) {
  if (!value) {
    document.querySelector("#deadline-date").textContent = "A combinar";
    document.querySelector("#deadline-year").textContent = "Previsão ainda não definida";
    document.querySelector("#deadline-countdown").textContent = "";
    return;
  }
  const due = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(due.getTime())) return;
  document.querySelector("#deadline-date").textContent = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(due).replace(".", "");
  document.querySelector("#deadline-year").textContent = new Intl.DateTimeFormat("pt-BR", {
    year: "numeric",
    weekday: "long",
    timeZone: "UTC",
  }).format(due);
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const days = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  const countdown = document.querySelector("#deadline-countdown");
  countdown.textContent = days > 1 ? `${days} dias restantes` : days === 1 ? "1 dia restante" : days === 0 ? "Entrega prevista para hoje" : "Prazo previsto ultrapassado";
}

function renderSteps(steps) {
  const timeline = document.querySelector("#timeline-list");
  const validSteps = Array.isArray(steps)
    ? steps.filter((step) => step && typeof step.title === "string" && step.title.trim())
    : [];
  const completed = validSteps.filter((step) => step.status === "completed").length;
  document.querySelector("#timeline-counter").textContent = `${completed} de ${validSteps.length}`;
  timeline.replaceChildren();

  validSteps.forEach((step) => {
    const status = ["pending", "current", "completed"].includes(step.status) ? step.status : "pending";
    const item = document.createElement("li");
    item.className = `timeline-item${status === "completed" ? " is-complete" : status === "current" ? " is-current" : ""}`;
    const marker = document.createElement("span");
    marker.className = "timeline-marker";
    marker.setAttribute("aria-hidden", "true");
    if (status === "completed") marker.textContent = "✓";
    if (status === "current") {
      const currentIndicator = document.createElement("i");
      marker.append(currentIndicator);
    }

    const detail = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = step.title;
    detail.append(title);
    if (typeof step.description === "string" && step.description.trim()) {
      const description = document.createElement("p");
      description.textContent = step.description;
      detail.append(description);
    }
    item.append(marker, detail);
    if (status === "current") {
      const currentLabel = document.createElement("span");
      currentLabel.className = "timeline-now";
      currentLabel.textContent = "AGORA";
      item.append(currentLabel);
    }
    timeline.append(item);
  });
  if (validSteps.length === 0) {
    const empty = document.createElement("li");
    empty.className = "timeline-empty";
    empty.textContent = "As etapas deste projeto serão atualizadas em breve.";
    timeline.append(empty);
  }
}

function renderIncludedItems(items) {
  const list = document.querySelector("#deliverables-list");
  const validItems = Array.isArray(items) ? items.filter((item) => typeof item === "string" && item.trim()) : [];
  list.replaceChildren();
  validItems.forEach((item) => {
    const row = document.createElement("li");
    const check = document.createElement("span");
    check.className = "check-icon";
    check.setAttribute("aria-hidden", "true");
    check.textContent = "✓";
    const content = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = item;
    content.append(name);
    const tag = document.createElement("span");
    tag.className = "included-tag";
    tag.textContent = "INCLUSO";
    row.append(check, content, tag);
    list.append(row);
  });
  if (validItems.length === 0) {
    const empty = document.createElement("li");
    empty.className = "deliverables-empty";
    empty.textContent = "Os itens inclusos serão definidos com a equipe Argos.";
    list.append(empty);
  }
  document.querySelector("#scope-disclaimer").hidden = true;
}

function selectedPreviewUrl() {
  const mobile = preview.classList.contains("is-mobile");
  return safePreviewUrl(mobile ? project.preview_mobile_url : project.preview_desktop_url)
    || safePreviewUrl(project.preview_desktop_url)
    || safePreviewUrl(project.preview_mobile_url);
}

function renderPreview() {
  const url = selectedPreviewUrl();
  const sample = document.querySelector("#sample-site");
  const empty = document.querySelector("#preview-empty");
  const openLink = document.querySelector("#preview-open");
  const caption = document.querySelector("#preview-caption-text");
  const address = document.querySelector("#preview-address");
  sample.hidden = true;
  previewFrame.hidden = !url;
  empty.hidden = Boolean(url);
  openLink.hidden = !url;
  if (!url) {
    previewFrame.removeAttribute("src");
    caption.textContent = "A prévia do site será adicionada pela equipe Argos.";
    address.replaceChildren(document.createTextNode("Prévia não disponível"));
    return;
  }

  if (previewFrame.src !== url.href) previewFrame.src = url.href;
  previewFrame.title = preview.classList.contains("is-mobile")
    ? "Prévia do site do cliente em celular"
    : "Prévia do site do cliente em computador";
  openLink.href = url.href;
  caption.textContent = "Prévia atualizada pela equipe Argos · Se não carregar, abra em uma nova aba.";
  address.replaceChildren();
  const lock = document.createElement("span");
  lock.setAttribute("aria-hidden", "true");
  lock.textContent = "⌑";
  address.append(lock, document.createTextNode(` ${url.host} `));
  const tag = document.createElement("span");
  tag.className = "preview-tag";
  tag.textContent = "PRÉVIA";
  address.append(tag);
}

function renderProject(data) {
  project = data;
  document.querySelector("#client-name").textContent = data.name;
  document.querySelector("#sidebar-client-name").textContent = data.name;
  document.querySelector("#client-breadcrumb").textContent = data.name;
  document.querySelector(".avatar").textContent = data.name.trim().slice(0, 2).toLocaleUpperCase("pt-BR");
  document.querySelector(".profile-copy small").textContent = data.service;
  document.querySelector("#portal-mode").textContent = "Link privado individual";
  document.querySelector("#project-kicker").textContent = "PROJETO ARGOS";
  document.querySelector("#project-title").textContent = data.service;
  document.querySelector("#project-description").textContent = data.project_description || data.service;
  document.querySelector("#deliverables-intro").textContent = `Itens previstos para ${data.service}.`;
  document.querySelector("#portal-updated").replaceChildren(
    document.createTextNode(formatUpdatedAt(data.updated_at)),
  );

  const status = document.querySelector("#project-status");
  const isComplete = data.status === "completed";
  status.classList.toggle("is-complete", isComplete);
  document.querySelector("#project-status-label").textContent = isComplete ? "Concluído" : "Em desenvolvimento";

  const progress = Math.max(0, Math.min(100, Number(data.progress) || 0));
  const progressBar = document.querySelector(".progress-track");
  progressBar.setAttribute("aria-valuenow", String(progress));
  progressBar.setAttribute("aria-valuetext", `${progress}% concluído`);
  document.querySelector("#project-progress-label").textContent = `${progress}%`;
  document.querySelector("#project-progress-bar").style.width = `${progress}%`;
  document.querySelector("#progress-remaining").textContent = `${100 - progress}% restante`;

  formatDeadline(data.due_date);
  renderSteps(data.project_steps);
  renderIncludedItems(data.included_items);
  renderPreview();
}

async function loadProject(supabase, isInitialLoad = false) {
  const { data, error } = await supabase.rpc("get_client_portal", { p_token: token });
  if (error) {
    showPortalState("Não foi possível carregar o projeto. Tente novamente mais tarde.", true);
    return;
  }
  if (!data) {
    appShell.hidden = true;
    showPortalState("Este link não corresponde a um projeto disponível. Peça à equipe Argos um link atualizado.", true);
    return;
  }
  renderProject(data);
  appShell.hidden = false;
  showPortalState("");
  if (isInitialLoad) {
    document.querySelector("#demo-notice").hidden = true;
  }
}

previewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const isMobile = button.dataset.viewport === "mobile";
    preview.classList.toggle("is-mobile", isMobile);
    previewButtons.forEach((viewportButton) => {
      const selected = viewportButton === button;
      viewportButton.classList.toggle("is-active", selected);
      viewportButton.setAttribute("aria-pressed", String(selected));
    });
    if (project) renderPreview();
  });
});

if (token) {
  appShell.hidden = true;
  document.querySelector("#demo-notice").hidden = true;
  if (!tokenPattern.test(token)) {
    showPortalState("Este link não corresponde a um projeto disponível. Peça à equipe Argos um link atualizado.", true);
  } else if (!config.supabaseUrl || !config.supabaseAnonKey) {
    showPortalState("O portal ainda não está configurado. Entre em contato com a equipe Argos.", true);
  } else {
    showPortalState("Carregando as informações do projeto...");
    import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
      .then(({ createClient }) => {
        const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
        void loadProject(supabase, true);
        window.setInterval(() => {
          if (document.visibilityState === "visible") void loadProject(supabase);
        }, 30000);
      })
      .catch(() => {
        showPortalState("Não foi possível iniciar o portal. Verifique a conexão e tente novamente.", true);
      });
  }
}
