/// <reference types="vite-plugin-pwa/client" />

import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "./app/frame.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./app/App";
import { AppProviders } from "./app/AppProviders";
import { readDevNow } from "./app/devNow";
import { LegalSite, legalLangFrom, legalPageFromPath } from "./features/legal/LegalSite";
import { createPwaUpdateController } from "./features/update/PwaUpdatePrompt";

const pwaUpdateController = createPwaUpdateController((onNeedRefresh) =>
  registerSW({
    immediate: true,
    onNeedRefresh,
  }),
);

const devNow = import.meta.env.DEV ? readDevNow(window.location.search) : undefined;

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

// /privacy·/terms·/account-deletion은 수첩 대신 공개 문서를 그린다. vercel.json이 이 주소를 index.html로 보낸다.
const legalPage = legalPageFromPath(window.location.pathname);

createRoot(root).render(
  <StrictMode>
    {legalPage === null ? (
      <AppProviders>
        <App pwaUpdateController={pwaUpdateController} now={devNow} />
      </AppProviders>
    ) : (
      <LegalSite page={legalPage} lang={legalLangFrom(window.location.search, navigator.language)} />
    )}
  </StrictMode>,
);
