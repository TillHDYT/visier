import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { VisorApp } from "@/components/visor-app";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root fehlt in index.html");

createRoot(root).render(
  <StrictMode>
    <VisorApp />
  </StrictMode>,
);
