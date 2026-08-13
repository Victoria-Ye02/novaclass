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
  const _initTab = new URLSearchParams(location.search).get("tab") || "stream";
  const [activeTab, setActiveTab] = useState(_initTab);

  function goTab(tab) {
    setActiveTab(tab);
    navigate(`?tab=${tab}`, { replace: true });
  }
  const [loading, setLoading] = useState(true);
  const [isTeacher, setIsTeacher] = useState(false);
  const [myId, setMyId] = useState(null);

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
  const [uploadExtraFiles, setUploadExtraFiles] = useState([]);
  const [deleteAttachmentIds, setDeleteAttachmentIds] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [generatingInstructions, setGeneratingInstructions] = useState(false);
  const [suggestedVideos, setSuggestedVideos] = useState([]);
  const [suggestingVideos, setSuggestingVideos] = useState(false);
  const [selectedVideoUrls, setSelectedVideoUrls] = useState(new Set());
  const [instructionLang, setInstructionLang] = useState("en");
  const [ytNextPageToken, setYtNextPageToken] = useState(null);
  const [ytLanguageHint, setYtLanguageHint] = useState("English");
  const fileRef = useRef();
  const extraFileRef = useRef();
  const cachedInstructionText = useRef("");

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
  const [activeSession, setActiveSession] = useState(null);
  const [sessionRecords, setSessionRecords] = useState({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [newSessionModal, setNewSessionModal] = useState(false);
  const [newSessionForm, setNewSessionForm] = useState({ title: "", session_date: new Date().toISOString().slice(0, 10) });
  const [myAttendance, setMyAttendance] = useState(null);
  // Attendance calendar
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calSelectedDate, setCalSelectedDate] = useState(null); // "YYYY-MM-DD"
  // Student calendar (separate state from teacher calendar)
  const [calStudentYear, setCalStudentYear] = useState(today.getFullYear());
  const [calStudentMonth, setCalStudentMonth] = useState(today.getMonth());
  const [calStudentSelDate, setCalStudentSelDate] = useState(null); // "YYYY-MM-DD" for day detail
  const [disputeModal, setDisputeModal] = useState(null); // null | {title, session_date, status}
  const [disputeForm, setDisputeForm] = useState({ requested: "present", reason: "" });
  const [leaveModal, setLeaveModal] = useState(null); // null | "form" | "confirm"
  const [leaveForm, setLeaveForm] = useState({ from: new Date().toISOString().slice(0,10), to: new Date().toISOString().slice(0,10), reasonType: "medical", details: "" });
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [attendanceMarkModal, setAttendanceMarkModal] = useState(false);
  const [attendanceModalEditMode, setAttendanceModalEditMode] = useState(false);
  const [originalRecords, setOriginalRecords] = useState({});
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState("");
  const [renamingSessionId, setRenamingSessionId] = useState(null);
  const [renamingTitle, setRenamingTitle] = useState("");
  const [sessionMenuOpen, setSessionMenuOpen] = useState(null); // session id of open ⋮ menu
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

  // Material edit mode (null = create, number = editing material id)
  const [materialEditId, setMaterialEditId] = useState(null);

  // Material-linked assignments
  const [matAssignments, setMatAssignments] = useState([]);
  const [matAssignForm, setMatAssignForm] = useState({ title: "", instructions: "", due_date: "", points: 100 });
  const [matAssignOpen, setMatAssignOpen] = useState(false);
  const [matAssignSaving, setMatAssignSaving] = useState(false);

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

  useEffect(() => {
    loadAll().then(() => {
      const tab = new URLSearchParams(location.search).get("tab");
      if (tab === "attendance") { loadAttendance(); loadMeeting(); }
      if (tab === "grades") loadGrades();
    });
  }, [id]);

  // Push a history entry when a full-screen panel opens so the browser/trackpad
  // back gesture closes the panel instead of leaving the page.
  useEffect(() => {
    const isOpen = attendanceMarkModal || assignModal;
    if (!isOpen) return;
    window.history.pushState({ panel: true }, "");
    function handlePop() {
      setAttendanceMarkModal(false);
      setAttendanceSearchQuery("");
      setAttendanceModalEditMode(false);
      setAssignModal(false);
      setAssignFiles([]);
      setAssignForm({ title: "", instructions: "", due_date: "", points: 100 });
    }
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [attendanceMarkModal, assignModal]);

  // Auto-navigate student calendar to most recent attendance month
  useEffect(() => {
    if (!myAttendance || !myAttendance.rows || myAttendance.rows.length === 0) return;
    const dates = myAttendance.rows
      .map(r => r.session_date ? r.session_date.slice(0, 10) : null)
      .filter(Boolean)
      .sort()
      .reverse();
    if (dates.length === 0) return;
    const latest = new Date(dates[0]);
    setCalStudentYear(latest.getFullYear());
    setCalStudentMonth(latest.getMonth());
  }, [myAttendance]);

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
      setMyId(cls.my_id);
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
      goTab("classwork");
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

  async function openAttendanceSession(sessionId, isTaken = false) {
    try {
      const { data } = await API.get(`/classroom/attendance/${sessionId}`);
      setActiveSession(data);
      const rmap = {};
      for (const r of data.records) rmap[r.student_id] = r.status || "present";
      setSessionRecords(rmap);
      setOriginalRecords(isTaken ? { ...rmap } : {});
      setAttendanceSearchQuery("");
      setAttendanceModalEditMode(!isTaken);
      setAttendanceMarkModal(true);
    } catch (err) { console.error(err); }
  }

  async function saveAttendance() {
    setSavingAttendance(true);
    try {
      const records = Object.entries(sessionRecords).map(([student_id, status]) => ({ student_id: Number(student_id), status }));
      await API.patch(`/classroom/attendance/${activeSession.id}/mark`, { records });
      setAttendanceModalEditMode(false);
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

  function openEditMatModal() {
    const mat = selectedMat;
    setUploadForm({ title: mat.title, week: mat.week || 1, instructions: mat.instructions || "" });
    setUploadFile(null);
    setUploadExtraFiles([]);
    setDeleteAttachmentIds([]);
    setUploadError("");
    // Pre-load existing YouTube videos
    const existing = Array.isArray(mat.ai_resources) ? mat.ai_resources : [];
    setSuggestedVideos(existing);
    setSelectedVideoUrls(new Set(existing.map(v => v.url)));
    setYtNextPageToken(null);
    cachedInstructionText.current = "";
    setMaterialEditId(mat.id);
  }

  async function loadMatAssignments(materialId) {
    try {
      const { data } = await API.get(`/classroom/materials/${materialId}/assignments`);
      setMatAssignments(data || []);
    } catch {}
  }

  async function createMatAssignment() {
    if (!matAssignForm.title.trim()) return;
    setMatAssignSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", matAssignForm.title);
      fd.append("instructions", matAssignForm.instructions);
      if (matAssignForm.due_date) fd.append("due_date", matAssignForm.due_date);
      fd.append("points", matAssignForm.points);
      fd.append("material_id", selectedMat.id);
      const { data } = await API.post(`/classroom/classes/${id}/assignments`, fd);
      setMatAssignments(prev => [data, ...prev]);
      setAssignments(prev => [data, ...prev]);
      setMatAssignForm({ title: "", instructions: "", due_date: "", points: 100 });
      setMatAssignOpen(false);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create assignment.");
    } finally {
      setMatAssignSaving(false);
    }
  }

  async function openAssignment(assign) {
    markAssignSeen(assign.id);
    if (!isTeacher) {
      // Student → full page view
      setSelectedMat(null);
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

  async function handleGenerateInstructions(langOverride) {
    if (!uploadFile && !cachedInstructionText.current) return;
    setGeneratingInstructions(true);
    try {
      const fd = new FormData();
      fd.append("title", uploadForm.title);
      fd.append("week", uploadForm.week);
      fd.append("classId", id);
      fd.append("lang", langOverride || instructionLang);
      if (cachedInstructionText.current) {
        // Fast path: skip Vision re-reading, use cached extracted text
        fd.append("textContent", cachedInstructionText.current);
      } else {
        fd.append("file", uploadFile);
      }
      const { data } = await API.post("/classroom/materials/generate-instructions", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (data.textContent) cachedInstructionText.current = data.textContent;
      if (data.instructions) setUploadForm(f => ({ ...f, instructions: data.instructions }));
    } catch { /* silent */ } finally {
      setGeneratingInstructions(false);
    }
  }

  async function handleSuggestVideos(fileArg, useNextPage = false) {
    const fileToUse = fileArg !== undefined ? fileArg : uploadFile;
    if (!fileToUse) return;
    setSuggestingVideos(true);
    setSuggestedVideos([]);
    try {
      const fd = new FormData();
      fd.append("title", uploadForm.title);
      fd.append("file", fileToUse);
      if (useNextPage && ytNextPageToken) fd.append("pageToken", ytNextPageToken);
      if (ytLanguageHint.trim()) fd.append("languageHint", ytLanguageHint.trim());
      const { data } = await API.post("/classroom/materials/suggest-youtube", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSuggestedVideos(data.videos || []);
      setYtNextPageToken(data.nextPageToken || null);
      setSelectedVideoUrls(new Set());
    } catch { /* silent */ } finally {
      setSuggestingVideos(false);
    }
  }

  function closeUploadModal() {
    setUploadModal(false);
    setMaterialEditId(null);
    setUploadForm({ title: "", week: 1, instructions: "" });
    setUploadFile(null);
    setUploadExtraFiles([]);
    setDeleteAttachmentIds([]);
    setUploadError("");
    setSuggestedVideos([]);
    setYtNextPageToken(null);
    setSelectedVideoUrls(new Set());
    cachedInstructionText.current = "";
    if (fileRef.current) fileRef.current.value = "";
    if (extraFileRef.current) extraFileRef.current.value = "";
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
      uploadExtraFiles.forEach(f => fd.append("files", f));
      if (materialEditId && deleteAttachmentIds.length) fd.append("delete_file_ids", JSON.stringify(deleteAttachmentIds));
      const selectedVids = suggestedVideos.filter(v => selectedVideoUrls.has(v.url));
      fd.append("ai_resources", JSON.stringify(selectedVids));

      if (materialEditId) {
        // Edit mode — PUT existing material
        const { data } = await API.put(`/classroom/materials/${materialEditId}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setSelectedMat(prev => ({ ...prev, ...data }));
        setMaterials(prev => prev.map(m => m.id === materialEditId ? { ...m, ...data } : m));
      } else {
        // Create mode — POST new material
        await API.post(`/classroom/classes/${id}/materials`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        loadAll();
      }
      closeUploadModal();
    } catch (err) {
      setUploadError(err.response?.data?.message || err.response?.data?.error || "Failed to save.");
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
        <p style={{ color: "var(--text-faint)" }}>Loading...</p>
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
              <h1 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)", margin: 0 }}>{classInfo.name}</h1>
              {classInfo.subject && <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>{classInfo.subject}</p>}
            </div>
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            {[
              { key: "stream", label: "Stream" },
              { key: "classwork", label: "Classwork" },
              ...(isTeacher ? [{ key: "grades", label: "Grades" }] : []),
              { key: "attendance", label: "Attendance" },
              ...(isTeacher ? [{ key: "people", label: "People" }] : []),
            ].map(tab => (
              <button key={tab.key} onClick={() => {
                goTab(tab.key);
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

        <div style={{ flex: 1, padding: "28px 32px", background: "var(--bg)" }}>

          {/* ── STREAM TAB ── */}
          {activeTab === "stream" && streamView === "announcements" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                <button onClick={() => setStreamView("dashboard")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>← Back</button>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)", margin: 0 }}>📢 Announcements</h3>
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
                ? <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-faint)" }}><div style={{ fontSize: "32px", marginBottom: "8px" }}>📢</div><p>No announcements yet.</p></div>
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
                          <button onClick={e => { e.stopPropagation(); setEditingPost({ id: post.id, content: post.content }); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: "13px", padding: "0 3px" }}>✏️</button>
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
                  onMore={() => goTab("classwork")}
                  empty={materials.length === 0}
                  emptyMsg="No materials uploaded yet."
                >
                  {materials.slice(0, 5).map(mat => (
                    <StreamRow
                      key={mat.id}
                      label={mat.title}
                      date={new Date(mat.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      onClick={() => { goTab("classwork"); setClassworkTab("lessons"); }}
                    />
                  ))}
                </StreamSection>

                {/* Assignments section */}
                <StreamSection
                  icon="✏️" title="Assignments"
                  onMore={() => { goTab("classwork"); setClassworkTab("assignments"); }}
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
                        badgeColor={status === "Finished" ? "var(--text-muted)" : "#3B37CC"}
                        onClick={() => { goTab("classwork"); setClassworkTab("assignments"); }}
                      />
                    );
                  })}
                </StreamSection>
              </div>

              {/* ── RIGHT SIDEBAR ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                {/* Submission Status */}
                <div style={sideCard}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)", marginBottom: "14px", textAlign: "center" }}>
                    Submission Status
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>Activity</div>
                      <div style={{ fontSize: "28px", fontWeight: 800, color: "#3B37CC" }}>{streamStats?.totalAssignments ?? "—"}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>case</div>
                    </div>
                    {/* Donut chart */}
                    <div style={{ position: "relative", width: "80px", height: "80px" }}>
                      <svg viewBox="0 0 36 36" style={{ width: "80px", height: "80px", transform: "rotate(-90deg)" }}>
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3.5" />
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#3B37CC" strokeWidth="3.5"
                          strokeDasharray={`${streamStats?.submissionRate ?? 0} ${100 - (streamStats?.submissionRate ?? 0)}`}
                          strokeLinecap="round" />
                      </svg>
                      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: "14px", fontWeight: 800, color: "var(--text)" }}>
                        {streamStats?.submissionRate ?? 0}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Important (latest announcement) */}
                {posts.length > 0 && (
                  <div style={sideCard}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)", marginBottom: "10px" }}>Important</div>
                    {posts.slice(0, 2).map(p => (
                      <div key={p.id} style={{ display: "flex", gap: "8px", alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid var(--surface-alt)" }}>
                        <span style={{ fontSize: "13px" }}>⭐</span>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.4 }}>{p.content?.slice(0, 55)}{p.content?.length > 55 ? "…" : ""}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Class code */}
                {classInfo.code && (
                  <div style={{ background: "var(--surface)", border: "2px dashed var(--border)", borderRadius: "12px", padding: "14px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-faint)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px" }}>Class Code</div>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#3B37CC", letterSpacing: "4px" }}>{classInfo.code}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-faint)", marginTop: "4px" }}>Share with students</div>
                  </div>
                )}

                {/* New Posts */}
                <div style={sideCard}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)", marginBottom: "8px" }}>New Posts</div>
                  {posts.length === 0
                    ? <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>No Data.</div>
                    : posts.slice(0, 2).map(p => (
                      <div key={p.id} style={{ fontSize: "12px", color: "var(--text-muted)", padding: "4px 0", borderBottom: "1px solid var(--surface-alt)" }}>
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

                {/* Teacher action buttons */}
                {isTeacher && (
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginBottom: "20px" }}>
                    <button onClick={() => setAssignModal(true)} style={{ background: "var(--surface)", color: "#3B37CC", border: "1.5px solid #3B37CC", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                      + Assignment
                    </button>
                    <button onClick={() => setUploadModal(true)} style={{ background: "#3B37CC", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                      + Material
                    </button>
                  </div>
                )}

                {/* Student full-page assignment view */}
                {assignPage && !isTeacher ? (
                  <div style={{ background: "#f8f9fa", minHeight: "calc(100vh - 120px)", margin: "-8px -8px 0", padding: "0" }}>
                    {/* Top bar */}
                    <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 24px", display: "flex", alignItems: "center", gap: "12px" }}>
                      <button onClick={() => { setAssignPage(null); setAssignPageDetail(null); setEditing(false); setAiCheck(null); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#5f6368", fontSize: "20px", display: "flex", alignItems: "center", padding: "4px", borderRadius: "50%" }}>←</button>
                      <div style={{ width: "36px", height: "36px", background: "#1a73e8", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: "18px" }}>📝</span>
                      </div>
                      <div>
                        <div style={{ fontSize: "16px", fontWeight: 600, color: "#202124" }}>{assignPage.title}</div>
                        <div style={{ fontSize: "12px", color: "#5f6368" }}>{classInfo?.name}</div>
                      </div>
                    </div>

                    {/* Two-column body */}
                    <div style={{ display: "flex", gap: "20px", padding: "24px", maxWidth: "1100px", margin: "0 auto", alignItems: "flex-start" }}>

                      {/* LEFT — main content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Assignment header */}
                        <div style={{ background: "#fff", borderRadius: "8px", border: "1px solid #e0e0e0", padding: "24px 28px", marginBottom: "16px" }}>
                          <div style={{ fontSize: "22px", fontWeight: 400, color: "#202124", marginBottom: "8px" }}>{assignPage.title}</div>
                          <div style={{ display: "flex", gap: "16px", alignItems: "center", fontSize: "13px", color: "#5f6368", marginBottom: "4px" }}>
                            <span>{classInfo?.name}</span>
                            <span>·</span>
                            <span>{assignPage.due_date ? `Due ${formatDate(assignPage.due_date)}` : "No due date"}</span>
                            <span>·</span>
                            <span>{assignPage.points ? `${assignPage.points} points` : "Not graded"}</span>
                          </div>
                          <hr style={{ border: "none", borderTop: "1px solid #e0e0e0", margin: "16px 0" }} />
                          {assignPage.instructions ? (
                            <div style={{ fontSize: "14px", color: "#202124", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{assignPage.instructions}</div>
                          ) : (
                            <div style={{ fontSize: "14px", color: "#9aa0a6" }}>No instructions provided.</div>
                          )}

                          {/* Teacher files */}
                          {(assignPageDetail?.files || assignPage.files)?.length > 0 && (
                            <div style={{ marginTop: "20px", display: "flex", flexWrap: "wrap", gap: "10px" }}>
                              {(assignPageDetail?.files || assignPage.files).map(f => (
                                <a key={f.id} href={`http://localhost:5001/uploads/${f.file_path}`} target="_blank" rel="noreferrer"
                                  style={{ display: "flex", alignItems: "center", gap: "10px", background: "#f8f9fa", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "10px 14px", textDecoration: "none", minWidth: "200px" }}>
                                  <div style={{ width: "36px", height: "36px", background: "#4285f4", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <span style={{ fontSize: "18px" }}>📄</span>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: "13px", fontWeight: 500, color: "#202124", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.file_name}</div>
                                    <div style={{ fontSize: "11px", color: "#5f6368" }}>PDF</div>
                                  </div>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Class comments */}
                        <div style={{ background: "#fff", borderRadius: "8px", border: "1px solid #e0e0e0", padding: "20px 24px" }}>
                          <div style={{ fontSize: "14px", fontWeight: 500, color: "#202124", marginBottom: "14px" }}>Class comments</div>
                          {comments.length === 0
                            ? <div style={{ fontSize: "13px", color: "#9aa0a6" }}>No class comments yet.</div>
                            : comments.map(c => (
                              <div key={c.id} style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
                                <div style={{ width: "32px", height: "32px", background: "#3B37CC", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "13px", fontWeight: 700, color: "#fff" }}>
                                  {c.author_name?.[0]?.toUpperCase()}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#202124" }}>{c.author_name}</div>
                                  <div style={{ fontSize: "13px", color: "#374151", marginTop: "2px" }}>
                                    <CommentContent comment={c} isMine={c.author_id === myId}
                                      onUpdate={updated => setComments(prev => prev.map(x => x.id === c.id ? updated : x))}
                                      onDelete={() => setComments(prev => prev.filter(x => x.id !== c.id))} />
                                  </div>
                                </div>
                              </div>
                            ))
                          }
                          <div style={{ display: "flex", gap: "10px", marginTop: "12px", alignItems: "center" }}>
                            <div style={{ width: "32px", height: "32px", background: "#3B37CC", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "13px", fontWeight: 700, color: "#fff" }}>
                              {members.find(m => !m.is_teacher)?.name?.[0]?.toUpperCase() || "S"}
                            </div>
                            <input placeholder="Add class comment..." value={commentInput} onChange={e => setCommentInput(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && sendComment(assignPage.id)}
                              style={{ flex: 1, border: "none", borderBottom: "1px solid #e0e0e0", outline: "none", fontSize: "14px", padding: "6px 0", color: "#202124", background: "transparent" }} />
                            <button onClick={() => sendComment(assignPage.id)} disabled={commentSending || !commentInput.trim()}
                              style={{ background: "none", border: "none", cursor: commentInput.trim() ? "pointer" : "default", color: commentInput.trim() ? "#1a73e8" : "#9aa0a6", fontSize: "20px", padding: "4px" }}>➤</button>
                          </div>
                        </div>
                      </div>

                      {/* RIGHT — Your work panel */}
                      <div style={{ width: "300px", flexShrink: 0, position: "sticky", top: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        {(() => {
                          const sub = assignPage.my_submission || assignPageDetail?.my_submission;
                          const pastDue = assignPage.due_date && new Date() > new Date(assignPage.due_date);
                          const canEdit = !pastDue || !sub;

                          const statusLabel = (() => {
                            if (!sub) return { text: "Assigned", color: "#1a73e8", bg: "#e8f0fe" };
                            if (sub.status === "graded") return { text: "Graded", color: "#137333", bg: "#e6f4ea" };
                            if (sub.status === "returned") return { text: "Returned", color: "#b45309", bg: "#fef3c7" };
                            if (sub.status === "late") return { text: "Late", color: "#c5221f", bg: "#fce8e6" };
                            return { text: "Turned in", color: "#137333", bg: "#e6f4ea" };
                          })();

                          return (
                            <>
                              {/* Your work card */}
                              <div style={{ background: "#fff", borderRadius: "8px", border: "1px solid #e0e0e0", overflow: "hidden" }}>
                                <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f3f4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#202124" }}>Your work</span>
                                  <span style={{ fontSize: "12px", fontWeight: 600, color: statusLabel.color, background: statusLabel.bg, padding: "3px 10px", borderRadius: "12px" }}>{statusLabel.text}</span>
                                </div>

                                <div style={{ padding: "16px 18px" }}>
                                  {/* Graded display */}
                                  {sub?.status === "graded" && (
                                    <div style={{ textAlign: "center", marginBottom: "16px", padding: "12px", background: "#e6f4ea", borderRadius: "8px" }}>
                                      <div style={{ fontSize: "28px", fontWeight: 700, color: "#137333" }}>{sub.grade}<span style={{ fontSize: "14px", color: "#5f6368" }}>/{assignPage.points}</span></div>
                                      {sub.grade_comment && <div style={{ fontSize: "12px", color: "#374151", marginTop: "6px", fontStyle: "italic" }}>"{sub.grade_comment}"</div>}
                                    </div>
                                  )}

                                  {/* Submitted file */}
                                  {sub && !editing && (
                                    <div style={{ marginBottom: "12px" }}>
                                      {sub.content && (
                                        <div style={{ background: "#f8f9fa", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "10px 14px", marginBottom: "8px", fontSize: "13px", color: "#202124" }}>
                                          {sub.content}
                                        </div>
                                      )}
                                      {sub.file_path && (
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f8f9fa", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "10px 14px" }}>
                                          <span style={{ fontSize: "18px" }}>📎</span>
                                          <span style={{ fontSize: "13px", color: "#202124", fontWeight: 500 }}>File attached</span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Form when editing or not yet submitted */}
                                  {(editing || (!sub && canEdit)) && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "12px" }}>
                                      <textarea
                                        value={submitContent}
                                        onChange={e => { setSubmitContent(e.target.value); setAiCheck(null); }}
                                        placeholder="Write your answer here..."
                                        style={{ width: "100%", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", resize: "vertical", minHeight: "100px", outline: "none", boxSizing: "border-box", color: "#202124", fontFamily: "inherit" }}
                                      />
                                      <label style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f8f9fa", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "10px 14px", cursor: "pointer" }}>
                                        <span style={{ fontSize: "16px" }}>📎</span>
                                        <span style={{ fontSize: "13px", color: "#1a73e8", fontWeight: 500 }}>{submitFile ? submitFile.name : "Attach file"}</span>
                                        <input type="file" ref={submitFileRef} onChange={e => setSubmitFile(e.target.files[0])} style={{ display: "none" }} />
                                      </label>
                                    </div>
                                  )}

                                  {/* Past due + no submission */}
                                  {!canEdit && !sub && (
                                    <div style={{ fontSize: "13px", color: "#9aa0a6", marginBottom: "12px", textAlign: "center" }}>Submission period expired.</div>
                                  )}

                                  {/* AI check */}
                                  {(editing || (!sub && canEdit)) && (
                                    <div style={{ marginBottom: "10px" }}>
                                      <button onClick={checkWithAI} disabled={aiCheck?.loading}
                                        style={{ width: "100%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: "8px", padding: "9px", fontSize: "12px", fontWeight: 600, cursor: "pointer", opacity: aiCheck?.loading ? 0.7 : 1 }}>
                                        {aiCheck?.loading ? "🤖 Checking..." : "🤖 Check with AI"}
                                      </button>
                                      {aiCheck?.result && (
                                        <div style={{ marginTop: "8px", borderRadius: "8px", overflow: "hidden", border: `2px solid ${aiCheck.result.isComplete ? "#22c55e" : "#f59e0b"}` }}>
                                          <div style={{ background: aiCheck.result.isComplete ? "#22c55e" : "#f59e0b", padding: "8px 12px", display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span>{aiCheck.result.isComplete ? "✅" : "⚠️"}</span>
                                            <div style={{ fontSize: "12px", fontWeight: 700, color: "#fff" }}>
                                              {aiCheck.result.isComplete ? "Ready to submit" : "Incomplete"}
                                              {aiCheck.result.score != null && ` · ${aiCheck.result.score}%`}
                                            </div>
                                          </div>
                                          {aiCheck.result.missing?.length > 0 && (
                                            <div style={{ background: "#fff8ed", padding: "8px 12px" }}>
                                              {aiCheck.result.missing.map((m, i) => <div key={i} style={{ fontSize: "12px", color: "#78350f" }}>• {m}</div>)}
                                            </div>
                                          )}
                                          <div style={{ background: "#fff", padding: "8px 12px" }}>
                                            <div style={{ fontSize: "12px", color: "#374151", lineHeight: 1.6 }}>{aiCheck.result.feedback}</div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Action buttons */}
                                  {sub && !editing && sub.status !== "graded" && canEdit && (
                                    <button onClick={() => { setEditing(true); setSubmitContent(sub.content || ""); setAiCheck(null); }}
                                      style={{ width: "100%", background: "#fff", color: "#1a73e8", border: "1px solid #1a73e8", borderRadius: "20px", padding: "9px", fontSize: "13px", fontWeight: 600, cursor: "pointer", marginBottom: "8px" }}>
                                      Unsubmit
                                    </button>
                                  )}
                                  {editing && (
                                    <button onClick={() => setEditing(false)}
                                      style={{ width: "100%", background: "#fff", color: "#5f6368", border: "1px solid #e0e0e0", borderRadius: "20px", padding: "9px", fontSize: "13px", fontWeight: 600, cursor: "pointer", marginBottom: "8px" }}>
                                      Cancel
                                    </button>
                                  )}
                                  {(editing || (!sub && canEdit)) && (
                                    <button onClick={submitAssignment} disabled={submitting || (!submitContent.trim() && !submitFile)}
                                      style={{ width: "100%", background: submitting || (!submitContent.trim() && !submitFile) ? "#c5cae9" : "#1a73e8", color: "#fff", border: "none", borderRadius: "20px", padding: "10px", fontSize: "13px", fontWeight: 700, cursor: submitting || (!submitContent.trim() && !submitFile) ? "not-allowed" : "pointer" }}>
                                      {submitting ? "Turning in..." : editing ? "Save" : "Turn in"}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Private comments */}
                              <div style={{ background: "#fff", borderRadius: "8px", border: "1px solid #e0e0e0", padding: "16px 18px" }}>
                                <div style={{ fontSize: "13px", fontWeight: 600, color: "#202124", marginBottom: "12px" }}>Private comments</div>
                                {comments.length === 0
                                  ? <div style={{ fontSize: "13px", color: "#9aa0a6", marginBottom: "10px" }}>No private comments.</div>
                                  : comments.map(c => (
                                    <div key={c.id} style={{ marginBottom: "10px" }}>
                                      <div style={{ fontSize: "11px", fontWeight: 600, color: "#5f6368" }}>{c.author_name}</div>
                                      <div style={{ fontSize: "13px", color: "#202124", marginTop: "2px" }}>
                                        <CommentContent comment={c} isMine={c.author_id === myId}
                                          onUpdate={updated => setComments(prev => prev.map(x => x.id === c.id ? updated : x))}
                                          onDelete={() => setComments(prev => prev.filter(x => x.id !== c.id))} />
                                      </div>
                                    </div>
                                  ))
                                }
                                <div style={{ display: "flex", gap: "8px", alignItems: "center", borderTop: "1px solid #f1f3f4", paddingTop: "10px" }}>
                                  <input placeholder={`Add private comment to teacher...`} value={commentInput} onChange={e => setCommentInput(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && sendComment(assignPage.id)}
                                    style={{ flex: 1, border: "none", borderBottom: "1px solid #e0e0e0", outline: "none", fontSize: "13px", padding: "4px 0", color: "#202124", background: "transparent" }} />
                                  <button onClick={() => sendComment(assignPage.id)} disabled={commentSending || !commentInput.trim()}
                                    style={{ background: "none", border: "none", cursor: commentInput.trim() ? "pointer" : "default", color: commentInput.trim() ? "#1a73e8" : "#9aa0a6", fontSize: "18px" }}>➤</button>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* ── Assignments list (unified classwork) ── */}
                {!assignPage && !selectedMat && (
                <div style={{ marginBottom: "28px" }}>
                  {assignments.length === 0 ? (
                    <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: "10px", padding: "24px", textAlign: "center", color: "var(--text-faint)", fontSize: "13px" }}>
                      {isTeacher ? 'Click "+ Assignment" to add one.' : "No assignments yet."}
                    </div>
                  ) : (
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
                      {/* Table header */}
                      <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 100px 80px 80px 130px", gap: "0", background: "var(--bg)", borderBottom: "1px solid var(--border)", padding: "10px 16px", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
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
                              <div style={{ background: "var(--primary-tint)", padding: "6px 16px", fontSize: "12px", fontWeight: 700, color: "#3B37CC", borderBottom: "1px solid #e0e7ff" }}>
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
                                  style={{ display: "grid", gridTemplateColumns: "32px 1fr 100px 80px 80px 150px", gap: "0", padding: "12px 16px", borderBottom: "1px solid var(--surface-alt)", cursor: "pointer", alignItems: "center", transition: "background 0.1s", background: isUnread ? "#fefbff" : "transparent" }}
                                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg)"}
                                  onMouseLeave={e => e.currentTarget.style.background = isUnread ? "#fefbff" : "transparent"}
                                >
                                  <div style={{ position: "relative" }}>
                                    <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>{idx + 1}</div>
                                    {isUnread && <span style={{ position: "absolute", top: "-2px", right: "-2px", width: "7px", height: "7px", borderRadius: "50%", background: "#ef4444", display: "block" }} />}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: "13px", fontWeight: isUnread ? 700 : 600, color: "var(--text)", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                      {a.title}
                                      {isUnread && !a.is_draft && <span style={{ fontSize: "10px", fontWeight: 800, color: "#ef4444", background: "#fef2f2", padding: "1px 6px", borderRadius: "10px" }}>NEW</span>}
                                      {a.is_draft && <span style={{ fontSize: "10px", fontWeight: 700, color: "#92400e", background: "#fef3c7", padding: "1px 6px", borderRadius: "10px" }}>DRAFT</span>}
                                    </div>
                                    {isTeacher && <div style={{ fontSize: "11px", color: "var(--text-faint)" }}>{a.turned_in_count || 0} turned in</div>}
                                  </div>
                                  <div style={{ textAlign: "center" }}>
                                    <span style={{ fontSize: "11px", fontWeight: 700, color: inProgress ? "#22c55e" : "var(--text-faint)", background: inProgress ? "#f0fdf4" : "var(--surface-alt)", padding: "3px 8px", borderRadius: "20px" }}>
                                      {inProgress ? "In Progress" : "Finished"}
                                    </span>
                                  </div>
                                  <div style={{ textAlign: "center", fontSize: "18px" }}>
                                    {isTeacher
                                      ? <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{a.turned_in_count || 0}</span>
                                      : submitted ? <span style={{ color: sub.status === "graded" ? "#22c55e" : "#3B37CC" }}>✓</span>
                                      : <span style={{ color: "var(--border)" }}>—</span>}
                                  </div>
                                  <div style={{ textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>{a.points}</div>
                                  <div style={{ textAlign: "right", fontSize: "12px", color: pastDue ? "var(--text-faint)" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px", flexWrap: "wrap" }}>
                                    <span>{a.due_date ? formatDate(a.due_date) : "—"}</span>
                                    {isTeacher && (
                                      <div style={{ display: "flex", gap: "3px" }}>
                                        <button onClick={e => { e.stopPropagation(); setTopicModal({ type: "assignment", id: a.id, current: a.topic || "" }); setTopicInput(a.topic || ""); }} style={{ fontSize: "10px", padding: "2px 6px", background: "var(--surface-alt)", color: "var(--text-muted)", border: "none", borderRadius: "6px", cursor: "pointer" }} title="Set topic">📂</button>
                                        <button onClick={e => { e.stopPropagation(); openSubmissionStats(a.id); }} style={{ fontSize: "10px", padding: "2px 6px", background: "var(--primary-tint)", color: "#3B37CC", border: "none", borderRadius: "6px", cursor: "pointer" }} title="Submission stats">📊</button>
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
                  )}
                </div>
                )}

                {/* ── Materials section (unified classwork) ── */}
                {!assignPage && (
                <div>
                {selectedMat ? (
                  /* ── Material detail (full page) ── */
                  <div>
                    <button
                      onClick={() => { setSelectedMat(null); setAiModal(null); setAiResult(null); setChatHistory([]); }}
                      style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "var(--text-muted)", fontSize: "13px", fontWeight: 600, cursor: "pointer", padding: "0 0 16px" }}
                    >
                      ← Back to Classwork
                    </button>
                    <div style={{ ...banner, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>{selectedMat.title}</div>
                        <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", marginTop: "4px" }}>
                          Week {selectedMat.week || 1} · Posted {formatDate(selectedMat.created_at)}
                        </div>
                      </div>
                      {isTeacher && materialEditId !== selectedMat.id && (
                        <button onClick={openEditMatModal}
                          style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", borderRadius: "8px", padding: "5px 14px", fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                          ✏️ Edit
                        </button>
                      )}
                    </div>
                    {materialEditId === selectedMat.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
                        <div style={{ background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)", padding: "16px 20px" }}>
                          <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>Title</label>
                          <input value={uploadForm.title} onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))}
                            style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 12px", fontSize: "15px", fontWeight: 600, color: "var(--text)", boxSizing: "border-box", background: "var(--surface)" }} />
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
                            <span style={{ fontSize: "12px", color: "var(--text-faint)", fontWeight: 600 }}>WEEK</span>
                            <input type="number" min="1" max="20" value={uploadForm.week}
                              onChange={e => setUploadForm(f => ({ ...f, week: e.target.value }))}
                              style={{ width: "56px", border: "1px solid var(--border)", borderRadius: "6px", padding: "4px 8px", fontSize: "13px", fontWeight: 600, color: "#3B37CC", textAlign: "center", outline: "none" }} />
                          </div>
                        </div>

                        <div style={{ background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)", padding: "16px 20px" }}>
                          <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>Instructions</label>
                          <textarea value={uploadForm.instructions} onChange={e => setUploadForm(f => ({ ...f, instructions: e.target.value }))}
                            rows={3} placeholder="Add instructions for your students..."
                            style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "var(--text)", resize: "vertical", boxSizing: "border-box", background: "var(--surface)", fontFamily: "inherit" }} />
                        </div>

                        <div style={{ background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)", padding: "16px 20px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "10px" }}>Attach PDF (optional)</span>
                          {uploadFile ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "#f8f9ff", border: "1px solid #c7d2fe", borderRadius: "10px", padding: "10px 14px" }}>
                              <span style={{ fontSize: "20px" }}>📑</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{uploadFile.name}</div>
                                <div style={{ fontSize: "11px", color: "var(--text-faint)" }}>{(uploadFile.size / 1024).toFixed(0)} KB</div>
                              </div>
                              <button onClick={() => { setUploadFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                                style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: "16px" }}>✕</button>
                            </div>
                          ) : (
                            <label style={{ display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed #c7d2fe", borderRadius: "10px", padding: "16px", cursor: "pointer", color: "var(--text-muted)", gap: "8px" }}>
                              <span style={{ fontSize: "13px", fontWeight: 600 }}>📎 Click to replace the attached PDF</span>
                              <input type="file" accept="application/pdf" ref={fileRef} onChange={e => {
                                const f = e.target.files[0];
                                if (!f) return;
                                setUploadFile(f);
                              }} style={{ display: "none" }} />
                            </label>
                          )}
                        </div>

                        <div style={{ background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)", padding: "16px 20px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "10px" }}>Additional attachments (optional)</span>

                          {selectedMat.files?.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
                              {selectedMat.files.map(f => (
                                <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", color: deleteAttachmentIds.includes(f.id) ? "var(--text-faint)" : "var(--text-muted)", background: deleteAttachmentIds.includes(f.id) ? "#fef2f2" : "var(--surface-alt)", padding: "8px 12px", borderRadius: "8px", border: `1px solid ${deleteAttachmentIds.includes(f.id) ? "#fca5a5" : "var(--border)"}`, textDecoration: deleteAttachmentIds.includes(f.id) ? "line-through" : "none" }}>
                                  <span>📄 {f.file_name}</span>
                                  <button type="button" onClick={() => setDeleteAttachmentIds(prev => prev.includes(f.id) ? prev.filter(x => x !== f.id) : [...prev, f.id])}
                                    style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "12px", color: deleteAttachmentIds.includes(f.id) ? "#22c55e" : "#ef4444" }}>
                                    {deleteAttachmentIds.includes(f.id) ? "↩ Restore" : "× Remove"}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {uploadExtraFiles.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
                              {uploadExtraFiles.map((f, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", color: "var(--text)", background: "#f8f9ff", padding: "8px 12px", borderRadius: "8px", border: "1px solid #c7d2fe" }}>
                                  <span>📎 {f.name}</span>
                                  <button type="button" onClick={() => setUploadExtraFiles(prev => prev.filter((_, idx) => idx !== i))}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: "14px" }}>✕</button>
                                </div>
                              ))}
                            </div>
                          )}

                          <input ref={extraFileRef} type="file" multiple style={{ display: "none" }}
                            onChange={e => {
                              const picked = Array.from(e.target.files);
                              setUploadExtraFiles(prev => [...prev, ...picked]);
                              e.target.value = "";
                            }} />
                          <button type="button" onClick={() => extraFileRef.current?.click()}
                            style={{ fontSize: "13px", color: "#3B37CC", background: "var(--primary-tint)", border: "1px solid #a5b4fc", borderRadius: "8px", padding: "7px 14px", cursor: "pointer", fontWeight: 600 }}>
                            + Add files
                          </button>
                        </div>

                        {uploadError && (
                          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", color: "#dc2626", fontSize: "13px" }}>
                            {uploadError}
                          </div>
                        )}

                        <div style={{ display: "flex", gap: "10px" }}>
                          <button onClick={handleUpload} disabled={uploading || !uploadForm.title.trim()}
                            style={{ background: uploading || !uploadForm.title.trim() ? "#c7d2fe" : "#3B37CC", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 20px", fontSize: "13px", fontWeight: 700, cursor: uploading || !uploadForm.title.trim() ? "not-allowed" : "pointer" }}>
                            {uploading ? "Saving..." : "Save Changes"}
                          </button>
                          <button onClick={closeUploadModal}
                            style={{ background: "var(--surface-alt)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "8px", padding: "9px 20px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                    <>
                    {selectedMat.instructions && (
                      <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "20px" }}>{selectedMat.instructions}</p>
                    )}
                    <div style={{ marginBottom: "10px", fontSize: "11px", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "1px" }}>
                      Reference Materials
                    </div>
                    {selectedMat.file_url ? (() => {
                      const fileName = selectedMat.file_name || selectedMat.title;
                      const ext = (selectedMat.file_url.split(".").pop() || "").toLowerCase();
                      const isPdf = ext === "pdf";
                      const kind = {
                        pdf: { label: "PDF" },
                        docx: { label: "Word" },
                        pptx: { label: "PowerPoint" },
                        png: { label: "Image" }, jpg: { label: "Image" },
                        jpeg: { label: "Image" }, webp: { label: "Image" }, gif: { label: "Image" },
                      }[ext] || { label: "File" };
                      const openPreview = () => navigate(`/classroom/${id}/material/${selectedMat.id}`, { state: { backgroundLocation: location } });
                      const thumbUrl = isPdf ? `http://localhost:5001${selectedMat.file_url}` : null;
                      return (
                        <div
                          onClick={openPreview}
                          role="button" tabIndex={0}
                          onKeyDown={e => e.key === "Enter" && openPreview()}
                          style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", maxWidth: "460px", cursor: "pointer", background: "var(--surface)", transition: "box-shadow 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"}
                          onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
                        >
                          <div style={{ flex: 1, padding: "14px 16px", minWidth: 0 }}>
                            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "4px" }}>{fileName}</div>
                            <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>{kind.label}</div>
                          </div>
                          <div style={{ width: "120px", flexShrink: 0, background: "var(--surface-alt)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderLeft: "1px solid var(--border)" }}>
                            {isPdf ? (
                              <object data={thumbUrl} type="application/pdf" style={{ width: "120px", height: "80px", pointerEvents: "none" }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "80px", gap: "4px" }}>
                                  <span style={{ fontSize: "28px" }}>📄</span>
                                  <span style={{ fontSize: "10px", color: "var(--text-faint)" }}>PDF</span>
                                </div>
                              </object>
                            ) : (
                              <span style={{ fontSize: "32px" }}>📄</span>
                            )}
                          </div>
                        </div>
                      );
                    })() : (
                      selectedMat.files?.length > 0 ? null : (
                        <p style={{ fontSize: "13px", color: "var(--text-faint)" }}>No file attached.</p>
                      )
                    )}

                    {selectedMat.files?.length > 0 && (
                      <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "10px" }}>
                        {selectedMat.files.map(f => (
                          <a key={f.id} href={`http://localhost:5001/uploads/${f.file_path}`} target="_blank" rel="noreferrer"
                            style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px 14px", textDecoration: "none", minWidth: "200px" }}>
                            <span style={{ fontSize: "20px" }}>📎</span>
                            <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.file_name}</div>
                          </a>
                        ))}
                      </div>
                    )}

                    {/* AI suggested YouTube resources */}
                    {selectedMat.ai_resources?.length > 0 && (
                      <div style={{ marginTop: "24px" }}>
                        <div style={{ marginBottom: "10px", fontSize: "11px", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "1px" }}>
                          🎬 Related YouTube Videos
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {selectedMat.ai_resources.map((r, i) => (
                            <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                              style={{ display: "flex", alignItems: "center", gap: "12px", background: "#f8f9ff", border: "1px solid #e0e7ff", borderRadius: "12px", overflow: "hidden", textDecoration: "none" }}>
                              {r.thumbnail ? (
                                <img src={r.thumbnail} alt={r.title}
                                  style={{ width: "120px", height: "68px", objectFit: "cover", flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: "120px", height: "68px", background: "#ff0000", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <span style={{ fontSize: "24px" }}>▶</span>
                                </div>
                              )}
                              <div style={{ flex: 1, padding: "8px 12px 8px 0" }}>
                                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.title}</div>
                                {r.channel && <div style={{ fontSize: "11px", color: "var(--text-faint)", marginTop: "4px" }}>{r.channel}</div>}
                              </div>
                              <span style={{ fontSize: "12px", color: "#ff0000", fontWeight: 700, paddingRight: "12px", flexShrink: 0 }}>▶ Watch</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    </>
                    )}

                    {/* ── Assignments for this material ── */}
                    <div style={{ marginTop: "28px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "1px" }}>✏️ Assignments</div>
                        {isTeacher && (
                          <button onClick={() => setMatAssignOpen(o => !o)}
                            style={{ fontSize: "12px", fontWeight: 700, color: "#3B37CC", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: "8px", padding: "4px 12px", cursor: "pointer" }}>
                            + Add Assignment
                          </button>
                        )}
                      </div>

                      {/* Teacher: inline create form */}
                      {isTeacher && matAssignOpen && (
                        <div style={{ background: "var(--surface)", border: "1px solid #c7d2fe", borderRadius: "12px", padding: "16px", marginBottom: "14px" }}>
                          <input placeholder="Assignment title *" value={matAssignForm.title}
                            onChange={e => setMatAssignForm(f => ({ ...f, title: e.target.value }))}
                            style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", marginBottom: "10px", boxSizing: "border-box", background: "var(--surface)", color: "var(--text)" }} />
                          <textarea placeholder="Instructions (optional)" value={matAssignForm.instructions}
                            onChange={e => setMatAssignForm(f => ({ ...f, instructions: e.target.value }))}
                            rows={2}
                            style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", marginBottom: "10px", resize: "vertical", boxSizing: "border-box", background: "var(--surface)", color: "var(--text)" }} />
                          <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: "11px", color: "var(--text-faint)", marginBottom: "4px" }}>Due date</div>
                              <input type="datetime-local" value={matAssignForm.due_date}
                                onChange={e => setMatAssignForm(f => ({ ...f, due_date: e.target.value }))}
                                style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "8px", padding: "7px 10px", fontSize: "12px", boxSizing: "border-box", background: "var(--surface)", color: "var(--text)" }} />
                            </div>
                            <div>
                              <div style={{ fontSize: "11px", color: "var(--text-faint)", marginBottom: "4px" }}>Points</div>
                              <input type="number" value={matAssignForm.points} min={0} max={1000}
                                onChange={e => setMatAssignForm(f => ({ ...f, points: e.target.value }))}
                                style={{ width: "80px", border: "1px solid var(--border)", borderRadius: "8px", padding: "7px 10px", fontSize: "12px", boxSizing: "border-box", background: "var(--surface)", color: "var(--text)" }} />
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <button onClick={() => setMatAssignOpen(false)}
                              style={{ fontSize: "12px", color: "var(--text-faint)", background: "none", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 14px", cursor: "pointer" }}>Cancel</button>
                            <button onClick={createMatAssignment} disabled={matAssignSaving || !matAssignForm.title.trim()}
                              style={{ fontSize: "12px", fontWeight: 700, color: "#fff", background: "#3B37CC", border: "none", borderRadius: "8px", padding: "6px 16px", cursor: "pointer", opacity: matAssignSaving ? 0.6 : 1 }}>
                              {matAssignSaving ? "Saving…" : "Create"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Assignment list */}
                      {matAssignments.length === 0 ? (
                        <div style={{ fontSize: "12px", color: "var(--text-faint)", padding: "10px 0" }}>
                          {isTeacher ? "No assignments yet for this lesson. Add one above." : "No assignments for this lesson yet."}
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {matAssignments.map(a => {
                            const submitted = !isTeacher && a.my_submission;
                            return (
                              <div key={a.id}
                                onClick={() => openAssignment(a)}
                                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px 16px", cursor: "pointer", transition: "box-shadow 0.15s" }}
                                onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"}
                                onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                                <div>
                                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{a.title}</div>
                                  <div style={{ fontSize: "11px", color: "var(--text-faint)", marginTop: "2px" }}>
                                    {a.due_date ? `Due ${formatDate(a.due_date)}` : "No due date"} · {a.points} pts
                                  </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                                  {isTeacher ? (
                                    <span style={{ fontSize: "11px", color: "#3B37CC", fontWeight: 600 }}>{a.turned_in_count || 0} turned in</span>
                                  ) : submitted ? (
                                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: "10px" }}>✓ Submitted</span>
                                  ) : (
                                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#ea580c", background: "#fff7ed", padding: "2px 8px", borderRadius: "10px" }}>Pending</span>
                                  )}
                                  <span style={{ fontSize: "16px", color: "var(--text-faint)" }}>›</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                ) : (
                  /* ── Material list ── */
                  <>
                    {/* Hint: select a material to use AI */}
                    {aiHint && (
                      <div style={{ background: "var(--primary-tint)", border: "2px solid #3B37CC", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "20px" }}>👆</span>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "#3B37CC" }}>Select a material below</div>
                          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Click any material to activate AI Study Mentor</div>
                        </div>
                        <button onClick={() => setAiHint(false)} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: "16px" }}>×</button>
                      </div>
                    )}

                    {materials.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "64px 0", color: "var(--text-faint)" }}>
                        {isTeacher ? 'Click "+ Material" to add your first material.' : "No materials posted yet."}
                      </div>
                    ) : (
                      Object.entries(weekGroups).sort((a, b) => Number(a[0]) - Number(b[0])).map(([week, mats]) => (
                        <div key={week}>
                          <div style={weekLabel}>📚 Week {week}</div>
                          {mats.map(mat => (
                            <div key={mat.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", marginBottom: "10px", overflow: "hidden" }}>
                              {/* Material row — click to open detail */}
                              <div
                                onClick={async () => {
                                  setSelectedMat(mat);
                                  markMatSeen(mat.id);
                                  setMatAssignments([]);
                                  loadMatAssignments(mat.id);
                                  setAiResult(null); setChatHistory([]);
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
                                        setAiResult({ error: "AI unavailable. Check GROQ_API_KEY in backend .env" });
                                      } finally {
                                        setAiLoading(false);
                                      }
                                    }
                                  }
                                }}
                                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", background: !seenMatIds.has(mat.id) ? "#fefbff" : "transparent" }}
                                onMouseEnter={e => e.currentTarget.style.background = "var(--bg)"}
                                onMouseLeave={e => e.currentTarget.style.background = !seenMatIds.has(mat.id) ? "#fefbff" : "transparent"}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                  <div style={{ position: "relative" }}>
                                    <div style={matIcon}><span>📄</span></div>
                                    {!seenMatIds.has(mat.id) && <span style={{ position: "absolute", top: "-3px", right: "-3px", width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444", border: "2px solid #fff", display: "block" }} />}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: "14px", fontWeight: !seenMatIds.has(mat.id) ? 700 : 600, color: "var(--text)", display: "flex", alignItems: "center", gap: "6px" }}>
                                      {mat.title}
                                      {!seenMatIds.has(mat.id) && <span style={{ fontSize: "10px", fontWeight: 800, color: "#ef4444", background: "#fef2f2", padding: "1px 6px", borderRadius: "10px" }}>NEW</span>}
                                    </div>
                                    <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>Posted {formatDate(mat.created_at)}</div>
                                  </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  {mat.topic && <span style={{ fontSize: "11px", background: "var(--primary-tint)", color: "#3B37CC", padding: "2px 8px", borderRadius: "10px", fontWeight: 600 }}>📂 {mat.topic}</span>}
                                  {isTeacher && (
                                    <button onClick={e => { e.stopPropagation(); setTopicModal({ type: "material", id: mat.id, current: mat.topic || "" }); setTopicInput(mat.topic || ""); }}
                                      style={{ fontSize: "11px", padding: "2px 7px", background: "var(--surface-alt)", color: "var(--text-muted)", border: "none", borderRadius: "6px", cursor: "pointer" }}>
                                      📂 Topic
                                    </button>
                                  )}
                                  <span style={{ color: "var(--text-faint)", fontSize: "12px" }}>›</span>
                                </div>
                              </div>
                              {/* YouTube resource thumbnails — compact strip */}
                              {mat.ai_resources?.length > 0 && (
                                <div style={{ borderTop: "1px solid var(--surface-alt)", padding: "10px 16px", background: "#fafbff" }}>
                                  <div style={{ fontSize: "11px", color: "var(--text-faint)", fontWeight: 700, marginBottom: "8px" }}>🎬 Related Videos</div>
                                  <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
                                    {mat.ai_resources.map((r, i) => (
                                      <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                                        onClick={e => e.stopPropagation()}
                                        style={{ display: "flex", flexDirection: "column", flexShrink: 0, width: "140px", textDecoration: "none", borderRadius: "8px", overflow: "hidden", border: "1px solid #e0e7ff" }}>
                                        {r.thumbnail ? (
                                          <img src={r.thumbnail} alt={r.title} style={{ width: "140px", height: "79px", objectFit: "cover" }} />
                                        ) : (
                                          <div style={{ width: "140px", height: "79px", background: "#ff0000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <span style={{ fontSize: "20px", color: "#fff" }}>▶</span>
                                          </div>
                                        )}
                                        <div style={{ padding: "4px 6px", background: "var(--surface)" }}>
                                          <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text)", lineHeight: "1.3", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.title}</div>
                                        </div>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
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

            {/* Right: AI Study Mentor panel — students only */}
            {selectedMat && !isTeacher && (
              <div style={aiMentorPanel}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
                  <div style={aiAvatarStyle}>🤖</div>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>AI Study Mentor</div>
                    <div style={{ fontSize: "12px", color: "#22c55e", fontWeight: 600 }}>● ACTIVE NOW</div>
                  </div>
                  <button onClick={() => setSelectedMat(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: "18px" }}>×</button>
                </div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-faint)", letterSpacing: "1px", margin: "16px 0 10px", textTransform: "uppercase" }}>
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
                    style={{ ...aiFeatureCard, border: aiModal === f.key ? "2px solid #3B37CC" : "1px solid var(--border)", background: aiModal === f.key ? "var(--primary-tint)" : "#fff" }}
                  >
                    <div style={{ fontSize: "22px", marginBottom: "6px" }}>{f.icon}</div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)", marginBottom: "4px" }}>{f.title}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5 }}>{f.desc}</div>
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
                <div style={{ textAlign: "center", padding: "60px", color: "var(--text-faint)" }}>Loading grades...</div>
              ) : !gradesData ? (
                <div style={{ textAlign: "center", padding: "60px", color: "var(--text-faint)" }}>No grade data yet.</div>
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
                    <p style={{ color: "var(--text-faint)", textAlign: "center", padding: "24px" }}>No assignments yet.</p>
                  ) : gradesData.rows.map(row => {
                    const pct = row.grade !== null ? Math.round((row.grade / row.points) * 100) : null;
                    const color = row.status === "graded" ? (pct >= 75 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444") : row.status === "turned_in" || row.status === "late" ? "#3B37CC" : "var(--text-faint)";
                    return (
                      <div key={row.assignment_id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 20px", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                            {row.status === "graded" ? "✅" : row.status === "turned_in" ? "📤" : row.status === "late" ? "⏰" : "📝"}
                          </div>
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>{row.title}</div>
                            <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>
                              {row.due_date ? `Due ${formatDate(row.due_date)}` : "No due date"}
                              {row.grade_comment && ` • "${row.grade_comment}"`}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {row.grade !== null ? (
                            <>
                              <div style={{ fontSize: "18px", fontWeight: 800, color }}>{row.grade}<span style={{ fontSize: "13px", color: "var(--text-faint)", fontWeight: 400 }}>/{row.points}</span></div>
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
                    <p style={{ color: "var(--text-faint)", textAlign: "center", padding: "32px" }}>No students enrolled yet.</p>
                  ) : (
                    <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface)" }}>
                      <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%", minWidth: `${200 + gradesData.rows.length * 100}px` }}>
                        <thead>
                          <tr style={{ background: "var(--bg)" }}>
                            {/* Sticky assignment column */}
                            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", borderRight: "2px solid var(--border)", width: "200px", position: "sticky", left: 0, background: "var(--bg)", zIndex: 2 }}>
                              Assignment
                            </th>
                            {gradesData.rows.map(row => (
                              <th key={row.student_id} style={{ padding: "10px 8px", textAlign: "center", fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", minWidth: "90px" }}>
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
                              <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--surface-alt)", borderRight: "2px solid var(--border)", position: "sticky", left: 0, background: i % 2 === 0 ? "#fff" : "#fafafa", zIndex: 1 }}>
                                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", marginBottom: "2px" }}>{a.title}</div>
                                <div style={{ fontSize: "11px", color: "var(--text-faint)" }}>{a.points} pts{a.due_date ? ` · Due ${new Date(a.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</div>
                              </td>
                              {gradesData.rows.map(row => {
                                const g = row.grades.find(g => g.assignment_id === a.id);
                                const pct = g?.grade !== null && g?.grade !== undefined ? Math.round((g.grade / a.points) * 100) : null;
                                const bg = !g || g.grade === null ? "transparent" : pct >= 75 ? "#f0fdf4" : pct >= 50 ? "#fefce8" : "#fef2f2";
                                const col = !g || g.grade === null ? "var(--border)" : pct >= 75 ? "#15803d" : pct >= 50 ? "#92400e" : "#dc2626";
                                return (
                                  <td key={row.student_id} style={{ padding: "12px 8px", textAlign: "center", borderBottom: "1px solid var(--surface-alt)", background: bg }}>
                                    {g?.grade !== null && g?.grade !== undefined ? (
                                      <div>
                                        <div style={{ fontSize: "14px", fontWeight: 700, color: col }}>{g.grade}<span style={{ fontSize: "10px", color: col, opacity: 0.6 }}>/{a.points}</span></div>
                                        <div style={{ fontSize: "10px", color: col, opacity: 0.8 }}>{pct}%</div>
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: "15px", color: g?.status === "turned_in" || g?.status === "late" ? "#3B37CC" : "var(--border)" }}>
                                        {g?.status === "turned_in" ? "✓" : g?.status === "late" ? "⏰" : "—"}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                          {/* Overall row */}
                          <tr style={{ background: "var(--primary-tint)", borderTop: "2px solid #a5b4fc" }}>
                            <td style={{ padding: "12px 16px", borderRight: "2px solid var(--border)", position: "sticky", left: 0, background: "var(--primary-tint)", zIndex: 1 }}>
                              <span style={{ fontSize: "13px", fontWeight: 700, color: "#3B37CC" }}>Overall</span>
                            </td>
                            {gradesData.rows.map(row => (
                              <td key={row.student_id} style={{ padding: "12px 8px", textAlign: "center" }}>
                                {row.percentage !== null ? (
                                  <span style={{ fontSize: "14px", fontWeight: 800, color: row.percentage >= 75 ? "#15803d" : row.percentage >= 50 ? "#92400e" : "#dc2626" }}>
                                    {row.percentage}%
                                  </span>
                                ) : <span style={{ color: "var(--border)" }}>—</span>}
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
                    <a href={activeMeeting.room_url} target="_blank" rel="noopener noreferrer" style={{ background: "var(--surface)", color: "#3B37CC", border: "none", borderRadius: "8px", padding: "8px 18px", fontWeight: 700, fontSize: "13px", cursor: "pointer", textDecoration: "none" }}>
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
                <div style={{ background: "var(--bg)", borderRadius: "12px", padding: "16px 20px", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px dashed var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "20px" }}>📹</span>
                    <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>{lang === "en" ? "No active meeting" : "လက်ရှိ Meeting မရှိသေးပါ"}</span>
                  </div>
                  <button onClick={startMeeting} disabled={meetingLoading} style={{ background: "#3B37CC", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 18px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                    {meetingLoading ? "..." : lang === "en" ? "▶ Start Meeting" : "▶ Meeting စတင်မည်"}
                  </button>
                </div>
              )}

              {/* Attendance section */}
              {attendanceLoading ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text-faint)" }}>Loading...</div>
              ) : isTeacher ? (
                (() => {
                  const sessionByDate = {};
                  (attendanceSessions || []).forEach(s => {
                    const d = s.session_date?.slice(0, 10);
                    if (d) sessionByDate[d] = s;
                  });
                  const firstDay = new Date(calYear, calMonth, 1).getDay();
                  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                  const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
                  const todayStr = today.toISOString().slice(0, 10);
                  const selectedSession = calSelectedDate ? sessionByDate[calSelectedDate] : null;
                  const totalSessions = (attendanceSessions || []).length;
                  const totalPresent = (attendanceSessions || []).reduce((a, s) => a + (Number(s.present) || 0), 0);
                  const totalStudents = (attendanceSessions || []).reduce((a, s) => a + (Number(s.total) || 0), 0);
                  const avgRate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : null;
                  const pendingCount = (attendanceSessions || []).filter(s => !s.total || Number(s.total) === 0).length;
                  return (
                    <div>
                      {/* Stats row */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px", marginBottom: "24px" }}>
                        {[
                          { num: totalSessions, lbl: lang === "en" ? "Total Sessions" : "စုစုပေါင်း Session" },
                          { num: avgRate !== null ? avgRate + "%" : "—", lbl: lang === "en" ? "Avg Attendance" : "ပျမ်းမျှ တက်ရောက်မှု", color: avgRate !== null ? (avgRate >= 75 ? "#0F9D6E" : "#E1483F") : undefined },
                          { num: pendingCount, lbl: lang === "en" ? "Pending" : "မမှတ်ရသေးသော", color: pendingCount > 0 ? "#D97706" : undefined },
                        ].map(({ num, lbl, color }) => (
                          <div key={lbl} style={{ background: "#EEF0FF", borderRadius: "16px", padding: "16px 18px" }}>
                            <div style={{ fontSize: "22px", fontWeight: 700, color: color || "var(--text)" }}>{num}</div>
                            <div style={{ fontSize: "12px", color: "#6B6B85", marginTop: "2px" }}>{lbl}</div>
                          </div>
                        ))}
                      </div>

                      {/* Attendance — Calendar + Right Panel */}
                      <div style={{ display: "grid", gridTemplateColumns: "210px 1fr", gap: "16px", alignItems: "start" }}>

                        {/* Left: Mini calendar */}
                        <div style={{ background: "var(--surface)", borderRadius: "16px", border: "1px solid var(--border)", padding: "14px 16px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                            <button onClick={() => { const d = new Date(calYear, calMonth - 1, 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }}
                              style={{ width: "22px", height: "22px", borderRadius: "6px", border: "none", background: "rgba(11,11,30,0.05)", color: "#6B6B85", cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
                            <span style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--text)" }}>{monthLabel}</span>
                            <button onClick={() => { const d = new Date(calYear, calMonth + 1, 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }}
                              style={{ width: "22px", height: "22px", borderRadius: "6px", border: "none", background: "rgba(11,11,30,0.05)", color: "#6B6B85", cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: "3px" }}>
                            {["S","M","T","W","T","F","S"].map((d, i) => (
                              <div key={i} style={{ textAlign: "center", fontSize: "8.5px", color: "#A6A6BF", fontWeight: 600, padding: "1px 0" }}>{d}</div>
                            ))}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "3px" }}>
                            {Array.from({ length: firstDay }).map((_, i) => <div key={"e" + i} />)}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                              const day = i + 1;
                              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                              const session = sessionByDate[dateStr];
                              const isSelected = calSelectedDate === dateStr;
                              const isToday = dateStr === todayStr;
                              const isWeekend = [0, 6].includes(new Date(calYear, calMonth, day).getDay());
                              const hasSavedRecords = session && Number(session.total) > 0;
                              const cellBg = isSelected ? "#3B37CC"
                                : session ? (hasSavedRecords ? "#22c55e" : "#f59e0b")
                                : isToday ? "#EEF0FF" : "transparent";
                              const cellColor = isSelected ? "#fff"
                                : session ? "#fff"
                                : isWeekend ? "#A6A6BF" : "var(--text)";
                              return (
                                <div key={day} onClick={() => {
                                  setCalSelectedDate(dateStr);
                                  if (!session) {
                                    setNewSessionTitle(classInfo?.name ? `${classInfo.name} — ${new Date(dateStr + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : dateStr);
                                  }
                                }} style={{ aspectRatio: "1", borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: session ? 700 : 400, cursor: "pointer", background: cellBg, color: cellColor }}>
                                  {day}
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ display: "flex", gap: "10px", marginTop: "12px", fontSize: "9.5px", color: "#6B6B85", flexWrap: "wrap" }}>
                            {[["#22c55e", lang === "en" ? "Taken" : "မှတ်ပြီး"], ["#f59e0b", lang === "en" ? "Pending" : "မမှတ်ရသေး"]].map(([c, label]) => (
                              <span key={label} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: c, display: "inline-block" }} />{label}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Right: All sessions list */}
                        <div style={{ background: "var(--surface)", borderRadius: "18px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", minHeight: "280px", maxHeight: "520px" }}>

                          {/* Create strip — shown when a blank date is selected */}
                          {calSelectedDate && !selectedSession && (
                            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "8px" }}>
                                {new Date(calSelectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
                                <span style={{ fontSize: "11px", fontWeight: 400, color: "#A6A6BF", marginLeft: "8px" }}>
                                  {lang === "en" ? "· No session yet" : "· Session မရှိသေး"}
                                </span>
                              </div>
                              <div style={{ display: "flex", gap: "8px" }}>
                                <input value={newSessionTitle} onChange={e => setNewSessionTitle(e.target.value)}
                                  placeholder={lang === "en" ? "Session title…" : "Session ခေါင်းစဉ်…"}
                                  onKeyDown={async e => {
                                    if (e.key === "Enter" && newSessionTitle.trim()) {
                                      try {
                                        const { data } = await API.post(`/classroom/classes/${id}/attendance`, { title: newSessionTitle.trim(), session_date: calSelectedDate });
                                        setAttendanceSessions(prev => [data, ...(prev || [])]);
                                        setNewSessionTitle("");
                                      } catch (err) { console.error(err); }
                                    }
                                  }}
                                  style={{ flex: 1, padding: "9px 13px", borderRadius: "10px", border: "1.5px solid var(--border)", fontSize: "13px", color: "var(--text)", background: "var(--bg)", outline: "none", boxSizing: "border-box" }} />
                                <button onClick={async () => {
                                  if (!newSessionTitle.trim()) return;
                                  try {
                                    const { data } = await API.post(`/classroom/classes/${id}/attendance`, { title: newSessionTitle.trim(), session_date: calSelectedDate });
                                    setAttendanceSessions(prev => [data, ...(prev || [])]);
                                    setNewSessionTitle("");
                                  } catch (err) { console.error(err); }
                                }} style={{ padding: "9px 18px", borderRadius: "10px", border: "none", background: "#0B0B1E", color: "#fff", fontWeight: 700, fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap" }}>
                                  {lang === "en" ? "+ Create" : "+ ဖန်တီး"}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Header row */}
                          <div style={{ padding: "14px 18px 8px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#6B6B85", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                              {lang === "en" ? "All Sessions" : "Session အားလုံး"}
                            </span>
                            <span style={{ fontSize: "11px", color: "#A6A6BF" }}>{(attendanceSessions || []).length}</span>
                          </div>

                          {/* Scrollable list — grouped by week */}
                          <div style={{ flex: 1, overflowY: "auto", padding: "2px 10px 12px" }} onClick={() => setSessionMenuOpen(null)}>
                            {(attendanceSessions || []).length === 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "180px", color: "#A6A6BF" }}>
                                <div style={{ fontSize: "26px", marginBottom: "8px" }}>📋</div>
                                <div style={{ fontSize: "13px", fontWeight: 600 }}>{lang === "en" ? "No sessions yet" : "Session မရှိသေးပါ"}</div>
                                <div style={{ fontSize: "11px", marginTop: "4px" }}>{lang === "en" ? "Pick a date on the calendar to create one" : "Calendar မှ နေ့ရက် ရွေး ဖန်တီးပါ"}</div>
                              </div>
                            ) : (() => {
                              // Group sessions by ISO week (Mon–Sun)
                              const sorted = [...(attendanceSessions || [])].sort((a, b) => new Date(b.session_date) - new Date(a.session_date));
                              const weeks = {};
                              sorted.forEach(s => {
                                const d = new Date((s.session_date || "").slice(0, 10) + "T00:00:00");
                                const dow = d.getDay() === 0 ? 7 : d.getDay();
                                const mon = new Date(d); mon.setDate(d.getDate() - dow + 1);
                                const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
                                const wk = mon.toISOString().slice(0, 10);
                                if (!weeks[wk]) weeks[wk] = { mon, sun, sessions: [] };
                                weeks[wk].sessions.push(s);
                              });
                              return Object.entries(weeks).sort(([a], [b]) => b.localeCompare(a)).map(([wk, { mon, sun, sessions: wSessions }], wi) => {
                                const fmt = d => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                                return (
                                  <div key={wk} style={{ marginBottom: "6px" }}>
                                    {/* Week section header */}
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px 4px" }}>
                                      <span style={{ fontSize: "10px", fontWeight: 700, color: "#A6A6BF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                        {fmt(mon)} – {fmt(sun)}
                                      </span>
                                      <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
                                      <span style={{ fontSize: "10px", color: "#A6A6BF" }}>{wSessions.length}</span>
                                    </div>

                                    {wSessions.map(s => {
                                      const isHighlighted = calSelectedDate && s.session_date?.slice(0, 10) === calSelectedDate;
                                      const isRenaming = renamingSessionId === s.id;
                                      const menuOpen = sessionMenuOpen === s.id;
                                      return (
                                        <div key={s.id} style={{ position: "relative" }}>
                                          {isRenaming ? (
                                            /* Inline rename row */
                                            <div style={{ display: "flex", gap: "6px", padding: "8px 10px", borderRadius: "12px", background: "#EEF0FF", border: "1px solid rgba(91,95,233,0.2)", marginBottom: "2px" }}>
                                              <input autoFocus value={renamingTitle} onChange={e => setRenamingTitle(e.target.value)}
                                                onKeyDown={async e => {
                                                  if (e.key === "Enter") {
                                                    if (renamingTitle.trim()) {
                                                      try { await API.patch(`/classroom/attendance/${s.id}`, { title: renamingTitle.trim() }); setAttendanceSessions(prev => prev.map(x => x.id === s.id ? { ...x, title: renamingTitle.trim() } : x)); } catch {}
                                                    }
                                                    setRenamingSessionId(null);
                                                  }
                                                  if (e.key === "Escape") setRenamingSessionId(null);
                                                }}
                                                style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: "13px", fontWeight: 600, color: "var(--text)" }} />
                                              <button onClick={async () => {
                                                if (renamingTitle.trim()) {
                                                  try { await API.patch(`/classroom/attendance/${s.id}`, { title: renamingTitle.trim() }); setAttendanceSessions(prev => prev.map(x => x.id === s.id ? { ...x, title: renamingTitle.trim() } : x)); } catch {}
                                                }
                                                setRenamingSessionId(null);
                                              }} style={{ fontSize: "11px", fontWeight: 700, color: "#5B5FE9", background: "transparent", border: "none", cursor: "pointer", padding: "0 4px" }}>
                                                {lang === "en" ? "Save" : "သိမ်း"}
                                              </button>
                                              <button onClick={() => setRenamingSessionId(null)} style={{ fontSize: "11px", color: "#A6A6BF", background: "transparent", border: "none", cursor: "pointer", padding: "0 2px" }}>✕</button>
                                            </div>
                                          ) : (
                                            <div onClick={() => openAttendanceSession(s.id, Number(s.total) > 0)}
                                              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 10px", borderRadius: "12px", cursor: "pointer", transition: "background 0.12s", marginBottom: "2px",
                                                background: isHighlighted ? "#EEF0FF" : "transparent",
                                                border: isHighlighted ? "1px solid rgba(91,95,233,0.18)" : "1px solid transparent" }}
                                              onMouseEnter={e => { if (!isHighlighted) e.currentTarget.style.background = "#F7F7FC"; }}
                                              onMouseLeave={e => { e.currentTarget.style.background = isHighlighted ? "#EEF0FF" : "transparent"; }}>
                                              <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{ fontSize: "10.5px", color: isHighlighted ? "#5B5FE9" : "#A6A6BF", marginBottom: "2px", fontWeight: isHighlighted ? 700 : 400 }}>
                                                  {s.session_date ? new Date(s.session_date.slice(0, 10) + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : ""}
                                                </div>
                                                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</div>
                                                <div style={{ fontSize: "11px", color: "#6B6B85", marginTop: "1px" }}>
                                                  {Number(s.total) > 0 ? `${s.present || 0} present · ${s.late || 0} late · ${s.absent || 0} absent` : (lang === "en" ? "Not yet marked" : "မှတ်မရသေး")}
                                                </div>
                                              </div>
                                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, marginLeft: "8px" }}>
                                                <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px",
                                                  background: Number(s.total) > 0 ? "#E6F7EF" : "#FFF3E0",
                                                  color: Number(s.total) > 0 ? "#0F9D6E" : "#D97706" }}>
                                                  {Number(s.total) > 0 ? (lang === "en" ? "Taken ✓" : "မှတ်ပြီး") : (lang === "en" ? "Pending" : "မမှတ်ရသေး")}
                                                </span>
                                                {/* ⋮ menu button */}
                                                <button onClick={e => { e.stopPropagation(); setSessionMenuOpen(menuOpen ? null : s.id); }}
                                                  style={{ width: "24px", height: "24px", borderRadius: "6px", border: "none", background: menuOpen ? "rgba(11,11,30,0.08)" : "transparent", color: "#A6A6BF", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                  ⋮
                                                </button>
                                              </div>
                                            </div>
                                          )}

                                          {/* Dropdown menu */}
                                          {menuOpen && !isRenaming && (
                                            <div onClick={e => e.stopPropagation()}
                                              style={{ position: "absolute", right: "8px", top: "100%", zIndex: 50, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", boxShadow: "0 8px 24px rgba(11,11,30,0.12)", minWidth: "140px", overflow: "hidden" }}>
                                              <button onClick={() => { setRenamingSessionId(s.id); setRenamingTitle(s.title); setSessionMenuOpen(null); }}
                                                style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 14px", border: "none", background: "transparent", color: "var(--text)", fontSize: "13px", fontWeight: 600, cursor: "pointer", textAlign: "left" }}
                                                onMouseEnter={e => e.currentTarget.style.background = "var(--bg)"}
                                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                                ✏️ {lang === "en" ? "Rename" : "ခေါင်းစဉ်ပြင်"}
                                              </button>
                                              <div style={{ height: "1px", background: "var(--border)", margin: "0 10px" }} />
                                              <button onClick={async () => {
                                                setSessionMenuOpen(null);
                                                await deleteAttendanceSession(s.id);
                                                if (calSelectedDate === s.session_date?.slice(0, 10)) setCalSelectedDate(null);
                                              }}
                                                style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 14px", border: "none", background: "transparent", color: "#E1483F", fontSize: "13px", fontWeight: 600, cursor: "pointer", textAlign: "left" }}
                                                onMouseEnter={e => e.currentTarget.style.background = "#FFF0F0"}
                                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                                🗑 {lang === "en" ? "Delete" : "ဖျက်မည်"}
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* Student view */
                <div>
                  {myAttendance && (() => {
                    const dateMap = {};
                    myAttendance.rows.forEach(r => {
                      const d = r.session_date ? r.session_date.slice(0, 10) : null;
                      if (d && !dateMap[d]) dateMap[d] = r.status;
                    });
                    const firstDay = new Date(calStudentYear, calStudentMonth, 1).getDay();
                    const daysInMonth = new Date(calStudentYear, calStudentMonth + 1, 0).getDate();
                    const monthName = new Date(calStudentYear, calStudentMonth, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
                    const dayRows = calStudentSelDate ? myAttendance.rows.filter(r => r.session_date && r.session_date.slice(0, 10) === calStudentSelDate) : [];
                    const recent = myAttendance.rows.slice(0, 6);
                    const rate = myAttendance.rate ?? 0;
                    const r34 = 34, circ = 2 * Math.PI * r34;
                    const filled = (rate / 100) * circ;
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const statusLabel = s => s === "present" ? (lang === "en" ? "Present" : "တက်ရောက်") : s === "late" ? (lang === "en" ? "Late" : "နောက်ကျ") : s === "absent" ? (lang === "en" ? "Absent" : "မတက်") : "—";
                    const statusColor = s => s === "present" ? "#16a34a" : s === "late" ? "#d97706" : s === "absent" ? "#dc2626" : "var(--text-faint)";
                    const statusBg = s => s === "present" ? "#dcfce7" : s === "late" ? "#fff3e0" : "#fee2e2";
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                        {/* Warning banner — only when < 85% */}
                        {myAttendance.rate !== null && myAttendance.rate < 85 && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "14px", padding: "14px 18px" }}>
                            <div>
                              <div style={{ fontSize: "13px", fontWeight: 700, color: "#dc2626" }}>⚠ {lang === "en" ? "Attendance below requirement" : "တက်ရောက်မှုနှုန်း လိုအပ်ချက်အောက်"}</div>
                              <div style={{ fontSize: "11px", color: "#991b1b", marginTop: "3px" }}>{lang === "en" ? `Your attendance is at ${rate}%, below the 85% minimum.` : `တက်ရောက်မှုနှုန်း ${rate}% ဖြစ်ပြီး 85% လိုအပ်ချက်အောက်ဖြစ်နေသည်။`}</div>
                            </div>
                            <button style={{ background: "#dc2626", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "9px", fontSize: "11.5px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", marginLeft: "14px" }}>
                              {lang === "en" ? "View details" : "အသေးစိတ်"}
                            </button>
                          </div>
                        )}

                        {/* Entry card */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#EEF0FF", borderRadius: "14px", padding: "16px 20px" }}>
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>{lang === "en" ? "Can't make it to class?" : "ကျောင်းမတက်နိုင်ဘူးလား?"}</div>
                            <div style={{ fontSize: "11.5px", color: "var(--text-faint)", marginTop: "2px" }}>{lang === "en" ? "Let your teacher know in advance and avoid an unexplained absence" : "ကြိုတင် အကြောင်းကြားပြီး ရှင်းမပြသော ပျက်ကွက်ကို ရှောင်ပါ"}</div>
                          </div>
                          <button onClick={() => { setLeaveModal("form"); setLeaveForm({ from: new Date().toISOString().slice(0,10), to: new Date().toISOString().slice(0,10), reasonType: "medical", details: "" }); }}
                            style={{ background: "#0F172A", color: "#fff", border: "none", borderRadius: "9px", padding: "10px 18px", fontSize: "12px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", marginLeft: "16px" }}>
                            {lang === "en" ? "Request leave" : "ကြိုတင်တောင်းဆိုမည်"}
                          </button>
                        </div>

                        {/* Ring card + Stat strip */}
                        <div style={{ display: "flex", gap: "14px" }}>
                          {/* Ring */}
                          <div style={{ width: "200px", flexShrink: 0, background: "linear-gradient(150deg,#4F46E5,#818CF8)", borderRadius: "16px", padding: "18px 16px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "8px" }}>
                            <svg width="80" height="80" viewBox="0 0 76 76">
                              <circle cx="38" cy="38" r={r34} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="8"/>
                              <circle cx="38" cy="38" r={r34} fill="none" stroke="#fff" strokeWidth="8"
                                strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" transform="rotate(-90 38 38)"/>
                              <text x="38" y="35" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="800" fontFamily="Inter,sans-serif">{myAttendance.rate !== null ? `${rate}%` : "—"}</text>
                              <text x="38" y="47" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="7" fontFamily="Inter,sans-serif">OVERALL</text>
                            </svg>
                            <div style={{ fontSize: "11px", fontWeight: 600, color: "#fff" }}>
                              {myAttendance.rate === null ? "—" : rate >= 85 ? (lang === "en" ? "Above 85% requirement" : "85% လိုအပ်ချက် ပြည့်") : (lang === "en" ? "Below requirement" : "လိုအပ်ချက်အောက်")}
                            </div>
                          </div>
                          {/* Stat strip */}
                          <div style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", display: "flex", alignItems: "center" }}>
                            {[
                              { dot: "#16a34a", value: myAttendance.present, label: lang === "en" ? "Present days" : "တက်ရောက်" },
                              { dot: "#d97706", value: myAttendance.late,    label: lang === "en" ? "Late days"    : "နောက်ကျ"   },
                              { dot: "#dc2626", value: myAttendance.absent,  label: lang === "en" ? "Absent days"  : "မတက်"      },
                            ].map((s, i) => (
                              <div key={i} style={{ flex: 1, padding: "18px 20px", display: "flex", alignItems: "center", gap: "12px", borderLeft: i > 0 ? "1px solid var(--border)" : "none" }}>
                                <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
                                <div>
                                  <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{s.value}</div>
                                  <div style={{ fontSize: "10.5px", color: "var(--text-faint)", marginTop: "3px" }}>{s.label}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Calendar + History */}
                        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "14px" }}>
                          {/* Calendar card */}
                          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "18px 20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                              <span onClick={() => { if (calStudentMonth === 0) { setCalStudentYear(y => y - 1); setCalStudentMonth(11); } else setCalStudentMonth(m => m - 1); }} style={{ cursor: "pointer", color: "var(--text-faint)", fontSize: "16px", padding: "4px 8px", userSelect: "none" }}>‹</span>
                              <span style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--text)" }}>{monthName}</span>
                              <span onClick={() => { if (calStudentMonth === 11) { setCalStudentYear(y => y + 1); setCalStudentMonth(0); } else setCalStudentMonth(m => m + 1); }} style={{ cursor: "pointer", color: "var(--text-faint)", fontSize: "16px", padding: "4px 8px", userSelect: "none" }}>›</span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 36px)", justifyContent: "center", marginBottom: "6px" }}>
                              {["S","M","T","W","T","F","S"].map((d, i) => <span key={i} style={{ fontSize: "10.5px", color: "var(--text-faint)", textAlign: "center" }}>{d}</span>)}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 36px)", gap: "4px", justifyContent: "center" }}>
                              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} style={{ width: "36px", height: "36px" }} />)}
                              {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1;
                                const ds = `${calStudentYear}-${String(calStudentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                                const st = dateMap[ds];
                                const isSel = calStudentSelDate === ds;
                                const isToday = ds === todayStr;
                                return (
                                  <div key={day} onClick={() => st ? setCalStudentSelDate(isSel ? null : ds) : null} style={{
                                    width: "36px", height: "36px", borderRadius: "8px", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center",
                                    cursor: st ? "pointer" : "default", fontWeight: st ? 700 : 500,
                                    background: isSel ? "#4F46E5" : st === "present" ? "#22c55e" : st === "late" ? "#f59e0b" : st === "absent" ? "#ef4444" : isToday ? "#EEF0FF" : "#F8F9FB",
                                    color: (isSel || st) ? "#fff" : isToday ? "#4F46E5" : "var(--text)",
                                    border: isToday && !st && !isSel ? "1.5px solid #4F46E5" : "none",
                                  }}>{day}</div>
                                );
                              })}
                            </div>
                            <div style={{ display: "flex", gap: "16px", marginTop: "14px" }}>
                              {[["#22c55e", lang === "en" ? "Present" : "တက်ရောက်"], ["#f59e0b", lang === "en" ? "Late" : "နောက်ကျ"], ["#ef4444", lang === "en" ? "Absent" : "မတက်"]].map(([c, l], i) => (
                                <span key={i} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--text)", fontWeight: 500 }}>
                                  <span style={{ width: "13px", height: "13px", borderRadius: "4px", background: c, flexShrink: 0 }} />{l}
                                </span>
                              ))}
                            </div>
                            {/* Day detail popover — inside the calendar card */}
                            {calStudentSelDate && dayRows.length > 0 && (
                              <div style={{ marginTop: "14px", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px 14px", background: "var(--bg)" }}>
                                <div style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--text)", marginBottom: "6px" }}>
                                  {new Date(calStudentSelDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                                </div>
                                {dayRows.map((r, i) => (
                                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11.5px", padding: "5px 0", borderBottom: i < dayRows.length - 1 ? "1px solid var(--border)" : "none" }}>
                                    <span style={{ color: "var(--text)", fontWeight: 500 }}>{r.title}</span>
                                    <span style={{ fontSize: "9.5px", fontWeight: 700, padding: "2px 9px", borderRadius: "999px", background: statusBg(r.status), color: statusColor(r.status) }}>{statusLabel(r.status)}</span>
                                  </div>
                                ))}
                                <button onClick={() => { const r = dayRows[0]; setDisputeModal({ title: r.title, session_date: calStudentSelDate, status: r.status }); setDisputeForm({ requested: "present", reason: "" }); }}
                                  style={{ marginTop: "8px", background: "none", border: "none", padding: 0, fontSize: "10.5px", fontWeight: 600, color: "#4F46E5", cursor: "pointer" }}>
                                  {lang === "en" ? "This looks wrong? Request a review →" : "မမှန်ဘူးလား? ပြင်ဆင်တောင်းဆိုမည် →"}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Recent history card */}
                          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "18px 20px" }}>
                            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--text)", marginBottom: "4px" }}>{lang === "en" ? "Recent history" : "မကြာမီ မှတ်တမ်းများ"}</div>
                            {recent.length === 0 && <div style={{ textAlign: "center", padding: "24px 0", fontSize: "11.5px", color: "var(--text-faint)" }}>{lang === "en" ? "No sessions yet" : "session မရှိသေးပါ"}</div>}
                            {recent.map((r, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderBottom: i < recent.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer" }}
                                onClick={() => { setDisputeModal({ title: r.title, session_date: r.session_date ? r.session_date.slice(0,10) : "", status: r.status }); setDisputeForm({ requested: "present", reason: "" }); }}>
                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: statusColor(r.status), flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                  <span style={{ fontSize: "12.5px", color: "var(--text)", fontWeight: 600 }}>{statusLabel(r.status)}</span>
                                  <span style={{ fontSize: "12.5px", color: "var(--text)" }}> — {r.title}</span>
                                </div>
                                <div style={{ fontSize: "10px", color: "var(--text-faint)", display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                                  {r.session_date && new Date(r.session_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  <span style={{ color: "#4F46E5", fontWeight: 600 }}>Review</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* ── Dispute modal ── */}
                        {disputeModal && (
                          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
                            <div style={{ background: "var(--surface)", borderRadius: "16px", width: "400px", overflow: "hidden", boxShadow: "0 24px 60px rgba(15,23,42,0.2)" }}>
                              <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border)" }}>
                                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{lang === "en" ? "Request a review" : "ပြင်ဆင်တောင်းဆိုမည်"}</div>
                                <div style={{ fontSize: "11px", color: "var(--text-faint)", marginTop: "3px" }}>{disputeModal.title}{disputeModal.session_date && ` — ${new Date(disputeModal.session_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}`}</div>
                              </div>
                              <div style={{ padding: "16px 20px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fef2f2", borderRadius: "9px", padding: "9px 13px", marginBottom: "14px" }}>
                                  <span style={{ fontSize: "11px", color: "var(--text-faint)" }}>{lang === "en" ? "Currently marked as" : "လက်ရှိ မှတ်တမ်း"}</span>
                                  <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 10px", borderRadius: "999px", background: statusBg(disputeModal.status), color: statusColor(disputeModal.status) }}>{statusLabel(disputeModal.status)}</span>
                                </div>
                                <label style={{ fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "6px", color: "var(--text-muted)" }}>{lang === "en" ? "What should this be?" : "မည်သို့ ဖြစ်သင့်သနည်း?"}</label>
                                <select value={disputeForm.requested} onChange={e => setDisputeForm(p => ({ ...p, requested: e.target.value }))}
                                  style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "9px", padding: "9px 12px", fontSize: "12px", fontFamily: "inherit", color: "var(--text)", background: "var(--surface)", marginBottom: "12px" }}>
                                  <option value="present">{lang === "en" ? "Present" : "တက်ရောက်"}</option>
                                  <option value="excused">{lang === "en" ? "Excused absence" : "ခွင့်ရ မတက်ရောက်"}</option>
                                </select>
                                <label style={{ fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "6px", color: "var(--text-muted)" }}>{lang === "en" ? "Explain (visible to teacher)" : "ရှင်းပြမည် (ဆရာမြင်သည်)"}</label>
                                <textarea value={disputeForm.reason} onChange={e => setDisputeForm(p => ({ ...p, reason: e.target.value }))}
                                  placeholder={lang === "en" ? "e.g. I was on time, roll call may have missed me" : "ဥပမာ — ကျွန်တော်/ကျွန်မ အချိန်မီ တက်ခဲ့သည်"}
                                  style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "9px", padding: "9px 12px", fontSize: "12px", fontFamily: "inherit", color: "var(--text)", background: "var(--surface)", height: "60px", resize: "none", boxSizing: "border-box" }} />
                              </div>
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "14px 20px", borderTop: "1px solid var(--border)" }}>
                                <button onClick={() => setDisputeModal(null)} style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "9px", padding: "9px 16px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>{lang === "en" ? "Cancel" : "မလုပ်တော့"}</button>
                                <button onClick={() => setDisputeModal(null)} style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: "9px", padding: "9px 16px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>{lang === "en" ? "Send request" : "တောင်းဆိုမည်"}</button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ── My leave requests history ── */}
                        {leaveHistory.length > 0 && (
                          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "18px 20px" }}>
                            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--text)", marginBottom: "4px" }}>{lang === "en" ? "My leave requests" : "ကျွန်တော်/ကျွန်မ ကြိုတင်တောင်းဆိုချက်များ"}</div>
                            {leaveHistory.map((req, i) => {
                              const icons = { medical: "🩺", family: "👪", travel: "✈️", other: "📝" };
                              const reasonLabels = { medical: lang === "en" ? "Medical" : "ကျန်းမာရေး", family: lang === "en" ? "Family event" : "မိသားစု", travel: lang === "en" ? "Travel" : "ခရီးသွား", other: lang === "en" ? "Other" : "အခြား" };
                              return (
                                <div key={i} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "13px 0", borderBottom: i < leaveHistory.length - 1 ? "1px solid var(--border)" : "none" }}>
                                  <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#EEF0FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>{icons[req.reasonType] || "📝"}</div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text)" }}>{reasonLabels[req.reasonType]} — {classInfo?.name || ""}</div>
                                    <div style={{ fontSize: "11px", color: "var(--text-faint)", marginTop: "1px" }}>{req.from === req.to ? new Date(req.from + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : `${new Date(req.from + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(req.to + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}</div>
                                  </div>
                                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                                    <span style={{ fontSize: "10px", fontWeight: 700, padding: "4px 10px", borderRadius: "999px", background: "#fff3e0", color: "#b45309" }}>{lang === "en" ? "Pending" : "စောင့်ဆိုင်း"}</span>
                                    <div style={{ fontSize: "10px", color: "var(--text-faint)", marginTop: "3px" }}>{lang === "en" ? "Sent today" : "ယနေ့ပေးပို့"}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* ── Leave request modal (form) ── */}
                        {leaveModal === "form" && (
                          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
                            <div style={{ background: "var(--surface)", borderRadius: "16px", width: "420px", overflow: "hidden", boxShadow: "0 24px 60px rgba(15,23,42,0.2)" }}>
                              <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border)" }}>
                                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{lang === "en" ? "Request leave" : "ကြိုတင်တောင်းဆိုမည်"}</div>
                                <div style={{ fontSize: "11px", color: "var(--text-faint)", marginTop: "3px" }}>{lang === "en" ? "Let your teacher know in advance" : "ဆရာ/ဆရာမကို ကြိုတင် အကြောင်းကြားပါ"}</div>
                              </div>
                              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                  <div>
                                    <label style={{ fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "5px", color: "var(--text-muted)" }}>{lang === "en" ? "From" : "မှ"}</label>
                                    <input type="date" value={leaveForm.from} onChange={e => setLeaveForm(p => ({ ...p, from: e.target.value, to: e.target.value > p.to ? e.target.value : p.to }))}
                                      style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "9px", padding: "9px 10px", fontSize: "12px", fontFamily: "inherit", color: "var(--text)", background: "var(--surface)", boxSizing: "border-box" }} />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "5px", color: "var(--text-muted)" }}>{lang === "en" ? "To" : "အထိ"}</label>
                                    <input type="date" value={leaveForm.to} min={leaveForm.from} onChange={e => setLeaveForm(p => ({ ...p, to: e.target.value }))}
                                      style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "9px", padding: "9px 10px", fontSize: "12px", fontFamily: "inherit", color: "var(--text)", background: "var(--surface)", boxSizing: "border-box" }} />
                                  </div>
                                </div>
                                <div>
                                  <label style={{ fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "5px", color: "var(--text-muted)" }}>{lang === "en" ? "Reason" : "အကြောင်းရင်း"}</label>
                                  <select value={leaveForm.reasonType} onChange={e => setLeaveForm(p => ({ ...p, reasonType: e.target.value }))}
                                    style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "9px", padding: "9px 12px", fontSize: "12px", fontFamily: "inherit", color: "var(--text)", background: "var(--surface)" }}>
                                    <option value="medical">{lang === "en" ? "Medical" : "ကျန်းမာရေး"}</option>
                                    <option value="family">{lang === "en" ? "Family event" : "မိသားစုကိစ္စ"}</option>
                                    <option value="travel">{lang === "en" ? "Travel" : "ခရီးသွား"}</option>
                                    <option value="other">{lang === "en" ? "Other" : "အခြား"}</option>
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "5px", color: "var(--text-muted)" }}>{lang === "en" ? "Add details (visible to teacher)" : "အသေးစိတ် ထည့်ပါ (ဆရာမြင်မည်)"}</label>
                                  <textarea value={leaveForm.details} onChange={e => setLeaveForm(p => ({ ...p, details: e.target.value }))}
                                    placeholder={lang === "en" ? "e.g. Doctor appointment at 9am" : "ဥပမာ — နံနက် ၉ နာရီ ဆေးပြမည်"}
                                    style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "9px", padding: "9px 12px", fontSize: "12px", fontFamily: "inherit", color: "var(--text)", background: "var(--surface)", height: "60px", resize: "none", boxSizing: "border-box" }} />
                                </div>
                              </div>
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "14px 20px", borderTop: "1px solid var(--border)" }}>
                                <button onClick={() => setLeaveModal(null)} style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "9px", padding: "9px 16px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>{lang === "en" ? "Cancel" : "မလုပ်တော့"}</button>
                                <button onClick={() => { setLeaveHistory(h => [...h, { ...leaveForm }]); setLeaveModal("confirm"); }}
                                  style={{ background: "#0F172A", color: "#fff", border: "none", borderRadius: "9px", padding: "9px 16px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>{lang === "en" ? "Submit request" : "တောင်းဆိုမည်"}</button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ── Leave request confirmation ── */}
                        {leaveModal === "confirm" && (
                          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
                            <div style={{ background: "var(--surface)", borderRadius: "16px", width: "360px", overflow: "hidden", boxShadow: "0 24px 60px rgba(15,23,42,0.2)", padding: "34px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "12px" }}>
                              <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "#dcfce7", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>✓</div>
                              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>{lang === "en" ? "Request sent" : "တောင်းဆိုချက် ပေးပို့ပြီး"}</div>
                              <div style={{ fontSize: "12px", color: "var(--text-faint)", maxWidth: "270px" }}>{lang === "en" ? "Your teacher will review this request. You'll be notified once it's approved or declined." : "ဆရာ/ဆရာမ စစ်ဆေးပြီး အတည်ပြုချက် သို့မဟုတ် ငြင်းပယ်ချက် ပြန်ကြားပါမည်။"}</div>
                              <button onClick={() => setLeaveModal(null)} style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "9px", padding: "9px 20px", fontSize: "12px", fontWeight: 600, cursor: "pointer", marginTop: "4px" }}>{lang === "en" ? "Done" : "ပြီးပြီ"}</button>
                            </div>
                          </div>
                        )}

                      </div>
                    );
                  })()}
                </div>
              )}

              {/* New Session Modal */}
              {newSessionModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
                  <div style={{ background: "var(--surface)", borderRadius: "16px", padding: "28px", width: "400px" }}>
                    <h3 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: 700 }}>{lang === "en" ? "New Attendance Session" : "Session အသစ် ဖန်တီးမည်"}</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      <div>
                        <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>{lang === "en" ? "Title" : "ခေါင်းစဉ်"}</label>
                        <input value={newSessionForm.title} onChange={e => setNewSessionForm(p => ({ ...p, title: e.target.value }))} placeholder={lang === "en" ? "e.g. Week 3 Class" : "ဥပမာ Week 3 သင်ကြားချိန်"} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1.5px solid var(--border)", fontSize: "14px", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>{lang === "en" ? "Date" : "နေ့စွဲ"}</label>
                        <input type="date" value={newSessionForm.session_date} onChange={e => setNewSessionForm(p => ({ ...p, session_date: e.target.value }))} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1.5px solid var(--border)", fontSize: "14px", boxSizing: "border-box" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
                      <button onClick={() => setNewSessionModal(false)} style={{ background: "var(--surface-alt)", color: "var(--text-muted)", border: "none", borderRadius: "8px", padding: "9px 18px", fontWeight: 600, cursor: "pointer" }}>{lang === "en" ? "Cancel" : "မလုပ်တော့ပါ"}</button>
                      <button onClick={createAttendanceSession} style={{ background: "#3B37CC", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 18px", fontWeight: 700, cursor: "pointer" }}>{lang === "en" ? "Create" : "ဖန်တီးမည်"}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ATTENDANCE FULL-PAGE PANEL ── */}
          {attendanceMarkModal && activeSession && (() => {
            const statusColors = { present: "#0F9D6E", late: "#D97706", absent: "#E1483F" };
            const statusBg = { present: "#E6F7EF", late: "#FFF8E6", absent: "#FFF0F0" };
            const isSavedSession = Object.keys(originalRecords).length > 0;
            const filteredRecords = activeSession.records.filter(r =>
              !attendanceSearchQuery || r.name.toLowerCase().includes(attendanceSearchQuery.toLowerCase())
            );
            const presentCount = Object.values(sessionRecords).filter(v => v === "present").length;
            const lateCount = Object.values(sessionRecords).filter(v => v === "late").length;
            const absentCount = Object.values(sessionRecords).filter(v => v === "absent").length;
            const changedCount = Object.keys(sessionRecords).filter(sid => originalRecords[sid] && sessionRecords[sid] !== originalRecords[sid]).length;
            return (
              <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "var(--bg)", display: "flex", flexDirection: "column" }}>

                {/* ── Top bar ── */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", height: "62px", background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <button onClick={() => window.history.back()}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "22px", lineHeight: 1, padding: "4px", borderRadius: "50%", display: "flex", alignItems: "center" }}>←</button>
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)" }}>{activeSession.title}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>
                        {activeSession.session_date
                          ? new Date(activeSession.session_date.slice(0, 10) + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                          : ""}
                        {" · "}{activeSession.records?.length || 0} {lang === "en" ? "students" : "ကျောင်းသား"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {isSavedSession && !attendanceModalEditMode && (
                      <button onClick={() => setAttendanceModalEditMode(true)}
                        style={{ padding: "8px 20px", borderRadius: "8px", border: "none", background: "#0B0B1E", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                        {lang === "en" ? "Edit" : "ပြင်မည်"}
                      </button>
                    )}
                    {attendanceModalEditMode && (
                      <>
                        <button onClick={() => { setSessionRecords({ ...originalRecords }); setAttendanceModalEditMode(false); }}
                          style={{ padding: "8px 18px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                          {lang === "en" ? "Cancel" : "မလုပ်တော့"}
                        </button>
                        <button onClick={saveAttendance} disabled={savingAttendance}
                          style={{ padding: "8px 22px", borderRadius: "8px", border: "none", background: "#3B37CC", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: savingAttendance ? "default" : "pointer" }}>
                          {savingAttendance ? (lang === "en" ? "Saving…" : "သိမ်းနေသည်…") : lang === "en" ? "Save" : "သိမ်းမည်"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* ── Status strip (saved session) ── */}
                {isSavedSession && (
                  <div style={{ padding: "10px 28px", background: attendanceModalEditMode ? "rgba(217,119,6,0.07)" : "rgba(91,95,233,0.06)", borderBottom: "1px solid var(--border)", flexShrink: 0, fontSize: "12px", fontWeight: 600, color: attendanceModalEditMode ? "#D97706" : "#5B5FE9" }}>
                    {attendanceModalEditMode
                      ? (lang === "en" ? "✏️ Editing — changes will update the saved record" : "✏️ ပြင်နေသည် — သိမ်းမှ record ပြောင်းမည်")
                      : (lang === "en" ? "🔒 Viewing saved record" : "🔒 မှတ်ပြီးသော record ကြည့်နေသည်")}
                    {attendanceModalEditMode && changedCount > 0 && (
                      <span style={{ marginLeft: "12px", fontWeight: 400, color: "#D97706" }}>
                        · {changedCount} {lang === "en" ? "changed" : "ပြောင်းလဲပြီ"}
                      </span>
                    )}
                  </div>
                )}

                {/* ── Toolbar (edit mode) ── */}
                {attendanceModalEditMode && (
                  <div style={{ padding: "12px 28px", display: "flex", gap: "10px", alignItems: "center", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                    <div style={{ flex: 1, maxWidth: "400px", display: "flex", alignItems: "center", gap: "8px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "8px 14px" }}>
                      <span style={{ color: "var(--text-faint)" }}>🔍</span>
                      <input value={attendanceSearchQuery} onChange={e => setAttendanceSearchQuery(e.target.value)}
                        placeholder={lang === "en" ? "Search student…" : "ကျောင်းသား ရှာပါ…"}
                        style={{ border: "none", background: "transparent", outline: "none", fontSize: "13px", color: "var(--text)", width: "100%" }} />
                    </div>
                    <button onClick={() => { const all = {}; activeSession.records.forEach(r => { all[r.student_id] = "present"; }); setSessionRecords(all); }}
                      style={{ fontSize: "12px", fontWeight: 600, color: "#5B5FE9", background: "#EEF0FF", border: "none", borderRadius: "10px", padding: "10px 16px", cursor: "pointer", whiteSpace: "nowrap" }}>
                      {lang === "en" ? "✓ Mark all present" : "✓ အားလုံး တက်ရောက်"}
                    </button>
                  </div>
                )}

                {/* ── Student list (scrollable) ── */}
                <div style={{ flex: 1, overflowY: "auto" }}>
                  <div style={{ maxWidth: "860px", margin: "0 auto", padding: "12px 20px 80px" }}>
                    {filteredRecords.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-faint)" }}>
                        <div style={{ fontSize: "30px", marginBottom: "10px" }}>🔍</div>
                        <div style={{ fontSize: "14px", fontWeight: 600 }}>
                          {activeSession.records.length === 0
                            ? (lang === "en" ? "No students enrolled." : "ကျောင်းသား မရှိသေးပါ")
                            : (lang === "en" ? "No match found" : "မတွေ့ပါ")}
                        </div>
                      </div>
                    ) : filteredRecords.map(r => {
                      const st = sessionRecords[r.student_id] || "present";
                      const isChanged = isSavedSession && attendanceModalEditMode && originalRecords[r.student_id] && sessionRecords[r.student_id] !== originalRecords[r.student_id];
                      return (
                        <div key={r.student_id}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderRadius: "14px", marginBottom: "4px", transition: "background 0.12s" }}
                          onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <div style={{ display: "flex", alignItems: "center", gap: "13px" }}>
                            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg,#5B5FE9,#22D3EE)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "14px", flexShrink: 0 }}>
                              {r.name[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                                <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>{r.name}</span>
                                {isChanged && <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#5B5FE9", background: "#EEF0FF", padding: "2px 7px", borderRadius: "999px" }}>{lang === "en" ? "Changed" : "ပြောင်းလဲ"}</span>}
                              </div>
                              <div style={{ fontSize: "11.5px", color: "var(--text-faint)" }}>{r.email}</div>
                            </div>
                          </div>
                          {attendanceModalEditMode ? (
                            <div style={{ display: "flex", background: "rgba(11,11,30,0.05)", borderRadius: "10px", padding: "3px", gap: "2px" }}>
                              {[["present", lang === "en" ? "Present" : "တက်"], ["late", lang === "en" ? "Late" : "နောက်ကျ"], ["absent", lang === "en" ? "Absent" : "မတက်"]].map(([val, label]) => (
                                <button key={val} onClick={() => setSessionRecords(prev => ({ ...prev, [r.student_id]: val }))}
                                  style={{ border: "none", fontSize: "12px", fontWeight: 600, padding: "8px 16px", borderRadius: "8px", cursor: "pointer",
                                    background: st === val ? "#fff" : "transparent",
                                    color: st === val ? statusColors[val] : "var(--text-muted)",
                                    boxShadow: st === val ? "0 1px 4px rgba(11,11,30,0.1)" : "none" }}>
                                  {label}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: "12px", fontWeight: 700, padding: "7px 16px", borderRadius: "999px", background: statusBg[st], color: statusColors[st] }}>
                              {st === "present" ? (lang === "en" ? "Present" : "တက်") : st === "late" ? (lang === "en" ? "Late" : "နောက်ကျ") : (lang === "en" ? "Absent" : "မတက်")}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Bottom bar (fixed) ── */}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "12px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  {/* Summary dots */}
                  <div style={{ display: "flex", gap: "18px", fontSize: "12.5px", color: "var(--text-muted)" }}>
                    <span><span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#0F9D6E", display: "inline-block", marginRight: "6px" }} />{presentCount} {lang === "en" ? "Present" : "တက်"}</span>
                    <span><span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#D97706", display: "inline-block", marginRight: "6px" }} />{lateCount} {lang === "en" ? "Late" : "နောက်ကျ"}</span>
                    <span><span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#E1483F", display: "inline-block", marginRight: "6px" }} />{absentCount} {lang === "en" ? "Absent" : "မတက်"}</span>
                  </div>
                  {/* Delete */}
                  <button onClick={async () => {
                    await deleteAttendanceSession(activeSession.id);
                    setAttendanceMarkModal(false);
                    setAttendanceSearchQuery("");
                    setAttendanceModalEditMode(false);
                  }} style={{ fontSize: "12.5px", fontWeight: 600, color: "#E1483F", background: "transparent", border: "1px solid #E1483F", borderRadius: "8px", padding: "8px 16px", cursor: "pointer" }}>
                    🗑 {lang === "en" ? "Delete session" : "Session ဖျက်မည်"}
                  </button>
                </div>
              </div>
            );
          })()}

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
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>{teacher.name}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>{teacher.email}</div>
                      </div>
                    </div>
                  ) : <p style={{ color: "var(--text-faint)", fontSize: "14px" }}>No teacher.</p>}
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
                  <p style={{ color: "var(--text-faint)", fontSize: "14px" }}>No students enrolled yet.</p>
                ) : students.map(s => (
                  <div key={s.id}
                    onClick={() => openStudentStats(s)}
                    style={{
                      ...memberRow, justifyContent: "space-between", cursor: "pointer",
                      background: selectedStudent?.id === s.id ? "var(--primary-tint)" : "#fff",
                      border: selectedStudent?.id === s.id ? "1.5px solid #3B37CC" : "1px solid var(--border)",
                      transition: "all 0.15s",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ ...memberAvatar, background: selectedStudent?.id === s.id ? "#3B37CC" : "var(--border)", color: selectedStudent?.id === s.id ? "#fff" : "var(--text-muted)" }}>
                        {s.name[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>{s.name}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>{s.email}</div>
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
                <div style={{ background: "var(--surface)", borderRadius: "14px", border: "1px solid var(--border)", padding: "20px", position: "sticky", top: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "#3B37CC", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 700 }}>
                        {selectedStudent.name[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>{selectedStudent.name}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>{selectedStudent.email}</div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedStudent(null)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "var(--text-faint)" }}>×</button>
                  </div>

                  {studentStatsLoading ? (
                    <div style={{ textAlign: "center", padding: "32px", color: "var(--text-faint)" }}>Loading...</div>
                  ) : studentStats ? (
                    <>
                      {/* Stats row - Assignment */}
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Assignments</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "16px" }}>
                        {[
                          { label: lang === "en" ? "Submission" : "တင်သွင်းမှု", value: `${studentStats.stats.submissionRate}%`, color: studentStats.stats.submissionRate >= 80 ? "#22c55e" : studentStats.stats.submissionRate >= 50 ? "#f59e0b" : "#ef4444" },
                          { label: lang === "en" ? "Submitted" : "တင်ပြီး", value: `${studentStats.stats.submittedCount}/${studentStats.stats.totalAssignments}`, color: "#3B37CC" },
                          { label: lang === "en" ? "Avg Grade" : "ပျမ်းမျှ", value: studentStats.stats.avgGrade !== null ? `${studentStats.stats.avgGrade}%` : "—", color: "var(--text-muted)" },
                        ].map(stat => (
                          <div key={stat.label} style={{ background: "var(--surface-alt)", borderRadius: "10px", padding: "10px", textAlign: "center" }}>
                            <div style={{ fontSize: "18px", fontWeight: 800, color: stat.color }}>{stat.value}</div>
                            <div style={{ fontSize: "11px", color: "var(--text-faint)", marginTop: "2px" }}>{stat.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Stats row - Attendance */}
                      {studentStats.stats.totalSessions > 0 && (
                        <>
                          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                            {lang === "en" ? "Attendance" : "တက်ရောက်မှု"}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px", marginBottom: "16px" }}>
                            {[
                              { label: lang === "en" ? "Rate" : "နှုန်း", value: `${studentStats.stats.attendanceRate}%`, color: studentStats.stats.attendanceRate >= 80 ? "#22c55e" : studentStats.stats.attendanceRate >= 60 ? "#f59e0b" : "#ef4444" },
                              { label: lang === "en" ? "Present" : "တက်", value: studentStats.stats.presentCount, color: "#22c55e" },
                              { label: lang === "en" ? "Late" : "နောက်ကျ", value: studentStats.stats.lateCount, color: "#f59e0b" },
                              { label: lang === "en" ? "Absent" : "မတက်", value: studentStats.stats.absentCount, color: "#ef4444" },
                            ].map(stat => (
                              <div key={stat.label} style={{ background: "var(--surface-alt)", borderRadius: "10px", padding: "8px", textAlign: "center" }}>
                                <div style={{ fontSize: "16px", fontWeight: 800, color: stat.color }}>{stat.value}</div>
                                <div style={{ fontSize: "10px", color: "var(--text-faint)", marginTop: "2px" }}>{stat.label}</div>
                              </div>
                            ))}
                          </div>
                          {/* Attendance history mini list */}
                          <div style={{ maxHeight: "120px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px", marginBottom: "16px" }}>
                            {studentStats.attendance.map((r, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 10px", background: "var(--surface-alt)", borderRadius: "6px" }}>
                                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                  <span style={{ fontWeight: 600 }}>{r.title}</span>
                                  <span style={{ color: "var(--text-faint)", marginLeft: "8px" }}>{new Date(r.session_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
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
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                        {lang === "en" ? "Assignment Detail" : "အိမ်စာ အသေးစိတ်"}
                      </div>
                      <div style={{ maxHeight: "340px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {studentStats.assignments.map(a => (
                          <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--surface-alt)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                            <div>
                              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{a.title}</div>
                              {a.submission?.grade !== null && a.submission?.grade !== undefined && (
                                <div style={{ fontSize: "11px", color: "#3B37CC", marginTop: "2px" }}>
                                  {a.submission.grade}/{a.points} pts ({Math.round((a.submission.grade/a.points)*100)}%)
                                </div>
                              )}
                            </div>
                            <span style={{
                              fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "20px", flexShrink: 0,
                              background: a.status === "missing" ? "#fef2f2" : a.status === "graded" ? "var(--primary-tint)" : "#f0fdf4",
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
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)", margin: 0 }}>✉️ Invite Student</h3>
              <button onClick={() => { setInviteModal(false); setInviteMsg(null); setInviteEmail(""); }} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-faint)" }}>×</button>
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "14px" }}>
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
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)", margin: "0 0 20px" }}>✏️ Edit Assignment</h2>
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
                      <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", color: editDeleteFileIds.includes(f.id) ? "var(--text-faint)" : "var(--text-muted)", background: editDeleteFileIds.includes(f.id) ? "#fef2f2" : "var(--surface-alt)", padding: "4px 10px", borderRadius: "6px", border: `1px solid ${editDeleteFileIds.includes(f.id) ? "#fca5a5" : "var(--border)"}`, textDecoration: editDeleteFileIds.includes(f.id) ? "line-through" : "none" }}>
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
                <div style={{ border: "1.5px dashed var(--border)", borderRadius: "10px", padding: "10px", background: "#fafafa" }}>
                  <input ref={editAssignFileRef} type="file" multiple style={{ display: "none" }}
                    onChange={e => setEditAssignFiles(prev => [...prev, ...Array.from(e.target.files)])} />
                  <button type="button" onClick={() => editAssignFileRef.current?.click()}
                    style={{ fontSize: "13px", color: "#3B37CC", background: "var(--primary-tint)", border: "1px solid #a5b4fc", borderRadius: "8px", padding: "6px 14px", cursor: "pointer", fontWeight: 600 }}>
                    📎 Add files
                  </button>
                  {editAssignFiles.length > 0 && (
                    <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                      {editAssignFiles.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", background: "var(--surface)", padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--border)" }}>
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
                style={{ ...btnOutline, flex: 1, color: "var(--text-muted)", opacity: (!editAssignForm.title.trim() || editAssignSaving) ? 0.6 : 1 }}>
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
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)", margin: 0 }}>✏️ Edit Announcement</h3>
              <button onClick={() => setEditingPost(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-faint)" }}>×</button>
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
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)", margin: 0 }}>📊 Submission Status</h3>
              <button onClick={() => setSubmissionStats(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-faint)" }}>×</button>
            </div>
            {submissionStats.loading ? (
              <div style={{ textAlign: "center", padding: "32px", color: "var(--text-faint)" }}>Loading...</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                  {[
                    { label: "Submitted", count: submissionStats.students?.filter(s => s.status !== "missing").length || 0, color: "#22c55e", bg: "#f0fdf4" },
                    { label: "Missing", count: submissionStats.students?.filter(s => s.status === "missing").length || 0, color: "#ef4444", bg: "#fef2f2" },
                    { label: "Graded", count: submissionStats.students?.filter(s => s.status === "graded").length || 0, color: "#3B37CC", bg: "var(--primary-tint)" },
                  ].map(stat => (
                    <div key={stat.label} style={{ flex: 1, background: stat.bg, borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                      <div style={{ fontSize: "24px", fontWeight: 800, color: stat.color }}>{stat.count}</div>
                      <div style={{ fontSize: "12px", color: stat.color, fontWeight: 600 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
                  {submissionStats.students?.map(s => (
                    <div key={s.student.id}>
                      <div
                        onClick={() => s.submission && setSelectedSubmission(selectedSubmission?.id === s.submission?.id ? null : s)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "10px 16px", borderBottom: "1px solid var(--surface-alt)",
                          cursor: s.submission ? "pointer" : "default",
                          background: selectedSubmission?.student?.id === s.student.id ? "var(--primary-tint)" : "transparent",
                        }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: "var(--text-muted)" }}>
                            {s.student.name[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: "14px", color: "var(--text)", fontWeight: 500 }}>{s.student.name}</div>
                            {s.submission && <div style={{ fontSize: "11px", color: "var(--text-faint)" }}>
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
                            background: s.status === "missing" ? "#fef2f2" : s.status === "graded" ? "var(--primary-tint)" : "#f0fdf4",
                            color: s.status === "missing" ? "#ef4444" : s.status === "graded" ? "#3B37CC" : "#22c55e",
                          }}>
                            {s.status === "missing" ? "Missing" : s.status === "graded" ? "Graded" : "Submitted"}
                          </span>
                          {s.submission && <span style={{ fontSize: "14px", color: "var(--text-faint)" }}>{selectedSubmission?.student?.id === s.student.id ? "▲" : "▼"}</span>}
                        </div>
                      </div>

                      {/* Expanded submission detail */}
                      {selectedSubmission?.student?.id === s.student.id && s.submission && (
                        <div style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)", padding: "14px 20px" }}>
                          {/* Text content */}
                          {s.submission.content && (
                            <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "10px", lineHeight: 1.6, background: "var(--surface)", borderRadius: "8px", padding: "10px 12px", border: "1px solid var(--border)" }}>
                              {s.submission.content}
                            </div>
                          )}
                          {/* File */}
                          {s.submission.file_path && (
                            <a href={`http://localhost:5001/uploads/${s.submission.file_path}`} target="_blank" rel="noreferrer"
                              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#3B37CC", fontWeight: 600, marginBottom: "12px", background: "var(--primary-tint)", padding: "6px 12px", borderRadius: "8px", textDecoration: "none" }}>
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
                            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>/ {submissionStats.assignment?.points || 100} pts</span>
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
                            myId={myId}
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
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)", marginBottom: "14px" }}>📂 Set Topic</h3>
            <input value={topicInput} onChange={e => setTopicInput(e.target.value)}
              placeholder="e.g. Chapter 1, Week 2, HTML Basics..."
              style={{ ...inp, width: "100%", marginBottom: "14px" }} autoFocus
              onKeyDown={e => e.key === "Enter" && saveTopic()} />
            <div style={{ fontSize: "12px", color: "var(--text-faint)", marginBottom: "14px" }}>{lang === "en" ? "Leave blank and Save to remove the topic" : "Topic ကို ဖယ်ရှားဖို့ blank ထားပြီး Save နှိပ်ပါ"}</div>
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
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)", margin: 0 }}>
                {aiModal === "highlights" ? "✏️ Smart Highlighting" : aiModal === "summary" ? "📋 Auto-Summary" : "❓ Practice Quiz"}
              </h2>
              <button onClick={() => setAiModal(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-faint)" }}>×</button>
            </div>

            {aiLoading ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-faint)" }}>
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
                    <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.6 }}>{item.explanation}</div>
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
                    <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>{point}</p>
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
                <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)" }}>Level Up Chat</div>
                {levelUpLevel && <div style={{ fontSize: "11px", color: "#22c55e", fontWeight: 600 }}>
                  ● {levelUpLevel === "beginner"
                    ? (lang === "en" ? "🌱 Beginner" : "🌱 စတင်သင်")
                    : levelUpLevel === "intermediate"
                    ? (lang === "en" ? "📘 Intermediate" : "📘 တစ်ဝက်နားလည်")
                    : (lang === "en" ? "🔥 Advanced" : "🔥 နားလည်ပြီး")} mode
                </div>}
              </div>
              <button onClick={() => { setAiModal(null); setLevelUpLevel(null); }} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-faint)" }}>×</button>
            </div>

            {/* Level selector screen */}
            {!levelUpLevel ? (
              <div>
                <div style={{ textAlign: "center", marginBottom: "20px" }}>
                  <div style={{ fontSize: "32px", marginBottom: "10px" }}>🎯</div>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)", marginBottom: "6px" }}>
                    {lang === "en" ? "How well do you know this material?" : "ဒီသင်ခန်းစာနဲ့ ပတ်သက်ပြီး ဘယ်လောက်နားလည်သလဲ?"}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text-muted)" }}><strong>{selectedMat?.title}</strong></div>
                </div>
                {[
                  { key: "beginner", icon: "🌱",
                    label: lang === "en" ? "Just starting out" : "စတင်သင်",
                    desc: lang === "en" ? "New to this material — need basic explanations" : "ဒီသင်ခန်းစာနဲ့ ပထမဆုံးတွေ့ဆုံနေသည်၊ အခြေခံ ရှင်းပြချက်လိုသည်",
                    color: "#22c55e", bg: "#f0fdf4", border: "#86efac" },
                  { key: "intermediate", icon: "📘",
                    label: lang === "en" ? "Know the basics" : "တစ်ဝက်နားလည်",
                    desc: lang === "en" ? "I know some parts but still have gaps" : "အခြေခံသိသော်လည်း အချို့နေရာများ မရှင်းသေးပါ",
                    color: "#3B37CC", bg: "var(--primary-tint)", border: "#a5b4fc" },
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
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{l.desc}</div>
                    </div>
                    <div style={{ marginLeft: "auto", color: l.color, fontSize: "18px" }}>›</div>
                  </div>
                ))}
                {chatSending && <div style={{ textAlign: "center", color: "var(--text-faint)", fontSize: "13px", padding: "10px" }}>
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
                    background: msg.role === "user" ? "#3B37CC" : "var(--surface-alt)",
                    color: msg.role === "user" ? "#fff" : "var(--text-muted)",
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
                  <div style={{ background: "var(--surface-alt)", padding: "10px 14px", borderRadius: "14px", fontSize: "14px", color: "var(--text-faint)" }}>
                    ⚡ {lang === "en" ? "AI is thinking..." : "AI တွေးဆနေသည်..."}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Level badge + change level */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", color: "var(--text-faint)" }}>
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
            <div style={{ display: "flex", gap: "10px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
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
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)", margin: "0 0 20px" }}>📂 Add Resource</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={lbl}>Title *</label>
                <input value={resourceForm.title} onChange={e => setResourceForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Week 1 Reference" style={inp} autoFocus />
              </div>
              <div>
                <label style={lbl}>Link URL</label>
                <input value={resourceForm.url} onChange={e => setResourceForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." style={inp} disabled={!!resourceFile} />
              </div>
              <div style={{ textAlign: "center", color: "var(--text-faint)", fontSize: "13px" }}>— or —</div>
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

      {/* Create Assignment — full screen Google Classroom style */}
      {assignModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: "64px", background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button onClick={() => window.history.back()}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "20px", padding: "4px", borderRadius: "50%", display: "flex", alignItems: "center" }}>✕</button>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "32px", height: "32px", background: "var(--primary-tint)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "16px" }}>📝</span>
                </div>
                <span style={{ fontSize: "17px", fontWeight: 700, color: "var(--text)" }}>Create assignment</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => createAssignment(true)} disabled={assignCreating || !assignForm.title.trim()}
                style={{ background: "var(--surface-alt)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "8px", padding: "9px 20px", fontSize: "13px", fontWeight: 600, cursor: assignCreating || !assignForm.title.trim() ? "not-allowed" : "pointer", opacity: !assignForm.title.trim() ? 0.5 : 1 }}>
                Save draft
              </button>
              <button onClick={() => createAssignment(false)} disabled={assignCreating || !assignForm.title.trim()}
                style={{ background: assignCreating || !assignForm.title.trim() ? "#c7d2fe" : "#3B37CC", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 24px", fontSize: "14px", fontWeight: 700, cursor: assignCreating || !assignForm.title.trim() ? "not-allowed" : "pointer" }}>
                {assignCreating ? "Posting..." : "Post"}
              </button>
            </div>
          </div>

          {/* Body — 2 column layout */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", justifyContent: "center", padding: "32px 16px" }}>
            <div style={{ width: "100%", maxWidth: "900px", display: "flex", gap: "20px", alignItems: "flex-start" }}>

              {/* Left — main form */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Title */}
                <div style={{ background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                  <input
                    value={assignForm.title}
                    onChange={e => setAssignForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Assignment title"
                    autoFocus
                    style={{ width: "100%", border: "none", outline: "none", fontSize: "22px", fontWeight: 600, color: "var(--text)", padding: "20px 24px", boxSizing: "border-box", background: "transparent" }}
                  />
                </div>

                {/* Instructions */}
                <div style={{ background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)", padding: "20px 24px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "10px" }}>Instructions (optional)</span>
                  <textarea
                    value={assignForm.instructions}
                    onChange={e => setAssignForm(f => ({ ...f, instructions: e.target.value }))}
                    placeholder="Tell students what to do..."
                    style={{ width: "100%", minHeight: "120px", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px", fontSize: "14px", color: "var(--text-muted)", resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit", lineHeight: "1.6" }}
                  />
                </div>

                {/* File attachments */}
                <div style={{ background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)", padding: "20px 24px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "12px" }}>Attachments (optional)</span>
                  <input ref={assignFileRef} type="file" multiple style={{ display: "none" }}
                    onChange={e => setAssignFiles(prev => [...prev, ...Array.from(e.target.files)])} />
                  {assignFiles.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                      {assignFiles.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", background: "#f8f9ff", border: "1px solid #e0e7ff", borderRadius: "8px", padding: "10px 14px" }}>
                          <span style={{ fontSize: "18px" }}>📄</span>
                          <span style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                          <button onClick={() => setAssignFiles(prev => prev.filter((_, j) => j !== i))}
                            style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: "16px" }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "2px dashed #c7d2fe", borderRadius: "10px", padding: "24px", cursor: "pointer", color: "var(--text-muted)", gap: "6px" }}>
                    <span style={{ fontSize: "28px" }}>📎</span>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#3B37CC" }}>Attach files</span>
                    <input type="file" multiple style={{ display: "none" }}
                      onChange={e => setAssignFiles(prev => [...prev, ...Array.from(e.target.files)])} />
                  </label>
                </div>

                {assignError && (
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "12px 16px", color: "#dc2626", fontSize: "13px" }}>
                    {assignError}
                  </div>
                )}
              </div>

              {/* Right — settings panel */}
              <div style={{ width: "240px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                  <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--surface-alt)" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Points</div>
                    <input type="number" min="0" max="1000" value={assignForm.points}
                      onChange={e => setAssignForm(f => ({ ...f, points: e.target.value }))}
                      style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 10px", fontSize: "16px", fontWeight: 700, color: "#3B37CC", outline: "none", textAlign: "center", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Due date</div>
                    <input type="datetime-local" value={assignForm.due_date}
                      onChange={e => setAssignForm(f => ({ ...f, due_date: e.target.value }))}
                      style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 10px", fontSize: "13px", color: "var(--text-muted)", outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Detail Modal */}
      {/* Teacher Assignment Full-Page View */}
      {selectedAssign && isTeacher && (
        <div style={{ position: "fixed", inset: 0, background: "#f5f6fa", zIndex: 900, overflowY: "auto" }}>
          {/* Top bar */}
          <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "14px 28px", display: "flex", alignItems: "center", gap: "14px", position: "sticky", top: 0, zIndex: 10 }}>
            <button onClick={() => { setSelectedAssign(null); setAssignDetail(null); setSelectedSubmissionStudent(null); }}
              style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "var(--text-muted)", lineHeight: 1 }}>←</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "17px", fontWeight: 700, color: "var(--text)" }}>📝 {selectedAssign.title}</div>
              <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>
                {selectedAssign.due_date ? `Due: ${formatDate(selectedAssign.due_date)}` : "No due date"} • {selectedAssign.points} pts
              </div>
            </div>
            <button onClick={() => openEditAssign(selectedAssign)}
              style={{ fontSize: "13px", fontWeight: 600, color: "#3B37CC", background: "var(--primary-tint)", border: "1px solid #a5b4fc", borderRadius: "8px", padding: "7px 16px", cursor: "pointer" }}>
              ✏️ Edit
            </button>
          </div>

          {/* Body */}
          <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 0, minHeight: "calc(100vh - 64px)" }}>
            {/* LEFT — student list */}
            <div style={{ background: "var(--surface)", borderRight: "1px solid var(--border)", padding: "16px" }}>
              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "16px" }}>
                {[
                  { label: "Submitted", count: assignDetail?.submissions?.length || 0, color: "#22c55e", bg: "#f0fdf4" },
                  { label: "Missing", count: Math.max(0, (students?.length || 0) - (assignDetail?.submissions?.length || 0)), color: "#ef4444", bg: "#fef2f2" },
                  { label: "Graded", count: assignDetail?.submissions?.filter(s => s.status === "graded" || s.status === "returned").length || 0, color: "#3B37CC", bg: "var(--primary-tint)" },
                ].map(stat => (
                  <div key={stat.label} style={{ background: stat.bg, borderRadius: "10px", padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: stat.color }}>{stat.count}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-faint)", marginBottom: "10px", letterSpacing: "0.05em" }}>STUDENTS</div>

              {!assignDetail ? (
                <div style={{ color: "var(--text-faint)", fontSize: "13px", textAlign: "center", padding: "32px" }}>Loading...</div>
              ) : students.map(st => {
                const sub = assignDetail.submissions?.find(s => s.student_id === st.id);
                const isSelected = selectedSubmissionStudent?.id === st.id;
                return (
                  <div key={st.id} onClick={() => setSelectedSubmissionStudent({ ...st, submission: sub || null })}
                    style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", cursor: "pointer", marginBottom: "4px", background: isSelected ? "var(--primary-tint)" : "transparent", border: isSelected ? "1.5px solid #3B37CC" : "1.5px solid transparent", transition: "all 0.12s" }}>
                    <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: isSelected ? "#3B37CC" : "var(--border)", color: isSelected ? "#fff" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, flexShrink: 0 }}>
                      {st.name[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{st.name}</div>
                      {sub ? (
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{formatDate(sub.submitted_at)}</div>
                      ) : (
                        <div style={{ fontSize: "11px", color: "#ef4444" }}>Missing</div>
                      )}
                    </div>
                    <span style={{
                      fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", flexShrink: 0,
                      background: !sub ? "#fef2f2" : (sub.status === "graded" || sub.status === "returned") ? "var(--primary-tint)" : "#f0fdf4",
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
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-faint)", gap: "12px" }}>
                  <div style={{ fontSize: "48px" }}>👈</div>
                  <div style={{ fontSize: "14px" }}>Select a student to view their submission</div>
                </div>
              ) : !selectedSubmissionStudent.submission ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-faint)", gap: "12px" }}>
                  <div style={{ fontSize: "48px" }}>📭</div>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-muted)" }}>{selectedSubmissionStudent.name}</div>
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
                        <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)" }}>{selectedSubmissionStudent.name}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>Submitted {formatDate(sub.submitted_at)}{sub.status === "late" ? " (Late)" : ""}</div>
                      </div>
                      <span style={{ marginLeft: "auto", fontSize: "11px", fontWeight: 700, padding: "4px 12px", borderRadius: "20px",
                        background: (sub.status === "graded" || sub.status === "returned") ? "var(--primary-tint)" : "#f0fdf4",
                        color: (sub.status === "graded" || sub.status === "returned") ? "#3B37CC" : "#22c55e" }}>
                        {(sub.status === "graded" || sub.status === "returned") ? `Graded: ${sub.grade}/${selectedAssign.points}` : "Submitted"}
                      </span>
                    </div>

                    {/* Submission content */}
                    {sub.content && (
                      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", marginBottom: "16px", fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.7 }}>
                        {sub.content}
                      </div>
                    )}

                    {/* File */}
                    {sub.file_path && (
                      <a href={`http://localhost:5001/uploads/${sub.file_path}`} target="_blank" rel="noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#3B37CC", fontWeight: 600, background: "var(--primary-tint)", padding: "8px 16px", borderRadius: "10px", textDecoration: "none", border: "1px solid #a5b4fc", marginBottom: "20px" }}>
                        📎 View attached file
                      </a>
                    )}

                    {/* Grade section */}
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "12px" }}>Grade</div>
                      {(sub.status === "graded" || sub.status === "returned") ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "22px", fontWeight: 800, color: "#22c55e" }}>{sub.grade}</span>
                          <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>/ {selectedAssign.points} pts</span>
                          {sub.grade_comment && <span style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>— {sub.grade_comment}</span>}
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
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "12px", letterSpacing: "0.05em" }}>🔒 PRIVATE COMMENT — {selectedSubmissionStudent.name}</div>
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
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>📝 {selectedAssign.title}</h2>
                <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>
                  {selectedAssign.due_date ? `Due: ${formatDate(selectedAssign.due_date)}` : "No due date"} • {selectedAssign.points} pts
                </div>
              </div>
              <button onClick={() => setSelectedAssign(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-faint)" }}>×</button>
            </div>
            {selectedAssign.instructions && (
              <div style={{ background: "var(--bg)", borderRadius: "10px", padding: "14px", marginBottom: "12px", fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.6 }}>
                {selectedAssign.instructions}
              </div>
            )}
            {selectedAssign.files?.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "6px" }}>ATTACHMENTS</div>
                {selectedAssign.files.map(f => (
                  <a key={f.id} href={`http://localhost:5001/uploads/${f.file_path}`} target="_blank" rel="noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#3B37CC", fontWeight: 600, background: "var(--primary-tint)", padding: "6px 12px", borderRadius: "8px", textDecoration: "none", border: "1px solid #a5b4fc", marginRight: "8px", marginBottom: "4px" }}>
                    📄 {f.file_name}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload / Edit Material Modal — full screen Google Classroom style */}
      {uploadModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: "64px", background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button onClick={closeUploadModal}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "20px", padding: "4px", borderRadius: "50%", display: "flex", alignItems: "center" }}>✕</button>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "32px", height: "32px", background: "#3B37CC", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#fff", fontSize: "16px" }}>📄</span>
                </div>
                <span style={{ fontSize: "17px", fontWeight: 700, color: "var(--text)" }}>{materialEditId ? "Edit material" : "Create material"}</span>
              </div>
            </div>
            <button onClick={handleUpload} disabled={uploading || !uploadForm.title.trim()}
              style={{ background: uploading || !uploadForm.title.trim() ? "#c7d2fe" : "#3B37CC", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 24px", fontSize: "14px", fontWeight: 700, cursor: uploading || !uploadForm.title.trim() ? "not-allowed" : "pointer", transition: "background 0.2s" }}>
              {uploading ? "Saving..." : materialEditId ? "Save Changes" : "Post"}
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", justifyContent: "center", padding: "32px 16px" }}>
            <div style={{ width: "100%", maxWidth: "720px", display: "flex", flexDirection: "column", gap: "16px" }}>

              {/* Title */}
              <div style={{ background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                <input
                  value={uploadForm.title}
                  onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Title"
                  autoFocus
                  style={{ width: "100%", border: "none", outline: "none", fontSize: "22px", fontWeight: 600, color: "var(--text)", padding: "20px 24px", boxSizing: "border-box", background: "transparent" }}
                />
                <div style={{ height: "1px", background: "var(--surface-alt)", margin: "0 24px" }} />
                <div style={{ padding: "4px 24px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-faint)", fontWeight: 600 }}>WEEK</span>
                  <input type="number" min="1" max="20" value={uploadForm.week}
                    onChange={e => setUploadForm(f => ({ ...f, week: e.target.value }))}
                    style={{ width: "56px", border: "1px solid var(--border)", borderRadius: "6px", padding: "4px 8px", fontSize: "14px", fontWeight: 600, color: "#3B37CC", textAlign: "center", outline: "none" }} />
                </div>
              </div>

              {/* YouTube suggestions */}
              <div style={{ background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)", padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-muted)" }}>🎬 Related YouTube Videos</span>
                    <span style={{ fontSize: "11px", color: "var(--text-faint)", marginLeft: "8px" }}>PDF ဖတ်ပြီး AI ကညွှန်းပေးမည်</span>
                  </div>
                  {uploadFile && (
                    <button
                      onClick={() => handleSuggestVideos(undefined, true)}
                      disabled={suggestingVideos}
                      style={{
                        display: "flex", alignItems: "center", gap: "6px",
                        background: suggestingVideos ? "var(--surface-alt)" : "#fff7ed",
                        color: "#ea580c", border: "1px solid #fed7aa",
                        borderRadius: "20px", padding: "5px 14px",
                        fontSize: "12px", fontWeight: 700,
                        cursor: suggestingVideos ? "not-allowed" : "pointer",
                        flexShrink: 0,
                      }}>
                      {suggestingVideos ? <><span>⏳</span> Searching...</> : <><span>🔄</span> Re-search</>}
                    </button>
                  )}
                </div>
                {/* Language hint row */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: (suggestedVideos.length > 0 || suggestingVideos) ? "14px" : "8px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-faint)", flexShrink: 0 }}>Video ဘာသာစကား:</span>
                  {[{ label: "ENG", value: "English" }, { label: "KOR", value: "Korean" }].map(btn => (
                    <button key={btn.value} onClick={() => setYtLanguageHint(btn.value)}
                      style={{
                        fontSize: "11px", fontWeight: 700,
                        padding: "3px 12px", borderRadius: "14px",
                        border: `1px solid ${ytLanguageHint === btn.value ? "#3B37CC" : "var(--border)"}`,
                        background: ytLanguageHint === btn.value ? "#3B37CC" : "var(--surface-alt)",
                        color: ytLanguageHint === btn.value ? "#fff" : "var(--text-muted)",
                        cursor: "pointer", transition: "all 0.15s",
                      }}>
                      {btn.label}
                    </button>
                  ))}
                </div>
                {suggestingVideos && (
                  <div style={{ display: "flex", gap: "10px" }}>
                    {[1,2,3].map(i => (
                      <div key={i} style={{ flex: 1, borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)" }}>
                        <div style={{ height: "80px", background: "linear-gradient(135deg, #fee2e2, #fecaca)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>▶</div>
                        <div style={{ padding: "8px", background: "var(--surface-alt)" }}>
                          <div style={{ height: "8px", background: "var(--border)", borderRadius: "4px", marginBottom: "4px" }} />
                          <div style={{ height: "6px", background: "var(--border)", borderRadius: "4px", width: "70%" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {suggestedVideos.length > 0 && (
                  <div>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "nowrap", overflowX: "auto", paddingBottom: "4px" }}>
                      {suggestedVideos.map((v, i) => {
                        const isSelected = selectedVideoUrls.has(v.url);
                        return (
                          <div key={i} onClick={() => setSelectedVideoUrls(prev => {
                            const next = new Set(prev);
                            isSelected ? next.delete(v.url) : next.add(v.url);
                            return next;
                          })}
                            style={{ flex: "0 0 200px", borderRadius: "8px", overflow: "hidden", border: `2px solid ${isSelected ? "#3B37CC" : "var(--border)"}`, cursor: "pointer", display: "block", transition: "border-color 0.15s, box-shadow 0.15s", boxShadow: isSelected ? "0 0 0 3px rgba(59,55,204,0.15)" : "none", userSelect: "none" }}>
                            <div style={{ position: "relative" }}>
                              {v.thumbnail ? (
                                <img src={v.thumbnail} alt={v.title} style={{ width: "100%", height: "112px", objectFit: "cover", display: "block" }} />
                              ) : (
                                <div style={{ height: "112px", background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", color: "#fff" }}>▶</div>
                              )}
                              <div style={{ position: "absolute", top: "6px", right: "6px", background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "2px 5px", borderRadius: "4px" }}>YouTube</div>
                              {isSelected && (
                                <div style={{ position: "absolute", top: "6px", left: "6px", background: "#3B37CC", color: "#fff", fontSize: "14px", width: "22px", height: "22px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>✓</div>
                              )}
                            </div>
                            <div style={{ padding: "8px 10px", background: isSelected ? "rgba(59,55,204,0.06)" : "var(--surface)" }}>
                              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text)", lineHeight: 1.4, marginBottom: "3px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{v.title}</div>
                              <div style={{ fontSize: "10px", color: "var(--text-faint)" }}>{v.channel}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
                      <div style={{ fontSize: "11px", color: selectedVideoUrls.size > 0 ? "#3B37CC" : "var(--text-faint)" }}>
                        {selectedVideoUrls.size > 0
                          ? `✓ ${selectedVideoUrls.size} video ရွေးထားသည် — post လုပ်သောအခါ lesson မှာ ထည့်သွင်းမည်`
                          : "Video ကို နှိပ်ပြီး ရွေးပါ — ကြိုက်သောဟာကို lesson မှာ ထည့်နိုင်သည်"}
                      </div>
                      {selectedVideoUrls.size > 0 && (
                        <button onClick={() => setSelectedVideoUrls(new Set())}
                          style={{ fontSize: "10px", color: "var(--text-faint)", background: "none", border: "none", cursor: "pointer", padding: "0" }}>
                          ဖျက်မည်
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {!suggestingVideos && suggestedVideos.length === 0 && (
                  <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-faint)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "16px" }}>📄</span>
                    PDF file တင်လိုက်တာနဲ့ AI က file အကြောင်းကို ဖတ်ပြီး သင်ခန်းစာနဲ့ ကိုက်ညီတဲ့ YouTube videos အလိုအလျောက် ညွှန်းပေးမည်
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div style={{ background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)", padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-muted)" }}>Instructions for students</span>
                    <span style={{ fontSize: "11px", color: "var(--text-faint)", marginLeft: "8px" }}>AI က သင်ရိုးကြည့်ပြီး ရေးပေးမည်</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ display: "flex", borderRadius: "20px", overflow: "hidden", border: "1px solid var(--border)" }}>
                      {["en", "ko"].map(lang => (
                        <button key={lang} onClick={() => {
                          setInstructionLang(lang);
                          if (uploadFile && !generatingInstructions) handleGenerateInstructions(lang);
                        }}
                          style={{ padding: "4px 12px", fontSize: "11px", fontWeight: 700, border: "none", cursor: "pointer", background: instructionLang === lang ? "#3B37CC" : "var(--surface)", color: instructionLang === lang ? "#fff" : "var(--text-faint)", transition: "background 0.15s" }}>
                          {lang === "en" ? "ENG" : "KOR"}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={handleGenerateInstructions}
                      disabled={generatingInstructions || !uploadFile}
                      title={!uploadFile ? "PDF တင်မှ အသုံးပြုနိုင်မည်" : ""}
                      style={{ display: "flex", alignItems: "center", gap: "6px", background: generatingInstructions ? "var(--surface-alt)" : !uploadFile ? "var(--surface-alt)" : "var(--primary-tint)", color: !uploadFile ? "var(--text-faint)" : "#3B37CC", border: `1px solid ${!uploadFile ? "var(--border)" : "#c7d2fe"}`, borderRadius: "20px", padding: "5px 14px", fontSize: "12px", fontWeight: 700, cursor: (generatingInstructions || !uploadFile) ? "not-allowed" : "pointer", opacity: !uploadFile ? 0.6 : 1 }}>
                      {generatingInstructions ? (
                        <><span style={{ fontSize: "14px" }}>⏳</span> Generating...</>
                      ) : (
                        <><span style={{ fontSize: "14px" }}>{!uploadFile ? "🔒" : "✨"}</span> Generate with AI</>
                      )}
                    </button>
                  </div>
                </div>
                <textarea
                  value={uploadForm.instructions}
                  onChange={e => setUploadForm(f => ({ ...f, instructions: e.target.value }))}
                  placeholder="Add instructions for your students..."
                  style={{ width: "100%", minHeight: "120px", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px", fontSize: "14px", color: "var(--text-muted)", resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit", lineHeight: "1.6" }}
                />
              </div>

              {/* File upload */}
              <div style={{ background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)", padding: "20px 24px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "12px" }}>Attach PDF (optional)</span>
                {uploadFile ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "#f8f9ff", border: "1px solid #c7d2fe", borderRadius: "10px", padding: "12px 16px" }}>
                    <span style={{ fontSize: "24px" }}>📑</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{uploadFile.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-faint)" }}>{(uploadFile.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <button onClick={() => { setUploadFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                      style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: "18px" }}>✕</button>
                  </div>
                ) : (
                  <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "2px dashed #c7d2fe", borderRadius: "10px", padding: "32px", cursor: "pointer", color: "var(--text-muted)", gap: "8px" }}>
                    <span style={{ fontSize: "32px" }}>📎</span>
                    <span style={{ fontSize: "14px", fontWeight: 600 }}>Click to attach a PDF</span>
                    <span style={{ fontSize: "12px", color: "var(--text-faint)" }}>PDF files only</span>
                    <input type="file" accept="application/pdf" ref={fileRef} onChange={e => {
                      const f = e.target.files[0];
                      if (!f) return;
                      setUploadFile(f);
                      setSuggestedVideos([]);
                      setYtNextPageToken(null);
                      cachedInstructionText.current = "";
                      handleSuggestVideos(f);
                    }} style={{ display: "none" }} />
                  </label>
                )}
              </div>

              {/* Additional attachments */}
              <div style={{ background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)", padding: "20px 24px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "12px" }}>Additional attachments (optional)</span>

                {materialEditId && selectedMat?.files?.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
                    {selectedMat.files.map(f => (
                      <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", color: deleteAttachmentIds.includes(f.id) ? "var(--text-faint)" : "var(--text-muted)", background: deleteAttachmentIds.includes(f.id) ? "#fef2f2" : "var(--surface-alt)", padding: "8px 12px", borderRadius: "8px", border: `1px solid ${deleteAttachmentIds.includes(f.id) ? "#fca5a5" : "var(--border)"}`, textDecoration: deleteAttachmentIds.includes(f.id) ? "line-through" : "none" }}>
                        <span>📄 {f.file_name}</span>
                        <button type="button" onClick={() => setDeleteAttachmentIds(prev => prev.includes(f.id) ? prev.filter(x => x !== f.id) : [...prev, f.id])}
                          style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "12px", color: deleteAttachmentIds.includes(f.id) ? "#22c55e" : "#ef4444" }}>
                          {deleteAttachmentIds.includes(f.id) ? "↩ Restore" : "× Remove"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {uploadExtraFiles.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
                    {uploadExtraFiles.map((f, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", color: "var(--text)", background: "#f8f9ff", padding: "8px 12px", borderRadius: "8px", border: "1px solid #c7d2fe" }}>
                        <span>📎 {f.name}</span>
                        <button type="button" onClick={() => setUploadExtraFiles(prev => prev.filter((_, idx) => idx !== i))}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: "14px" }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                <input ref={extraFileRef} type="file" multiple style={{ display: "none" }}
                  onChange={e => {
                    const picked = Array.from(e.target.files);
                    setUploadExtraFiles(prev => [...prev, ...picked]);
                    e.target.value = "";
                  }} />
                <button type="button" onClick={() => extraFileRef.current?.click()}
                  style={{ fontSize: "13px", color: "#3B37CC", background: "var(--primary-tint)", border: "1px solid #a5b4fc", borderRadius: "8px", padding: "8px 16px", cursor: "pointer", fontWeight: 600 }}>
                  + Add files
                </button>
              </div>

              {uploadError && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "12px 16px", color: "#dc2626", fontSize: "13px" }}>
                  {uploadError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Editable comment content — shows edit/delete only for the comment's own author ──
function CommentContent({ comment, isMine, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.content);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { data } = await API.put(`/classroom/comments/${comment.id}`, { content: text.trim() });
      onUpdate(data);
      setEditing(false);
    } catch (err) { console.error(err); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!window.confirm("Delete this comment?")) return;
    setBusy(true);
    try {
      await API.delete(`/classroom/comments/${comment.id}`);
      onDelete();
    } catch (err) { console.error(err); }
    finally { setBusy(false); }
  }

  if (editing) {
    return (
      <div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={2} autoFocus
          style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "6px", padding: "6px 8px", fontSize: "13px", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
        <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
          <button onClick={save} disabled={busy || !text.trim()} style={{ fontSize: "11px", fontWeight: 700, color: "#3B37CC", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Save</button>
          <button onClick={() => { setEditing(false); setText(comment.content); }} style={{ fontSize: "11px", color: "#9aa0a6", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <span>
      {comment.content}
      {isMine && (
        <span style={{ marginLeft: "8px", whiteSpace: "nowrap" }}>
          <button onClick={() => setEditing(true)} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: "#9aa0a6", padding: "0 2px" }}>✏️</button>
          <button onClick={remove} disabled={busy} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: "#9aa0a6", padding: "0 2px" }}>🗑️</button>
        </span>
      )}
    </span>
  );
}

// ── Submission Comments (inline, for teacher's assignment detail) ──
function SubmissionComments({ assignId, studentId, studentName, myName, myId }) {
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
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "10px" }}>
      <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "8px", letterSpacing: "0.05em" }}>
        🔒 PRIVATE COMMENT — {studentName}
      </div>
      <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", marginBottom: "8px" }}>
        {comments.length === 0
          ? <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>No comments yet.</div>
          : comments.map((c, i) => (
            <div key={i} style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              <span style={{ fontWeight: 700 }}>{c.author_name || (c.author_id === studentId ? studentName : myName)}:</span>{" "}
              <CommentContent comment={c} isMine={c.author_id === myId}
                onUpdate={updated => setComments(prev => prev.map(x => x.id === c.id ? updated : x))}
                onDelete={() => setComments(prev => prev.filter(x => x.id !== c.id))} />
            </div>
          ))
        }
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Add private comment..." style={{ flex: 1, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
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
    <div style={{ background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--surface-alt)", background: "#fafafa" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>{icon}</span>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>{title}</span>
        </div>
        <button onClick={onMore} style={{ fontSize: "12px", color: "#3B37CC", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
          More »
        </button>
      </div>
      <div style={{ padding: "6px 18px 10px" }}>
        {empty
          ? <div style={{ fontSize: "13px", color: "var(--text-faint)", padding: "12px 0" }}>{emptyMsg}</div>
          : children
        }
      </div>
    </div>
  );
}

function StreamRow({ label, date, badge, badgeColor, onClick, actions }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--surface-alt)", cursor: onClick ? "pointer" : "default", gap: "6px" }}
      onMouseEnter={e => onClick && (e.currentTarget.style.background = "var(--surface-alt)")}
      onMouseLeave={e => onClick && (e.currentTarget.style.background = "transparent")}>
      <span style={{ fontSize: "13px", color: "var(--text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        · {label}
      </span>
      {actions}
      {badge && <span style={{ fontSize: "11px", color: badgeColor || "var(--text-muted)", fontWeight: 600, flexShrink: 0 }}>{badge}</span>}
      {date && !badge && <span style={{ fontSize: "11px", color: "var(--text-faint)", flexShrink: 0 }}>{date}</span>}
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
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>{post.author_name}</div>
          <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>{formatDate(post.created_at)}</div>
        </div>
        {isMaterial && (
          <span style={{ marginLeft: "auto", background: "var(--primary-tint)", color: "#3B37CC", fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px" }}>
            📄 Material
          </span>
        )}
        {isTeacher && !isMaterial && (
          <div style={{ marginLeft: isMaterial ? "8px" : "auto", display: "flex", gap: "6px" }}>
            <button onClick={() => onEdit(post)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "var(--text-faint)", padding: "2px 6px" }} title="Edit">✏️</button>
            <button onClick={() => onDelete(post.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "#ef4444", padding: "2px 6px" }} title="Delete">🗑️</button>
          </div>
        )}
      </div>

      {/* Content */}
      <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 12px" }}>
        {post.content}
      </p>

      {/* Material card */}
      {isMaterial && post.material_title && (
        <div style={matPostCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>{post.material_title}</div>
              {post.material_instructions && (
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>{post.material_instructions}</div>
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
      <div style={{ borderTop: "1px solid var(--surface-alt)", marginTop: "12px", paddingTop: "10px" }}>
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
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{c.content}</span>
                <div style={{ fontSize: "11px", color: "var(--text-faint)", marginTop: "2px" }}>{formatDate(c.created_at)}</div>
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
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)", marginBottom: "12px" }}>
            Q{i + 1}. {q.question}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {q.options.map((opt, j) => {
              const letter = opt[0];
              const isSelected = answers[i] === letter;
              const isCorrect = letter === q.answer;
              let bg = "#fff", border = "1px solid var(--border)", color = "var(--text-muted)";
              if (submitted) {
                if (isCorrect) { bg = "#f0fdf4"; border = "2px solid #22c55e"; color = "#15803d"; }
                else if (isSelected) { bg = "#fef2f2"; border = "2px solid #ef4444"; color = "#dc2626"; }
              } else if (isSelected) {
                bg = "var(--primary-tint)"; border = "2px solid #3B37CC"; color = "#3B37CC";
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
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px", fontStyle: "italic" }}>
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
        <div style={{ background: score === questions.length ? "#f0fdf4" : "var(--primary-tint)", borderRadius: "10px", padding: "16px", textAlign: "center" }}>
          <div style={{ fontSize: "28px", fontWeight: 800, color: score === questions.length ? "#15803d" : "#3B37CC" }}>
            {score}/{questions.length}
          </div>
          <div style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "4px" }}>
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
const layout = { display: "flex", minHeight: "100vh", background: "var(--bg)" };

const topHeader = {
  background: "var(--surface)", borderBottom: "1px solid var(--border)",
  padding: "14px 28px", display: "flex", alignItems: "center",
  justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50,
};

const backBtn = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: "18px", color: "var(--text-muted)", padding: "4px 8px",
};

const tabBtn = (active) => ({
  padding: "8px 18px", borderRadius: "8px", border: "none",
  fontSize: "14px", fontWeight: 600, cursor: "pointer",
  background: active ? "#3B37CC" : "transparent",
  color: active ? "#fff" : "var(--text-muted)",
});

const avatarSm = {
  width: "36px", height: "36px", borderRadius: "50%",
  background: "var(--border)", display: "flex", alignItems: "center",
  justifyContent: "center", fontSize: "14px", fontWeight: 700, color: "var(--text-muted)",
};

const announceCard = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "12px", padding: "16px 20px", marginBottom: "20px",
};

const announceTextarea = {
  flex: 1, border: "none", outline: "none", fontSize: "14px",
  color: "var(--text-muted)", resize: "none", background: "transparent",
  fontFamily: "inherit", lineHeight: 1.6,
};

const postBtn = {
  background: "#3B37CC", color: "#fff", border: "none",
  borderRadius: "8px", padding: "8px 20px", fontSize: "13px",
  fontWeight: 600, cursor: "pointer",
};

const postCard = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "12px", padding: "20px", marginBottom: "16px",
};

const matPostCard = {
  background: "var(--bg)", border: "1px solid var(--border)",
  borderRadius: "10px", padding: "14px 16px", marginBottom: "4px",
};

const dlBtn = {
  background: "#3B37CC", color: "#fff", textDecoration: "none",
  borderRadius: "8px", padding: "7px 14px", fontSize: "13px",
  fontWeight: 600, flexShrink: 0,
};

const commentToggle = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: "13px", color: "var(--text-muted)", fontWeight: 500, padding: "4px 0",
};

const commentRow = {
  display: "flex", gap: "10px", marginBottom: "10px", alignItems: "flex-start",
};

const commentAvatar = {
  width: "28px", height: "28px", borderRadius: "50%", background: "var(--border)",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", flexShrink: 0,
};

const commentBubble = {
  background: "var(--surface-alt)", borderRadius: "12px", padding: "8px 12px",
  fontSize: "13px", color: "var(--text-muted)", flex: 1,
};

const commentInput = {
  flex: 1, padding: "8px 14px", borderRadius: "20px",
  border: "1px solid var(--border)", fontSize: "13px", outline: "none",
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
  marginTop: "14px", background: "var(--surface)", color: "#3B37CC",
  border: "none", borderRadius: "8px", padding: "8px 16px",
  fontSize: "13px", fontWeight: 600, cursor: "pointer", width: "100%",
};

const sideCard = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "14px", padding: "16px 20px",
};

const banner = {
  background: "linear-gradient(135deg, #3B37CC, #6366F1)",
  borderRadius: "14px", padding: "24px 28px",
  display: "flex", justifyContent: "space-between",
  alignItems: "center", marginBottom: "24px",
};

const newMatBtn = {
  background: "var(--surface)", color: "#3B37CC", border: "none",
  borderRadius: "8px", padding: "10px 20px", fontSize: "13px",
  fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
};

const weekLabel = {
  fontSize: "12px", fontWeight: 700, color: "var(--text-faint)",
  textTransform: "uppercase", letterSpacing: "1px", padding: "14px 0 6px",
};

const matRow = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "14px 18px", background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "10px", marginBottom: "3px", cursor: "pointer",
};

const matIcon = {
  width: "36px", height: "36px", borderRadius: "8px",
  background: "var(--primary-tint)", display: "flex", alignItems: "center",
  justifyContent: "center", fontSize: "16px", flexShrink: 0,
};

const fileChip = {
  display: "flex", alignItems: "center", gap: "8px",
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px",
  padding: "8px 14px", fontSize: "13px", color: "var(--text-muted)",
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
  padding: "12px 16px", background: "var(--surface)", borderRadius: "10px",
  border: "1px solid var(--border)", marginBottom: "4px",
};

const memberAvatar = {
  width: "40px", height: "40px", borderRadius: "50%",
  background: "var(--border)", color: "var(--text-muted)", display: "flex",
  alignItems: "center", justifyContent: "center",
  fontSize: "16px", fontWeight: 700, flexShrink: 0,
};

const overlayStyle = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
};

const modalStyle = {
  background: "var(--surface)", borderRadius: "16px", padding: "28px",
  width: "420px", maxWidth: "92vw",
};

const btnPrimary = {
  background: "#3B37CC", color: "#fff", padding: "11px 20px",
  borderRadius: "10px", fontSize: "14px", fontWeight: 600,
  border: "none", cursor: "pointer", width: "100%",
};

const btnOutline = {
  background: "var(--surface)", color: "var(--text-muted)", padding: "11px 20px",
  borderRadius: "10px", fontSize: "14px", fontWeight: 600,
  border: "1px solid var(--border)", cursor: "pointer", width: "100%",
};

const lbl = { display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" };
const inp = { width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "14px", outline: "none", boxSizing: "border-box" };

const aiMentorPanel = {
  background: "var(--surface)", border: "1px solid var(--border)",
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
