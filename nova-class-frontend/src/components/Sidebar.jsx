import { NavLink, useNavigate } from "react-router-dom";
import { useLang } from "../LanguageContext";

export default function Sidebar() {
  const navigate = useNavigate();
  const name = localStorage.getItem("nova_name") || "Student";
  const { t } = useLang();

  const navItems = [
    { path: "/",         icon: "⊞",  key: "dashboard"  },
    { path: "/classroom",icon: "🎓",  key: "classroom"  },
    { path: "/kmate",    icon: "🤖",  key: "kmate"      },
    { path: "/exam",     icon: "📝",  key: "examMode"   },
    { path: "/settings", icon: "⚙️",  key: "settings"   },
  ];

  function logout() {
    localStorage.removeItem("nova_token");
    localStorage.removeItem("nova_name");
    localStorage.removeItem("nova_role");
    localStorage.removeItem("nova_email");
    navigate("/login");
  }

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logo}>
        <span style={styles.logoText}>Nova Class</span>
        <span style={styles.logoSub}>Educational Portal</span>
      </div>

      <nav style={styles.nav}>
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            style={({ isActive }) => ({
              ...styles.navItem,
              ...(isActive ? styles.navActive : {}),
            })}
          >
            <span style={styles.navIcon}>{item.icon}</span>
            {t(item.key)}
          </NavLink>
        ))}
      </nav>

      <div style={styles.bottom}>
        <div style={styles.userBox}>
          <div style={styles.avatar}>{name[0]?.toUpperCase()}</div>
          <div>
            <div style={styles.userName}>{name}</div>
          </div>
        </div>
        <button onClick={logout} style={styles.logoutBtn}>{t("logout")}</button>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: "240px", minHeight: "100vh", background: "#fff",
    borderRight: "1px solid #e5e7eb", display: "flex",
    flexDirection: "column", padding: "24px 16px", position: "fixed",
    top: 0, left: 0,
  },
  logo: { padding: "8px 12px 24px", borderBottom: "1px solid #e5e7eb", marginBottom: "16px" },
  logoText: { display: "block", fontWeight: 700, fontSize: "18px", color: "#3B37CC" },
  logoSub: { fontSize: "12px", color: "#6b7280" },
  nav: { display: "flex", flexDirection: "column", gap: "4px", flex: 1 },
  navItem: {
    display: "flex", alignItems: "center", gap: "10px",
    padding: "10px 12px", borderRadius: "8px", fontSize: "14px",
    fontWeight: 500, color: "#6b7280", transition: "all 0.2s",
  },
  navActive: { background: "#3B37CC", color: "#fff" },
  navIcon: { fontSize: "16px" },
  bottom: { borderTop: "1px solid #e5e7eb", paddingTop: "16px" },
  userBox: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" },
  avatar: {
    width: "36px", height: "36px", borderRadius: "50%",
    background: "#3B37CC", color: "#fff", display: "flex",
    alignItems: "center", justifyContent: "center", fontWeight: 700,
  },
  userName: { fontSize: "14px", fontWeight: 600, color: "#1a1a2e" },
  userRole: { fontSize: "11px", color: "#6b7280", textTransform: "uppercase" },
  logoutBtn: {
    width: "100%", padding: "8px", background: "#f5f5f5",
    borderRadius: "8px", fontSize: "13px", color: "#ef4444",
    fontWeight: 600, border: "none",
  },
};
