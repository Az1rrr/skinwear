import { Link, useLocation } from "react-router-dom";

export default function NavBar() {
  const location = useLocation();

  const linkClass = (path: string) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
      location.pathname === path
        ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20"
        : "text-gray-400 hover:text-gray-200 hover:bg-surface-200"
    }`;

  return (
    <nav className="bg-surface-300 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-brand-500 font-bold text-lg mr-4">🎮 Skinwear</span>
          <Link to="/" className={linkClass("/")}>
            📋 向导
          </Link>
          <Link to="/calculator" className={linkClass("/calculator")}>
            🔢 磨损计算器
          </Link>
        </div>

        <div />
      </div>
    </nav>
  );
}
