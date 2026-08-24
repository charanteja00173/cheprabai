import { useEffect, useState } from "react";

export const BREAKPOINTS = {
  xs: 380,
  sm: 480,
  md: 600,
  lg: 768,
  xl: 1024,
};

const subscribe = (query, callback) => {
  const mql = window.matchMedia(query);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
};

const getSnapshot = (query) => window.matchMedia(query).matches;

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => getSnapshot(query));

  useEffect(() => {
    const update = () => setMatches(getSnapshot(query));
    update();
    return subscribe(query, update);
  }, [query]);

  return matches;
}

export const useIsMobile = () => useMediaQuery(`(max-width: ${BREAKPOINTS.lg}px)`);

export const useIsPhone = () => useMediaQuery(`(max-width: ${BREAKPOINTS.sm}px)`);

export const useIsPortrait = () => useMediaQuery("(orientation: portrait)");
