import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.ARGOS_CONFIG ?? {};
const loginScreen = document.querySelector("#login-screen");
const appShell = document.querySelector("#app-shell");
const loginForm = document.querySelector("#login-form");
const loginStatus = document.querySelector("#login-status");
const configNotice = document.querySelector("#config-notice");
const appStatus = document.querySelector("#app-status");
const clientForm = document.querySelector("#client-form");
const entryForm = document.querySelector("#entry-form");
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });
let supabase;
let clients = [];
let entries = [];

const today = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};
const amountValue = (value) => Number(value) || 0;
const formatCurrency = (value) => currency.format(value);
const formatDate = (value) => value ? dateFormat.format(new Date(`${value}T00:00:00Z`)) : "—";
const statusLabel = (status) => status === "completed" ? "Concluído" : "Em andamento";

function showNotice(message, isError = false) {
  appStatus.textContent = message;
  appStatus.classList.toggle("notice-error", isError);
  appStatus.hidden = !message;
}

function setAuthView(user) {
  loginScreen.hidden = Boolean(user);
  appShell.hidden = !user;
  if (user) {
    document.querySelector("#user-email").textContent = user.email || "Administração";
    document.querySelector("#user-avatar").textContent = (user.email || "A").charAt(0).toUpperCase();
  }
}

function getMonthlyEntries() {
  const month = today().slice(0, 7);
  return entries.filter((entry) => entry.occurred_on.startsWith(month));
}

function renderOverview() {
  const inProgress = clients.filter((client) => client.status === "in_progress").length;
  const completed = clients.length - inProgress;
  const income = entries.filter((entry) => entry.kind === "income").reduce((sum, entry) => sum + amountValue(entry.amount), 0);
  const expenses = entries.filter((entry) => entry.kind === "expense").reduce((sum, entry) => sum + amountValue(entry.amount), 0);
  const monthly = getMonthlyEntries();
  const monthIncome = monthly.filter((entry) => entry.kind === "income").reduce((sum, entry) => sum + amountValue(entry.amount), 0);
  const monthExpenses = monthly.filter((entry) => entry.kind === "expense").reduce((sum, entry) => sum + amountValue(entry.amount), 0);

  document.querySelector("#metric-clients").textContent = String(clients.length);
  document.querySelector("#metric-progress").textContent = String(inProgress);
  document.querySelector("#metric-completed").textContent = String(completed);
  document.querySelector("#metric-profit").textContent = formatCurrency(income - expenses);
  document.querySelector("#month-income").textContent = formatCurrency(monthIncome);
  document.querySelector("#month-expenses").textContent = formatCurrency(monthExpenses);
  document.querySelector("#month-profit").textContent = formatCurrency(monthIncome - monthExpenses);

  const recent = document.querySelector("#recent-clients");
  recent.replaceChildren(...clients.slice(0, 5).map((client) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const name = document.createElement("div");
    name.className = "client-cell";
    const strong = document.createElement("strong");
    strong.textContent = client.name;
    const date = document.createElement("span");
    date.textContent = `Desde ${formatDate(client.created_at.slice(0, 10))}`;
    name.append(strong, date);
    nameCell.append(name);
    const serviceCell = document.createElement("td");
    serviceCell.textContent = client.service;
    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `status-pill${client.status === "completed" ? " is-completed" : ""}`;
    badge.textContent = statusLabel(client.status);
    statusCell.append(badge);
    row.append(nameCell, serviceCell, statusCell);
    return row;
  }));
  document.querySelector("#recent-empty").hidden = clients.length > 0;
}

