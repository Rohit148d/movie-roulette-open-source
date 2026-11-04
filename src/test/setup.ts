import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  if (typeof document !== "undefined") cleanup();
});

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    writable: true,
    value: vi.fn(),
  });

  if (typeof window.HTMLDialogElement !== "undefined") {
    window.HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
    };
    window.HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  }
}
