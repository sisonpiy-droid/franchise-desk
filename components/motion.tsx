"use client";
// GSAP motion helpers. Everything here is decoration: content is always in the DOM and readable, and nothing runs
// when the visitor prefers reduced motion. Words are real text in the page, split only so they can slide in.
import { useLayoutEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;
function register() {
  if (!registered && typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
    registered = true;
  }
}
export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A line of text whose words can slide up one by one: wrap in an element and animate `.word`. */
export function Words({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden align-bottom">
          <span className="word inline-block will-change-transform">{w}</span>
          {i < text.split(" ").length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

/** Slide the words of a headline up on load. */
export function useWordsIn(root: RefObject<HTMLElement | null>, delay = 0) {
  useLayoutEffect(() => {
    if (!root.current || reducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from(".word", { yPercent: 115, opacity: 0, duration: 0.8, ease: "power4.out", stagger: 0.06, delay });
      gsap.from(".fade-in", { opacity: 0, y: 10, duration: 0.7, ease: "power2.out", delay: delay + 0.5, stagger: 0.12 });
    }, root);
    return () => ctx.revert();
  }, [root, delay]);
}

/**
 * Scroll reveals for a scrolling page: headings slide in word by word, chips and cards rise, numbers count up,
 * table rows stagger in as they reach the viewport. `scroller` is the element that actually scrolls.
 * Re-run (via `deps`) when the rows change so new rows animate too.
 */
export function useScrollReveal(root: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useLayoutEffect(() => {
    register();
    const el = root.current;
    if (!el || reducedMotion()) return;
    const ctx = gsap.context(() => {
      const scroller = el;
      gsap.utils.toArray<HTMLElement>("[data-reveal='heading']").forEach((h) => {
        gsap.from(h.querySelectorAll(".word"), { yPercent: 115, opacity: 0, duration: 0.75, ease: "power4.out", stagger: 0.05, scrollTrigger: { trigger: h, scroller, start: "top 92%", once: true } });
      });
      gsap.utils.toArray<HTMLElement>("[data-reveal='fade']").forEach((n) => {
        gsap.from(n, { opacity: 0, y: 14, duration: 0.7, ease: "power2.out", scrollTrigger: { trigger: n, scroller, start: "top 94%", once: true } });
      });
      gsap.utils.toArray<HTMLElement>("[data-reveal='group']").forEach((g) => {
        gsap.from(g.children, { opacity: 0, y: 14, duration: 0.5, ease: "power2.out", stagger: 0.06, scrollTrigger: { trigger: g, scroller, start: "top 94%", once: true } });
      });
      gsap.utils.toArray<HTMLElement>("[data-count]").forEach((n) => {
        const to = Number(n.dataset.count);
        if (!Number.isFinite(to)) return;
        n.textContent = "0";
        const o = { v: 0 };
        gsap.to(o, { v: to, duration: 1.1, ease: "power2.out", onUpdate: () => (n.textContent = String(Math.round(o.v))), onComplete: () => (n.textContent = String(to)), scrollTrigger: { trigger: n, scroller, start: "top 98%", once: true } });
      });
      gsap.utils.toArray<HTMLElement>("[data-reveal='rows']").forEach((tb) => {
        const rows = Array.from(tb.querySelectorAll<HTMLElement>("tr"));
        gsap.set(rows, { opacity: 0, y: 18 });
        ScrollTrigger.batch(rows, {
          scroller,
          start: "top 96%",
          once: true,
          onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.04, overwrite: true, clearProps: "transform" }),
        });
      });
    }, el);
    const t = setTimeout(() => ScrollTrigger.refresh(), 60);
    return () => {
      clearTimeout(t);
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, ...deps]);
}
