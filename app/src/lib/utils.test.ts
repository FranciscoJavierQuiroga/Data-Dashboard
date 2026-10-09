import { describe, it, expect } from "vitest"
import { cn } from "@/lib/utils"

describe("cn", () => {
  it("concatena clases simples", () => {
    expect(cn("a", "b")).toBe("a b")
  })
  it("descarta valores falsy", () => {
    expect(cn("a", false, undefined, null, 0)).toBe("a")
  })
  it("resuelve conflictos de Tailwind (tailwind-merge): gana la última", () => {
    expect(cn("p-2", "p-4")).toBe("p-4")
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500")
  })
  it("une clases condicionales tipadas de clsx", () => {
    expect(cn("base", { activo: true, oculto: false })).toBe("base activo")
  })
  it("flex (display) y flex-col (dirección) NO confligen", () => {
    expect(cn("flex", "items-center", "flex-col")).toBe("flex items-center flex-col")
    expect(cn("flex-col", "flex-row")).toBe("flex-row")
  })
})
