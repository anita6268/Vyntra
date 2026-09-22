import { Navigate, Route, Routes } from "react-router";
import ChatPage from "./pages/ChatPage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import PublicProfilePage from "./pages/PublicProfilePage";
import { useAuthStore } from "./store/useAuthStore";
import usePremiumStore from "./store/usePremiumStore";
import { useEffect, useState, useMemo } from "react";
import PageLoader from "./components/PageLoader";
import AuroraBackground from "./components/AuroraBackground";
import FloatingParticles from "./components/FloatingParticles";
import { THEMES } from "./lib/themes";
import CallLayer from "./components/CallLayer";

import { Toaster } from "react-hot-toast";

function App() {
  const { checkAuth, isCheckingAuth, authUser, fetchSubscription } = useAuthStore();
  const syncFromAuth = usePremiumStore((state) => state.syncFromAuth);
  const syncFromSubscription = usePremiumStore((state) => state.syncFromSubscription);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("chatify-theme");
    const found = THEMES.find((t) => t.key === saved);
    if (!found) return "dark";
    if (found.premium) return "dark";
    return found.key;
  });
  const [themeAnimKey, setThemeAnimKey] = useState(0);
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
  // Keep Pro/free gating in sync with the backend-verified authenticated user.
  // Runs on login, signup, refresh, payment success and logout, so the correct
  // subscription status always survives logout/login and a browser refresh.
  useEffect(() => {
    syncFromAuth(authUser);
  }, [authUser, syncFromAuth]);
  // Prevent free users from keeping a premium theme via localStorage tampering.
  useEffect(() => {
    if (authUser?.isPro) return;
    const saved = localStorage.getItem("chatify-theme");
    const found = THEMES.find((t) => t.key === saved);
    if (found?.premium) {
      setTheme("dark");
    }
  }, [authUser]);
  // Refresh subscription state (gateway, demo mode, expiry) on app load and
  // whenever authUser changes. This is the single source of truth for the
  // premium store's gateway/demo flags.
  useEffect(() => {
    if (!authUser?._id) return;
    let cancelled = false;
    (async () => {
      const data = await fetchSubscription();
      if (!cancelled && data) {
        syncFromSubscription(data);
      }
    })();
    return () => { cancelled = true; };
  }, [
    authUser?._id,
    authUser?.plan,
    authUser?.isPro,
    authUser?.subscriptionStatus,
    authUser?.billingCycle,
    fetchSubscription,
    syncFromSubscription,
  ]);
  useEffect(() => {
    localStorage.setItem("chatify-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const handleThemeChange = (nextTheme) => {
    if (nextTheme === theme) return;
    setTheme(nextTheme);
    setThemeAnimKey((k) => k + 1);
  };
                                                    
  const stars = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * 2.5 + 1.2,
        delay: Math.random() * 4,
        duration: Math.random() * 3 + 2.5,
      })),
    []
  );

  if (isCheckingAuth) return <PageLoader />;

  return (
    <div className="fixed inset-0 flex h-screen w-screen overflow-hidden bg-[var(--app-bg)] text-[color:var(--text-primary)]">
      <AuroraBackground />
      <FloatingParticles count={18} />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:24px_24px]" />

      {/* Twinkling stars */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {stars.map((star) => (
          <span
            key={star.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              animation: `star-twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
              opacity: 0.3,
            }}
          />
        ))}
      </div>

{/* Theme switch transition overlay */}
      {themeAnimKey > 0 && (
        <div key={themeAnimKey} className="theme-wipe-overlay pointer-events-none absolute inset-0 z-[var(--z-modal,1600)] bg-[color:var(--app-bg)]" />
      )}

      {/* Definite-size content area: inset-0 = full viewport height, padding inside border-box */}
      <div className="absolute inset-0 z-10 flex w-full justify-center overflow-hidden p-3 sm:p-4 lg:p-6">
        <Routes>
          <Route path="/" element={authUser ? <ChatPage theme={theme} setTheme={handleThemeChange} /> : <Navigate to={"/login"} />} />
          <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to={"/"} />} />
          <Route path="/signup" element={!authUser ? <SignUpPage /> : <Navigate to={"/"} />} />
          <Route path="/u/:username" element={<PublicProfilePage />} />
        </Routes>
      </div>

      <Toaster position="top-right" toastOptions={{ style: { background: "rgba(24,24,27,0.9)", color: "white", border: "1px solid rgba(255,255,255,0.1)" } }} />
      <CallLayer />
    </div>
  );
}
export default App;