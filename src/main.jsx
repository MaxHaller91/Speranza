import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Speranza from "./Speranza.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Speranza />
  </StrictMode>
);

const loadingEl = document.getElementById("app-loading");
if (loadingEl) {
  window.setTimeout(() => {
    loadingEl.classList.add("is-hidden");
    window.setTimeout(() => loadingEl.remove(), 400);
  }, 150);
}
