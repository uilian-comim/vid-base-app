import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initMediaServer } from "./lib/mediaServer";
import "./utils/i18n";
import "@fontsource-variable/inter";
import "@fontsource-variable/sora";
import "./global.css";

// Thumbnails and playback URLs need the media server's address and token, so fetch them
// (one IPC round trip) before the first render.
initMediaServer()
  .catch((error) => console.error("Media server unavailable:", error))
  .finally(() => {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  });
