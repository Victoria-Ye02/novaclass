import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import API from "../../services/api";
import Login from "./Login";

const navigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

// The real Google Identity Services script never loads in jsdom. Stub the
// global so the component's effect runs its "already loaded" branch and
// captures the callback it registered, letting tests fire it directly.
function stubGoogleIdentity() {
  let registeredCallback;
  window.google = {
    accounts: {
      id: {
        initialize: ({ callback }) => { registeredCallback = callback; },
        renderButton: vi.fn(),
      },
    },
  };
  return {
    fireCredentialResponse: (response) => registeredCallback(response),
  };
}

describe("Login Google sign-in", () => {
  beforeEach(() => {
    navigate.mockReset();
    API.post.mockReset();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    delete window.google;
  });

  it("sends intent: login on the Login tab, so an unregistered Google account is not auto-created", async () => {
    const google = stubGoogleIdentity();
    API.post.mockResolvedValueOnce({
      data: { token: "t", user: { id: 1, name: "Vic", role: "student", email: "vic@nova.com" } },
    });

    render(<Login />);
    await google.fireCredentialResponse({ credential: "fake-credential" });

    expect(API.post).toHaveBeenCalledWith("/auth/google", {
      credential: "fake-credential",
      intent: "login",
    });
  });

  it("sends intent: register on the Sign Up tab, allowing account creation", async () => {
    const google = stubGoogleIdentity();
    API.post.mockResolvedValueOnce({
      data: { token: "t", user: { id: 2, name: "New", role: "student", email: "new@nova.com" } },
    });

    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));
    await google.fireCredentialResponse({ credential: "fake-credential" });

    expect(API.post).toHaveBeenCalledWith("/auth/google", {
      credential: "fake-credential",
      intent: "register",
    });
  });

  it("shows the backend's 'sign up first' message when a Login-tab Google sign-in finds no account", async () => {
    const google = stubGoogleIdentity();
    API.post.mockRejectedValueOnce({
      response: { data: { error: "No account found for this Google email. Please sign up first." } },
    });

    render(<Login />);
    await google.fireCredentialResponse({ credential: "fake-credential" });

    expect(await screen.findByText(/No account found for this Google email/)).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("Login email/ID + register form", () => {
  beforeEach(() => {
    navigate.mockReset();
    API.post.mockReset();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("logs in with a non-email ID typed into the Email/ID field", async () => {
    API.post.mockResolvedValueOnce({
      data: { token: "t", user: { id: 1, name: "Vic", role: "student", email: "vic@nova.com" } },
    });

    render(<Login />);
    fireEvent.change(screen.getByPlaceholderText("Enter your email or ID"), {
      target: { value: "  Victoria6  " },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await vi.waitFor(() => expect(API.post).toHaveBeenCalled());
    expect(API.post).toHaveBeenCalledWith("/auth/login", { email: "victoria6", password: "secret" });
  });

  it("sends a trimmed, lowercased ID (username) when registering", async () => {
    API.post.mockResolvedValueOnce({ data: { id: 1, name: "Vic", email: "vic@nova.com", username: "victoria6" } });

    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));
    fireEvent.change(screen.getByPlaceholderText("Your name"), { target: { value: "Vic" } });
    fireEvent.change(screen.getByPlaceholderText("your@email.com"), { target: { value: "vic@nova.com" } });
    fireEvent.change(screen.getByPlaceholderText("Choose an ID for logging in"), {
      target: { value: "  Victoria6  " },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await vi.waitFor(() => expect(API.post).toHaveBeenCalled());
    expect(API.post).toHaveBeenCalledWith("/auth/register", {
      name: "Vic", email: "vic@nova.com", username: "victoria6", password: "secret",
    });
  });

  it("shows the backend's minimum-length error when the ID is rejected", async () => {
    API.post.mockRejectedValueOnce({ response: { data: { error: "ID must be at least 6 characters" } } });

    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));
    fireEvent.change(screen.getByPlaceholderText("Your name"), { target: { value: "Vic" } });
    fireEvent.change(screen.getByPlaceholderText("your@email.com"), { target: { value: "vic@nova.com" } });
    fireEvent.change(screen.getByPlaceholderText("Choose an ID for logging in"), { target: { value: "abc12" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(await screen.findByText(/ID must be at least 6 characters/)).toBeTruthy();
  });
});
