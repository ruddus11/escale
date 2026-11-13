import type { ReactNode } from "react";
import { InternationalizationProvider } from "@astryxdesign/core/i18n";
import { Theme } from "@astryxdesign/core/theme";
import { appTheme } from "../theme/appTheme";
import { astryxKoMessages } from "./astryxKo";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <InternationalizationProvider locale="ko" messages={{ ko: astryxKoMessages }}>
      <Theme theme={appTheme} mode="light">
        {children}
      </Theme>
    </InternationalizationProvider>
  );
}
