import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";

import { App } from "@/index";
import "@/shared/i18n";
import { initializeObservability } from "@/shared/lib";

initializeObservability();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
