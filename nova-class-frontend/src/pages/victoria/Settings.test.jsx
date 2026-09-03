import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import API from "../../services/api";
import Settings from "./Settings";

const navigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../components/Sidebar", () => ({
  default: () => <div data-testid="sidebar" />,
}));

vi.mock("../../LanguageContext", () => ({
  useLang: () => ({ lang: "en", changeLang: vi.fn(), t: (key) => key }),
}));

vi.mock("../../ThemeContext", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));

describe("Settings profile + account", () => {
  let store;

  beforeEach(() => {
    navigate.mockReset();
    API.put.mockReset();
    API.delete.mockReset();
    store = { nova_name: "Student" };
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key) => store[key] ?? null),
      setItem: vi.fn((key, value) => { store[key] = value; }),
      removeItem: vi.fn((key) => { delete store[key]; }),
      clear: vi.fn(),
    });
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("saves the edited display name via PUT /auth/me and updates localStorage", async () => {
    API.put.mockResolvedValueOnce({ data: { id: 1, name: "New Name" } });

    render(<Settings />);
    const nameInput = screen.getByDisplayValue("Student");
    fireEvent.change(nameInput, { target: { value: "New Name" } });
    fireEvent.click(screen.getByText("saveChanges"));

    await vi.waitFor(() => expect(API.put).toHaveBeenCalledWith("/auth/me", { name: "New Name" }));
    await vi.waitFor(() => expect(localStorage.setItem).toHaveBeenCalledWith("nova_name", "New Name"));
    expect(await screen.findByText(/saved/i)).toBeTruthy();
  });

  it("shows an error instead of a saved message when the update fails", async () => {
    API.put.mockRejectedValueOnce({ response: { data: { error: "Name cannot be empty" } } });

    render(<Settings />);
    fireEvent.click(screen.getByText("saveChanges"));

    expect(await screen.findByText(/Name cannot be empty/)).toBeTruthy();
  });

  it("deletes the account after confirmation and redirects to /login", async () => {
    API.delete.mockResolvedValueOnce({ data: { success: true } });

    render(<Settings />);
    fireEvent.click(screen.getByText("deleteAccountBtn"));

    await vi.waitFor(() => expect(API.delete).toHaveBeenCalledWith("/auth/me"));
    expect(confirm).toHaveBeenCalled();
    expect(localStorage.removeItem).toHaveBeenCalledWith("nova_token");
    expect(navigate).toHaveBeenCalledWith("/login");
  });

  it("does not call the API when the delete confirmation is cancelled", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));

    render(<Settings />);
    fireEvent.click(screen.getByText("deleteAccountBtn"));

    expect(API.delete).not.toHaveBeenCalled();
  });

  it("shows the backend's conflict message when a teacher who owns classes tries to delete", async () => {
    API.delete.mockRejectedValueOnce({
      response: { data: { error: "Cannot delete an account that owns classes or uploaded materials. Please delete or transfer them first." } },
    });

    render(<Settings />);
    fireEvent.click(screen.getByText("deleteAccountBtn"));

    expect(await screen.findByText(/Cannot delete an account that owns classes/)).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });
});
