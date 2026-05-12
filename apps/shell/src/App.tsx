// Shell's top-level router. Three branches, picked by pathname + auth:
//   /callback?code=...  → Callback (exchange in flight)
//   isAuthenticated     → ActivityPicker
//   otherwise           → Login
//
// No router library yet — usePathname is a 10-line subscription to
// popstate. Phase 6 federation will replace this with something richer
// (sub-routes for /editor, /history) but for Phase 4 plain branching is
// the right complexity floor.
import { useEffect, useState } from "react";
import { useAtomValue } from "@effect-atom/atom-react";
import { isAuthenticatedAtom } from "./store/session-store";
import { Login } from "./components/Login";
import { Callback } from "./components/Callback";
import { ActivityPicker } from "./components/ActivityPicker";

const usePathname = () => {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onChange = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);
  return path;
};

export default function App() {
  const path = usePathname();
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);

  if (path === "/callback") return <Callback />;
  if (!isAuthenticated) return <Login />;
  return <ActivityPicker />;
}
