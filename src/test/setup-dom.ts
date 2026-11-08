import { GlobalWindow } from "happy-dom";
import * as React from "react";

(globalThis as any).React = React;

const happyWindow = new GlobalWindow({
  url: "http://localhost:3000",
});

(happyWindow as any).requestIdleCallback = (cb: any) => setTimeout(cb, 0);
(happyWindow as any).cancelIdleCallback = (id: any) => clearTimeout(id);
(happyWindow as any).self = happyWindow;

Object.defineProperties(globalThis, {
  window: { value: happyWindow, writable: true, configurable: true },
  self: { value: happyWindow, writable: true, configurable: true },
  document: { value: happyWindow.document, writable: true, configurable: true },
  HTMLElement: { value: happyWindow.HTMLElement, writable: true, configurable: true },
  HTMLInputElement: { value: happyWindow.HTMLInputElement, writable: true, configurable: true },
  HTMLButtonElement: { value: happyWindow.HTMLButtonElement, writable: true, configurable: true },
  Event: { value: happyWindow.Event, writable: true, configurable: true },
  MouseEvent: { value: happyWindow.MouseEvent, writable: true, configurable: true },
  KeyboardEvent: { value: happyWindow.KeyboardEvent, writable: true, configurable: true },
  CustomEvent: { value: happyWindow.CustomEvent, writable: true, configurable: true },
  requestAnimationFrame: {
    value: (cb: FrameRequestCallback) => setTimeout(cb, 0),
    writable: true,
    configurable: true,
  },
  cancelAnimationFrame: {
    value: (id: number) => clearTimeout(id),
    writable: true,
    configurable: true,
  },
  requestIdleCallback: {
    value: (cb: any) => setTimeout(cb, 0),
    writable: true,
    configurable: true,
  },
  cancelIdleCallback: {
    value: (id: any) => clearTimeout(id),
    writable: true,
    configurable: true,
  },
});
