const test = require("node:test");
const assert = require("node:assert/strict");
const pool = require("../config/db");

const originalQuery = pool.query;
const controllerPath = require.resolve("../controllers/victoria/progress.controller");
const groqPath = require.resolve("../services/ai/groqText");
const originalGroq = require.cache[groqPath];

function loadController(completeText) {
  delete require.cache[controllerPath];
  require.cache[groqPath] = { id: groqPath, filename: groqPath, loaded: true, exports: { completeText } };
  return require("../controllers/victoria/progress.controller");
}

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
}

// Mirrors progress.controller.js's own formatDueDate() so the "D-N" label
// doesn't have to be re-hardcoded (and go stale) every time this test runs.
function dueLabelFor(dueDateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueDate = new Date(dueDateStr); dueDate.setHours(0, 0, 0, 0);
  const dayDiff = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
  return `D-${dayDiff}`;
}

test.afterEach(() => { pool.query = originalQuery; delete require.cache[controllerPath]; });
test.after(() => { if (originalGroq) require.cache[groqPath] = originalGroq; else delete require.cache[groqPath]; });

test("todayPlan returns separate student and teacher tasks and uses AI wording", async () => {
  pool.query = async (sql) => {
    if (sql.includes("student_plan_assignments")) return [[{ id: 7, class_id: 3, title: "Korean essay", class_name: "Korean", due_date: "2099-01-01" }]];
    if (sql.includes("teacher_plan_submissions")) return [[{ class_id: 4, class_name: "Java", count: 2 }]];
    return [[]];
  };
  const controller = loadController(async () => ({ choices: [{ message: { content: JSON.stringify({ student: [{ id: "student-assignment-7", title: "Finish Korean essay", reason: "Due soon" }], teacher: [{ id: "teacher-grading-4", title: "Grade Java work", reason: "2 submissions" }] }) } }] }));
  const res = response();

  await controller.todayPlan({ user: { id: 2 }, query: {}, headers: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.studentPlan, [{
    title: "Finish Korean essay", reason: "Due soon",
    dueDate: "2099-01-01", dueLabel: dueLabelFor("2099-01-01"), isOverdue: false,
    link: "/classroom/3?tab=classwork&assign=7",
  }]);
  assert.deepEqual(res.body.teacherPlan, [{
    title: "Grade Java work", reason: "2 submissions",
    dueDate: null, dueLabel: "", isOverdue: false,
    link: "/classroom/4?tab=classwork",
  }]);
});

test("todayPlan keeps deterministic role-specific tasks when AI is unavailable", async () => {
  pool.query = async (sql) => {
    if (sql.includes("student_plan_assignments")) return [[{ id: 8, class_id: 5, title: "Week 2 quiz", class_name: "English", due_date: "2099-01-01" }]];
    if (sql.includes("teacher_plan_submissions")) return [[]];
    return [[]];
  };
  const controller = loadController(async () => { throw new Error("provider unavailable"); });
  const res = response();

  await controller.todayPlan({ user: { id: 2 }, query: {}, headers: {} }, res);

  assert.deepEqual(res.body, {
    studentPlan: [{
      title: "Complete Week 2 quiz", reason: "Upcoming assignment in English",
      dueDate: "2099-01-01", dueLabel: dueLabelFor("2099-01-01"), isOverdue: false,
      link: "/classroom/5?tab=classwork&assign=8",
    }],
    teacherPlan: [],
  });
});
