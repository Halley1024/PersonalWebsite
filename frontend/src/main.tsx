import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./shared/styles/reset.css";
import "./shared/styles/tokens.css";
import "./shared/styles/themes/dark.css";
import "./shared/styles/themes/light.css";
import "./shared/styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