function renderClients() {
  const query = document.querySelector("#client-search").value.trim().toLocaleLowerCase("pt-BR");
  const filtered = clients.filter((client) => `${client.name} ${client.service}`.toLocaleLowerCase("pt-BR").includes(query));
  const table = document.querySelector("#clients-table");
  table.replaceChildren(...filtered.map((client) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const name = document.createElement("div");
    name.className = "client-cell";
    const strong = document.createElement("strong");
    strong.textContent = client.name;
    const since = document.createElement("span");
    since.textContent = `Cliente desde ${formatDate(client.created_at.slice(0, 10))}`;
    name.append(strong, since);
    nameCell.append(name);
    const serviceCell = document.createElement("td");
    serviceCell.textContent = client.service;
    const dueCell = document.createElement("td");
    dueCell.textContent = formatDate(client.due_date);
    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `status-pill${client.status === "completed" ? " is-completed" : ""}`;
    badge.textContent = statusLabel(client.status);
    statusCell.append(badge);
    const actionCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "row-actions";
    const edit = document.createElement("button");
    edit.className = "row-action";
    edit.type = "button";
    edit.textContent = "Gerenciar projeto";
    edit.addEventListener("click", () => openClientDialog(client));
    const portal = document.createElement("a");
    portal.className = "row-action";
    portal.textContent = "Abrir portal";
    portal.href = getPortalUrl(client.portal_token);
    portal.target = "_blank";
    portal.rel = "noopener noreferrer";
    const copyLink = document.createElement("button");
    copyLink.className = "row-action";
    copyLink.type = "button";
    copyLink.textContent = "Copiar link";
    copyLink.addEventListener("click", () => copyPortalLink(client.portal_token));
    const remove = document.createElement("button");
    remove.className = "row-action is-delete";
    remove.type = "button";
    remove.textContent = "Excluir";
    remove.addEventListener("click", () => deleteClient(client));
    actions.append(edit, portal, copyLink, remove);
    actionCell.append(actions);
    row.append(nameCell, serviceCell, dueCell, statusCell, actionCell);
    return row;
  }));
  document.querySelector("#client-count-label").textContent = `${clients.length} ${clients.length === 1 ? "cliente cadastrado" : "clientes cadastrados"}`;
  document.querySelector("#clients-empty").hidden = filtered.length > 0;
}

function renderFinance() {
  const income = entries.filter((entry) => entry.kind === "income").reduce((sum, entry) => sum + amountValue(entry.amount), 0);
  const expenses = entries.filter((entry) => entry.kind === "expense").reduce((sum, entry) => sum + amountValue(entry.amount), 0);
  document.querySelector("#total-income").textContent = formatCurrency(income);
  document.querySelector("#total-expenses").textContent = formatCurrency(expenses);
  document.querySelector("#total-profit").textContent = formatCurrency(income - expenses);
  const filter = document.querySelector("#finance-filter").value;
  const filtered = entries.filter((entry) => filter === "all" || entry.kind === filter);
  const table = document.querySelector("#finance-table");
  table.replaceChildren(...filtered.map((entry) => {
    const row = document.createElement("tr");
    const descriptionCell = document.createElement("td");
    const description = document.createElement("div");
    description.className = "client-cell";
    const strong = document.createElement("strong");
    strong.textContent = entry.description;
    description.append(strong);
    descriptionCell.append(description);
    const kindCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `type-pill is-${entry.kind}`;
    badge.textContent = entry.kind === "income" ? "Receita" : "Despesa";
    kindCell.append(badge);
    const dateCell = document.createElement("td");
    dateCell.textContent = formatDate(entry.occurred_on);
    const amountCell = document.createElement("td");
    amountCell.textContent = formatCurrency(amountValue(entry.amount));
    const actionCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "row-actions";
    const edit = document.createElement("button");
    edit.className = "row-action";
    edit.type = "button";
    edit.textContent = "Editar";
    edit.addEventListener("click", () => openEntryDialog(entry));
    const remove = document.createElement("button");
    remove.className = "row-action is-delete";
    remove.type = "button";
    remove.textContent = "Excluir";
    remove.addEventListener("click", () => deleteEntry(entry));
    actions.append(edit, remove);
    actionCell.append(actions);
    row.append(descriptionCell, kindCell, dateCell, amountCell, actionCell);
    return row;
  }));
  document.querySelector("#finance-empty").hidden = filtered.length > 0;
}

function renderAll() {
  renderOverview();
  renderClients();
  renderFinance();
}

async function loadData() {
  showNotice("");
  const [clientsResult, entriesResult] = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: false }),
    supabase.from("finance_entries").select("*").order("occurred_on", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  if (clientsResult.error || entriesResult.error) {
    const error = clientsResult.error || entriesResult.error;
    showNotice(`Não foi possível carregar os dados: ${error.message}`, true);
    return;
  }
  clients = clientsResult.data;
  entries = entriesResult.data;
  renderAll();
}

function openClientDialog(client = null) {
  clientForm.reset();
  renderProjectSteps(client?.project_steps ?? []);
  document.querySelector("#client-id").value = client?.id ?? "";
  document.querySelector("#client-name").value = client?.name ?? "";
  document.querySelector("#client-service").value = client?.service ?? "";
  document.querySelector("#client-status").value = client?.status ?? "in_progress";
  document.querySelector("#client-due-date").value = client?.due_date ?? "";
  document.querySelector("#client-description").value = client?.project_description ?? "";
  document.querySelector("#client-progress").value = String(client?.progress ?? 0);
  document.querySelector("#client-progress-output").value = `${client?.progress ?? 0}% concluído · ${100 - (client?.progress ?? 0)}% restante`;
  document.querySelector("#client-preview-desktop").value = client?.preview_desktop_url ?? "";
  document.querySelector("#client-preview-mobile").value = client?.preview_mobile_url ?? "";
  document.querySelector("#client-included-items").value = (client?.included_items ?? []).join("\n");
  document.querySelector("#client-dialog-title").textContent = client ? "Gerenciar projeto" : "Novo cliente";
  document.querySelector("#client-form-status").textContent = "";
  const portalLinkRow = document.querySelector("#portal-link-row");
  portalLinkRow.hidden = !client;
  portalLinkRow.dataset.portalToken = client?.portal_token ?? "";
  document.querySelector("#client-dialog").showModal();
}

