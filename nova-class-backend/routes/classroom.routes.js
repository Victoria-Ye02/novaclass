const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const upload = require("../middleware/upload");
const ctrl = require("../controllers/classroom.controller");
const posts = require("../controllers/posts.controller");
const assign = require("../controllers/assignment.controller");
const grades = require("../controllers/grades.controller");
const resources = require("../controllers/resources.controller");
const attendance = require("../controllers/attendance.controller");
const meeting = require("../controllers/meeting.controller");

router.post("/classes",                     auth, ctrl.createClass);
router.get("/classes",                      auth, ctrl.listClasses);
router.post("/classes/join",               auth, ctrl.joinClass);
router.get("/classes/:id",                  auth, ctrl.getClass);
router.get("/classes/:id/members",          auth, ctrl.getMembers);
router.get("/classes/:id/materials",        auth, ctrl.listMaterials);
router.post("/classes/:id/materials",       auth, upload.single("file"), ctrl.uploadMaterial);
router.get("/materials/:materialId/summary", auth, ctrl.getSummary);
router.post("/materials/:materialId/ai",    auth, ctrl.materialAI);

router.get("/classes/:id/posts",           auth, posts.getPosts);
router.post("/classes/:id/posts",          auth, posts.createPost);
router.put("/posts/:postId",               auth, posts.editPost);
router.delete("/posts/:postId",            auth, posts.deletePost);
router.post("/posts/:postId/comments",     auth, posts.addComment);

router.get("/classes/:id/assignments",         auth, assign.listAssignments);
router.post("/classes/:id/assignments",        auth, upload.anyFile.array("files", 10), assign.createAssignment);
router.get("/assignments/:id",                 auth, assign.getAssignment);
router.post("/assignments/:id/submit",         auth, upload.anyFile.single("file"), assign.submitAssignment);
router.post("/submissions/:id/grade",          auth, assign.gradeSubmission);
router.post("/submissions/:id/return",         auth, assign.returnSubmission);
router.post("/assignments/:id/ai-check",        auth, assign.aiCheck);
router.get("/assignments/:id/comments",        auth, assign.getComments);
router.post("/assignments/:id/comments",       auth, assign.addComment);
router.patch("/assignments/:id/draft",         auth, assign.toggleDraft);
router.put("/assignments/:id",                 auth, upload.anyFile.array("files", 10), assign.updateAssignment);
router.delete("/assignments/:id",              auth, assign.deleteAssignment);
router.get("/assignments/:id/submission-stats", auth, assign.getSubmissionStats);
router.delete("/classes/:classId/members/:userId", auth, ctrl.removeMember);
router.get("/classes/:classId/students/:studentId/stats", auth, ctrl.getStudentStats);
router.post("/classes/:classId/invite", auth, ctrl.inviteStudent);

router.get("/classes/:id/grades",              auth, grades.getGrades);
router.get("/classes/:id/stream-stats",        auth, assign.getStreamStats);
router.patch("/assignments/:id/topic",         auth, assign.updateTopic);
router.patch("/materials/:id/topic",           auth, ctrl.updateMaterialTopic);

router.get("/classes/:id/resources",           auth, resources.listResources);
router.post("/classes/:id/resources",          auth, upload.single("file"), resources.addResource);
router.delete("/resources/:id",                auth, resources.deleteResource);

// Attendance
router.get("/classes/:id/attendance",              auth, attendance.getSessions);
router.post("/classes/:id/attendance",             auth, attendance.createSession);
router.get("/classes/:id/attendance/me",           auth, attendance.getMyAttendance);
router.get("/attendance/:sessionId",               auth, attendance.getSession);
router.patch("/attendance/:sessionId/mark",        auth, attendance.markAttendance);
router.delete("/attendance/:sessionId",            auth, attendance.deleteSession);

// Meeting
router.get("/classes/:id/meeting",                 auth, meeting.getActiveMeeting);
router.post("/classes/:id/meeting",                auth, meeting.startMeeting);
router.delete("/classes/:id/meeting",              auth, meeting.endMeeting);

module.exports = router;
