import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"
import { matchMediaStub, resetMediaListeners } from "@/test/mediaQuery"

afterEach(() => {
  cleanup()
  resetMediaListeners()
})

// jsdom no implementa ResizeObserver (usado por recharts para medir contenedores)
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub

// jsdom no implementa matchMedia de forma utilizable (usado por useIsMobile)
window.matchMedia = matchMediaStub

// jsdom no implementa SVG getBBox (usado por recharts para posicionamiento de texto)
if (!SVGElement.prototype.getBBox) {
  SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 })
}
if (!SVGElement.prototype.getComputedTextLength) {
  SVGElement.prototype.getComputedTextLength = () => 0
}

window.scrollTo = () => {}

// jsdom no implementa estas APIs de pointer/scroll que Radix Select necesita
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
