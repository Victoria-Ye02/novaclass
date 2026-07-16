import { useState } from "react";
import Sidebar from "../../components/Sidebar";
import { useLang } from "../../LanguageContext";

export default function Settings() {
  const name  = localStorage.getItem("nova_name") || "Student";
  const [notif, setNotif]   = useState(true);
  const [saved, setSaved]   = useState(false);
  const { lang, changeLang, t } = useLang();
  const my = lang === "my";

  function save() { setSaved(true); setTimeout(() => setSaved(false), 2000); }

  return (
    <div style={s.layout}>
      <Sidebar />
      <main style={s.main}>
        <div style={s.topbar}>
          <div>
            <h2 style={s.title}>⚙️ {t("settingsTitle")}</h2>
            <p style={s.sub}>{my ? "အကောင့်နှင့် ဦးစားပေးများ စီမံပါ" : "Manage your account and preferences"}</p>
          </div>
        </div>

        <div style={s.grid}>
          {/* Profile */}
          <div style={s.card}>
            <h3 style={s.cardTitle}>👤 {t("profile")}</h3>
            <div style={s.avatarRow}>
              <div style={s.bigAvatar}>{name[0]?.toUpperCase()}</div>
              <div>
                <div style={s.profileName}>{name}</div>
                <div style={s.profileRole}>{t("student")} · TOPIK II</div>
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>{my ? "ပြသမည့် အမည်" : "Display Name"}</label>
              <input style={s.inp} defaultValue={name} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Email</label>
              <input style={s.inp} placeholder="your@email.com" type="email" />
            </div>
          </div>

          {/* Language */}
          <div style={s.card}>
            <h3 style={s.cardTitle}>🌐 {t("appLanguage")}</h3>
            <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>{t("languageDesc")}</p>

            <div style={s.langRow}>
              {[
                { code: "en", flag: "🇬🇧", label: "English" },
                { code: "my", flag: "🇲🇲", label: "မြန်မာ" },
              ].map(l => (
                <div key={l.code}
                  onClick={() => changeLang(l.code)}
                  style={{
                    ...s.langCard,
                    border: lang === l.code ? "2.5px solid #3B37CC" : "2px solid #e5e7eb",
                    background: lang === l.code ? "#f0f4ff" : "#f9fafb",
                  }}>
                  <div style={{ fontSize: "30px" }}>{l.flag}</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: lang === l.code ? "#3B37CC" : "#374151", marginTop: "8px" }}>{l.label}</div>
                  {lang === l.code && <div style={s.langCheck}>✓</div>}
                </div>
              ))}
            </div>

            <div style={{ ...s.toggleRow, marginTop: "20px" }}>
              <div>
                <div style={s.toggleLabel}>{my ? "အသိပေးချက်" : "Notifications"}</div>
                <div style={s.toggleSub}>{my ? "စစ်ဆေးမှုများ အတွက် သတိပေးချက်" : "Get alerts for upcoming exams"}</div>
              </div>
              <div style={{ ...s.toggle, background: notif ? "#3B37CC" : "#e5e7eb" }}
                onClick={() => setNotif(!notif)}>
                <div style={{ ...s.toggleThumb, transform: notif ? "translateX(20px)" : "translateX(0)" }} />
              </div>
            </div>
          </div>

          {/* TOPIK Level */}
          <div style={s.card}>
            <h3 style={s.cardTitle}>🎯 TOPIK Target</h3>
            <div style={s.levelGrid}>
              {["Level 3","Level 4","Level 5","Level 6"].map((l, i) => (
                <div key={i} style={{ ...s.levelCard, ...(i === 1 ? s.levelActive : {}) }}>
                  <div style={s.levelNum}>{i+3}</div>
                  <div style={s.levelName}>{l}</div>
                  {i === 1 && <div style={s.levelBadge}>Current Goal</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Account */}
          <div style={s.card}>
            <h3 style={s.cardTitle}>🔐 {t("account")}</h3>
            <div style={s.field}>
              <label style={s.label}>{my ? "လက်ရှိ စကားဝှက်" : "Current Password"}</label>
              <input style={s.inp} type="password" placeholder="••••••••" />
            </div>
            <div style={s.field}>
              <label style={s.label}>{my ? "စကားဝှက် အသစ်" : "New Password"}</label>
              <input style={s.inp} type="password" placeholder="••••••••" />
            </div>
            <div style={s.dangerZone}>
              <div style={s.dangerTitle}>⚠️ {my ? "အန္တရာယ်ဇုန်" : "Danger Zone"}</div>
              <button style={s.dangerBtn}>{my ? "အကောင့် ဖျက်မည်" : "Delete Account"}</button>
            </div>
          </div>
        </div>

        <div style={s.saveRow}>
          {saved && <span style={s.savedMsg}>✅ {my ? "သိမ်းဆည်းပြီး!" : "Settings saved!"}</span>}
          <button style={s.saveBtn} onClick={save}>{t("saveChanges")}</button>
        </div>
      </main>
    </div>
  );
}

const s = {
  layout: { display: "flex", minHeight: "100vh", background: "#f5f5f5" },
  main: { marginLeft: "240px", flex: 1, padding: "24px 32px" },
  topbar: { marginBottom: "24px" },
  title: { fontSize: "22px", fontWeight: 700, color: "#1a1a2e" },
  sub: { fontSize: "13px", color: "#6b7280" },
  grid: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "20px", marginBottom: "24px" },
  card: { background: "#fff", borderRadius: "14px", padding: "24px", border: "1px solid #e5e7eb" },
  cardTitle: { fontSize: "16px", fontWeight: 700, marginBottom: "20px", color: "#1a1a2e" },
  avatarRow: { display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" },
  bigAvatar: { width: "56px", height: "56px", borderRadius: "50%", background: "#3B37CC", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: 700 },
  profileName: { fontSize: "18px", fontWeight: 700, color: "#1a1a2e" },
  profileRole: { fontSize: "13px", color: "#6b7280" },
  field: { marginBottom: "16px" },
  label: { display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" },
  inp: { width: "100%", padding: "10px 14px", border: "1.5px solid #e5e7eb", borderRadius: "10px", fontSize: "14px", color: "#1a1a2e", background: "#f9fafb", boxSizing: "border-box" },
  langRow: { display: "flex", gap: "12px" },
  langCard: { flex: 1, borderRadius: "12px", padding: "20px 16px", textAlign: "center", cursor: "pointer", position: "relative", transition: "all 0.15s" },
  langCheck: { position: "absolute", top: "8px", right: "10px", color: "#3B37CC", fontWeight: 800, fontSize: "14px" },
  toggleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid #f5f5f5" },
  toggleLabel: { fontSize: "14px", fontWeight: 600, color: "#1a1a2e" },
  toggleSub: { fontSize: "12px", color: "#9ca3af" },
  toggle: { width: "44px", height: "24px", borderRadius: "12px", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 },
  toggleThumb: { position: "absolute", top: "3px", left: "3px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", transition: "transform 0.2s" },
  levelGrid: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "12px" },
  levelCard: { border: "2px solid #e5e7eb", borderRadius: "10px", padding: "16px", textAlign: "center", cursor: "pointer" },
  levelActive: { border: "2px solid #3B37CC", background: "#ede9fe" },
  levelNum: { fontSize: "28px", fontWeight: 800, color: "#3B37CC" },
  levelName: { fontSize: "13px", color: "#6b7280", marginTop: "4px" },
  levelBadge: { background: "#3B37CC", color: "#fff", borderRadius: "4px", padding: "2px 8px", fontSize: "10px", fontWeight: 700, marginTop: "6px", display: "inline-block" },
  dangerZone: { marginTop: "20px", padding: "16px", background: "#fef2f2", borderRadius: "10px", border: "1px solid #fca5a5" },
  dangerTitle: { fontSize: "13px", fontWeight: 700, color: "#dc2626", marginBottom: "8px" },
  dangerBtn: { padding: "8px 16px", background: "#ef4444", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  saveRow: { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "16px" },
  savedMsg: { fontSize: "14px", color: "#10b981", fontWeight: 600 },
  saveBtn: { background: "#3B37CC", color: "#fff", padding: "12px 28px", borderRadius: "10px", fontSize: "15px", fontWeight: 700, border: "none", cursor: "pointer" },
};
