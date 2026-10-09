type MediaListener = (event: { matches: boolean; media: string }) => void

const listeners = new Set<MediaListener>()

export function matchMediaStub(query: string): MediaQueryList {
  return {
    get matches() {
      return false
    },
    media: query,
    onchange: null,
    addListener: (cb: MediaListener) => listeners.add(cb),
    removeListener: (cb: MediaListener) => listeners.delete(cb),
    addEventListener: (_type: string, cb: MediaListener) => listeners.add(cb),
    removeEventListener: (_type: string, cb: MediaListener) => listeners.delete(cb),
    dispatchEvent: () => false,
  } as unknown as MediaQueryList
}

export function fireMediaChange(matches = false): void {
  for (const listener of listeners) {
    listener({ matches, media: "" })
  }
}

export function resetMediaListeners(): void {
  listeners.clear()
}

export function setWindowWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    configurable: true,
    writable: true,
  })
}
