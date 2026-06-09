import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Entrada principal: mantém o StrictMode habilitado para alertar efeitos colaterais
// durante o desenvolvimento sem impactar o build de produção.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