function renderProjectSteps(steps) {
  const container = document.querySelector("#project-steps-fields");
  container.replaceChildren(...steps.map((step) => createProjectStepRow(step)));
}

function createProjectStepRow(step = {}) {
  const row = document.createElement("div");
  row.className = "step-editor-row";

  const titleLabel = document.createElement("label");
  titleLabel.textContent = "Etapa";
  const titleInput = document.createElement("input");
  titleInput.className = "step-title";
  titleInput.type = "text";
  titleInput.maxLength = 120;
  titleInput.placeholder = "Ex.: Desenvolvimento do site";
  titleInput.value = step.title ?? "";
  titleLabel.append(titleInput);

  const detailLabel = document.createElement("label");
  detailLabel.textContent = "Detalhe";
  const detailInput = document.createElement("input");
  detailInput.className = "step-description";
  detailInput.type = "text";
  detailInput.maxLength = 240;
  detailInput.placeholder = "O que está sendo feito nesta etapa";
  detailInput.value = step.description ?? "";
  detailLabel.append(detailInput);

  const statusLabel = document.createElement("label");
  statusLabel.textContent = "Situação";
  const statusSelect = document.createElement("select");
  statusSelect.className = "step-status";
  [
    ["pending", "Pendente"],
    ["current", "Em andamento"],
    ["completed", "Concluída"],
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    statusSelect.append(option);
  });
  statusSelect.value = ["pending", "current", "completed"].includes(step.status) ? step.status : "pending";
  statusLabel.append(statusSelect);

  const remove = document.createElement("button");
  remove.className = "row-action is-delete remove-step";
  remove.type = "button";
  remove.textContent = "Remover etapa";
  remove.addEventListener("click", () => row.remove());
  row.append(titleLabel, detailLabel, statusLabel, remove);
  return row;
}

function getProjectSteps() {
  return [...document.querySelectorAll("#project-steps-fields .step-editor-row")]
    .map((row) => ({
      title: row.querySelector(".step-title").value.trim(),
      description: row.querySelector(".step-description").value.trim(),
      status: row.querySelector(".step-status").value,
    }))
    .filter((step) => step.title);
}

function getPortalUrl(token) {
  const url = new URL("../src/cliente.html", window.location.href);
  url.searchParams.set("token", token);
  return url.href;
}

async function copyPortalLink(token) {
  try {
    await navigator.clipboard.writeText(getPortalUrl(token));
    showNotice("Link privado do portal copiado.");
  } catch (error) {
    showNotice(`Não foi possível copiar o link: ${error.message}`, true);
  }
}

function openEntryDialog(entry = null) {
  entryForm.reset();
  document.querySelector("#entry-id").value = entry?.id ?? "";
  document.querySelector("#entry-description").value = entry?.description ?? "";
  document.querySelector("#entry-kind").value = entry?.kind ?? "income";
  document.querySelector("#entry-amount").value = entry?.amount ?? "";
  document.querySelector("#entry-date").value = entry?.occurred_on ?? today();
  document.querySelector("#entry-dialog-title").textContent = entry ? "Editar lançamento" : "Novo lançamento";
  document.querySelector("#entry-form-status").textContent = "";
  document.querySelector("#entry-dialog").showModal();
}

async function saveForm(table, statusElement, values) {
  const id = values.id;
  delete values.id;
  const { error } = id
    ? await supabase.from(table).update(values).eq("id", id)
    : await supabase.from(table).insert(values);
  if (error) {
    statusElement.textContent = `Não foi possível salvar: ${error.message}`;
    return false;
  }
  return true;
}

async function deleteRecord(table, record, message) {
  if (!window.confirm(message)) return;
  const { error } = await supabase.from(table).delete().eq("id", record.id);
  if (error) {
    showNotice(`Não foi possível excluir: ${error.message}`, true);
    return;
  }
  showNotice("");
  await loadData();
}

async function deleteClient(client) {
  await deleteRecord("clients", client, `Excluir o cadastro de ${client.name}?`);
}

