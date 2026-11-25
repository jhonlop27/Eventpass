import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import CompraProvider from "./context/CompraContext";
import { AuthProvider } from "./context/AuthContext";
import "@fontsource/jetbrains-mono/latin-400.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <CompraProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </CompraProvider>
    </AuthProvider>
  </React.StrictMode>,
);
