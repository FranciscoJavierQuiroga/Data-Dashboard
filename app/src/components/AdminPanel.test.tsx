import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AdminPanel } from "@/components/AdminPanel"
import type { Session } from "@/lib/api"

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  getCurrentUser: vi.fn(),
  listImports: vi.fn(),
  listEps: vi.fn(),
  listPrograms: vi.fn(),
  listIndicators: vi.fn(),
  listUsers: vi.fn(),
  listAudit: vi.fn(),
}))

vi.mock("@/lib/api", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    login: mocks.login,
    getCurrentUser: mocks.getCurrentUser,
    listImports: mocks.listImports,
    listEps: mocks.listEps,
    listPrograms: mocks.listPrograms,
    listIndicators: mocks.listIndicators,
    listUsers: mocks.listUsers,
    listAudit: mocks.listAudit,
  }
})

const SESSION: Session = {
  access_token: "token-123",
  token_type: "bearer",
  role: "admin",
  email: "admin@example.com",
}

const emptyPage = { items: [], total: 0, page: 1, page_size: 100 }

describe("AdminPanel", () => {
  beforeEach(() => {
    localStorage.clear()
    Object.values(mocks).forEach(mock => mock.mockReset())
    mocks.getCurrentUser.mockResolvedValue({
      id: 1,
      email: SESSION.email,
      full_name: "Admin",
      role: "admin",
      active: true,
      created_at: "",
      updated_at: "",
    })
    mocks.listImports.mockResolvedValue(emptyPage)
    mocks.listEps.mockResolvedValue([])
    mocks.listPrograms.mockResolvedValue([])
    mocks.listIndicators.mockResolvedValue([])
    mocks.listUsers.mockResolvedValue([])
    mocks.listAudit.mockResolvedValue(emptyPage)
  })

  it("muestra el formulario de ingreso cuando no hay sesión", () => {
    render(<AdminPanel />)
    expect(screen.getByText(/Administración/)).toBeInTheDocument()
    expect(screen.getByLabelText("Correo")).toBeInTheDocument()
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument()
    expect(screen.queryByText("Importaciones")).not.toBeInTheDocument()
  })

  it("inicia sesión y muestra el panel de importaciones", async () => {
    const user = userEvent.setup()
    mocks.login.mockResolvedValue(SESSION)
    render(<AdminPanel />)

    await user.type(screen.getByLabelText("Correo"), SESSION.email)
    await user.type(screen.getByLabelText("Contraseña"), "secret")
    await user.click(screen.getByRole("button", { name: "Ingresar" }))

    await waitFor(() => expect(screen.getByText(SESSION.email)).toBeInTheDocument())
    expect(mocks.login).toHaveBeenCalledWith(SESSION.email, "secret")
    expect(screen.getByRole("button", { name: /Importaciones/ })).toBeInTheDocument()
    expect(screen.getByText("Historial de importaciones")).toBeInTheDocument()
    await waitFor(() => expect(mocks.listImports).toHaveBeenCalled())
  })

  it("muestra el error del backend cuando el login falla", async () => {
    const user = userEvent.setup()
    mocks.login.mockRejectedValue(new Error("Correo o contraseña incorrectos"))
    render(<AdminPanel />)

    await user.type(screen.getByLabelText("Correo"), SESSION.email)
    await user.type(screen.getByLabelText("Contraseña"), "mala")
    await user.click(screen.getByRole("button", { name: "Ingresar" }))

    expect(await screen.findByText("Correo o contraseña incorrectos")).toBeInTheDocument()
    expect(screen.queryByText("Historial de importaciones")).not.toBeInTheDocument()
  })

  it("permite cerrar sesión y vuelve al formulario", async () => {
    const user = userEvent.setup()
    mocks.login.mockResolvedValue(SESSION)
    render(<AdminPanel />)

    await user.type(screen.getByLabelText("Correo"), SESSION.email)
    await user.type(screen.getByLabelText("Contraseña"), "secret")
    await user.click(screen.getByRole("button", { name: "Ingresar" }))
    await screen.findByText(SESSION.email)

    await user.click(screen.getByRole("button", { name: /Cerrar sesión/ }))
    expect(screen.getByLabelText("Correo")).toBeInTheDocument()
  })
})
