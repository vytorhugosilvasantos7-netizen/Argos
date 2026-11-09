const preview = document.querySelector("#site-preview");
const viewportButtons = document.querySelectorAll("[data-viewport]");

viewportButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const isMobile = button.dataset.viewport === "mobile";

    preview.classList.toggle("is-mobile", isMobile);

    viewportButtons.forEach((viewportButton) => {
      const selected = viewportButton === button;
      viewportButton.classList.toggle("is-active", selected);
      viewportButton.setAttribute("aria-pressed", String(selected));
    });
  });
});
