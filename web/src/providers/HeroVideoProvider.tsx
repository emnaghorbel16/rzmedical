"use client";

/**
 * HeroVideoProvider
 *
 * Allows any page-level Hero component to signal that it is currently
 * showing a fullscreen video or a full-bleed image background, so that
 * SiteHeader can adopt the transparent/glass appearance without needing a
 * prop drilled from the server layout.
 *
 * Usage:
 *   - Wrap the app in <HeroVideoProvider> (done in the root providers or layout).
 *   - Hero calls `useSetHeroVideo(true)` while it renders with video active.
 *   - Hero calls `useSetHeroImage(true)` while it renders with image-only hero.
 *   - SiteHeader reads `useHasHeroVideo()` / `useHasHeroImage()` to decide its look.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface HeroVideoCtx {
  hasHeroVideo: boolean;
  setHasHeroVideo: (v: boolean) => void;
  hasHeroImage: boolean;
  setHasHeroImage: (v: boolean) => void;
}

const Ctx = createContext<HeroVideoCtx>({
  hasHeroVideo: false,
  setHasHeroVideo: () => {},
  hasHeroImage: false,
  setHasHeroImage: () => {},
});

export function HeroVideoProvider({ children }: { children: ReactNode }) {
  const [hasHeroVideo, setHasHeroVideoRaw] = useState(false);
  const [hasHeroImage, setHasHeroImageRaw] = useState(false);

  const setHasHeroVideo = useCallback((v: boolean) => {
    setHasHeroVideoRaw((prev) => (prev === v ? prev : v));
  }, []);

  const setHasHeroImage = useCallback((v: boolean) => {
    setHasHeroImageRaw((prev) => (prev === v ? prev : v));
  }, []);

  return (
    <Ctx.Provider value={{ hasHeroVideo, setHasHeroVideo, hasHeroImage, setHasHeroImage }}>
      {children}
    </Ctx.Provider>
  );
}

/** Read whether any hero video is currently active on the page. */
export function useHasHeroVideo() {
  return useContext(Ctx).hasHeroVideo;
}

/** Read whether the full-bleed image hero is currently active on the page. */
export function useHasHeroImage() {
  return useContext(Ctx).hasHeroImage;
}

/**
 * Call inside a Hero component to register/unregister the video state.
 * Cleanup resets to false when the component unmounts (page navigation).
 */
export function useSetHeroVideo(active: boolean) {
  const { setHasHeroVideo } = useContext(Ctx);
  useEffect(() => {
    setHasHeroVideo(active);
    return () => setHasHeroVideo(false);
  }, [active, setHasHeroVideo]);
}

/**
 * Call inside a Hero component to register/unregister the image hero state.
 * Cleanup resets to false when the component unmounts (page navigation).
 */
export function useSetHeroImage(active: boolean) {
  const { setHasHeroImage } = useContext(Ctx);
  useEffect(() => {
    setHasHeroImage(active);
    return () => setHasHeroImage(false);
  }, [active, setHasHeroImage]);
}