async function deleteEntry(entry) {
  await deleteRecord("finance_entries", entry, `Excluir o lançamento "${entry.description}"?`);
}

function setCurrentView(viewName) {
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    const isActive = panel.dataset.panel === viewName;
    panel.hidden = !isActive;
    panel.classList.toggle("is-visible", isActive);
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === viewName);
  });
}

function configureNavigation() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setCurrentView(button.dataset.view));
  });
  document.querySelectorAll("[data-go-view]").forEach((button) => {
    button.addEventListener("click", () => setCurrentView(button.dataset.goView));
  });
  document.querySelectorAll("[data-open-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.openDialog === "client-dialog") openClientDialog();
      if (button.dataset.openDialog === "entry-dialog") openEntryDialog();
    });
  });
  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog").close());
  });
  document.querySelector("#add-project-step").addEventListener("click", () => {
    document.querySelector("#project-steps-fields").append(createProjectStepRow());
  });
}

document.querySelector("#topbar-date").textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date());
configureNavigation();
document.querySelector("#client-search").addEventListener("input", renderClients);
document.querySelector("#finance-filter").addEventListener("change", renderFinance);
document.querySelector("#client-progress").addEventListener("input", (event) => {
  const progress = Number(event.currentTarget.value);
  document.querySelector("#client-progress-output").value = `${progress}% concluído · ${100 - progress}% restante`;
});
document.querySelector("#copy-portal-link").addEventListener("click", () => {
  void copyPortalLink(document.querySelector("#portal-link-row").dataset.portalToken);
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginStatus.textContent = "";
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  const formData = new FormData(loginForm);
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")).trim(),
    password: String(formData.get("password")),
  });
  button.disabled = false;
  if (error) loginStatus.textContent = `Não foi possível entrar: ${error.message}`;
});

document.querySelector("#sign-out").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) showNotice(`Não foi possível sair da conta: ${error.message}`, true);
});

clientForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!clientForm.reportValidity()) return;
  const formData = new FormData(clientForm);
  const values = {
    id: String(formData.get("id") || ""),
    name: String(formData.get("name")).trim(),
    service: String(formData.get("service")).trim(),
    status: String(formData.get("status")),
    due_date: String(formData.get("due_date")) || null,
    project_description: String(formData.get("project_description")).trim(),
    progress: Number(formData.get("progress")),
    preview_desktop_url: String(formData.get("preview_desktop_url")).trim() || null,
    preview_mobile_url: String(formData.get("preview_mobile_url")).trim() || null,
    included_items: String(formData.get("included_items")).split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    project_steps: getProjectSteps(),
  };
  for (const field of ["preview_desktop_url", "preview_mobile_url"]) {
    const value = values[field];
    if (!value) continue;
    try {
      if (!["http:", "https:"].includes(new URL(value).protocol)) throw new Error();
    } catch {
      document.querySelector("#client-form-status").textContent = "As prévias devem usar um endereço válido com http:// ou https://.";
      document.querySelector(`#client-${field.replaceAll("_", "-")}`).focus();
      return;
    }
  }
  const statusElement = document.querySelector("#client-form-status");
  const saved = await saveForm("clients", statusElement, values);
  if (!saved) return;
  document.querySelector("#client-dialog").close();
  showNotice("");
  await loadData();
});

entryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!entryForm.reportValidity()) return;
  const formData = new FormData(entryForm);
  const values = {
    id: String(formData.get("id") || ""),
    description: String(formData.get("description")).trim(),
    kind: String(formData.get("kind")),
    amount: Number(formData.get("amount")),
    occurred_on: String(formData.get("occurred_on")),
  };
  const statusElement = document.querySelector("#entry-form-status");
  const saved = await saveForm("finance_entries", statusElement, values);
  if (!saved) return;
  document.querySelector("#entry-dialog").close();
  showNotice("");
  await loadData();
});

if (!config.supabaseUrl || !config.supabaseAnonKey) {
  configNotice.hidden = false;
  loginForm.querySelectorAll("input, button").forEach((element) => { element.disabled = true; });
} else {
  supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  supabase.auth.onAuthStateChange((_event, session) => {
    setAuthView(session?.user);
    if (session?.user) window.setTimeout(() => void loadData(), 0);
    else {
      clients = [];
      entries = [];
      loginForm.reset();
      loginStatus.textContent = "";
    }
  });
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      loginStatus.textContent = `Não foi possível verificar a sessão: ${error.message}`;
      return;
    }
    setAuthView(data.session?.user);
    if (data.session?.user) void loadData();
  });
}
