import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Sidebar } from "@/components/Sidebar"

const ITEMS = ["Ejecutivo", "Tendencias", "Funnel Operativo", "Avance Mensual", "Detalle EPS", "Proyección"]

describe("Sidebar", () => {
  it("renderiza los 6 items de navegación en orden", () => {
    render(<Sidebar active="executive" onChange={() => {}} alertCount={0} />)
    const botones = screen.getAllByRole("button")
    expect(botones).toHaveLength(6)
    expect(botones.map((b) => b.textContent)).toEqual(ITEMS.map((i) => expect.stringContaining(i)))
  })

  it("resalta el item activo con bg-emerald-600", () => {
    render(<Sidebar active="funnel" onChange={() => {}} alertCount={0} />)
    const activo = screen.getByRole("button", { name: /Funnel Operativo/ })
    const inactivo = screen.getByRole("button", { name: /Ejecutivo/ })
    expect(activo.className).toContain("bg-emerald-600")
    expect(inactivo.className).not.toContain("bg-emerald-600")
  })

  it("notifica el cambio de vista con la ViewKey correcta", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Sidebar active="executive" onChange={onChange} alertCount={0} />)

    await user.click(screen.getByRole("button", { name: /Proyección/ }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith("poisson")
  })

  it("muestra el contador de alertas solo en Ejecutivo", () => {
    render(<Sidebar active="executive" onChange={() => {}} alertCount={18} />)
    const ejecutivo = screen.getByRole("button", { name: /Ejecutivo/ })
    expect(ejecutivo).toHaveTextContent("18")
    expect(screen.getByRole("button", { name: /Tendencias/ })).not.toHaveTextContent("18")
  })

  it("oculta el contador cuando alertCount es 0", () => {
    render(<Sidebar active="executive" onChange={() => {}} alertCount={0} />)
    expect(screen.getByRole("button", { name: /Ejecutivo/ }).querySelector("span.bg-red-500")).toBeNull()
  })

  it("muestra el badge incluso en otra vista (el contador es siempre de alertas totales)", () => {
    render(<Sidebar active="monthly" onChange={() => {}} alertCount={7} />)
    expect(screen.getByRole("button", { name: /Ejecutivo/ })).toHaveTextContent("7")
  })
})
