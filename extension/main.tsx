import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import StockChart from "../src/app/stock-chart";
import "../src/app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Não foi possível encontrar o elemento raiz da nova guia.");
}

createRoot(root).render(
  <StrictMode>
    <StockChart />
  </StrictMode>,
);
