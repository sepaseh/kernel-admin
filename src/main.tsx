import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

import { App } from "@/app/App";
import { initializeObservability } from "@/shared/lib";

initializeObservability();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
