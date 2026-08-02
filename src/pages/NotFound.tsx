import { useEffect, useState } from "react";

/**
 * Some OAuth / email links can land on a path the SPA router doesn't know
 * (e.g. /index or a provider callback path). If the URL carries auth tokens,
 * bounce back to "/" keeping the hash/query so the session can be picked up.
 */
const NotFound = () => {
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const path = window.location.pathname;
    const hasAuthPayload =
      hash.includes("access_token") ||
      hash.includes("error_description") ||
      /[?&](code|token_hash|type)=/.test(search);

    // The managed OAuth broker path only exists on published hosting; if it
    // falls through to the SPA router, go home instead of showing a 404.
    if (path.startsWith("/~oauth")) {
      setRecovering(true);
      window.location.replace("/");
      return;
    }

    if (hasAuthPayload || path === "/index") {
      setRecovering(true);
      window.location.replace(`/${search}${hash}`);
    }
  }, []);


  if (recovering) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        लॉगिन पूरा किया जा रहा है…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
