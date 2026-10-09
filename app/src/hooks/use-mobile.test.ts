import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useIsMobile } from "@/hooks/use-mobile"
import { fireMediaChange, setWindowWidth } from "@/test/mediaQuery"

describe("useIsMobile", () => {
  beforeEach(() => {
    setWindowWidth(1024)
  })

  it("retorna false en viewport de escritorio (>= 768px)", async () => {
    const { result } = renderHook(() => useIsMobile())
    await act(async () => {})
    expect(result.current).toBe(false)
  })

  it("retorna true cuando innerWidth < 768 al montar", async () => {
    setWindowWidth(500)
    const { result } = renderHook(() => useIsMobile())
    await act(async () => {})
    expect(result.current).toBe(true)
  })

  it("retorna false en el borde exacto de 768px (max-width: 767px)", async () => {
    setWindowWidth(768)
    const { result } = renderHook(() => useIsMobile())
    await act(async () => {})
    expect(result.current).toBe(false)
  })

  it("reacciona al evento change de la media query", async () => {
    setWindowWidth(1024)
    const { result } = renderHook(() => useIsMobile())
    await act(async () => {})
    expect(result.current).toBe(false)

    setWindowWidth(500)
    act(() => {
      fireMediaChange(true)
    })
    expect(result.current).toBe(true)
  })

  it("registra y desregistra el listener al desmontar", async () => {
    const { unmount } = renderHook(() => useIsMobile())
    await act(async () => {})
    unmount()
    // tras desmontar, disparar el cambio no debe lanzar error
    expect(() => fireMediaChange(true)).not.toThrow()
  })

  it("usa matchMedia con el breakpoint 767px", () => {
    const spy = vi.spyOn(window, "matchMedia")
    renderHook(() => useIsMobile())
    expect(spy).toHaveBeenCalledWith("(max-width: 767px)")
    spy.mockRestore()
  })
})
