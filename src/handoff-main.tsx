import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./demo.css";
import { HandoffExample } from "./HandoffExample";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HandoffExample />
  </StrictMode>,
);
