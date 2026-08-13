import { NavLink, useNavigate } from "react-router-dom";
import { useLang } from "../LanguageContext";
import Icon from "./Icon";

export default function Sidebar() {
  const navigate = useNavigate();
  const name = localStorage.getItem("nova_name") || "Student";
  const { t } = useLang();

  const navItems = [
    { path: "/",         icon: "dashboard",      key: "dashboard"  },
    { path: "/classroom",icon: "graduation-cap", key: "classroom"  },
    { path: "/kmate",    icon: "bot",            key: "kmate"      },
    { path: "/exam",     icon: "quiz",           key: "examMode"   },
    { path: "/settings", icon: "settings",       key: "settings"   },
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
            <Icon name={item.icon} size={16} style={styles.navIcon} />
            {item.label || t(item.key)}
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
        <a href="https://icons8.com" target="_blank" rel="noreferrer" style={styles.iconCredit}>
          Icons by Icons8
        </a>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: "240px", minHeight: "100vh", background: "var(--surface)",
    borderRight: "1px solid var(--border)", display: "flex",
    flexDirection: "column", padding: "24px 16px", position: "fixed",
    top: 0, left: 0,
  },
  logo: { padding: "8px 12px 24px", borderBottom: "1px solid var(--border)", marginBottom: "16px" },
  logoText: { display: "block", fontWeight: 700, fontSize: "18px", color: "var(--primary)" },
  logoSub: { fontSize: "12px", color: "var(--text-muted)" },
  nav: { display: "flex", flexDirection: "column", gap: "4px", flex: 1 },
  navItem: {
    display: "flex", alignItems: "center", gap: "10px",
    padding: "10px 12px", borderRadius: "8px", fontSize: "14px",
    fontWeight: 500, color: "var(--text-muted)", transition: "all 0.2s",
  },
  navActive: { background: "var(--primary)", color: "#fff" },
  navIcon: { flexShrink: 0 },
  bottom: { borderTop: "1px solid var(--border)", paddingTop: "16px" },
  userBox: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" },
  avatar: {
    width: "36px", height: "36px", borderRadius: "50%",
    background: "var(--primary)", color: "#fff", display: "flex",
    alignItems: "center", justifyContent: "center", fontWeight: 700,
  },
  userName: { fontSize: "14px", fontWeight: 600, color: "var(--text)" },
  userRole: { fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" },
  logoutBtn: {
    width: "100%", padding: "8px", background: "var(--surface-alt)",
    borderRadius: "8px", fontSize: "13px", color: "#ef4444",
    fontWeight: 600, border: "none",
  },
  iconCredit: {
    display: "block", textAlign: "center", marginTop: "10px",
    fontSize: "10px", color: "var(--text-faint)", textDecoration: "none",
  },
};
