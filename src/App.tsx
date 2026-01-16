import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import { AuthProvider } from "./contexts/AuthContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Suspense } from "react";
import ErrorBoundary from "./components/base/ErrorBoundary";

import { ThemeProvider } from "./contexts/ThemeContext";

import SystemAnnouncement from "./components/base/SystemAnnouncement";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nextProvider i18n={i18n}>
          <AuthProvider>
            <BrowserRouter basename={__BASE_PATH__}>
              {/* <SystemAnnouncement /> */}
              <ErrorBoundary>
                <Suspense fallback={
                  <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading...</p>
                    </div>
                  </div>
                }>
                  <AppRoutes />
                </Suspense>
              </ErrorBoundary>
            </BrowserRouter>
          </AuthProvider>
        </I18nextProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
