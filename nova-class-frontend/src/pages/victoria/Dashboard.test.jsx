import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import API from "../../services/api";
import Dashboard from "./Dashboard";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

vi.mock("../../components/Sidebar", () => ({
  default: () => <div data-testid="sidebar" />,
}));

vi.mock("../../LanguageContext", () => ({
  useLang: () => ({ lang: "en" }),
}));

function realClass(overrides = {}) {
  return {
    id: 3, name: "html", subject: "Web Dev", code: "ABC123",
    my_role: "student", teacher_name: "Ms. Vic",
    student_count: 12, material_count: 5, assignment_count: 3,
    ...overrides,
  };
}

function deadline(overrides = {}) {
  return {
    id: 1, title: "Essay 1", due_date: "2099-01-01T09:00:00Z",
    class_id: 3, class_name: "html", my_status: null,
    ...overrides,
  };
}

function notification(overrides = {}) {
  return {
    id: 1, type: "assignment_created", title: "New assignment: Essay 1",
    message: null, link_url: "/classroom/3", is_read: 0,
    created_at: "2026-08-12T10:00:00Z",
    ...overrides,
  };
}

function stubApi(overrides = {}) {
  API.get.mockImplementation((url) => {
    if (url === "/progress/summary") return Promise.resolve({ data: { classes_joined: 0, classes_teaching: 0, questions_asked: 0, materials_accessed: 0, to_grade_count: 0, ...overrides.summary } });
    if (url.startsWith("/progress/today-plan")) return Promise.resolve({ data: overrides.todayPlan ?? { studentPlan: [], teacherPlan: [] } });
    if (url === "/classroom/classes") return Promise.resolve({ data: overrides.classes ?? [] });
    if (url === "/classroom/deadlines") return Promise.resolve({ data: { deadlines: overrides.deadlines ?? [] } });
    if (url === "/classroom/attendance/summary") return Promise.resolve({ data: overrides.attendance ?? { total: 0, present: 0, late: 0, absent: 0, rate: null } });
    if (url === "/notifications") return Promise.resolve({ data: { notifications: overrides.notifications ?? [] } });
    if (url === "/notifications/unread-count") return Promise.resolve({ data: { count: overrides.unreadCount ?? 0 } });
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
  API.post.mockResolvedValue({ data: { success: true } });
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", { getItem: vi.fn((k) => (k === "nova_role" ? "teacher" : "Vic")), setItem: vi.fn(), clear: vi.fn() });
    stubApi();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe("priority banner", () => {
    it("shows the nearest deadline due within 24 hours", async () => {
      const soon = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      stubApi({ deadlines: [deadline({ title: "gk", due_date: soon, class_name: "html" })] });
      render(<Dashboard />);

      expect((await screen.findAllByText(/gk/)).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/html/).length).toBeGreaterThan(0);
    });

    it("falls back to ungraded submissions when no deadline is imminent", async () => {
      stubApi({ summary: { to_grade_count: 4 }, deadlines: [deadline({ due_date: "2099-01-01T00:00:00Z" })] });
      render(<Dashboard />);

      expect(await screen.findByText(/4 submissions? waiting to be graded/i)).toBeTruthy();
    });

    it("shows no banner when nothing is urgent", async () => {
      render(<Dashboard />);
      await waitFor(() => expect(API.get).toHaveBeenCalledWith("/progress/summary"));
      expect(screen.queryByRole("button", { name: /view/i })).toBeNull();
    });
  });

  describe("AI Today Plan", () => {
    it("shows separate student and teacher plans for a user with both classroom roles", async () => {
      stubApi({
        summary: { classes_joined: 1, classes_teaching: 1 },
        todayPlan: {
          studentPlan: [{ title: "Finish Korean essay", reason: "Due tomorrow", link: "/classroom/3" }],
          teacherPlan: [{ title: "Grade 2 submissions", reason: "Student work is waiting", link: "/classroom/4" }],
        },
      });
      render(<Dashboard />);

      expect(await screen.findByText("Student Today Plan")).toBeTruthy();
      expect(screen.getByText("Teacher Today Plan")).toBeTruthy();
      expect(screen.getByText("Finish Korean essay")).toBeTruthy();
      expect(screen.getByText("Grade 2 submissions")).toBeTruthy();
    });

    it("shows an all-caught-up plan when a user has no actionable work", async () => {
      stubApi({ summary: { classes_joined: 1, classes_teaching: 1 } });
      render(<Dashboard />);
      await waitFor(() => expect(API.get).toHaveBeenCalledWith("/progress/today-plan?lang=en"));
      expect(screen.getByText("Student Today Plan")).toBeTruthy();
      expect(screen.getByText("Teacher Today Plan")).toBeTruthy();
      expect(screen.getByText("You are all caught up. Review a lesson or practice with K_MATE.")).toBeTruthy();
    });
  });

  describe("Teaching / Learning summary card", () => {
    it("shows only the Teaching block for a teacher with no enrolled classes", async () => {
      stubApi({ summary: { classes_teaching: 2, classes_joined: 0, to_grade_count: 1 } });
      render(<Dashboard />);

      expect(await screen.findByText("Teaching")).toBeTruthy();
      expect(screen.queryByText("Learning")).toBeNull();
    });

    it("shows both blocks for a user who teaches and is enrolled", async () => {
      stubApi({ summary: { classes_teaching: 2, classes_joined: 3 } });
      render(<Dashboard />);

      expect(await screen.findByText("Teaching")).toBeTruthy();
      expect(screen.getByText("Learning")).toBeTruthy();
    });

    it("shows the attendance strip only when there is real attendance data this month", async () => {
      stubApi({ summary: { classes_joined: 1 }, attendance: { total: 50, present: 46, late: 2, absent: 2, rate: 96 } });
      render(<Dashboard />);
      expect((await screen.findAllByText(/96%/)).length).toBeGreaterThan(0);
    });

    it("hides the attendance strip when there is no attendance data yet", async () => {
      stubApi({ summary: { classes_joined: 1 }, attendance: { total: 0, present: 0, late: 0, absent: 0, rate: null } });
      render(<Dashboard />);
      await screen.findByText("Learning");
      expect(screen.queryByText(/this month/i)).toBeNull();
    });
  });

  describe("Your classes list", () => {
    it("renders a compact row per class with a role-colored tag", async () => {
      stubApi({ classes: [realClass({ id: 1, name: "html", my_role: "teacher" }), realClass({ id: 2, name: "java", my_role: "student" })] });
      render(<Dashboard />);

      await screen.findByText("html");
      expect(screen.getByText("java")).toBeTruthy();
      expect(screen.getByText("Teaching")).toBeTruthy();
      expect(screen.getByText("Learning")).toBeTruthy();
    });

    it("still shows a Join or Create Class row when there are no classes", async () => {
      render(<Dashboard />);
      expect(await screen.findByText(/Join or Create Class/)).toBeTruthy();
    });
  });

  describe("notifications bell", () => {
    it("shows the real unread count badge", async () => {
      stubApi({ unreadCount: 3 });
      render(<Dashboard />);
      expect(await screen.findByText("3")).toBeTruthy();
    });

    it("hides the badge when there are no unread notifications", async () => {
      render(<Dashboard />);
      await waitFor(() => expect(API.get).toHaveBeenCalledWith("/notifications/unread-count"));
      expect(screen.queryByTestId("unread-badge")).toBeNull();
    });

    it("opens a dropdown of real notifications when clicked", async () => {
      stubApi({ notifications: [notification({ title: "New assignment: Essay 1" })] });
      render(<Dashboard />);

      fireEvent.click(await screen.findByLabelText(/notifications/i));
      expect(await screen.findByText("New assignment: Essay 1")).toBeTruthy();
    });

    it("marks a notification read when clicked", async () => {
      stubApi({ notifications: [notification({ id: 9, title: "New assignment: Essay 1" })] });
      render(<Dashboard />);

      fireEvent.click(await screen.findByLabelText(/notifications/i));
      fireEvent.click(await screen.findByText("New assignment: Essay 1"));

      await waitFor(() => expect(API.post).toHaveBeenCalledWith("/notifications/9/read"));
    });
  });

  describe("Calendar", () => {
    it("renders all seven day-of-week headers", async () => {
      render(<Dashboard />);
      expect(await screen.findByText("Sun")).toBeTruthy();
      expect(screen.getByText("Sat")).toBeTruthy();
    });
  });

  describe("Upcoming list", () => {
    it("shows real upcoming deadlines, not the old hardcoded TOPIK events", async () => {
      stubApi({ deadlines: [deadline({ title: "Essay 1" })] });
      render(<Dashboard />);

      expect(await screen.findByText(/Essay 1/)).toBeTruthy();
      expect(screen.queryByText(/TOPIK Mock Exam/)).toBeNull();
    });
  });
});
