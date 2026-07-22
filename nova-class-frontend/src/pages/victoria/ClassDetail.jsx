import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import API from "../../services/api";
import { useLang } from "../../LanguageContext";

export default function ClassDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [classInfo, setClassInfo] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [members, setMembers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [activeTab, setActiveTab] = useState("stream");
  const [loading, setLoading] = useState(true);
  const [isTeacher, setIsTeacher] = useState(false);

  // Stream state
  const [announcement, setAnnouncement] = useState("");
  const [posting, setPosting] = useState(false);
  const [expandedComments, setExpandedComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [submittingComment, setSubmittingComment] = useState({});

  // Classwork state
  const [selectedMat, setSelectedMat] = useState(null);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: "", week: 1, instructions: "" });
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef();

  // AI Study Mentor state
  const [aiModal, setAiModal] = useState(null); // null | 'highlights' | 'summary' | 'quiz' | 'chat'
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [aiHint, setAiHint] = useState(false); // show "select a material" hint
  const [levelUpLevel, setLevelUpLevel] = useState(null); // null | "beginner" | "intermediate" | "advanced"
  const chatEndRef = useRef(null);
  const [classworkTab, setClassworkTab] = useState("assignments"); // "assignments" | "lessons"

  // Grades state
  const [gradesData, setGradesData] = useState(null);
  const [gradesLoading, setGradesLoading] = useState(false);
  // Attendance
  const [attendanceSessions, setAttendanceSessions] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [activeSession, setActiveSession] = useState(null); // session being marked
  const [sessionRecords, setSessionRecords] = useState({}); // { studentId: status }
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [newSessionModal, setNewSessionModal] = useState(false);
  const [newSessionForm, setNewSessionForm] = useState({ title: "", session_date: new Date().toISOString().slice(0, 10) });
  const [myAttendance, setMyAttendance] = useState(null);
  // Meeting
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [meetingLoading, setMeetingLoading] = useState(false);

  // Unread tracking (localStorage-based)
  const [seenAssignIds, setSeenAssignIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`nova_seen_assign_${id}`) || "[]")); } catch { return new Set(); }
  });
  const [seenMatIds, setSeenMatIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`nova_seen_mat_${id}`) || "[]")); } catch { return new Set(); }
  });

  function markAssignSeen(assignId) {
    setSeenAssignIds(prev => {
      const next = new Set(prev); next.add(assignId);
      localStorage.setItem(`nova_seen_assign_${id}`, JSON.stringify([...next]));
      return next;
    });
  }
  function markMatSeen(matId) {
    setSeenMatIds(prev => {
      const next = new Set(prev); next.add(matId);
      localStorage.setItem(`nova_seen_mat_${id}`, JSON.stringify([...next]));
      return next;
    });
  }

  // Resources state
  const [resources, setResources] = useState([]);
  const [resourceModal, setResourceModal] = useState(false);
  const [resourceForm, setResourceForm] = useState({ title: "", url: "" });
  const [resourceFile, setResourceFile] = useState(null);
  const [resourceAdding, setResourceAdding] = useState(false);
  const resourceFileRef = useRef();

  // Assignment state
  const [assignments, setAssignments] = useState([]);
  const [assignModal, setAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ title: "", instructions: "", due_date: "", points: 100 });
  const [assignCreating, setAssignCreating] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [assignFiles, setAssignFiles] = useState([]);
  const assignFileRef = useRef(null);
  const [editAssignFiles, setEditAssignFiles] = useState([]); // new files for edit
  const editAssignFileRef = useRef(null);
  const [editDeleteFileIds, setEditDeleteFileIds] = useState([]); // ids to delete
  const [editAssignModal, setEditAssignModal] = useState(false);
  const [editAssignForm, setEditAssignForm] = useState({ title: "", instructions: "", due_date: "", points: 100 });
  const [editAssignSaving, setEditAssignSaving] = useState(false);
  const [editAssignError, setEditAssignError] = useState("");
  const [selectedAssign, setSelectedAssign] = useState(null); // assignment detail (teacher full page)
  const [assignDetail, setAssignDetail] = useState(null); // full detail with submissions
  const [selectedSubmissionStudent, setSelectedSubmissionStudent] = useState(null); // selected student in teacher view
  const [assignPage, setAssignPage] = useState(null); // student full-page view
  const [assignPageDetail, setAssignPageDetail] = useState(null);
  const [submitContent, setSubmitContent] = useState("");
  const [submitFile, setSubmitFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false); // editing existing submission
  const [aiCheck, setAiCheck] = useState(null); // { loading, result }
  const [gradeInputs, setGradeInputs] = useState({});
  const [grading, setGrading] = useState({});
  const submitFileRef = useRef();
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const [returning, setReturning] = useState({});
  const [streamStats, setStreamStats] = useState(null);

  // Teacher-specific states
  const [streamView, setStreamView] = useState("dashboard");
  const [editingPost, setEditingPost] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null); // People tab detail panel
  const [studentStats, setStudentStats] = useState(null);
  const [studentStatsLoading, setStudentStatsLoading] = useState(false);
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null); // for assignment detail: click student row // { id, content }
  const [submissionStats, setSubmissionStats] = useState(null); // per-assignment stats modal
  const [submissionStatsLoading, setSubmissionStatsLoading] = useState(false);
  const [topicModal, setTopicModal] = useState(null); // { type: 'assignment'|'material', id, current }
  const [topicInput, setTopicInput] = useState("");

  const { lang } = useLang();
  const myName = localStorage.getItem("nova_name") || "You";

  useEffect(() => { loadAll(); }, [id]);

  async function loadAll() {
    setLoading(true);
    try {
      const [classRes, matsRes, membersRes, postsRes] = await Promise.all([
        API.get(`/classroom/classes/${id}`),
        API.get(`/classroom/classes/${id}/materials`),
        API.get(`/classroom/classes/${id}/members`),
        API.get(`/classroom/classes/${id}/posts`),
      ]);
      const cls = classRes.data.class || classRes.data;
      setClassInfo(cls);
      setIsTeacher(cls.my_role === "teacher");
      setMaterials(matsRes.data.materials || matsRes.data || []);
      const md = membersRes.data;
      setMembers(md.members || [
        ...(md.teachers || []).map(t => ({ ...t, role: "teacher" })),
        ...(md.students || []).map(s => ({ ...s, role: "student" })),
      ]);
      setPosts(postsRes.data || []);

      // Load optional data separately so failures don't block the page
      API.get(`/classroom/classes/${id}/assignments`).then(r => setAssignments(r.data || [])).catch(() => {});
      API.get(`/classroom/classes/${id}/resources`).then(r => setResources(r.data || [])).catch(() => {});
      API.get(`/classroom/classes/${id}/stream-stats`).then(r => setStreamStats(r.data)).catch(() => {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleEditPost() {
    if (!editingPost?.content?.trim()) return;
    try {
      await API.put(`/classroom/posts/${editingPost.id}`, { content: editingPost.content });
      setPosts(prev => prev.map(p => p.id === editingPost.id ? { ...p, content: editingPost.content } : p));
      setEditingPost(null);
    } catch (err) { console.error(err); }
  }

  async function handleDeletePost(postId) {
    if (!window.confirm(lang === "en" ? "Delete this post?" : "ဤ post ကို ဖျက်မည်လား?")) return;
    try {
      await API.delete(`/classroom/posts/${postId}`);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err) { console.error(err); }
  }

  function openEditAssign(a) {
    setEditAssignForm({
      title: a.title || "",
      instructions: a.instructions || "",
      due_date: a.due_date ? a.due_date.slice(0, 16) : "",
      points: a.points ?? 100,
    });
    setEditAssignError("");
    setEditAssignModal(true);
  }

  async function handleUpdateAssignment(isDraft) {
    if (!editAssignForm.title.trim()) { setEditAssignError("Title is required"); return; }
    setEditAssignSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", editAssignForm.title.trim());
      fd.append("instructions", editAssignForm.instructions || "");
      fd.append("due_date", editAssignForm.due_date || "");
      fd.append("points", editAssignForm.points || 100);
      fd.append("is_draft", isDraft ? 1 : 0);
      if (editDeleteFileIds.length) fd.append("delete_file_ids", JSON.stringify(editDeleteFileIds));
      for (const f of editAssignFiles) fd.append("files", f);
      const { data } = await API.put(`/classroom/assignments/${selectedAssign.id}`, fd);
      setAssignments(prev => prev.map(a => a.id === data.id ? data : a));
      setSelectedAssign(data);
      setEditAssignModal(false);
      setEditAssignFiles([]);
      setEditDeleteFileIds([]);
    } catch (err) {
      setEditAssignError(err.response?.data?.error || "Failed to save");
    } finally {
      setEditAssignSaving(false);
    }
  }

  async function openSubmissionStats(assignId) {
    setSubmissionStatsLoading(true);
    setSubmissionStats({ loading: true });
    try {
      const { data } = await API.get(`/classroom/assignments/${assignId}/submission-stats`);
      setSubmissionStats(data);
    } catch (err) { setSubmissionStats(null); }
    finally { setSubmissionStatsLoading(false); }
  }

  async function handleRemoveMember(memberId, memberName) {
    if (!window.confirm(lang === "en" ? `Remove "${memberName}" from this class?` : `"${memberName}" ကို class မှ ဖယ်ရှားမည်လား?`)) return;
    try {
      await API.delete(`/classroom/classes/${id}/members/${memberId}`);
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (err) { console.error(err); }
  }

  async function openStudentStats(student) {
    setSelectedStudent(student);
    setStudentStats(null);
    setStudentStatsLoading(true);
    try {
      const { data } = await API.get(`/classroom/classes/${id}/students/${student.id}/stats`);
      setStudentStats(data);
    } catch (err) { console.error(err); }
    finally { setStudentStatsLoading(false); }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteMsg(null);
    try {
      const { data } = await API.post(`/classroom/classes/${id}/invite`, { email: inviteEmail });
      setInviteMsg({ ok: true, text: lang === "en" ? `✅ ${data.user.name} has been added to the class` : `✅ ${data.user.name} ကို class ထဲ ထည့်ပြီးပါပြီ` });
      setInviteEmail("");
      // refresh members
      const res = await API.get(`/classroom/classes/${id}/members`);
      const md = res.data;
      setMembers(md.members || [...(md.teachers||[]).map(t=>({...t,role:"teacher"})),...(md.students||[]).map(s=>({...s,role:"student"}))]);
    } catch (err) {
      setInviteMsg({ ok: false, text: err.response?.data?.error || "Error occurred" });
    } finally { setInviting(false); }
  }

  async function saveTopic() {
    if (!topicModal) return;
    try {
      if (topicModal.type === "assignment") {
        await API.patch(`/classroom/assignments/${topicModal.id}/topic`, { topic: topicInput });
        setAssignments(prev => prev.map(a => a.id === topicModal.id ? { ...a, topic: topicInput } : a));
      } else {
        await API.patch(`/classroom/materials/${topicModal.id}/topic`, { topic: topicInput });
        setMaterials(prev => prev.map(m => m.id === topicModal.id ? { ...m, topic: topicInput } : m));
      }
      setTopicModal(null);
      setTopicInput("");
    } catch (err) { console.error(err); }
  }

  async function handlePost() {
    if (!announcement.trim()) return;
    setPosting(true);
    try {
      const { data } = await API.post(`/classroom/classes/${id}/posts`, { content: announcement });
      setPosts(prev => [data, ...prev]);
      setAnnouncement("");
    } catch (err) {
      console.error(err);
    } finally {
      setPosting(false);
    }
  }

  async function handleComment(postId) {
    const content = commentInputs[postId]?.trim();
    if (!content) return;
    setSubmittingComment(s => ({ ...s, [postId]: true }));
    try {
      const { data } = await API.post(`/classroom/posts/${postId}/comments`, { content });
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, comments: [...(p.comments || []), data] } : p
      ));
      setCommentInputs(c => ({ ...c, [postId]: "" }));
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingComment(s => ({ ...s, [postId]: false }));
    }
  }

  async function openAI(action) {
    if (!selectedMat) {
      // If called from Stream tab: switch to Classwork, auto-select first material if only one
      setActiveTab("classwork");
      if (materials.length === 1) {
        setSelectedMat(materials[0]);
        setExpandedId(materials[0].id);
        setAiModal(action);
        setAiResult(null);
        setChatHistory([]);
        if (action !== "chat") {
          setAiLoading(true);
          try {
            const { data } = await API.post(`/classroom/materials/${materials[0].id}/ai`, { action });
            setAiResult(data.data);
          } catch {
            setAiResult({ error: "AI unavailable. Check GEMINI_API_KEY in backend .env" });
          } finally {
            setAiLoading(false);
          }
        }
      } else {
        setAiHint(action); // show "please select a material" banner
      }
      return;
    }
    setAiModal(action);
    setAiResult(null);
    setChatHistory([]);
    if (action === "chat") { setLevelUpLevel(null); return; }
    setAiLoading(true);
    try {
      const { data } = await API.post(`/classroom/materials/${selectedMat.id}/ai`, { action });
      setAiResult(data.data);
    } catch (err) {
      setAiResult({ error: "AI unavailable. Check GEMINI_API_KEY in backend .env" });
    } finally {
      setAiLoading(false);
    }
  }

  async function sendChat() {
    if (!chatInput.trim() || !selectedMat) return;
    const userMsg = { role: "user", content: chatInput };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setChatInput("");
    setChatSending(true);
    try {
      const { data } = await API.post(`/classroom/materials/${selectedMat.id}/ai`, {
        action: "chat", message: chatInput, history: chatHistory, level: levelUpLevel, lang,
      });
      setChatHistory([...newHistory, { role: "assistant", content: data.reply }]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      setChatHistory([...newHistory, { role: "assistant", content: lang === "en" ? "AI unavailable. Please check the backend." : "AI မရနိုင်ပါ။ Backend ကို စစ်ဆေးပါ။" }]);
    } finally {
      setChatSending(false);
    }
  }

  async function startLevelUpChat(level) {
    setLevelUpLevel(level);
    setChatHistory([]);
    setChatSending(true);
    const startMsg = lang === "en" ? {
      beginner: "I'm ready to learn this material from scratch. Please ask me the first question — I'll answer as best I can.",
      intermediate: "I know the basics of this material. Let's check what I know well.",
      advanced: "I understand this material well. Challenge me with hard questions.",
    } : {
      beginner: "ဒီသင်ခန်းစာကို ယခုမှ စတင်လေ့လာမည်ဆိုတာ သိပြီ။ ပထမဆုံး မေးခွန်းလေး မေးမယ်နော် — ဖြေနိုင်သလောက် ဖြေပေးပါ၊ မမှန်ရင်လဲ ကိစ္စမရှိဘူး။",
      intermediate: "ဒီသင်ခန်းစာကို တစ်ဝက်လောက် နားလည်ပြီဆိုတာ သိပြီ။ ဘာတွေ ကောင်းကောင်းသိပြီးလဲ စစ်ဆေးကြည့်မယ်နော်။",
      advanced: "ဒီသင်ခန်းစာကို ကောင်းကောင်းသိပြီဆိုတာ သိပြီ။ ခက်ဆစ်တဲ့ မေးခွန်းတွေနဲ့ စိန်ခေါ်မယ်နော်။",
    };
    try {
      const { data } = await API.post(`/classroom/materials/${selectedMat.id}/ai`, {
        action: "chat",
        message: startMsg[level],
        history: [],
        level,
        lang,
      });
      setChatHistory([{ role: "assistant", content: data.reply }]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      setChatHistory([{ role: "assistant", content: lang === "en" ? "AI unavailable. Please check the backend." : "AI မရနိုင်ပါ။ Backend ကို စစ်ဆေးပါ။" }]);
    } finally {
      setChatSending(false);
    }
  }

  async function loadGrades() {
    setGradesLoading(true);
    try {
      const { data } = await API.get(`/classroom/classes/${id}/grades`);
      setGradesData(data);
    } catch (err) { console.error(err); }
    finally { setGradesLoading(false); }
  }

  async function loadAttendance() {
    setAttendanceLoading(true);
    try {
      if (isTeacher) {
        const { data } = await API.get(`/classroom/classes/${id}/attendance`);
        setAttendanceSessions(data);
      } else {
        const { data } = await API.get(`/classroom/classes/${id}/attendance/me`);
        setMyAttendance(data);
      }
    } catch (err) { console.error(err); }
    finally { setAttendanceLoading(false); }
  }

  async function loadMeeting() {
    try {
      const { data } = await API.get(`/classroom/classes/${id}/meeting`);
      setActiveMeeting(data.meeting);
    } catch (err) { console.error(err); }
  }

  async function startMeeting() {
    setMeetingLoading(true);
    try {
      const { data } = await API.post(`/classroom/classes/${id}/meeting`, { title: "Live Class" });
      setActiveMeeting(data.meeting);
    } catch (err) { console.error(err); }
    finally { setMeetingLoading(false); }
  }

  async function endMeeting() {
    setMeetingLoading(true);
    try {
      await API.delete(`/classroom/classes/${id}/meeting`);
      setActiveMeeting(null);
    } catch (err) { console.error(err); }
    finally { setMeetingLoading(false); }
  }

  async function createAttendanceSession() {
    if (!newSessionForm.title.trim() || !newSessionForm.session_date) return;
    try {
      const { data } = await API.post(`/classroom/classes/${id}/attendance`, newSessionForm);
      setAttendanceSessions(prev => [data, ...(prev || [])]);
      setNewSessionModal(false);
      setNewSessionForm({ title: "", session_date: new Date().toISOString().slice(0, 10) });
      // Open the new session right away for marking
      openAttendanceSession(data.id);
    } catch (err) { console.error(err); }
  }

  async function openAttendanceSession(sessionId) {
    try {
      const { data } = await API.get(`/classroom/attendance/${sessionId}`);
      setActiveSession(data);
      const rmap = {};
      for (const r of data.records) rmap[r.student_id] = r.status;
      setSessionRecords(rmap);
    } catch (err) { console.error(err); }
  }

  async function saveAttendance() {
    setSavingAttendance(true);
    try {
      const records = Object.entries(sessionRecords).map(([student_id, status]) => ({ student_id: Number(student_id), status }));
      await API.patch(`/classroom/attendance/${activeSession.id}/mark`, { records });
      setActiveSession(null);
      loadAttendance();
    } catch (err) {
      console.error("saveAttendance error:", err);
      alert("Save failed: " + (err?.response?.data?.error || err.message));
    } finally { setSavingAttendance(false); }
  }

  async function deleteAttendanceSession(sessionId) {
    try {
      await API.delete(`/classroom/attendance/${sessionId}`);
      setAttendanceSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) { console.error(err); }
  }

  async function addResource() {
    if (!resourceForm.title.trim()) return;
    setResourceAdding(true);
    try {
      const fd = new FormData();
      fd.append("title", resourceForm.title);
      if (resourceFile) fd.append("file", resourceFile);
      else fd.append("url", resourceForm.url);
      const { data } = await API.post(`/classroom/classes/${id}/resources`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResources(prev => [data, ...prev]);
      setResourceModal(false);
      setResourceForm({ title: "", url: "" });
      setResourceFile(null);
      if (resourceFileRef.current) resourceFileRef.current.value = "";
    } catch (err) { console.error(err); }
    finally { setResourceAdding(false); }
  }

  async function deleteResource(resId) {
    try {
      await API.delete(`/classroom/resources/${resId}`);
      setResources(prev => prev.filter(r => r.id !== resId));
    } catch (err) { console.error(err); }
  }

  async function createAssignment(asDraft = false) {
    if (!assignForm.title.trim()) return;
    setAssignCreating(true); setAssignError("");
    try {
      const fd = new FormData();
      fd.append("title", assignForm.title.trim());
      fd.append("instructions", assignForm.instructions || "");
      fd.append("due_date", assignForm.due_date || "");
      fd.append("points", assignForm.points || 100);
      fd.append("is_draft", asDraft ? 1 : 0);
      for (const f of assignFiles) fd.append("files", f);
      const { data } = await API.post(`/classroom/classes/${id}/assignments`, fd);
      setAssignments(prev => [data, ...prev]);
      setAssignModal(false);
      setAssignForm({ title: "", instructions: "", due_date: "", points: 100 });
      setAssignFiles([]);
    } catch (err) {
      setAssignError(err.response?.data?.error || "Failed to create assignment.");
    } finally {
      setAssignCreating(false);
    }
  }

  async function openAssignment(assign) {
    markAssignSeen(assign.id);
    if (!isTeacher) {
      // Student → full page view
      setAssignPage(assign);
      setAssignPageDetail(null);
      setSubmitContent(assign.my_submission?.content || "");
      setEditing(false);
      setAiCheck(null);
      setComments([]);
      setCommentInput("");
      try {
        const [detail, cmts] = await Promise.all([
          API.get(`/classroom/assignments/${assign.id}`),
          API.get(`/classroom/assignments/${assign.id}/comments`),
        ]);
        setAssignPageDetail(detail.data);
        setComments(cmts.data || []);
      } catch (err) { console.error(err); }
      return;
    }
    // Teacher → full page view
    setSelectedAssign(assign);
    setAssignDetail(null);
    setSelectedSubmissionStudent(null);
    try {
      const { data } = await API.get(`/classroom/assignments/${assign.id}`);
      setAssignDetail(data);
    } catch (err) { console.error(err); }
  }

  async function checkWithAI() {
    if (!assignPage) return;
    setAiCheck({ loading: true, result: null });
    try {
      const { data } = await API.post(`/classroom/assignments/${assignPage.id}/ai-check`, {
        answer: submitContent,
        hasFile: !!submitFile,
        fileName: submitFile?.name || null,
        lang,
      });
      setAiCheck({ loading: false, result: data });
    } catch {
      setAiCheck({ loading: false, result: { isComplete: null, score: null, missing: [], feedback: lang === "en" ? "AI check failed. Please try again later." : "AI စစ်ဆေးမှု မအောင်မြင်ပါ။ နောက်မှ ထပ်ကြိုးစားပါ။" } });
    }
  }

  async function sendComment(assignId, targetStudentId = null) {
    if (!commentInput.trim()) return;
    setCommentSending(true);
    try {
      const { data } = await API.post(`/classroom/assignments/${assignId}/comments`, {
        content: commentInput.trim(),
        target_student_id: targetStudentId,
      });
      setComments(c => [...c, data]);
      setCommentInput("");
    } catch (err) {
      console.error(err);
    } finally {
      setCommentSending(false);
    }
  }

  async function returnSubmission(subId) {
    setReturning(r => ({ ...r, [subId]: true }));
    try {
      await API.post(`/classroom/submissions/${subId}/return`);
      setAssignDetail(d => d ? {
        ...d,
        submissions: d.submissions.map(s => s.id === subId ? { ...s, status: "returned" } : s),
      } : d);
    } catch (err) {
      console.error(err);
    } finally {
      setReturning(r => ({ ...r, [subId]: false }));
    }
  }

  async function publishDraft(assignId) {
    try {
      await API.patch(`/classroom/assignments/${assignId}/draft`, { is_draft: false });
      setAssignments(prev => prev.map(a => a.id === assignId ? { ...a, is_draft: false } : a));
      setSelectedAssign(a => a ? { ...a, is_draft: false } : a);
    } catch (err) { console.error(err); }
  }

  async function submitAssignment() {
    const target = assignPage || selectedAssign;
    if (!target) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (submitContent) fd.append("content", submitContent);
      if (submitFile) fd.append("file", submitFile);
      const { data } = await API.post(`/classroom/assignments/${target.id}/submit`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAssignments(prev => prev.map(a =>
        a.id === target.id ? { ...a, my_submission: data } : a
      ));
      if (assignPage) {
        setAssignPage(a => ({ ...a, my_submission: data }));
        setAssignPageDetail(d => d ? { ...d, my_submission: data } : d);
        setEditing(false);
        setAiCheck(null);
      }
      setAssignDetail(d => d ? { ...d, my_submission: data } : d);
      setSubmitFile(null);
      if (submitFileRef.current) submitFileRef.current.value = "";
    } catch (err) {
      alert(err.response?.data?.error || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function gradeSubmission(subId) {
    const { grade, comment } = gradeInputs[subId] || {};
    setGrading(g => ({ ...g, [subId]: true }));
    try {
      const { data } = await API.post(`/classroom/submissions/${subId}/grade`, {
        grade, grade_comment: comment,
      });
      setAssignDetail(d => d ? {
        ...d,
        submissions: d.submissions.map(s => s.id === subId ? data : s),
      } : d);
    } catch (err) {
      console.error(err);
    } finally {
      setGrading(g => ({ ...g, [subId]: false }));
    }
  }

  async function handleUpload() {
    if (!uploadForm.title.trim()) return;
    setUploading(true); setUploadError("");
    try {
      const fd = new FormData();
      fd.append("title", uploadForm.title);
      fd.append("week", uploadForm.week);
      fd.append("instructions", uploadForm.instructions);
      if (uploadFile) fd.append("file", uploadFile);
      await API.post(`/classroom/classes/${id}/materials`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadModal(false);
      setUploadForm({ title: "", week: 1, instructions: "" });
      setUploadFile(null);
      if (fileRef.current) fileRef.current.value = "";
      loadAll();
    } catch (err) {
      setUploadError(err.response?.data?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const weekGroups = materials.reduce((acc, mat) => {
    const w = mat.week || 1;
    if (!acc[w]) acc[w] = [];
    acc[w].push(mat);
    return acc;
  }, {});

  const teacher = members.find(m => m.role === "teacher");
  const students = members.filter(m => m.role === "student");

  if (loading) return (
    <div style={layout}>
      <Sidebar />
      <main style={{ marginLeft: "240px", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#9ca3af" }}>Loading...</p>
      </main>
    </div>
  );

  if (!classInfo) return (
    <div style={layout}>
      <Sidebar />
      <main style={{ marginLeft: "240px", padding: "32px" }}>
        <button onClick={() => navigate("/classroom")} style={backBtn}>← Back</button>
        <p style={{ color: "#ef4444", marginTop: "16px" }}>Class not found.</p>
      </main>
    </div>
  );

  return (
    <div style={layout}>
      <Sidebar />
      <div style={{ marginLeft: "240px", flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Header */}
        <div style={topHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button onClick={() => navigate("/classroom")} style={backBtn}>←</button>
            <div>
              <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>{classInfo.name}</h1>
              {classInfo.subject && <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{classInfo.subject}</p>}
            </div>
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            {[
              { key: "stream", label: "Stream" },
              { key: "classwork", label: "Classwork" },
              ...(isTeacher ? [{ key: "grades", label: "Grades" }] : []),
              { key: "attendance", label: "Attendance" },
              { key: "resources", label: "Resources" },
              ...(isTeacher ? [{ key: "people", label: "People" }] : []),
            ].map(tab => (
              <button key={tab.key} onClick={() => {
                setActiveTab(tab.key);
                if (tab.key === "stream") setStreamView("dashboard");
                if (tab.key === "grades" && !gradesData) loadGrades();
                if (tab.key === "attendance" && !attendanceSessions && !myAttendance) loadAttendance();
                if (tab.key === "attendance") loadMeeting();
              }} style={tabBtn(activeTab === tab.key)}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, padding: "28px 32px", background: "#f8f9fa" }}>

          {/* ── STREAM TAB ── */}
          {activeTab === "stream" && streamView === "announcements" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                <button onClick={() => setStreamView("dashboard")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "#6b7280", display: "flex", alignItems: "center", gap: "4px" }}>← Back</button>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>📢 Announcements</h3>
              </div>
              {isTeacher && (
                <div style={{ ...announceCard, marginBottom: "16px" }}>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <div style={{ ...avatarSm, background: "#3B37CC", color: "#fff", flexShrink: 0 }}>{myName[0].toUpperCase()}</div>
                    <textarea value={announcement} onChange={e => setAnnouncement(e.target.value)} placeholder="Announce something to your class..." style={announceTextarea} rows={announcement ? 4 : 2} />
                  </div>
                  {announcement.trim() && (
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
                      <button onClick={handlePost} disabled={posting} style={postBtn}>{posting ? "Posting..." : "Post"}</button>
                    </div>
                  )}
                </div>
              )}
              {posts.length === 0
                ? <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}><div style={{ fontSize: "32px", marginBottom: "8px" }}>📢</div><p>No announcements yet.</p></div>
                : posts.map(post => (
                  <PostCard key={post.id} post={post} myName={myName} isTeacher={isTeacher}
                    onEdit={p => setEditingPost({ id: p.id, content: p.content })}
                    onDelete={handleDeletePost}
                    expandedComments={expandedComments} setExpandedComments={setExpandedComments}
                    commentInputs={commentInputs} setCommentInputs={setCommentInputs}
                    submittingComment={submittingComment} handleComment={handleComment} />
                ))
              }
            </div>
          )}

          {activeTab === "stream" && streamView === "dashboard" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "20px", alignItems: "start" }}>

              {/* ── LEFT MAIN ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                {/* Announcement post box — teacher only */}
                {isTeacher && (
                  <div style={announceCard}>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <div style={{ ...avatarSm, background: "#3B37CC", color: "#fff", flexShrink: 0 }}>
                        {myName[0].toUpperCase()}
                      </div>
                      <textarea
                        value={announcement}
                        onChange={e => setAnnouncement(e.target.value)}
                        placeholder="Announce something to your class..."
                        style={announceTextarea}
                        rows={announcement ? 4 : 2}
                      />
                    </div>
                    {announcement.trim() && (
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
                        <button onClick={handlePost} disabled={posting} style={postBtn}>
                          {posting ? "Posting..." : "Post"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Announcement section — compact rows like e-Class */}
                <StreamSection
                  icon="📢" title="Announcement"
                  onMore={() => setStreamView("announcements")}
                  empty={posts.length === 0}
                  emptyMsg={isTeacher ? "Write an announcement above." : "No announcements yet."}
                >
                  {posts.slice(0, 4).map(post => (
                    <StreamRow
                      key={post.id}
                      label={post.content?.slice(0, 70) + (post.content?.length > 70 ? "…" : "")}
                      date={new Date(post.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      actions={isTeacher ? (
                        <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                          <button onClick={e => { e.stopPropagation(); setEditingPost({ id: post.id, content: post.content }); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: "13px", padding: "0 3px" }}>✏️</button>
                          <button onClick={e => { e.stopPropagation(); handleDeletePost(post.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "13px", padding: "0 3px" }}>🗑️</button>
                        </div>
                      ) : null}
                      onClick={() => setStreamView("announcements")}
                    />
                  ))}
                </StreamSection>

                {/* Material section */}
                <StreamSection
                  icon="📁" title="Material"
                  onMore={() => setActiveTab("classwork")}
                  empty={materials.length === 0}
                  emptyMsg="No materials uploaded yet."
                >
                  {materials.slice(0, 5).map(mat => (
                    <StreamRow
                      key={mat.id}
                      label={mat.title}
                      date={new Date(mat.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      onClick={() => { setActiveTab("classwork"); setClassworkTab("lessons"); }}
                    />
                  ))}
                </StreamSection>

                {/* Assignments section */}
                <StreamSection
                  icon="✏️" title="Assignments"
                  onMore={() => { setActiveTab("classwork"); setClassworkTab("assignments"); }}
                  empty={assignments.filter(a => !a.is_draft).length === 0}
                  emptyMsg="No assignments yet."
                >
                  {assignments.filter(a => !a.is_draft).slice(0, 4).map(a => {
                    const now = new Date();
                    const due = a.due_date ? new Date(a.due_date) : null;
                    const status = due && due < now ? "Finished" : "In Progress";
                    return (
                      <StreamRow
                        key={a.id}
                        label={a.title}
                        badge={status}
                        badgeColor={status === "Finished" ? "#6b7280" : "#3B37CC"}
                        onClick={() => { setActiveTab("classwork"); setClassworkTab("assignments"); }}
                      />
                    );
                  })}
                </StreamSection>
              </div>

              {/* ── RIGHT SIDEBAR ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                {/* Submission Status */}
                <div style={sideCard}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a2e", marginBottom: "14px", textAlign: "center" }}>
                    Submission Status
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>Activity</div>
                      <div style={{ fontSize: "28px", fontWeight: 800, color: "#3B37CC" }}>{streamStats?.totalAssignments ?? "—"}</div>
                      <div style={{ fontSize: "11px", color: "#6b7280" }}>case</div>
                    </div>
                    {/* Donut chart */}
                    <div style={{ position: "relative", width: "80px", height: "80px" }}>
                      <svg viewBox="0 0 36 36" style={{ width: "80px", height: "80px", transform: "rotate(-90deg)" }}>
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#3B37CC" strokeWidth="3.5"
                          strokeDasharray={`${streamStats?.submissionRate ?? 0} ${100 - (streamStats?.submissionRate ?? 0)}`}
                          strokeLinecap="round" />
                      </svg>
                      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: "14px", fontWeight: 800, color: "#1a1a2e" }}>
                        {streamStats?.submissionRate ?? 0}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Important (latest announcement) */}
                {posts.length > 0 && (
                  <div style={sideCard}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a2e", marginBottom: "10px" }}>Important</div>
                    {posts.slice(0, 2).map(p => (
                      <div key={p.id} style={{ display: "flex", gap: "8px", alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
                        <span style={{ fontSize: "13px" }}>⭐</span>
                        <span style={{ fontSize: "12px", color: "#374151", lineHeight: 1.4 }}>{p.content?.slice(0, 55)}{p.content?.length > 55 ? "…" : ""}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Class code */}
                {classInfo.code && (
                  <div style={{ background: "#fff", border: "2px dashed #d1d5db", borderRadius: "12px", padding: "14px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#9ca3af", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px" }}>Class Code</div>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#3B37CC", letterSpacing: "4px" }}>{classInfo.code}</div>
                    <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>Share with students</div>
                  </div>
                )}

                {/* New Posts */}
                <div style={sideCard}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a2e", marginBottom: "8px" }}>New Posts</div>
                  {posts.length === 0
                    ? <div style={{ fontSize: "12px", color: "#9ca3af" }}>No Data.</div>
                    : posts.slice(0, 2).map(p => (
                      <div key={p.id} style={{ fontSize: "12px", color: "#374151", padding: "4px 0", borderBottom: "1px solid #f3f4f6" }}>
                        {p.content?.slice(0, 40)}{p.content?.length > 40 ? "…" : ""}
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          )}

          {/* ── CLASSWORK TAB ── */}
          {activeTab === "classwork" && (
            <div style={{ display: "grid", gridTemplateColumns: (selectedMat && !isTeacher) ? "1fr 320px" : "1fr", gap: "24px", alignItems: "start" }}>
              {/* Left: material list */}
              <div>

                {/* Sub-tabs */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                  <div style={{ display: "flex", background: "#f3f4f6", borderRadius: "10px", padding: "4px", gap: "4px" }}>
                    {(() => {
                      const unreadAssign = assignments.filter(a => !seenAssignIds.has(a.id)).length;
                      const unreadMat = materials.filter(m => !seenMatIds.has(m.id)).length;
                      return [
                        { key: "assignments", label: "📝 Assignments", total: assignments.length, unread: unreadAssign },
                        { key: "lessons",     label: "📚 Lessons",     total: materials.length,   unread: unreadMat },
                      ].map(t => (
                        <button key={t.key} onClick={() => setClassworkTab(t.key)} style={{
                          padding: "8px 18px", borderRadius: "8px", border: "none", cursor: "pointer",
                          fontSize: "13px", fontWeight: 700, transition: "all 0.15s",
                          background: classworkTab === t.key ? "#fff" : "transparent",
                          color: classworkTab === t.key ? "#3B37CC" : "#6b7280",
                          boxShadow: classworkTab === t.key ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                          position: "relative",
                        }}>
                          {t.label}
                          {t.unread > 0 ? (
                            <span style={{ marginLeft: "6px", background: "#ef4444", color: "#fff", borderRadius: "20px", padding: "1px 7px", fontSize: "11px", fontWeight: 800, animation: "pulse 1.5s infinite" }}>
                              {t.unread} new
                            </span>
                          ) : (
                            <span style={{ marginLeft: "6px", background: classworkTab === t.key ? "#3B37CC" : "#d1d5db", color: classworkTab === t.key ? "#fff" : "#6b7280", borderRadius: "20px", padding: "1px 7px", fontSize: "11px" }}>
                              {t.total}
                            </span>
                          )}
                        </button>
                      ));
                    })()}
                  </div>
                  {/* Action button */}
                  {isTeacher && classworkTab === "assignments" && (
                    <button onClick={() => setAssignModal(true)} style={{ background: "#3B37CC", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                      + Create Assignment
                    </button>
                  )}
                  {isTeacher && classworkTab === "lessons" && (
                    <button onClick={() => setUploadModal(true)} style={{ background: "#3B37CC", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                      + New Material
                    </button>
                  )}
                </div>

                {/* Assignments tab */}
                {classworkTab === "assignments" && <div style={{ marginBottom: "28px" }}>

                  {/* Student full-page assignment view */}
                  {assignPage && !isTeacher ? (
                    <div>
                      {/* Back button */}
                      <button onClick={() => { setAssignPage(null); setAssignPageDetail(null); setEditing(false); setAiCheck(null); }} style={{ background: "none", border: "none", color: "#3B37CC", fontSize: "13px", fontWeight: 700, cursor: "pointer", marginBottom: "16px", display: "flex", alignItems: "center", gap: "6px" }}>
                        ← Back to Assignments
                      </button>

                      {/* Assignment info table */}
                      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden", marginBottom: "20px" }}>
                        <div style={{ background: "#3B37CC", padding: "16px 20px" }}>
                          <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>{assignPage.title}</div>
                          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)", marginTop: "4px" }}>{classInfo.name}</div>
                        </div>
                        {[
                          { label: "Due Date", value: assignPage.due_date ? formatDate(assignPage.due_date) : "No due date" },
                          { label: "Points", value: assignPage.points ? `${assignPage.points} pts` : "Not graded" },
                          { label: "Status", value: (() => {
                            const sub = assignPage.my_submission || assignPageDetail?.my_submission;
                            if (!sub) return <span style={{ color: "#f59e0b", fontWeight: 700 }}>Not submitted</span>;
                            if (sub.status === "graded") return <span style={{ color: "#22c55e", fontWeight: 700 }}>✓ Graded ({sub.grade}/{assignPage.points})</span>;
                            if (sub.status === "returned") return <span style={{ color: "#3B37CC", fontWeight: 700 }}>↩ Returned</span>;
                            if (sub.status === "late") return <span style={{ color: "#ef4444", fontWeight: 700 }}>⚠ Late Submission</span>;
                            return <span style={{ color: "#3B37CC", fontWeight: 700 }}>✓ Turned In</span>;
                          })() },
                          { label: "Edit Allowed", value: assignPage.due_date ? (new Date() < new Date(assignPage.due_date) ? <span style={{ color: "#22c55e" }}>Yes (before due date)</span> : <span style={{ color: "#ef4444" }}>No (past due date)</span>) : "Yes" },
                        ].map(row => (
                          <div key={row.label} style={{ display: "flex", borderBottom: "1px solid #f3f4f6", padding: "12px 20px" }}>
                            <div style={{ width: "140px", fontSize: "13px", fontWeight: 700, color: "#6b7280", flexShrink: 0 }}>{row.label}</div>
                            <div style={{ fontSize: "13px", color: "#1a1a2e" }}>{row.value}</div>
                          </div>
                        ))}
                        {assignPage.instructions && (
                          <div style={{ display: "flex", padding: "12px 20px" }}>
                            <div style={{ width: "140px", fontSize: "13px", fontWeight: 700, color: "#6b7280", flexShrink: 0 }}>Instructions</div>
                            <div style={{ fontSize: "13px", color: "#374151", lineHeight: 1.6 }}>{assignPage.instructions}</div>
                          </div>
                        )}
                        {(assignPageDetail?.files || assignPage.files)?.length > 0 && (
                          <div style={{ display: "flex", padding: "12px 20px", borderTop: "1px solid #f3f4f6" }}>
                            <div style={{ width: "140px", fontSize: "13px", fontWeight: 700, color: "#6b7280", flexShrink: 0 }}>Attachments</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              {(assignPageDetail?.files || assignPage.files).map(f => (
                                <a key={f.id} href={`http://localhost:5001/uploads/${f.file_path}`} target="_blank" rel="noreferrer"
                                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#3B37CC", fontWeight: 600, background: "#f0f4ff", padding: "5px 12px", borderRadius: "8px", textDecoration: "none", border: "1px solid #a5b4fc", width: "fit-content" }}>
                                  📄 {f.file_name}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Submit section */}
                      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px", marginBottom: "16px" }}>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: "#374151", marginBottom: "14px" }}>Submit</div>

                        {(() => {
                          const sub = assignPage.my_submission || assignPageDetail?.my_submission;
                          const pastDue = assignPage.due_date && new Date() > new Date(assignPage.due_date);
                          const canEdit = !pastDue || !sub;

                          if (sub && !editing) {
                            // Already submitted — show submission + edit button
                            return (
                              <div>
                                <div style={{ background: sub.status === "graded" ? "#f0fdf4" : "#f0f4ff", border: `1px solid ${sub.status === "graded" ? "#86efac" : "#a5b4fc"}`, borderRadius: "10px", padding: "16px", marginBottom: "12px" }}>
                                  {sub.status === "graded" ? (
                                    <div style={{ textAlign: "center" }}>
                                      <div style={{ fontSize: "32px", fontWeight: 800, color: "#15803d" }}>{sub.grade}<span style={{ fontSize: "16px", color: "#6b7280" }}>/{assignPage.points}</span></div>
                                      <div style={{ fontSize: "13px", color: "#166534", marginTop: "4px" }}>Graded ✓</div>
                                      {sub.grade_comment && <div style={{ fontSize: "13px", color: "#374151", marginTop: "8px", fontStyle: "italic" }}>"{sub.grade_comment}"</div>}
                                    </div>
                                  ) : (
                                    <div>
                                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#3B37CC", marginBottom: "8px" }}>✓ Turned In {sub.status === "late" ? "(Late)" : ""}</div>
                                      {sub.content && <p style={{ fontSize: "13px", color: "#374151", margin: "0 0 6px" }}>{sub.content}</p>}
                                      {sub.file_path && <div style={{ fontSize: "12px", color: "#6b7280" }}>📎 File attached</div>}
                                    </div>
                                  )}
                                </div>
                                {canEdit && sub.status !== "graded" && (
                                  <button onClick={() => { setEditing(true); setSubmitContent(sub.content || ""); setAiCheck(null); }} style={{ background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer", color: "#374151" }}>
                                    ✏️ Edit Submission
                                  </button>
                                )}
                                {pastDue && sub.status !== "graded" && (
                                  <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "8px" }}>Submission period is expired. Editing not allowed.</div>
                                )}
                              </div>
                            );
                          }

                          if (!canEdit && !sub) {
                            return <div style={{ textAlign: "center", padding: "20px", color: "#9ca3af", fontSize: "13px" }}>Submission period is expired.</div>;
                          }

                          // Submit / Edit form
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                              <textarea
                                value={submitContent}
                                onChange={e => { setSubmitContent(e.target.value); setAiCheck(null); }}
                                placeholder="Write your answer here..."
                                style={{ ...inp, height: "140px", resize: "vertical" }}
                              />
                              <div>
                                <label style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Attach file (optional)</label>
                                <input type="file" ref={submitFileRef} onChange={e => setSubmitFile(e.target.files[0])} style={{ fontSize: "13px" }} />
                              </div>

                              {/* AI Check */}
                              <div>
                                <button onClick={checkWithAI} disabled={aiCheck?.loading} style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 18px", fontSize: "13px", fontWeight: 700, cursor: "pointer", opacity: aiCheck?.loading ? 0.7 : 1, width: "100%" }}>
                                  {aiCheck?.loading
                                    ? (lang === "en" ? "🤖 Checking..." : "🤖 စစ်ဆေးနေသည်...")
                                    : (lang === "en" ? "🤖 Check with AI before submitting" : "🤖 တင်မဆက်ခင် AI နဲ့ စစ်ဆေးပါ")}
                                </button>
                                {aiCheck?.result && (
                                  <div style={{ marginTop: "12px", borderRadius: "12px", overflow: "hidden", border: `2px solid ${aiCheck.result.isComplete ? "#22c55e" : "#f59e0b"}` }}>
                                    {/* Header */}
                                    <div style={{ background: aiCheck.result.isComplete ? "#22c55e" : "#f59e0b", padding: "10px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
                                      <span style={{ fontSize: "20px" }}>{aiCheck.result.isComplete ? "✅" : "⚠️"}</span>
                                      <div>
                                        <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>
                                          {aiCheck.result.isComplete
                                            ? (lang === "en" ? "Complete Submission" : "ပြည့်စုံသောတင်သွင်းမှု")
                                            : (lang === "en" ? "Incomplete" : "မပြည့်စုံသေးပါ")}
                                        </div>
                                        {aiCheck.result.score !== null && aiCheck.result.score !== undefined && (
                                          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.9)" }}>{lang === "en" ? "Match" : "ကိုက်ညီမှု"}: {aiCheck.result.score}%</div>
                                        )}
                                      </div>
                                    </div>
                                    {/* Missing items */}
                                    {aiCheck.result.missing?.length > 0 && (
                                      <div style={{ background: "#fff8ed", padding: "12px 16px", borderBottom: "1px solid #fde68a" }}>
                                        <div style={{ fontSize: "12px", fontWeight: 700, color: "#92400e", marginBottom: "6px" }}>{lang === "en" ? "Missing items" : "မပြည့်စုံသောအချက်များ"}</div>
                                        {aiCheck.result.missing.map((m, i) => (
                                          <div key={i} style={{ fontSize: "13px", color: "#78350f", marginBottom: "3px" }}>• {m}</div>
                                        ))}
                                      </div>
                                    )}
                                    {/* Feedback */}
                                    <div style={{ background: "#fff", padding: "12px 16px" }}>
                                      <div style={{ fontSize: "13px", color: "#374151", lineHeight: 1.7 }}>{aiCheck.result.feedback}</div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div style={{ display: "flex", gap: "10px" }}>
                                {editing && <button onClick={() => setEditing(false)} style={{ ...btnOutline, flex: 1 }}>Cancel</button>}
                                <button onClick={submitAssignment} disabled={submitting || (!submitContent.trim() && !submitFile)} style={{ ...btnPrimary, flex: 1, opacity: (submitting || (!submitContent.trim() && !submitFile)) ? 0.6 : 1 }}>
                                  {submitting ? "Submitting..." : editing ? "💾 Save Changes" : "✅ Turn In"}
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Private Comments */}
                      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px" }}>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: "#374151", marginBottom: "12px" }}>🔒 Private Comments</div>
                        {comments.length === 0 ? <p style={{ fontSize: "13px", color: "#9ca3af" }}>No comments yet.</p> : comments.map(c => (
                          <div key={c.id} style={{ background: "#f8f9fa", borderRadius: "8px", padding: "10px 14px", marginBottom: "8px" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", marginBottom: "4px" }}>{c.author_name}</div>
                            <div style={{ fontSize: "13px", color: "#374151" }}>{c.content}</div>
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                          <input placeholder="Add private comment to teacher..." value={commentInput} onChange={e => setCommentInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendComment(assignPage.id)} style={{ ...inp, flex: 1 }} />
                          <button onClick={() => sendComment(assignPage.id)} disabled={commentSending} style={{ ...btnPrimary, width: "auto", padding: "10px 16px" }}>{commentSending ? "..." : "Send"}</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                  /* Assignment table list */
                  assignments.length === 0 ? (
                    <div style={{ background: "#fff", border: "1px dashed #d1d5db", borderRadius: "10px", padding: "24px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>
                      {isTeacher ? 'Click "+ Create Assignment" to add one.' : "No assignments yet."}
                    </div>
                  ) : (
                    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
                      {/* Table header */}
                      <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 100px 80px 80px 130px", gap: "0", background: "#f8f9fa", borderBottom: "1px solid #e5e7eb", padding: "10px 16px", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        <div>No</div>
                        <div>Title</div>
                        <div style={{ textAlign: "center" }}>Status</div>
                        <div style={{ textAlign: "center" }}>Submit</div>
                        <div style={{ textAlign: "center" }}>Points</div>
                        <div style={{ textAlign: "right" }}>Due Date</div>
                      </div>
                      {(() => {
                        const visible = assignments.filter(a => isTeacher || !a.is_draft);
                        // Group by topic
                        const topics = [...new Set(visible.map(a => a.topic || ""))];
                        return topics.map(topic => (
                          <div key={topic || "__none__"}>
                            {topic && (
                              <div style={{ background: "#f0f4ff", padding: "6px 16px", fontSize: "12px", fontWeight: 700, color: "#3B37CC", borderBottom: "1px solid #e0e7ff" }}>
                                📂 {topic}
                              </div>
                            )}
                            {visible.filter(a => (a.topic || "") === topic).map((a, idx) => {
                              const sub = a.my_submission;
                              const pastDue = a.due_date && new Date() > new Date(a.due_date);
                              const inProgress = !pastDue;
                              const submitted = !!sub;
                              const isUnread = !seenAssignIds.has(a.id);
                              return (
                                <div key={a.id} onClick={() => openAssignment(a)}
                                  style={{ display: "grid", gridTemplateColumns: "32px 1fr 100px 80px 80px 150px", gap: "0", padding: "12px 16px", borderBottom: "1px solid #f3f4f6", cursor: "pointer", alignItems: "center", transition: "background 0.1s", background: isUnread ? "#fefbff" : "transparent" }}
                                  onMouseEnter={e => e.currentTarget.style.background = "#f8f9fa"}
                                  onMouseLeave={e => e.currentTarget.style.background = isUnread ? "#fefbff" : "transparent"}
                                >
                                  <div style={{ position: "relative" }}>
                                    <div style={{ fontSize: "12px", color: "#9ca3af" }}>{idx + 1}</div>
                                    {isUnread && <span style={{ position: "absolute", top: "-2px", right: "-2px", width: "7px", height: "7px", borderRadius: "50%", background: "#ef4444", display: "block" }} />}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: "13px", fontWeight: isUnread ? 700 : 600, color: "#1a1a2e", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                      {a.title}
                                      {isUnread && !a.is_draft && <span style={{ fontSize: "10px", fontWeight: 800, color: "#ef4444", background: "#fef2f2", padding: "1px 6px", borderRadius: "10px" }}>NEW</span>}
                                      {a.is_draft && <span style={{ fontSize: "10px", fontWeight: 700, color: "#92400e", background: "#fef3c7", padding: "1px 6px", borderRadius: "10px" }}>DRAFT</span>}
                                    </div>
                                    {isTeacher && <div style={{ fontSize: "11px", color: "#9ca3af" }}>{a.turned_in_count || 0} turned in</div>}
                                  </div>
                                  <div style={{ textAlign: "center" }}>
                                    <span style={{ fontSize: "11px", fontWeight: 700, color: inProgress ? "#22c55e" : "#9ca3af", background: inProgress ? "#f0fdf4" : "#f3f4f6", padding: "3px 8px", borderRadius: "20px" }}>
                                      {inProgress ? "In Progress" : "Finished"}
                                    </span>
                                  </div>
                                  <div style={{ textAlign: "center", fontSize: "18px" }}>
                                    {isTeacher
                                      ? <span style={{ fontSize: "12px", color: "#6b7280" }}>{a.turned_in_count || 0}</span>
                                      : submitted ? <span style={{ color: sub.status === "graded" ? "#22c55e" : "#3B37CC" }}>✓</span>
                                      : <span style={{ color: "#d1d5db" }}>—</span>}
                                  </div>
                                  <div style={{ textAlign: "center", fontSize: "12px", color: "#6b7280" }}>{a.points}</div>
                                  <div style={{ textAlign: "right", fontSize: "12px", color: pastDue ? "#9ca3af" : "#374151", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px", flexWrap: "wrap" }}>
                                    <span>{a.due_date ? formatDate(a.due_date) : "—"}</span>
                                    {isTeacher && (
                                      <div style={{ display: "flex", gap: "3px" }}>
                                        <button onClick={e => { e.stopPropagation(); setTopicModal({ type: "assignment", id: a.id, current: a.topic || "" }); setTopicInput(a.topic || ""); }} style={{ fontSize: "10px", padding: "2px 6px", background: "#f3f4f6", color: "#6b7280", border: "none", borderRadius: "6px", cursor: "pointer" }} title="Set topic">📂</button>
                                        <button onClick={e => { e.stopPropagation(); openSubmissionStats(a.id); }} style={{ fontSize: "10px", padding: "2px 6px", background: "#f0f4ff", color: "#3B37CC", border: "none", borderRadius: "6px", cursor: "pointer" }} title="Submission stats">📊</button>
                                        {a.is_draft && <button onClick={e => { e.stopPropagation(); publishDraft(a.id); }} style={{ fontSize: "10px", fontWeight: 700, color: "#fff", background: "#3B37CC", border: "none", padding: "2px 8px", borderRadius: "10px", cursor: "pointer" }}>Publish</button>}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ));
                      })()}
                    </div>
                  )
                  )}
                </div>}

                {/* Lessons tab */}
                {classworkTab === "lessons" && (
                <div>
                {selectedMat ? (
                  /* ── Lesson detail (full page) ── */
                  <div>
                    <button
                      onClick={() => { setSelectedMat(null); setAiModal(null); setAiResult(null); setChatHistory([]); }}
                      style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "#6b7280", fontSize: "13px", fontWeight: 600, cursor: "pointer", padding: "0 0 16px" }}
                    >
                      ← Back to Lessons
                    </button>
                    <div style={banner}>
                      <div>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>{selectedMat.title}</div>
                        <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", marginTop: "4px" }}>
                          Week {selectedMat.week || 1} · Posted {formatDate(selectedMat.created_at)}
                        </div>
                      </div>
                    </div>
                    {selectedMat.instructions && (
                      <p style={{ fontSize: "13px", color: "#374151", lineHeight: 1.6, marginBottom: "20px" }}>{selectedMat.instructions}</p>
                    )}
                    <div style={{ marginBottom: "10px", fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1px" }}>
                      Reference Materials
                    </div>
                    {selectedMat.file_url ? (() => {
                      const fileName = selectedMat.file_name || selectedMat.title;
                      const ext = (selectedMat.file_url.split(".").pop() || "").toLowerCase();
                      const kind = {
                        pdf: { icon: "📕", label: "PDF Document" },
                        docx: { icon: "📘", label: "Word Document" },
                        pptx: { icon: "📙", label: "PowerPoint" },
                        png: { icon: "🖼️", label: "Image" }, jpg: { icon: "🖼️", label: "Image" },
                        jpeg: { icon: "🖼️", label: "Image" }, webp: { icon: "🖼️", label: "Image" }, gif: { icon: "🖼️", label: "Image" },
                      }[ext] || { icon: "📄", label: "File" };
                      const openPreview = () => navigate(`/classroom/${id}/material/${selectedMat.id}`, { state: { backgroundLocation: location } });
                      return (
                        <div
                          onClick={openPreview}
                          role="button" tabIndex={0}
                          onKeyDown={e => e.key === "Enter" && openPreview()}
                          style={{ ...fileChip, maxWidth: "420px", cursor: "pointer" }}
                        >
                          <span style={{ fontSize: "18px" }}>{kind.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</div>
                            <div style={{ fontSize: "11px", color: "#9ca3af" }}>{kind.label}</div>
                          </div>
                          <span style={{ color: "#3B37CC", fontSize: "18px" }}>›</span>
                        </div>
                      );
                    })() : (
                      <p style={{ fontSize: "13px", color: "#9ca3af" }}>No file attached.</p>
                    )}
                  </div>
                ) : (
                  /* ── Lesson list ── */
                  <>
                    <div style={banner}>
                      <div>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>{classInfo.name} — Lessons</div>
                        <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", marginTop: "4px" }}>
                          {isTeacher ? "Upload and manage course materials" : "Click a material to open AI Study Mentor"}
                        </div>
                      </div>
                    </div>

                    {/* Hint: select a material to use AI */}
                    {aiHint && (
                      <div style={{ background: "#f0f4ff", border: "2px solid #3B37CC", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "20px" }}>👆</span>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "#3B37CC" }}>Select a material below</div>
                          <div style={{ fontSize: "12px", color: "#6b7280" }}>Click any material to activate AI Study Mentor</div>
                        </div>
                        <button onClick={() => setAiHint(false)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "16px" }}>×</button>
                      </div>
                    )}

                    {materials.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "64px 0", color: "#9ca3af" }}>
                        {isTeacher ? 'Click "+ New Material" to add your first material.' : "No materials posted yet."}
                      </div>
                    ) : (
                      Object.entries(weekGroups).sort((a, b) => Number(a[0]) - Number(b[0])).map(([week, mats]) => (
                        <div key={week}>
                          <div style={weekLabel}>Week {week}</div>
                          {mats.map(mat => (
                            <div
                              key={mat.id}
                              onClick={async () => {
                                setSelectedMat(mat);
                                markMatSeen(mat.id);
                                setAiResult(null); setChatHistory([]);
                                // If user came from Stream tab with a pending AI action
                                if (aiHint) {
                                  const action = aiHint;
                                  setAiHint(false);
                                  setAiModal(action);
                                  if (action !== "chat") {
                                    setAiLoading(true);
                                    try {
                                      const { data } = await API.post(`/classroom/materials/${mat.id}/ai`, { action });
                                      setAiResult(data.data);
                                    } catch {
                                      setAiResult({ error: "AI unavailable. Check GEMINI_API_KEY in backend .env" });
                                    } finally {
                                      setAiLoading(false);
                                    }
                                  }
                                }
                              }}
                              style={{ ...matRow, background: !seenMatIds.has(mat.id) ? "#fefbff" : "#fff" }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                                <div style={{ position: "relative" }}>
                                  <div style={matIcon}>
                                    <span>📄</span>
                                  </div>
                                  {!seenMatIds.has(mat.id) && <span style={{ position: "absolute", top: "-3px", right: "-3px", width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444", border: "2px solid #fff", display: "block" }} />}
                                </div>
                                <div>
                                  <div style={{ fontSize: "14px", fontWeight: !seenMatIds.has(mat.id) ? 700 : 600, color: "#1a1a2e", display: "flex", alignItems: "center", gap: "6px" }}>
                                    {mat.title}
                                    {!seenMatIds.has(mat.id) && <span style={{ fontSize: "10px", fontWeight: 800, color: "#ef4444", background: "#fef2f2", padding: "1px 6px", borderRadius: "10px" }}>NEW</span>}
                                  </div>
                                  <div style={{ fontSize: "12px", color: "#9ca3af" }}>Posted {formatDate(mat.created_at)}</div>
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                {mat.topic && <span style={{ fontSize: "11px", background: "#f0f4ff", color: "#3B37CC", padding: "2px 8px", borderRadius: "10px", fontWeight: 600 }}>📂 {mat.topic}</span>}
                                {isTeacher && (
                                  <button onClick={e => { e.stopPropagation(); setTopicModal({ type: "material", id: mat.id, current: mat.topic || "" }); setTopicInput(mat.topic || ""); }}
                                    style={{ fontSize: "11px", padding: "2px 7px", background: "#f3f4f6", color: "#6b7280", border: "none", borderRadius: "6px", cursor: "pointer" }}>
                                    📂 Topic
                                  </button>
                                )}
                                <span style={{ fontSize: "12px", color: "#9ca3af" }}>No due date</span>
                                <span style={{ color: "#9ca3af", fontSize: "12px" }}>›</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                    {isTeacher && (
                      <button onClick={() => setUploadModal(true)} style={fab}>+</button>
                    )}
                  </>
                )}
              </div>
              )}
            </div>

            {/* Right: AI Study Mentor panel — students only, lessons tab */}
            {selectedMat && !isTeacher && classworkTab === "lessons" && (
              <div style={aiMentorPanel}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
                  <div style={aiAvatarStyle}>🤖</div>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a2e" }}>AI Study Mentor</div>
                    <div style={{ fontSize: "12px", color: "#22c55e", fontWeight: 600 }}>● ACTIVE NOW</div>
                  </div>
                  <button onClick={() => setSelectedMat(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "18px" }}>×</button>
                </div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", letterSpacing: "1px", margin: "16px 0 10px", textTransform: "uppercase" }}>
                  Recommended Tools
                </div>

                {/* 4 Feature Cards */}
                {[
                  { key: "highlights", icon: "✏️", title: "Smart Highlighting", desc: "Automatically identify key formulas and concepts in today's notes." },
                  { key: "summary",    icon: "📋", title: "Auto-Summary",       desc: "Generate a 5-bullet summary of this material." },
                  { key: "quiz",       icon: "❓", title: "Practice Quiz",      desc: "3-question flash quiz based on this material." },
                  { key: "chat",       icon: "💬", title: "Level_Up Chat",      desc: "Ask questions at your own pace with AI powered answers." },
                ].map(f => (
                  <div
                    key={f.key}
                    onClick={() => openAI(f.key)}
                    style={{ ...aiFeatureCard, border: aiModal === f.key ? "2px solid #3B37CC" : "1px solid #e5e7eb", background: aiModal === f.key ? "#f0f4ff" : "#fff" }}
                  >
                    <div style={{ fontSize: "22px", marginBottom: "6px" }}>{f.icon}</div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a2e", marginBottom: "4px" }}>{f.title}</div>
                    <div style={{ fontSize: "12px", color: "#6b7280", lineHeight: 1.5 }}>{f.desc}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {/* ── GRADES TAB ── */}
          {activeTab === "grades" && (
            <div>
              {gradesLoading ? (
                <div style={{ textAlign: "center", padding: "60px", color: "#9ca3af" }}>Loading grades...</div>
              ) : !gradesData ? (
                <div style={{ textAlign: "center", padding: "60px", color: "#9ca3af" }}>No grade data yet.</div>
              ) : gradesData.role === "student" ? (
                /* ── Student Grades View ── */
                <div style={{ maxWidth: "680px" }}>
                  {/* Score summary card */}
                  <div style={{ background: "linear-gradient(135deg, #3B37CC, #6366F1)", borderRadius: "16px", padding: "28px", marginBottom: "24px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: "13px", opacity: 0.8, marginBottom: "4px" }}>Overall Grade</div>
                      <div style={{ fontSize: "48px", fontWeight: 800, lineHeight: 1 }}>
                        {gradesData.percentage !== null ? `${gradesData.percentage}%` : "—"}
                      </div>
                      <div style={{ fontSize: "13px", opacity: 0.8, marginTop: "6px" }}>
                        {gradesData.totalEarned} / {gradesData.totalPossible} points
                      </div>
                    </div>
                    <div style={{ fontSize: "64px" }}>
                      {gradesData.percentage === null ? "📋" : gradesData.percentage >= 90 ? "🏆" : gradesData.percentage >= 75 ? "⭐" : gradesData.percentage >= 60 ? "👍" : "📚"}
                    </div>
                  </div>

                  {/* Assignment rows */}
                  {gradesData.rows.length === 0 ? (
                    <p style={{ color: "#9ca3af", textAlign: "center", padding: "24px" }}>No assignments yet.</p>
                  ) : gradesData.rows.map(row => {
                    const pct = row.grade !== null ? Math.round((row.grade / row.points) * 100) : null;
                    const color = row.status === "graded" ? (pct >= 75 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444") : row.status === "turned_in" || row.status === "late" ? "#3B37CC" : "#9ca3af";
                    return (
                      <div key={row.assignment_id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px 20px", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                            {row.status === "graded" ? "✅" : row.status === "turned_in" ? "📤" : row.status === "late" ? "⏰" : "📝"}
                          </div>
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a2e" }}>{row.title}</div>
                            <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                              {row.due_date ? `Due ${formatDate(row.due_date)}` : "No due date"}
                              {row.grade_comment && ` • "${row.grade_comment}"`}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {row.grade !== null ? (
                            <>
                              <div style={{ fontSize: "18px", fontWeight: 800, color }}>{row.grade}<span style={{ fontSize: "13px", color: "#9ca3af", fontWeight: 400 }}>/{row.points}</span></div>
                              <div style={{ fontSize: "11px", color }}>{pct}%</div>
                            </>
                          ) : (
                            <span style={{ fontSize: "12px", fontWeight: 600, color, background: color + "15", padding: "4px 12px", borderRadius: "20px" }}>
                              {row.status === "assigned" ? "Pending" : row.status === "turned_in" ? "Submitted" : row.status === "late" ? "Late" : row.status}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ── Teacher Grade Book View ── */
                <div>
                  {/* Class average banner */}
                  <div style={{ background: "linear-gradient(135deg, #3B37CC, #6366F1)", borderRadius: "14px", padding: "20px 28px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "24px", color: "#fff" }}>
                    <div>
                      <div style={{ fontSize: "12px", opacity: 0.8 }}>Class Average</div>
                      <div style={{ fontSize: "36px", fontWeight: 800 }}>{gradesData.classAvg !== null ? `${gradesData.classAvg}%` : "—"}</div>
                    </div>
                    <div style={{ width: "1px", height: "48px", background: "rgba(255,255,255,0.3)" }} />
                    <div>
                      <div style={{ fontSize: "12px", opacity: 0.8 }}>Students</div>
                      <div style={{ fontSize: "28px", fontWeight: 700 }}>{gradesData.rows.length}</div>
                    </div>
                    <div style={{ width: "1px", height: "48px", background: "rgba(255,255,255,0.3)" }} />
                    <div>
                      <div style={{ fontSize: "12px", opacity: 0.8 }}>Assignments</div>
                      <div style={{ fontSize: "28px", fontWeight: 700 }}>{gradesData.assignments.length}</div>
                    </div>
                  </div>

                  {gradesData.rows.length === 0 ? (
                    <p style={{ color: "#9ca3af", textAlign: "center", padding: "32px" }}>No students enrolled yet.</p>
                  ) : (
                    <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid #e5e7eb", background: "#fff" }}>
                      <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%", minWidth: `${200 + gradesData.rows.length * 100}px` }}>
                        <thead>
                          <tr style={{ background: "#f8f9fa" }}>
                            {/* Sticky assignment column */}
                            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb", borderRight: "2px solid #e5e7eb", width: "200px", position: "sticky", left: 0, background: "#f8f9fa", zIndex: 2 }}>
                              Assignment
                            </th>
                            {gradesData.rows.map(row => (
                              <th key={row.student_id} style={{ padding: "10px 8px", textAlign: "center", fontSize: "12px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb", minWidth: "90px" }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#3B37CC", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700 }}>
                                    {row.name[0].toUpperCase()}
                                  </div>
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80px", display: "block" }}>{row.name}</span>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {gradesData.assignments.map((a, i) => (
                            <tr key={a.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                              {/* Sticky assignment name */}
                              <td style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6", borderRight: "2px solid #e5e7eb", position: "sticky", left: 0, background: i % 2 === 0 ? "#fff" : "#fafafa", zIndex: 1 }}>
                                <div style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a2e", marginBottom: "2px" }}>{a.title}</div>
                                <div style={{ fontSize: "11px", color: "#9ca3af" }}>{a.points} pts{a.due_date ? ` · Due ${new Date(a.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</div>
                              </td>
                              {gradesData.rows.map(row => {
                                const g = row.grades.find(g => g.assignment_id === a.id);
                                const pct = g?.grade !== null && g?.grade !== undefined ? Math.round((g.grade / a.points) * 100) : null;
                                const bg = !g || g.grade === null ? "transparent" : pct >= 75 ? "#f0fdf4" : pct >= 50 ? "#fefce8" : "#fef2f2";
                                const col = !g || g.grade === null ? "#d1d5db" : pct >= 75 ? "#15803d" : pct >= 50 ? "#92400e" : "#dc2626";
                                return (
                                  <td key={row.student_id} style={{ padding: "12px 8px", textAlign: "center", borderBottom: "1px solid #f3f4f6", background: bg }}>
                                    {g?.grade !== null && g?.grade !== undefined ? (
                                      <div>
                                        <div style={{ fontSize: "14px", fontWeight: 700, color: col }}>{g.grade}<span style={{ fontSize: "10px", color: col, opacity: 0.6 }}>/{a.points}</span></div>
                                        <div style={{ fontSize: "10px", color: col, opacity: 0.8 }}>{pct}%</div>
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: "15px", color: g?.status === "turned_in" || g?.status === "late" ? "#3B37CC" : "#e5e7eb" }}>
                                        {g?.status === "turned_in" ? "✓" : g?.status === "late" ? "⏰" : "—"}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                          {/* Overall row */}
                          <tr style={{ background: "#f0f4ff", borderTop: "2px solid #a5b4fc" }}>
                            <td style={{ padding: "12px 16px", borderRight: "2px solid #e5e7eb", position: "sticky", left: 0, background: "#f0f4ff", zIndex: 1 }}>
                              <span style={{ fontSize: "13px", fontWeight: 700, color: "#3B37CC" }}>Overall</span>
                            </td>
                            {gradesData.rows.map(row => (
                              <td key={row.student_id} style={{ padding: "12px 8px", textAlign: "center" }}>
                                {row.percentage !== null ? (
                                  <span style={{ fontSize: "14px", fontWeight: 800, color: row.percentage >= 75 ? "#15803d" : row.percentage >= 50 ? "#92400e" : "#dc2626" }}>
                                    {row.percentage}%
                                  </span>
                                ) : <span style={{ color: "#d1d5db" }}>—</span>}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── ATTENDANCE TAB ── */}
          {activeTab === "attendance" && (
            <div>
              {/* Meeting banner */}
              {activeMeeting ? (
                <div style={{ background: "linear-gradient(135deg,#3B37CC,#6366f1)", borderRadius: "12px", padding: "16px 20px", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "22px" }}>📹</span>
                    <div>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: "15px" }}>{activeMeeting.title}</div>
                      <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "12px" }}>{lang === "en" ? `Started by ${activeMeeting.host_name}` : `${activeMeeting.host_name} မှ စတင်`}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <a href={activeMeeting.room_url} target="_blank" rel="noopener noreferrer" style={{ background: "#fff", color: "#3B37CC", border: "none", borderRadius: "8px", padding: "8px 18px", fontWeight: 700, fontSize: "13px", cursor: "pointer", textDecoration: "none" }}>
                      {lang === "en" ? "Join Meeting" : "ဝင်မည်"}
                    </a>
                    {isTeacher && (
                      <button onClick={endMeeting} disabled={meetingLoading} style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "1px solid rgba(255,255,255,0.4)", borderRadius: "8px", padding: "8px 14px", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>
                        {lang === "en" ? "End" : "ပိတ်မည်"}
                      </button>
                    )}
                  </div>
                </div>
              ) : isTeacher && (
                <div style={{ background: "#f8f9fa", borderRadius: "12px", padding: "16px 20px", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px dashed #d1d5db" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "20px" }}>📹</span>
                    <span style={{ fontSize: "14px", color: "#6b7280" }}>{lang === "en" ? "No active meeting" : "လက်ရှိ Meeting မရှိသေးပါ"}</span>
                  </div>
                  <button onClick={startMeeting} disabled={meetingLoading} style={{ background: "#3B37CC", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 18px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                    {meetingLoading ? "..." : lang === "en" ? "▶ Start Meeting" : "▶ Meeting စတင်မည်"}
                  </button>
                </div>
              )}

              {/* Attendance section */}
              {attendanceLoading ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>Loading...</div>
              ) : isTeacher ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#1a1a2e" }}>{lang === "en" ? "Attendance Sessions" : "တက်ရောက်မှု မှတ်တမ်း"}</h3>
                    <button onClick={() => setNewSessionModal(true)} style={{ background: "#3B37CC", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                      + {lang === "en" ? "New Session" : "Session အသစ်"}
                    </button>
                  </div>

                  {/* Active session marking UI */}
                  {activeSession && (
                    <div style={{ background: "#fff", borderRadius: "12px", border: "2px solid #3B37CC", padding: "20px", marginBottom: "20px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                        <div>
                          <div style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a2e" }}>{activeSession.title}</div>
                          <div style={{ fontSize: "12px", color: "#9ca3af" }}>{new Date(activeSession.session_date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button onClick={() => setActiveSession(null)} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: "8px", padding: "8px 14px", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>
                            {lang === "en" ? "Cancel" : "မလုပ်တော့ပါ"}
                          </button>
                          <button onClick={saveAttendance} disabled={savingAttendance} style={{ background: "#3B37CC", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                            {savingAttendance ? "..." : lang === "en" ? "Save" : "သိမ်းမည်"}
                          </button>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {activeSession.records.map(r => {
                          const st = sessionRecords[r.student_id] || "absent";
                          return (
                            <div key={r.student_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "8px", background: "#f8f9fa" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "#3B37CC", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "13px" }}>
                                  {r.name[0].toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a2e" }}>{r.name}</div>
                                  <div style={{ fontSize: "11px", color: "#9ca3af" }}>{r.email}</div>
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: "6px" }}>
                                {[["present", "✓", "#16a34a", "#f0fdf4"], ["late", "⏰", "#d97706", "#fefce8"], ["absent", "✗", "#dc2626", "#fef2f2"]].map(([val, icon, col, bg]) => (
                                  <button key={val} onClick={() => setSessionRecords(prev => ({ ...prev, [r.student_id]: val }))}
                                    style={{ background: st === val ? bg : "#fff", color: st === val ? col : "#9ca3af", border: `1.5px solid ${st === val ? col : "#e5e7eb"}`, borderRadius: "6px", padding: "5px 10px", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>
                                    {icon} {lang === "en" ? val.charAt(0).toUpperCase() + val.slice(1) : val === "present" ? "တက်" : val === "late" ? "နောက်ကျ" : "မတက်"}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sessions list */}
                  {!attendanceSessions || attendanceSessions.length === 0 ? (
                    <p style={{ color: "#9ca3af", textAlign: "center", padding: "32px" }}>{lang === "en" ? "No sessions yet." : "Session မရှိသေးပါ။"}</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {attendanceSessions.map(s => (
                        <div key={s.id} style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a2e" }}>{s.title}</div>
                            <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "2px" }}>
                              {new Date(s.session_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              {s.total > 0 && <span style={{ marginLeft: "10px", color: "#16a34a" }}>✓ {s.present || 0}</span>}
                              {s.total > 0 && <span style={{ marginLeft: "6px", color: "#d97706" }}>⏰ {s.late || 0}</span>}
                              {s.total > 0 && <span style={{ marginLeft: "6px", color: "#dc2626" }}>✗ {s.absent || 0}</span>}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button onClick={() => openAttendanceSession(s.id)} style={{ background: "#f0f4ff", color: "#3B37CC", border: "none", borderRadius: "8px", padding: "7px 14px", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}>
                              {lang === "en" ? "Edit" : "ပြင်မည်"}
                            </button>
                            <button onClick={() => deleteAttendanceSession(s.id)} style={{ background: "#fff0f0", color: "#dc2626", border: "none", borderRadius: "8px", padding: "7px 14px", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}>
                              {lang === "en" ? "Delete" : "ဖျက်မည်"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Student view */
                <div>
                  {myAttendance && (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "24px" }}>
                        {[
                          { label: lang === "en" ? "Attendance Rate" : "တက်ရောက်မှုနှုန်း", value: myAttendance.rate !== null ? `${myAttendance.rate}%` : "—", color: myAttendance.rate >= 75 ? "#16a34a" : "#dc2626" },
                          { label: lang === "en" ? "Present" : "တက်ရောက်", value: myAttendance.present, color: "#16a34a" },
                          { label: lang === "en" ? "Late" : "နောက်ကျ", value: myAttendance.late, color: "#d97706" },
                          { label: lang === "en" ? "Absent" : "မတက်", value: myAttendance.absent, color: "#dc2626" },
                        ].map(stat => (
                          <div key={stat.label} style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "14px", textAlign: "center" }}>
                            <div style={{ fontSize: "22px", fontWeight: 800, color: stat.color }}>{stat.value}</div>
                            <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>{stat.label}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {myAttendance.rows.map((r, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", borderRadius: "10px", border: "1px solid #e5e7eb", padding: "12px 16px" }}>
                            <div>
                              <div style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a2e" }}>{r.title}</div>
                              <div style={{ fontSize: "11px", color: "#9ca3af" }}>{new Date(r.session_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                            </div>
                            <span style={{ fontSize: "13px", fontWeight: 700, color: r.status === "present" ? "#16a34a" : r.status === "late" ? "#d97706" : r.status === "absent" ? "#dc2626" : "#9ca3af", background: r.status === "present" ? "#f0fdf4" : r.status === "late" ? "#fefce8" : r.status === "absent" ? "#fef2f2" : "#f3f4f6", borderRadius: "6px", padding: "4px 10px" }}>
                              {r.status === "present" ? (lang === "en" ? "Present" : "တက်ရောက်") : r.status === "late" ? (lang === "en" ? "Late" : "နောက်ကျ") : r.status === "absent" ? (lang === "en" ? "Absent" : "မတက်") : "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* New Session Modal */}
              {newSessionModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
                  <div style={{ background: "#fff", borderRadius: "16px", padding: "28px", width: "400px" }}>
                    <h3 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: 700 }}>{lang === "en" ? "New Attendance Session" : "Session အသစ် ဖန်တီးမည်"}</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      <div>
                        <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "6px" }}>{lang === "en" ? "Title" : "ခေါင်းစဉ်"}</label>
                        <input value={newSessionForm.title} onChange={e => setNewSessionForm(p => ({ ...p, title: e.target.value }))} placeholder={lang === "en" ? "e.g. Week 3 Class" : "ဥပမာ Week 3 သင်ကြားချိန်"} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1.5px solid #e5e7eb", fontSize: "14px", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "6px" }}>{lang === "en" ? "Date" : "နေ့စွဲ"}</label>
                        <input type="date" value={newSessionForm.session_date} onChange={e => setNewSessionForm(p => ({ ...p, session_date: e.target.value }))} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1.5px solid #e5e7eb", fontSize: "14px", boxSizing: "border-box" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
                      <button onClick={() => setNewSessionModal(false)} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: "8px", padding: "9px 18px", fontWeight: 600, cursor: "pointer" }}>{lang === "en" ? "Cancel" : "မလုပ်တော့ပါ"}</button>
                      <button onClick={createAttendanceSession} style={{ background: "#3B37CC", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 18px", fontWeight: 700, cursor: "pointer" }}>{lang === "en" ? "Create" : "ဖန်တီးမည်"}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── RESOURCES TAB ── */}
          {activeTab === "resources" && (
            <div style={{ maxWidth: "720px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a2e", margin: "0 0 4px" }}>Resources</h2>
                  <p style={{ fontSize: "13px", color: "#9ca3af", margin: 0 }}>Links and files shared by the teacher</p>
                </div>
                {isTeacher && (
                  <button onClick={() => setResourceModal(true)} style={{ background: "#3B37CC", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                    + Add Resource
                  </button>
                )}
              </div>

              {resources.length === 0 ? (
                <div style={{ textAlign: "center", padding: "64px", color: "#9ca3af" }}>
                  <div style={{ fontSize: "48px", marginBottom: "12px" }}>📂</div>
                  <p>{isTeacher ? "Add links or files for your students." : "No resources shared yet."}</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {resources.map(r => (
                    <div key={r.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px 18px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: r.type === "file" ? "#fef3c7" : "#f0f4ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>
                        {r.type === "file" ? "📄" : "🔗"}
                      </div>
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a2e", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                        <div style={{ fontSize: "11px", color: "#9ca3af", marginBottom: "8px" }}>Added by {r.added_by_name} • {formatDate(r.created_at)}</div>
                        {r.type === "link" ? (
                          <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#3B37CC", fontWeight: 600, textDecoration: "none" }}>
                            Open Link →
                          </a>
                        ) : (
                          <a href={`http://localhost:5001${r.file_url}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#3B37CC", fontWeight: 600, textDecoration: "none" }}>
                            Download ↓
                          </a>
                        )}
                      </div>
                      {isTeacher && (
                        <button onClick={() => deleteResource(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#e5e7eb", fontSize: "16px", padding: "0", flexShrink: 0 }}
                          onMouseEnter={e => e.target.style.color = "#ef4444"}
                          onMouseLeave={e => e.target.style.color = "#e5e7eb"}
                        >×</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── PEOPLE TAB ── */}
          {activeTab === "people" && (
            <div style={{ display: "grid", gridTemplateColumns: selectedStudent ? "320px 1fr" : "1fr", gap: "20px", alignItems: "start" }}>
              {/* LEFT — member list */}
              <div>
                {/* Teacher section */}
                <div style={{ marginBottom: "20px" }}>
                  <h3 style={sectionHead}>Teachers</h3>
                  {teacher ? (
                    <div style={memberRow}>
                      <div style={{ ...memberAvatar, background: "#3B37CC" }}>{teacher.name[0].toUpperCase()}</div>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a2e" }}>{teacher.name}</div>
                        <div style={{ fontSize: "12px", color: "#9ca3af" }}>{teacher.email}</div>
                      </div>
                    </div>
                  ) : <p style={{ color: "#9ca3af", fontSize: "14px" }}>No teacher.</p>}
                </div>

                {/* Students section */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <h3 style={{ ...sectionHead, margin: 0 }}>Students ({students.length})</h3>
                  {isTeacher && (
                    <button onClick={() => setInviteModal(true)}
                      style={{ ...btnPrimary, fontSize: "12px", padding: "6px 14px" }}>
                      + Invite
                    </button>
                  )}
                </div>

                {students.length === 0 ? (
                  <p style={{ color: "#9ca3af", fontSize: "14px" }}>No students enrolled yet.</p>
                ) : students.map(s => (
                  <div key={s.id}
                    onClick={() => openStudentStats(s)}
                    style={{
                      ...memberRow, justifyContent: "space-between", cursor: "pointer",
                      background: selectedStudent?.id === s.id ? "#f0f4ff" : "#fff",
                      border: selectedStudent?.id === s.id ? "1.5px solid #3B37CC" : "1px solid #e5e7eb",
                      transition: "all 0.15s",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ ...memberAvatar, background: selectedStudent?.id === s.id ? "#3B37CC" : "#e5e7eb", color: selectedStudent?.id === s.id ? "#fff" : "#374151" }}>
                        {s.name[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a2e" }}>{s.name}</div>
                        <div style={{ fontSize: "12px", color: "#9ca3af" }}>{s.email}</div>
                      </div>
                    </div>
                    {isTeacher && (
                      <button onClick={e => { e.stopPropagation(); handleRemoveMember(s.id, s.name); }}
                        style={{ fontSize: "11px", color: "#ef4444", background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: "8px", padding: "3px 8px", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* RIGHT — student detail panel */}
              {selectedStudent && (
                <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e5e7eb", padding: "20px", position: "sticky", top: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "#3B37CC", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 700 }}>
                        {selectedStudent.name[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a2e" }}>{selectedStudent.name}</div>
                        <div style={{ fontSize: "12px", color: "#9ca3af" }}>{selectedStudent.email}</div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedStudent(null)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#9ca3af" }}>×</button>
                  </div>

                  {studentStatsLoading ? (
                    <div style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>Loading...</div>
                  ) : studentStats ? (
                    <>
                      {/* Stats row - Assignment */}
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Assignments</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "16px" }}>
                        {[
                          { label: lang === "en" ? "Submission" : "တင်သွင်းမှု", value: `${studentStats.stats.submissionRate}%`, color: studentStats.stats.submissionRate >= 80 ? "#22c55e" : studentStats.stats.submissionRate >= 50 ? "#f59e0b" : "#ef4444" },
                          { label: lang === "en" ? "Submitted" : "တင်ပြီး", value: `${studentStats.stats.submittedCount}/${studentStats.stats.totalAssignments}`, color: "#3B37CC" },
                          { label: lang === "en" ? "Avg Grade" : "ပျမ်းမျှ", value: studentStats.stats.avgGrade !== null ? `${studentStats.stats.avgGrade}%` : "—", color: "#6b7280" },
                        ].map(stat => (
                          <div key={stat.label} style={{ background: "#f9fafb", borderRadius: "10px", padding: "10px", textAlign: "center" }}>
                            <div style={{ fontSize: "18px", fontWeight: 800, color: stat.color }}>{stat.value}</div>
                            <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>{stat.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Stats row - Attendance */}
                      {studentStats.stats.totalSessions > 0 && (
                        <>
                          <div style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                            {lang === "en" ? "Attendance" : "တက်ရောက်မှု"}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px", marginBottom: "16px" }}>
                            {[
                              { label: lang === "en" ? "Rate" : "နှုန်း", value: `${studentStats.stats.attendanceRate}%`, color: studentStats.stats.attendanceRate >= 80 ? "#22c55e" : studentStats.stats.attendanceRate >= 60 ? "#f59e0b" : "#ef4444" },
                              { label: lang === "en" ? "Present" : "တက်", value: studentStats.stats.presentCount, color: "#22c55e" },
                              { label: lang === "en" ? "Late" : "နောက်ကျ", value: studentStats.stats.lateCount, color: "#f59e0b" },
                              { label: lang === "en" ? "Absent" : "မတက်", value: studentStats.stats.absentCount, color: "#ef4444" },
                            ].map(stat => (
                              <div key={stat.label} style={{ background: "#f9fafb", borderRadius: "10px", padding: "8px", textAlign: "center" }}>
                                <div style={{ fontSize: "16px", fontWeight: 800, color: stat.color }}>{stat.value}</div>
                                <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "2px" }}>{stat.label}</div>
                              </div>
                            ))}
                          </div>
                          {/* Attendance history mini list */}
                          <div style={{ maxHeight: "120px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px", marginBottom: "16px" }}>
                            {studentStats.attendance.map((r, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 10px", background: "#f9fafb", borderRadius: "6px" }}>
                                <div style={{ fontSize: "12px", color: "#374151" }}>
                                  <span style={{ fontWeight: 600 }}>{r.title}</span>
                                  <span style={{ color: "#9ca3af", marginLeft: "8px" }}>{new Date(r.session_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                </div>
                                <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "10px",
                                  background: r.status === "present" ? "#f0fdf4" : r.status === "late" ? "#fefce8" : "#fef2f2",
                                  color: r.status === "present" ? "#16a34a" : r.status === "late" ? "#d97706" : "#dc2626"
                                }}>
                                  {r.status === "present" ? (lang === "en" ? "Present" : "တက်") : r.status === "late" ? (lang === "en" ? "Late" : "နောက်ကျ") : (lang === "en" ? "Absent" : "မတက်")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Assignment list */}
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                        {lang === "en" ? "Assignment Detail" : "အိမ်စာ အသေးစိတ်"}
                      </div>
                      <div style={{ maxHeight: "340px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {studentStats.assignments.map(a => (
                          <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                            <div>
                              <div style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a2e" }}>{a.title}</div>
                              {a.submission?.grade !== null && a.submission?.grade !== undefined && (
                                <div style={{ fontSize: "11px", color: "#3B37CC", marginTop: "2px" }}>
                                  {a.submission.grade}/{a.points} pts ({Math.round((a.submission.grade/a.points)*100)}%)
                                </div>
                              )}
                            </div>
                            <span style={{
                              fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "20px", flexShrink: 0,
                              background: a.status === "missing" ? "#fef2f2" : a.status === "graded" ? "#f0f4ff" : "#f0fdf4",
                              color: a.status === "missing" ? "#ef4444" : a.status === "graded" ? "#3B37CC" : "#22c55e",
                            }}>
                              {a.status === "missing" ? "Missing" : a.status === "graded" ? "Graded" : "Submitted"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Invite Student Modal */}
      {inviteModal && (
        <div style={overlayStyle} onClick={() => { setInviteModal(false); setInviteMsg(null); setInviteEmail(""); }}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, width: "420px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>✉️ Invite Student</h3>
              <button onClick={() => { setInviteModal(false); setInviteMsg(null); setInviteEmail(""); }} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>
            <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "14px" }}>
              {lang === "en" ? "Enter the student's email — they must have an account" : "ကျောင်းသားရဲ့ email ထည့်ပါ — အကောင့်ရှိပါမှ ထည့်နိုင်မည်"}
            </div>
            <input
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleInvite()}
              placeholder="student@email.com"
              type="email"
              style={{ ...inp, width: "100%", marginBottom: "12px" }}
              autoFocus
            />
            {inviteMsg && (
              <div style={{ fontSize: "13px", color: inviteMsg.ok ? "#22c55e" : "#ef4444", marginBottom: "12px", fontWeight: 600 }}>
                {inviteMsg.text}
              </div>
            )}
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => { setInviteModal(false); setInviteMsg(null); setInviteEmail(""); }} style={{ ...btnOutline, flex: 1 }}>Cancel</button>
              <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} style={{ ...btnPrimary, flex: 1 }}>
                {inviting ? "Inviting..." : "Invite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {editAssignModal && selectedAssign && (
        <div style={{ ...overlayStyle, zIndex: 1100 }} onClick={() => setEditAssignModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, width: "540px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a2e", margin: "0 0 20px" }}>✏️ Edit Assignment</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={lbl}>Title *</label>
                <input value={editAssignForm.title}
                  onChange={e => setEditAssignForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Assignment title"
                  style={inp} autoFocus />
              </div>
              <div>
                <label style={lbl}>Instructions</label>
                <textarea value={editAssignForm.instructions}
                  onChange={e => setEditAssignForm(f => ({ ...f, instructions: e.target.value }))}
                  placeholder="What should students do?"
                  style={{ ...inp, height: "100px", resize: "none" }} />
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Due Date</label>
                  <input type="datetime-local" value={editAssignForm.due_date}
                    onChange={e => setEditAssignForm(f => ({ ...f, due_date: e.target.value }))}
                    style={inp} />
                </div>
                <div style={{ width: "110px" }}>
                  <label style={lbl}>Points</label>
                  <input type="number" min="0" max="1000" value={editAssignForm.points}
                    onChange={e => setEditAssignForm(f => ({ ...f, points: e.target.value }))}
                    style={inp} />
                </div>
              </div>
              {/* Existing files */}
              {selectedAssign?.files?.length > 0 && (
                <div>
                  <label style={lbl}>Current Attachments</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {selectedAssign.files.map(f => (
                      <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", color: editDeleteFileIds.includes(f.id) ? "#9ca3af" : "#374151", background: editDeleteFileIds.includes(f.id) ? "#fef2f2" : "#f9fafb", padding: "4px 10px", borderRadius: "6px", border: `1px solid ${editDeleteFileIds.includes(f.id) ? "#fca5a5" : "#e5e7eb"}`, textDecoration: editDeleteFileIds.includes(f.id) ? "line-through" : "none" }}>
                        <span>📄 {f.file_name}</span>
                        <button onClick={() => setEditDeleteFileIds(prev => prev.includes(f.id) ? prev.filter(x => x !== f.id) : [...prev, f.id])}
                          style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "12px", color: editDeleteFileIds.includes(f.id) ? "#22c55e" : "#ef4444" }}>
                          {editDeleteFileIds.includes(f.id) ? "↩ Restore" : "× Remove"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* New file attachments */}
              <div>
                <label style={lbl}>Add New Attachments</label>
                <div style={{ border: "1.5px dashed #d1d5db", borderRadius: "10px", padding: "10px", background: "#fafafa" }}>
                  <input ref={editAssignFileRef} type="file" multiple style={{ display: "none" }}
                    onChange={e => setEditAssignFiles(prev => [...prev, ...Array.from(e.target.files)])} />
                  <button type="button" onClick={() => editAssignFileRef.current?.click()}
                    style={{ fontSize: "13px", color: "#3B37CC", background: "#f0f4ff", border: "1px solid #a5b4fc", borderRadius: "8px", padding: "6px 14px", cursor: "pointer", fontWeight: 600 }}>
                    📎 Add files
                  </button>
                  {editAssignFiles.length > 0 && (
                    <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                      {editAssignFiles.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", color: "#374151", background: "#fff", padding: "4px 10px", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
                          <span>📄 {f.name}</span>
                          <button onClick={() => setEditAssignFiles(prev => prev.filter((_, j) => j !== i))}
                            style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontWeight: 700, fontSize: "14px" }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {editAssignError && <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "10px" }}>{editAssignError}</p>}
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button onClick={() => { setEditAssignModal(false); setEditAssignFiles([]); setEditDeleteFileIds([]); }} style={{ ...btnOutline, flex: 1 }}>Cancel</button>
              <button onClick={() => handleUpdateAssignment(true)}
                disabled={editAssignSaving || !editAssignForm.title.trim()}
                style={{ ...btnOutline, flex: 1, color: "#6b7280", opacity: (!editAssignForm.title.trim() || editAssignSaving) ? 0.6 : 1 }}>
                📄 Save as Draft
              </button>
              <button onClick={() => handleUpdateAssignment(false)}
                disabled={editAssignSaving || !editAssignForm.title.trim()}
                style={{ ...btnPrimary, flex: 1, opacity: (!editAssignForm.title.trim() || editAssignSaving) ? 0.6 : 1 }}>
                {editAssignSaving ? "Saving..." : "💾 Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Post Modal */}
      {editingPost && (
        <div style={overlayStyle} onClick={() => setEditingPost(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, width: "480px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>✏️ Edit Announcement</h3>
              <button onClick={() => setEditingPost(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>
            <textarea value={editingPost.content} onChange={e => setEditingPost(p => ({ ...p, content: e.target.value }))}
              style={{ ...inp, width: "100%", height: "120px", resize: "none", marginBottom: "14px" }} />
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setEditingPost(null)} style={btnOutline}>Cancel</button>
              <button onClick={handleEditPost} style={btnPrimary}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Submission Stats Modal */}
      {submissionStats && (
        <div style={overlayStyle} onClick={() => setSubmissionStats(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, width: "520px", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>📊 Submission Status</h3>
              <button onClick={() => setSubmissionStats(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>
            {submissionStats.loading ? (
              <div style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>Loading...</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                  {[
                    { label: "Submitted", count: submissionStats.students?.filter(s => s.status !== "missing").length || 0, color: "#22c55e", bg: "#f0fdf4" },
                    { label: "Missing", count: submissionStats.students?.filter(s => s.status === "missing").length || 0, color: "#ef4444", bg: "#fef2f2" },
                    { label: "Graded", count: submissionStats.students?.filter(s => s.status === "graded").length || 0, color: "#3B37CC", bg: "#f0f4ff" },
                  ].map(stat => (
                    <div key={stat.label} style={{ flex: 1, background: stat.bg, borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                      <div style={{ fontSize: "24px", fontWeight: 800, color: stat.color }}>{stat.count}</div>
                      <div style={{ fontSize: "12px", color: stat.color, fontWeight: 600 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
                  {submissionStats.students?.map(s => (
                    <div key={s.student.id}>
                      <div
                        onClick={() => s.submission && setSelectedSubmission(selectedSubmission?.id === s.submission?.id ? null : s)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "10px 16px", borderBottom: "1px solid #f3f4f6",
                          cursor: s.submission ? "pointer" : "default",
                          background: selectedSubmission?.student?.id === s.student.id ? "#f0f4ff" : "transparent",
                        }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: "#374151" }}>
                            {s.student.name[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: "14px", color: "#1a1a2e", fontWeight: 500 }}>{s.student.name}</div>
                            {s.submission && <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                              {new Date(s.submission.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </div>}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          {s.submission?.grade !== null && s.submission?.grade !== undefined && (
                            <span style={{ fontSize: "13px", fontWeight: 700, color: "#3B37CC" }}>{s.submission.grade}/{submissionStats.assignment?.points} pts</span>
                          )}
                          <span style={{
                            fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px",
                            background: s.status === "missing" ? "#fef2f2" : s.status === "graded" ? "#f0f4ff" : "#f0fdf4",
                            color: s.status === "missing" ? "#ef4444" : s.status === "graded" ? "#3B37CC" : "#22c55e",
                          }}>
                            {s.status === "missing" ? "Missing" : s.status === "graded" ? "Graded" : "Submitted"}
                          </span>
                          {s.submission && <span style={{ fontSize: "14px", color: "#9ca3af" }}>{selectedSubmission?.student?.id === s.student.id ? "▲" : "▼"}</span>}
                        </div>
                      </div>

                      {/* Expanded submission detail */}
                      {selectedSubmission?.student?.id === s.student.id && s.submission && (
                        <div style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", padding: "14px 20px" }}>
                          {/* Text content */}
                          {s.submission.content && (
                            <div style={{ fontSize: "13px", color: "#374151", marginBottom: "10px", lineHeight: 1.6, background: "#fff", borderRadius: "8px", padding: "10px 12px", border: "1px solid #e5e7eb" }}>
                              {s.submission.content}
                            </div>
                          )}
                          {/* File */}
                          {s.submission.file_path && (
                            <a href={`http://localhost:5001/uploads/${s.submission.file_path}`} target="_blank" rel="noreferrer"
                              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#3B37CC", fontWeight: 600, marginBottom: "12px", background: "#f0f4ff", padding: "6px 12px", borderRadius: "8px", textDecoration: "none" }}>
                              📎 View attached file
                            </a>
                          )}

                          {/* Grade input */}
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                            <input
                              type="number" min="0" max={submissionStats.assignment?.points || 100}
                              placeholder="Grade"
                              value={gradeInputs[s.submission.id] ?? (s.submission.grade ?? "")}
                              onChange={e => setGradeInputs(g => ({ ...g, [s.submission.id]: e.target.value }))}
                              style={{ ...inp, width: "80px" }}
                            />
                            <span style={{ fontSize: "13px", color: "#6b7280" }}>/ {submissionStats.assignment?.points || 100} pts</span>
                            <button
                              disabled={grading[s.submission.id]}
                              onClick={async () => {
                                const grade = parseInt(gradeInputs[s.submission.id]);
                                if (isNaN(grade)) return;
                                setGrading(g => ({ ...g, [s.submission.id]: true }));
                                try {
                                  await API.post(`/classroom/submissions/${s.submission.id}/grade`, { grade });
                                  setSubmissionStats(prev => ({
                                    ...prev,
                                    students: prev.students.map(st =>
                                      st.student.id === s.student.id
                                        ? { ...st, submission: { ...st.submission, grade }, status: "graded" }
                                        : st
                                    ),
                                  }));
                                } catch (err) { console.error(err); }
                                finally { setGrading(g => ({ ...g, [s.submission.id]: false })); }
                              }}
                              style={{ ...btnPrimary, fontSize: "12px", padding: "6px 14px" }}>
                              {grading[s.submission.id] ? "..." : "Grade"}
                            </button>
                          </div>

                          {/* Private comments inline */}
                          <SubmissionComments
                            assignId={submissionStats.assignment?.id}
                            studentId={s.student.id}
                            studentName={s.student.name}
                            myName={myName}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Topic Modal */}
      {topicModal && (
        <div style={overlayStyle} onClick={() => setTopicModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, width: "380px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a2e", marginBottom: "14px" }}>📂 Set Topic</h3>
            <input value={topicInput} onChange={e => setTopicInput(e.target.value)}
              placeholder="e.g. Chapter 1, Week 2, HTML Basics..."
              style={{ ...inp, width: "100%", marginBottom: "14px" }} autoFocus
              onKeyDown={e => e.key === "Enter" && saveTopic()} />
            <div style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "14px" }}>{lang === "en" ? "Leave blank and Save to remove the topic" : "Topic ကို ဖယ်ရှားဖို့ blank ထားပြီး Save နှိပ်ပါ"}</div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setTopicModal(null)} style={{ ...btnOutline, flex: 1 }}>Cancel</button>
              <button onClick={saveTopic} style={{ ...btnPrimary, flex: 1 }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* AI Result Modal */}
      {aiModal && aiModal !== "chat" && (
        <div style={overlayStyle} onClick={() => setAiModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, width: "540px", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>
                {aiModal === "highlights" ? "✏️ Smart Highlighting" : aiModal === "summary" ? "📋 Auto-Summary" : "❓ Practice Quiz"}
              </h2>
              <button onClick={() => setAiModal(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>

            {aiLoading ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>🤖</div>
                <p>AI is analyzing the material...</p>
              </div>
            ) : aiResult?.error ? (
              <div style={{ background: "#fef2f2", borderRadius: "8px", padding: "16px", color: "#dc2626", fontSize: "14px" }}>
                ⚠️ {aiResult.error}
              </div>
            ) : aiModal === "highlights" && Array.isArray(aiResult) ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {aiResult.map((item, i) => (
                  <div key={i} style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: "10px", padding: "12px 16px" }}>
                    <div style={{ fontWeight: 700, color: "#92400e", fontSize: "14px", marginBottom: "4px" }}>
                      🔑 {item.term}
                    </div>
                    <div style={{ fontSize: "13px", color: "#374151", lineHeight: 1.6 }}>{item.explanation}</div>
                  </div>
                ))}
              </div>
            ) : aiModal === "summary" && Array.isArray(aiResult) ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {aiResult.map((point, i) => (
                  <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                    <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#3B37CC", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, flexShrink: 0, marginTop: "2px" }}>
                      {i + 1}
                    </div>
                    <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.6, margin: 0 }}>{point}</p>
                  </div>
                ))}
              </div>
            ) : aiModal === "quiz" && Array.isArray(aiResult) ? (
              <QuizView questions={aiResult} />
            ) : null}
          </div>
        </div>
      )}

      {/* Level_Up Chat Modal */}
      {aiModal === "chat" && (
        <div style={overlayStyle} onClick={() => setAiModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, width: "520px", display: "flex", flexDirection: "column", height: levelUpLevel ? "600px" : "auto" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>⚡</div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e" }}>Level Up Chat</div>
                {levelUpLevel && <div style={{ fontSize: "11px", color: "#22c55e", fontWeight: 600 }}>
                  ● {levelUpLevel === "beginner"
                    ? (lang === "en" ? "🌱 Beginner" : "🌱 စတင်သင်")
                    : levelUpLevel === "intermediate"
                    ? (lang === "en" ? "📘 Intermediate" : "📘 တစ်ဝက်နားလည်")
                    : (lang === "en" ? "🔥 Advanced" : "🔥 နားလည်ပြီး")} mode
                </div>}
              </div>
              <button onClick={() => { setAiModal(null); setLevelUpLevel(null); }} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>

            {/* Level selector screen */}
            {!levelUpLevel ? (
              <div>
                <div style={{ textAlign: "center", marginBottom: "20px" }}>
                  <div style={{ fontSize: "32px", marginBottom: "10px" }}>🎯</div>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a2e", marginBottom: "6px" }}>
                    {lang === "en" ? "How well do you know this material?" : "ဒီသင်ခန်းစာနဲ့ ပတ်သက်ပြီး ဘယ်လောက်နားလည်သလဲ?"}
                  </div>
                  <div style={{ fontSize: "13px", color: "#6b7280" }}><strong>{selectedMat?.title}</strong></div>
                </div>
                {[
                  { key: "beginner", icon: "🌱",
                    label: lang === "en" ? "Just starting out" : "စတင်သင်",
                    desc: lang === "en" ? "New to this material — need basic explanations" : "ဒီသင်ခန်းစာနဲ့ ပထမဆုံးတွေ့ဆုံနေသည်၊ အခြေခံ ရှင်းပြချက်လိုသည်",
                    color: "#22c55e", bg: "#f0fdf4", border: "#86efac" },
                  { key: "intermediate", icon: "📘",
                    label: lang === "en" ? "Know the basics" : "တစ်ဝက်နားလည်",
                    desc: lang === "en" ? "I know some parts but still have gaps" : "အခြေခံသိသော်လည်း အချို့နေရာများ မရှင်းသေးပါ",
                    color: "#3B37CC", bg: "#f0f4ff", border: "#a5b4fc" },
                  { key: "advanced", icon: "🔥",
                    label: lang === "en" ? "Ready to be challenged" : "နားလည်ပြီး စစ်ချင်",
                    desc: lang === "en" ? "I know it well — give me hard questions" : "ကောင်းစွာသိပြီး ခက်ခဲသောမေးခွန်းများ ဖြေချင်သည်",
                    color: "#dc2626", bg: "#fff7ed", border: "#fca5a5" },
                ].map(l => (
                  <div key={l.key} onClick={() => startLevelUpChat(l.key)}
                    style={{ background: l.bg, border: `2px solid ${l.border}`, borderRadius: "12px", padding: "16px 18px", marginBottom: "10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "14px", transition: "transform 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                    onMouseLeave={e => e.currentTarget.style.transform = "none"}
                  >
                    <div style={{ fontSize: "28px", flexShrink: 0 }}>{l.icon}</div>
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: l.color }}>{l.label}</div>
                      <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>{l.desc}</div>
                    </div>
                    <div style={{ marginLeft: "auto", color: l.color, fontSize: "18px" }}>›</div>
                  </div>
                ))}
                {chatSending && <div style={{ textAlign: "center", color: "#9ca3af", fontSize: "13px", padding: "10px" }}>
                  {lang === "en" ? "AI is preparing..." : "AI ပြင်ဆင်နေသည်..."}
                </div>}
              </div>
            ) : (
            <>
            {/* Chat messages */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", padding: "4px 0", marginBottom: "12px" }}>
              {chatHistory.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "82%", padding: "10px 14px", borderRadius: "14px", fontSize: "14px", lineHeight: 1.5,
                    background: msg.role === "user" ? "#3B37CC" : "#f3f4f6",
                    color: msg.role === "user" ? "#fff" : "#374151",
                    borderBottomRightRadius: msg.role === "user" ? "4px" : "14px",
                    borderBottomLeftRadius: msg.role === "assistant" ? "4px" : "14px",
                  }}>
                    <span dangerouslySetInnerHTML={{ __html: msg.content
                      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                      .replace(/\n/g, "<br/>") }} />
                  </div>
                </div>
              ))}
              {chatSending && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ background: "#f3f4f6", padding: "10px 14px", borderRadius: "14px", fontSize: "14px", color: "#9ca3af" }}>
                    ⚡ {lang === "en" ? "AI is thinking..." : "AI တွေးဆနေသည်..."}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Level badge + change level */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                {levelUpLevel === "beginner"
                  ? (lang === "en" ? "🌱 Beginner mode" : "🌱 စတင်သင် mode")
                  : levelUpLevel === "intermediate"
                  ? (lang === "en" ? "📘 Intermediate mode" : "📘 တစ်ဝက်နားလည် mode")
                  : (lang === "en" ? "🔥 Advanced mode" : "🔥 နားလည်ပြီး mode")}
              </span>
              <button onClick={() => { setLevelUpLevel(null); setChatHistory([]); }} style={{ background: "none", border: "none", fontSize: "11px", color: "#3B37CC", cursor: "pointer", fontWeight: 700 }}>
                {lang === "en" ? "Change level" : "Level ပြောင်း"}
              </button>
            </div>

            {/* Chat input */}
            <div style={{ display: "flex", gap: "10px", borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder={lang === "en" ? "Type your answer..." : "မေးခွန်းထည့်ပါ..."}
                style={{ ...inp, flex: 1, borderRadius: "20px" }}
                autoFocus
              />
              <button onClick={sendChat} disabled={chatSending || !chatInput.trim()} style={{ ...btnPrimary, width: "44px", height: "44px", borderRadius: "50%", padding: 0, fontSize: "18px", flexShrink: 0 }}>
                →
              </button>
            </div>
            </>
            )}
          </div>
        </div>
      )}

      {/* Add Resource Modal */}
      {resourceModal && (
        <div style={overlayStyle} onClick={() => setResourceModal(false)}>
          <div onClick={e => e.stopPropagation()} style={modalStyle}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a2e", margin: "0 0 20px" }}>📂 Add Resource</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={lbl}>Title *</label>
                <input value={resourceForm.title} onChange={e => setResourceForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Week 1 Reference" style={inp} autoFocus />
              </div>
              <div>
                <label style={lbl}>Link URL</label>
                <input value={resourceForm.url} onChange={e => setResourceForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." style={inp} disabled={!!resourceFile} />
              </div>
              <div style={{ textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>— or —</div>
              <div>
                <label style={lbl}>Upload File</label>
                <input type="file" ref={resourceFileRef} onChange={e => setResourceFile(e.target.files[0])} style={{ fontSize: "13px" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button onClick={() => { setResourceModal(false); setResourceFile(null); }} style={{ ...btnOutline, flex: 1 }}>Cancel</button>
              <button onClick={addResource} disabled={resourceAdding || !resourceForm.title.trim()} style={{ ...btnPrimary, flex: 1, opacity: (!resourceForm.title.trim() || resourceAdding) ? 0.6 : 1 }}>
                {resourceAdding ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Assignment Modal */}
      {assignModal && (
        <div style={overlayStyle} onClick={() => setAssignModal(false)}>
          <div onClick={e => e.stopPropagation()} style={modalStyle}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a2e", margin: "0 0 20px" }}>📝 Create Assignment</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={lbl}>Title *</label>
                <input value={assignForm.title} onChange={e => setAssignForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Week 1 Exercise" style={inp} autoFocus />
              </div>
              <div>
                <label style={lbl}>Instructions</label>
                <textarea value={assignForm.instructions} onChange={e => setAssignForm(f => ({ ...f, instructions: e.target.value }))} placeholder="What should students do?" style={{ ...inp, height: "80px", resize: "none" }} />
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Due Date</label>
                  <input type="datetime-local" value={assignForm.due_date} onChange={e => setAssignForm(f => ({ ...f, due_date: e.target.value }))} style={inp} />
                </div>
                <div style={{ width: "100px" }}>
                  <label style={lbl}>Points</label>
                  <input type="number" min="0" max="1000" value={assignForm.points} onChange={e => setAssignForm(f => ({ ...f, points: e.target.value }))} style={inp} />
                </div>
              </div>
              {/* File attachments */}
              <div>
                <label style={lbl}>Attachments (optional)</label>
                <div style={{ border: "1.5px dashed #d1d5db", borderRadius: "10px", padding: "12px", background: "#fafafa" }}>
                  <input ref={assignFileRef} type="file" multiple style={{ display: "none" }}
                    onChange={e => setAssignFiles(prev => [...prev, ...Array.from(e.target.files)])} />
                  <button type="button" onClick={() => assignFileRef.current?.click()}
                    style={{ fontSize: "13px", color: "#3B37CC", background: "#f0f4ff", border: "1px solid #a5b4fc", borderRadius: "8px", padding: "6px 14px", cursor: "pointer", fontWeight: 600 }}>
                    📎 Add files
                  </button>
                  {assignFiles.length > 0 && (
                    <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                      {assignFiles.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", color: "#374151", background: "#fff", padding: "4px 10px", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
                          <span>📄 {f.name}</span>
                          <button onClick={() => setAssignFiles(prev => prev.filter((_, j) => j !== i))}
                            style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontWeight: 700, fontSize: "14px" }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {assignError && <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "10px" }}>{assignError}</p>}
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button onClick={() => { setAssignModal(false); setAssignFiles([]); }} style={{ ...btnOutline, flex: 1 }}>Cancel</button>
              <button onClick={() => createAssignment(true)} disabled={assignCreating || !assignForm.title.trim()} style={{ ...btnOutline, flex: 1, opacity: (!assignForm.title.trim() || assignCreating) ? 0.6 : 1, color: "#6b7280" }}>
                📄 Save Draft
              </button>
              <button onClick={() => createAssignment(false)} disabled={assignCreating || !assignForm.title.trim()} style={{ ...btnPrimary, flex: 1, opacity: (!assignForm.title.trim() || assignCreating) ? 0.6 : 1 }}>
                {assignCreating ? "..." : "📢 Post"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Detail Modal */}
      {/* Teacher Assignment Full-Page View */}
      {selectedAssign && isTeacher && (
        <div style={{ position: "fixed", inset: 0, background: "#f5f6fa", zIndex: 900, overflowY: "auto" }}>
          {/* Top bar */}
          <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "14px 28px", display: "flex", alignItems: "center", gap: "14px", position: "sticky", top: 0, zIndex: 10 }}>
            <button onClick={() => { setSelectedAssign(null); setAssignDetail(null); setSelectedSubmissionStudent(null); }}
              style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#6b7280", lineHeight: 1 }}>←</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "17px", fontWeight: 700, color: "#1a1a2e" }}>📝 {selectedAssign.title}</div>
              <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                {selectedAssign.due_date ? `Due: ${formatDate(selectedAssign.due_date)}` : "No due date"} • {selectedAssign.points} pts
              </div>
            </div>
            <button onClick={() => openEditAssign(selectedAssign)}
              style={{ fontSize: "13px", fontWeight: 600, color: "#3B37CC", background: "#f0f4ff", border: "1px solid #a5b4fc", borderRadius: "8px", padding: "7px 16px", cursor: "pointer" }}>
              ✏️ Edit
            </button>
          </div>

          {/* Body */}
          <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 0, minHeight: "calc(100vh - 64px)" }}>
            {/* LEFT — student list */}
            <div style={{ background: "#fff", borderRight: "1px solid #e5e7eb", padding: "16px" }}>
              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "16px" }}>
                {[
                  { label: "Submitted", count: assignDetail?.submissions?.length || 0, color: "#22c55e", bg: "#f0fdf4" },
                  { label: "Missing", count: Math.max(0, (students?.length || 0) - (assignDetail?.submissions?.length || 0)), color: "#ef4444", bg: "#fef2f2" },
                  { label: "Graded", count: assignDetail?.submissions?.filter(s => s.status === "graded" || s.status === "returned").length || 0, color: "#3B37CC", bg: "#f0f4ff" },
                ].map(stat => (
                  <div key={stat.label} style={{ background: stat.bg, borderRadius: "10px", padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: stat.color }}>{stat.count}</div>
                    <div style={{ fontSize: "10px", color: "#6b7280", marginTop: "2px" }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: "12px", fontWeight: 700, color: "#9ca3af", marginBottom: "10px", letterSpacing: "0.05em" }}>STUDENTS</div>

              {!assignDetail ? (
                <div style={{ color: "#9ca3af", fontSize: "13px", textAlign: "center", padding: "32px" }}>Loading...</div>
              ) : students.map(st => {
                const sub = assignDetail.submissions?.find(s => s.student_id === st.id);
                const isSelected = selectedSubmissionStudent?.id === st.id;
                return (
                  <div key={st.id} onClick={() => setSelectedSubmissionStudent({ ...st, submission: sub || null })}
                    style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", cursor: "pointer", marginBottom: "4px", background: isSelected ? "#f0f4ff" : "transparent", border: isSelected ? "1.5px solid #3B37CC" : "1.5px solid transparent", transition: "all 0.12s" }}>
                    <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: isSelected ? "#3B37CC" : "#e5e7eb", color: isSelected ? "#fff" : "#374151", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, flexShrink: 0 }}>
                      {st.name[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a2e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{st.name}</div>
                      {sub ? (
                        <div style={{ fontSize: "11px", color: "#6b7280" }}>{formatDate(sub.submitted_at)}</div>
                      ) : (
                        <div style={{ fontSize: "11px", color: "#ef4444" }}>Missing</div>
                      )}
                    </div>
                    <span style={{
                      fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", flexShrink: 0,
                      background: !sub ? "#fef2f2" : (sub.status === "graded" || sub.status === "returned") ? "#f0f4ff" : "#f0fdf4",
                      color: !sub ? "#ef4444" : (sub.status === "graded" || sub.status === "returned") ? "#3B37CC" : "#22c55e",
                    }}>
                      {!sub ? "Missing" : (sub.status === "graded" || sub.status === "returned") ? `${sub.grade}/${selectedAssign.points}` : "Submitted"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* RIGHT — submission detail */}
            <div style={{ padding: "24px 32px", overflowY: "auto" }}>
              {!selectedSubmissionStudent ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af", gap: "12px" }}>
                  <div style={{ fontSize: "48px" }}>👈</div>
                  <div style={{ fontSize: "14px" }}>Select a student to view their submission</div>
                </div>
              ) : !selectedSubmissionStudent.submission ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af", gap: "12px" }}>
                  <div style={{ fontSize: "48px" }}>📭</div>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "#374151" }}>{selectedSubmissionStudent.name}</div>
                  <div style={{ fontSize: "13px" }}>No submission yet</div>
                </div>
              ) : (() => {
                const sub = selectedSubmissionStudent.submission;
                return (
                  <div>
                    {/* Student header */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                      <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "#3B37CC", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 700 }}>
                        {selectedSubmissionStudent.name[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e" }}>{selectedSubmissionStudent.name}</div>
                        <div style={{ fontSize: "12px", color: "#9ca3af" }}>Submitted {formatDate(sub.submitted_at)}{sub.status === "late" ? " (Late)" : ""}</div>
                      </div>
                      <span style={{ marginLeft: "auto", fontSize: "11px", fontWeight: 700, padding: "4px 12px", borderRadius: "20px",
                        background: (sub.status === "graded" || sub.status === "returned") ? "#f0f4ff" : "#f0fdf4",
                        color: (sub.status === "graded" || sub.status === "returned") ? "#3B37CC" : "#22c55e" }}>
                        {(sub.status === "graded" || sub.status === "returned") ? `Graded: ${sub.grade}/${selectedAssign.points}` : "Submitted"}
                      </span>
                    </div>

                    {/* Submission content */}
                    {sub.content && (
                      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", marginBottom: "16px", fontSize: "14px", color: "#374151", lineHeight: 1.7 }}>
                        {sub.content}
                      </div>
                    )}

                    {/* File */}
                    {sub.file_path && (
                      <a href={`http://localhost:5001/uploads/${sub.file_path}`} target="_blank" rel="noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#3B37CC", fontWeight: 600, background: "#f0f4ff", padding: "8px 16px", borderRadius: "10px", textDecoration: "none", border: "1px solid #a5b4fc", marginBottom: "20px" }}>
                        📎 View attached file
                      </a>
                    )}

                    {/* Grade section */}
                    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#374151", marginBottom: "12px" }}>Grade</div>
                      {(sub.status === "graded" || sub.status === "returned") ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "22px", fontWeight: 800, color: "#22c55e" }}>{sub.grade}</span>
                          <span style={{ fontSize: "14px", color: "#6b7280" }}>/ {selectedAssign.points} pts</span>
                          {sub.grade_comment && <span style={{ fontSize: "13px", color: "#374151", fontStyle: "italic" }}>— {sub.grade_comment}</span>}
                          {sub.status === "graded" && (
                            <button onClick={() => returnSubmission(sub.id)} disabled={returning[sub.id]}
                              style={{ marginLeft: "auto", background: "#f0fdf4", border: "1px solid #22c55e", color: "#15803d", borderRadius: "8px", padding: "6px 14px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                              {returning[sub.id] ? "..." : "Return to Student"}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                          <input type="number" min="0" max={selectedAssign.points}
                            placeholder={`Score (0-${selectedAssign.points})`}
                            value={gradeInputs[sub.id]?.grade ?? ""}
                            onChange={e => setGradeInputs(g => ({ ...g, [sub.id]: { ...g[sub.id], grade: e.target.value } }))}
                            style={{ ...inp, width: "120px" }} />
                          <input type="text" placeholder="Comment (optional)"
                            value={gradeInputs[sub.id]?.comment || ""}
                            onChange={e => setGradeInputs(g => ({ ...g, [sub.id]: { ...g[sub.id], comment: e.target.value } }))}
                            style={{ ...inp, flex: 1, minWidth: "160px" }} />
                          <button onClick={async () => {
                            const grade = parseInt(gradeInputs[sub.id]?.grade);
                            if (isNaN(grade)) return;
                            setGrading(g => ({ ...g, [sub.id]: true }));
                            try {
                              await API.post(`/classroom/submissions/${sub.id}/grade`, { grade, comment: gradeInputs[sub.id]?.comment || "" });
                              const { data } = await API.get(`/classroom/assignments/${selectedAssign.id}`);
                              setAssignDetail(data);
                              setSelectedSubmissionStudent(prev => ({ ...prev, submission: data.submissions?.find(s => s.student_id === prev.id) || prev.submission }));
                            } catch (err) { console.error(err); }
                            finally { setGrading(g => ({ ...g, [sub.id]: false })); }
                          }} disabled={grading[sub.id]} style={{ ...btnPrimary, padding: "10px 20px" }}>
                            {grading[sub.id] ? "..." : "Grade"}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Private comment */}
                    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#6b7280", marginBottom: "12px", letterSpacing: "0.05em" }}>🔒 PRIVATE COMMENT — {selectedSubmissionStudent.name}</div>
                      <SubmissionComments
                        assignId={selectedAssign.id}
                        studentId={selectedSubmissionStudent.id}
                        studentName={selectedSubmissionStudent.name}
                        myName={myName}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Student Assignment Modal (non-teacher) */}
      {selectedAssign && !isTeacher && (
        <div style={overlayStyle} onClick={() => setSelectedAssign(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, width: "600px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a2e", margin: "0 0 4px" }}>📝 {selectedAssign.title}</h2>
                <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                  {selectedAssign.due_date ? `Due: ${formatDate(selectedAssign.due_date)}` : "No due date"} • {selectedAssign.points} pts
                </div>
              </div>
              <button onClick={() => setSelectedAssign(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>
            {selectedAssign.instructions && (
              <div style={{ background: "#f8f9fa", borderRadius: "10px", padding: "14px", marginBottom: "12px", fontSize: "14px", color: "#374151", lineHeight: 1.6 }}>
                {selectedAssign.instructions}
              </div>
            )}
            {selectedAssign.files?.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#6b7280", marginBottom: "6px" }}>ATTACHMENTS</div>
                {selectedAssign.files.map(f => (
                  <a key={f.id} href={`http://localhost:5001/uploads/${f.file_path}`} target="_blank" rel="noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#3B37CC", fontWeight: 600, background: "#f0f4ff", padding: "6px 12px", borderRadius: "8px", textDecoration: "none", border: "1px solid #a5b4fc", marginRight: "8px", marginBottom: "4px" }}>
                    📄 {f.file_name}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {uploadModal && (
        <div style={overlayStyle} onClick={() => setUploadModal(false)}>
          <div onClick={e => e.stopPropagation()} style={modalStyle}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a2e", margin: "0 0 20px" }}>Add New Material</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={lbl}>Title *</label>
                <input value={uploadForm.title} onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Week 1 – Introduction" style={inp} autoFocus />
              </div>
              <div>
                <label style={lbl}>Week</label>
                <input type="number" min="1" max="20" value={uploadForm.week} onChange={e => setUploadForm(f => ({ ...f, week: e.target.value }))} style={{ ...inp, width: "80px" }} />
              </div>
              <div>
                <label style={lbl}>Instructions</label>
                <textarea value={uploadForm.instructions} onChange={e => setUploadForm(f => ({ ...f, instructions: e.target.value }))} placeholder="Instructions for students..." style={{ ...inp, height: "80px", resize: "none" }} />
              </div>
              <div>
                <label style={lbl}>PDF File (optional)</label>
                <input type="file" accept="application/pdf" ref={fileRef} onChange={e => setUploadFile(e.target.files[0])} style={{ fontSize: "13px" }} />
              </div>
            </div>
            {uploadError && <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "10px" }}>{uploadError}</p>}
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button onClick={() => setUploadModal(false)} style={{ ...btnOutline, flex: 1 }}>Cancel</button>
              <button onClick={handleUpload} disabled={uploading || !uploadForm.title.trim()} style={{ ...btnPrimary, flex: 1, opacity: (!uploadForm.title.trim() || uploading) ? 0.6 : 1 }}>
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Submission Comments (inline, for teacher's assignment detail) ──
function SubmissionComments({ assignId, studentId, studentName, myName }) {
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!assignId) return;
    API.get(`/classroom/assignments/${assignId}/comments?student=${studentId}`)
      .then(r => setComments((r.data || []).filter(c => !c.target_student_id || c.target_student_id === studentId || c.author_id === studentId)))
      .catch(() => {});
  }, [assignId, studentId]);

  async function send() {
    if (!input.trim()) return;
    setSending(true);
    try {
      const { data } = await API.post(`/classroom/assignments/${assignId}/comments`, {
        content: input, target_student_id: studentId,
      });
      setComments(prev => [...prev, data]);
      setInput("");
    } catch (err) { console.error(err); }
    finally { setSending(false); }
  }

  return (
    <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "10px" }}>
      <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", marginBottom: "8px", letterSpacing: "0.05em" }}>
        🔒 PRIVATE COMMENT — {studentName}
      </div>
      <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", marginBottom: "8px" }}>
        {comments.length === 0
          ? <div style={{ fontSize: "12px", color: "#9ca3af" }}>No comments yet.</div>
          : comments.map((c, i) => (
            <div key={i} style={{ fontSize: "12px", color: "#374151" }}>
              <span style={{ fontWeight: 700 }}>{c.author_name || (c.author_id === studentId ? studentName : myName)}:</span> {c.content}
            </div>
          ))
        }
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Add private comment..." style={{ flex: 1, padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "12px" }} />
        <button onClick={send} disabled={sending || !input.trim()}
          style={{ background: "#3B37CC", color: "#fff", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}>
          Send
        </button>
      </div>
    </div>
  );
}

// ── Stream Section Component ──
function StreamSection({ icon, title, onMore, children, empty, emptyMsg }) {
  return (
    <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #f3f4f6", background: "#fafafa" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>{icon}</span>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a2e" }}>{title}</span>
        </div>
        <button onClick={onMore} style={{ fontSize: "12px", color: "#3B37CC", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
          More »
        </button>
      </div>
      <div style={{ padding: "6px 18px 10px" }}>
        {empty
          ? <div style={{ fontSize: "13px", color: "#9ca3af", padding: "12px 0" }}>{emptyMsg}</div>
          : children
        }
      </div>
    </div>
  );
}

function StreamRow({ label, date, badge, badgeColor, onClick, actions }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f9fafb", cursor: onClick ? "pointer" : "default", gap: "6px" }}
      onMouseEnter={e => onClick && (e.currentTarget.style.background = "#f9fafb")}
      onMouseLeave={e => onClick && (e.currentTarget.style.background = "transparent")}>
      <span style={{ fontSize: "13px", color: "#374151", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        · {label}
      </span>
      {actions}
      {badge && <span style={{ fontSize: "11px", color: badgeColor || "#6b7280", fontWeight: 600, flexShrink: 0 }}>{badge}</span>}
      {date && !badge && <span style={{ fontSize: "11px", color: "#9ca3af", flexShrink: 0 }}>{date}</span>}
    </div>
  );
}

// ── Post Card Component ──
function PostCard({ post, myName, isTeacher, onEdit, onDelete, expandedComments, setExpandedComments, commentInputs, setCommentInputs, submittingComment, handleComment }) {
  const isMaterial = post.type === "material";
  const commentCount = post.comments?.length || 0;
  const showComments = expandedComments[post.id];

  return (
    <div style={postCard}>
      {/* Author row */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
        <div style={{ ...avatarSm, background: "#3B37CC", color: "#fff" }}>
          {(post.author_name || "T")[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a2e" }}>{post.author_name}</div>
          <div style={{ fontSize: "12px", color: "#9ca3af" }}>{formatDate(post.created_at)}</div>
        </div>
        {isMaterial && (
          <span style={{ marginLeft: "auto", background: "#f0f4ff", color: "#3B37CC", fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px" }}>
            📄 Material
          </span>
        )}
        {isTeacher && !isMaterial && (
          <div style={{ marginLeft: isMaterial ? "8px" : "auto", display: "flex", gap: "6px" }}>
            <button onClick={() => onEdit(post)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "#9ca3af", padding: "2px 6px" }} title="Edit">✏️</button>
            <button onClick={() => onDelete(post.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "#ef4444", padding: "2px 6px" }} title="Delete">🗑️</button>
          </div>
        )}
      </div>

      {/* Content */}
      <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.6, margin: "0 0 12px" }}>
        {post.content}
      </p>

      {/* Material card */}
      {isMaterial && post.material_title && (
        <div style={matPostCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a2e" }}>{post.material_title}</div>
              {post.material_instructions && (
                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>{post.material_instructions}</div>
              )}
            </div>
            {post.material_file_url && (
              <a href={`http://localhost:5001${post.material_file_url}`} target="_blank" rel="noopener noreferrer" style={dlBtn}>
                ↓ Download
              </a>
            )}
          </div>
        </div>
      )}

      {/* Comment toggle */}
      <div style={{ borderTop: "1px solid #f3f4f6", marginTop: "12px", paddingTop: "10px" }}>
        <button
          onClick={() => setExpandedComments(e => ({ ...e, [post.id]: !e[post.id] }))}
          style={commentToggle}
        >
          💬 {commentCount > 0 ? `${commentCount} comment${commentCount > 1 ? "s" : ""}` : "Add comment"}
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div style={{ marginTop: "12px" }}>
          {post.comments?.map(c => (
            <div key={c.id} style={commentRow}>
              <div style={commentAvatar}>{(c.author_name || "U")[0].toUpperCase()}</div>
              <div style={commentBubble}>
                <span style={{ fontWeight: 600, fontSize: "13px" }}>{c.author_name} </span>
                <span style={{ fontSize: "13px", color: "#374151" }}>{c.content}</span>
                <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>{formatDate(c.created_at)}</div>
              </div>
            </div>
          ))}

          {/* Comment input */}
          <div style={{ display: "flex", gap: "10px", marginTop: "10px", alignItems: "center" }}>
            <div style={{ ...commentAvatar, background: "#3B37CC", color: "#fff" }}>
              {myName[0].toUpperCase()}
            </div>
            <input
              value={commentInputs[post.id] || ""}
              onChange={e => setCommentInputs(c => ({ ...c, [post.id]: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && handleComment(post.id)}
              placeholder="Write a comment..."
              style={commentInput}
            />
            <button
              onClick={() => handleComment(post.id)}
              disabled={submittingComment[post.id] || !commentInputs[post.id]?.trim()}
              style={sendBtn}
            >
              →
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

function QuizView({ questions }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const score = submitted
    ? questions.filter((q, i) => answers[i] === q.answer).length
    : 0;

  return (
    <div>
      {questions.map((q, i) => (
        <div key={i} style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a2e", marginBottom: "12px" }}>
            Q{i + 1}. {q.question}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {q.options.map((opt, j) => {
              const letter = opt[0];
              const isSelected = answers[i] === letter;
              const isCorrect = letter === q.answer;
              let bg = "#fff", border = "1px solid #e5e7eb", color = "#374151";
              if (submitted) {
                if (isCorrect) { bg = "#f0fdf4"; border = "2px solid #22c55e"; color = "#15803d"; }
                else if (isSelected) { bg = "#fef2f2"; border = "2px solid #ef4444"; color = "#dc2626"; }
              } else if (isSelected) {
                bg = "#f0f4ff"; border = "2px solid #3B37CC"; color = "#3B37CC";
              }
              return (
                <div
                  key={j}
                  onClick={() => !submitted && setAnswers(a => ({ ...a, [i]: letter }))}
                  style={{ padding: "10px 14px", borderRadius: "8px", background: bg, border, color, fontSize: "13px", cursor: submitted ? "default" : "pointer" }}
                >
                  {opt}
                  {submitted && isCorrect && " ✓"}
                  {submitted && isSelected && !isCorrect && " ✗"}
                </div>
              );
            })}
          </div>
          {submitted && (
            <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "8px", fontStyle: "italic" }}>
              💡 {q.explanation}
            </div>
          )}
        </div>
      ))}
      {!submitted ? (
        <button
          onClick={() => setSubmitted(true)}
          disabled={Object.keys(answers).length < questions.length}
          style={{ ...btnStyle, opacity: Object.keys(answers).length < questions.length ? 0.5 : 1 }}
        >
          Submit Quiz
        </button>
      ) : (
        <div style={{ background: score === questions.length ? "#f0fdf4" : "#f0f4ff", borderRadius: "10px", padding: "16px", textAlign: "center" }}>
          <div style={{ fontSize: "28px", fontWeight: 800, color: score === questions.length ? "#15803d" : "#3B37CC" }}>
            {score}/{questions.length}
          </div>
          <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
            {score === questions.length ? "Perfect! 🎉" : score >= 2 ? "Good job! 👍" : "Keep studying! 📚"}
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle = { background: "#3B37CC", color: "#fff", border: "none", borderRadius: "10px", padding: "12px 24px", fontSize: "14px", fontWeight: 600, cursor: "pointer", width: "100%" };

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Styles ──
const layout = { display: "flex", minHeight: "100vh", background: "#f8f9fa" };

const topHeader = {
  background: "#fff", borderBottom: "1px solid #e5e7eb",
  padding: "14px 28px", display: "flex", alignItems: "center",
  justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50,
};

const backBtn = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: "18px", color: "#6b7280", padding: "4px 8px",
};

const tabBtn = (active) => ({
  padding: "8px 18px", borderRadius: "8px", border: "none",
  fontSize: "14px", fontWeight: 600, cursor: "pointer",
  background: active ? "#3B37CC" : "transparent",
  color: active ? "#fff" : "#6b7280",
});

const avatarSm = {
  width: "36px", height: "36px", borderRadius: "50%",
  background: "#e5e7eb", display: "flex", alignItems: "center",
  justifyContent: "center", fontSize: "14px", fontWeight: 700, color: "#374151",
};

const announceCard = {
  background: "#fff", border: "1px solid #e5e7eb",
  borderRadius: "12px", padding: "16px 20px", marginBottom: "20px",
};

const announceTextarea = {
  flex: 1, border: "none", outline: "none", fontSize: "14px",
  color: "#374151", resize: "none", background: "transparent",
  fontFamily: "inherit", lineHeight: 1.6,
};

const postBtn = {
  background: "#3B37CC", color: "#fff", border: "none",
  borderRadius: "8px", padding: "8px 20px", fontSize: "13px",
  fontWeight: 600, cursor: "pointer",
};

const postCard = {
  background: "#fff", border: "1px solid #e5e7eb",
  borderRadius: "12px", padding: "20px", marginBottom: "16px",
};

const matPostCard = {
  background: "#f8f9fa", border: "1px solid #e5e7eb",
  borderRadius: "10px", padding: "14px 16px", marginBottom: "4px",
};

const dlBtn = {
  background: "#3B37CC", color: "#fff", textDecoration: "none",
  borderRadius: "8px", padding: "7px 14px", fontSize: "13px",
  fontWeight: 600, flexShrink: 0,
};

const commentToggle = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: "13px", color: "#6b7280", fontWeight: 500, padding: "4px 0",
};

const commentRow = {
  display: "flex", gap: "10px", marginBottom: "10px", alignItems: "flex-start",
};

const commentAvatar = {
  width: "28px", height: "28px", borderRadius: "50%", background: "#e5e7eb",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: "12px", fontWeight: 700, color: "#374151", flexShrink: 0,
};

const commentBubble = {
  background: "#f3f4f6", borderRadius: "12px", padding: "8px 12px",
  fontSize: "13px", color: "#374151", flex: 1,
};

const commentInput = {
  flex: 1, padding: "8px 14px", borderRadius: "20px",
  border: "1px solid #e5e7eb", fontSize: "13px", outline: "none",
};

const sendBtn = {
  background: "#3B37CC", color: "#fff", border: "none",
  borderRadius: "50%", width: "32px", height: "32px",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", fontSize: "16px", flexShrink: 0,
};

const aiCard = {
  background: "linear-gradient(135deg, #3B37CC, #6366F1)",
  borderRadius: "14px", padding: "20px",
};

const aiBtn = {
  marginTop: "14px", background: "#fff", color: "#3B37CC",
  border: "none", borderRadius: "8px", padding: "8px 16px",
  fontSize: "13px", fontWeight: 600, cursor: "pointer", width: "100%",
};

const sideCard = {
  background: "#fff", border: "1px solid #e5e7eb",
  borderRadius: "14px", padding: "16px 20px",
};

const banner = {
  background: "linear-gradient(135deg, #3B37CC, #6366F1)",
  borderRadius: "14px", padding: "24px 28px",
  display: "flex", justifyContent: "space-between",
  alignItems: "center", marginBottom: "24px",
};

const newMatBtn = {
  background: "#fff", color: "#3B37CC", border: "none",
  borderRadius: "8px", padding: "10px 20px", fontSize: "13px",
  fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
};

const weekLabel = {
  fontSize: "12px", fontWeight: 700, color: "#9ca3af",
  textTransform: "uppercase", letterSpacing: "1px", padding: "14px 0 6px",
};

const matRow = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "14px 18px", background: "#fff", border: "1px solid #e5e7eb",
  borderRadius: "10px", marginBottom: "3px", cursor: "pointer",
};

const matIcon = {
  width: "36px", height: "36px", borderRadius: "8px",
  background: "#f0f4ff", display: "flex", alignItems: "center",
  justifyContent: "center", fontSize: "16px", flexShrink: 0,
};

const fileChip = {
  display: "flex", alignItems: "center", gap: "8px",
  background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px",
  padding: "8px 14px", fontSize: "13px", color: "#374151",
  textDecoration: "none", maxWidth: "100%", boxSizing: "border-box",
};

const fab = {
  position: "fixed", bottom: "32px", right: "32px",
  width: "56px", height: "56px", borderRadius: "50%",
  background: "#3B37CC", color: "#fff", fontSize: "28px",
  border: "none", cursor: "pointer",
  boxShadow: "0 4px 16px rgba(59,55,204,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const sectionHead = {
  fontSize: "13px", fontWeight: 700, color: "#3B37CC",
  textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 12px",
};

const memberRow = {
  display: "flex", alignItems: "center", gap: "12px",
  padding: "12px 16px", background: "#fff", borderRadius: "10px",
  border: "1px solid #e5e7eb", marginBottom: "4px",
};

const memberAvatar = {
  width: "40px", height: "40px", borderRadius: "50%",
  background: "#e5e7eb", color: "#374151", display: "flex",
  alignItems: "center", justifyContent: "center",
  fontSize: "16px", fontWeight: 700, flexShrink: 0,
};

const overlayStyle = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
};

const modalStyle = {
  background: "#fff", borderRadius: "16px", padding: "28px",
  width: "420px", maxWidth: "92vw",
};

const btnPrimary = {
  background: "#3B37CC", color: "#fff", padding: "11px 20px",
  borderRadius: "10px", fontSize: "14px", fontWeight: 600,
  border: "none", cursor: "pointer", width: "100%",
};

const btnOutline = {
  background: "#fff", color: "#6b7280", padding: "11px 20px",
  borderRadius: "10px", fontSize: "14px", fontWeight: 600,
  border: "1px solid #d1d5db", cursor: "pointer", width: "100%",
};

const lbl = { display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" };
const inp = { width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", outline: "none", boxSizing: "border-box" };

const aiMentorPanel = {
  background: "#fff", border: "1px solid #e5e7eb",
  borderRadius: "16px", padding: "20px",
  position: "sticky", top: "80px",
};

const aiAvatarStyle = {
  width: "44px", height: "44px", borderRadius: "12px",
  background: "linear-gradient(135deg, #3B37CC, #6366F1)",
  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px",
};

const aiFeatureCard = {
  borderRadius: "12px", padding: "14px 16px",
  marginBottom: "10px", cursor: "pointer",
  transition: "all 0.15s",
};
