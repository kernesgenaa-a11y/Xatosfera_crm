import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { LanguageToggle } from '@/components/LanguageToggle';
import LOGO_SRC from '@/assets/log.png';
import BG from '@/assets/5.png';

// ─── Icons ────────────────────────────────────────────────────────────────────

const EmailIcon = () => (
  <svg className="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m2 7 10 7 10-7" />
  </svg>
);

const LockIcon = () => (
  <svg className="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat-item">
      <div className="stat-val">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function LeftPanel() {
  return (
    <div className="login-left">
      <div className="left-logo-wrap">
        <div className="left-glow" />
        <img src={LOGO_SRC} alt="Хатосфера" />
      </div>

      <div className="left-brand">
        <div className="left-brand-name">
          Хатосфера <span>CRM</span>
        </div>
        <div className="left-brand-sub">Система управління нерухомістю</div>
      </div>

      <div className="left-divider" />

      <div className="left-tagline">
        Ваш надійний інструмент<br />для роботи з нерухомістю
      </div>

      <div className="left-stats">
        <StatItem value="150+" label="Об'єктів" />
        <StatItem value="50+"  label="Угод" />
        <StatItem value="₴2M+" label="Обсяг" />
      </div>
    </div>
  );
}

function MobileLogo() {
  return (
    <div className="mobile-logo">
      <img src={LOGO_SRC} alt="Хатосфера" />
      <div className="mobile-brand-name">
        Хатосфера <span>CRM</span>
      </div>
    </div>
  );
}

interface PasswordToggleProps {
  show: boolean;
  onToggle: () => void;
}

function PasswordToggle({ show, onToggle }: PasswordToggleProps) {
  return (
    <button
      type="button"
      className="eye-btn"
      onClick={onToggle}
      aria-label={show ? 'Сховати пароль' : 'Показати пароль'}
    >
      {show
        ? <EyeOff style={{ width: 15, height: 15 }} />
        : <Eye    style={{ width: 15, height: 15 }} />
      }
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const LoginPage = () => {
  const { t } = useLanguage();
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success(t('common.success'));
      navigate('/dashboard');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{STYLES}</style>

      <div className="login-root">
        <img src={BG} className="bg" alt="" aria-hidden="true" />

        <LeftPanel />

        {/* Right panel */}
        <div className="login-right">
          <div className="lang-toggle-wrap">
            <LanguageToggle variant="default" />
          </div>

          <MobileLogo />

          <div className="form-card">
            <h1 className="form-heading">Вхід</h1>
            <p className="form-subheading">Введіть ваші дані для входу</p>

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div className="field-wrap">
                <label className="field-label" htmlFor="login-email">Email</label>
                <div className="field-input-wrap">
                  <EmailIcon />
                  <input
                    id="login-email"
                    type="email"
                    className="field-input"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="field-wrap">
                <label className="field-label" htmlFor="login-password">Пароль</label>
                <div className="field-input-wrap">
                  <LockIcon />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="field-input field-input-pr"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <PasswordToggle
                    show={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                  />
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                <span className="submit-btn-inner">
                  {loading && (
                    <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                  )}
                  {loading ? 'Завантаження...' : 'Увійти'}
                </span>
              </button>
            </form>

            <div className="form-footer">
              <span className="form-footer-text">
                Немає акаунту?{' '}
                <Link to="/register" className="form-footer-link">
                  Зареєструватись
                </Link>
              </span>
            </div>
          </div>

          <div className="bottom-line" />
        </div>
      </div>
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Montserrat:wght@300;400;500;600&display=swap');

  /* Layout */
  .login-root {
    min-height: 100vh;
    display: flex;
    font-family: 'Montserrat', sans-serif;
    position: relative;
    overflow: hidden;
  }
  .bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: -1;
  }

  /* Left panel */
  .login-left {
    display: none;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 60px;
    position: relative;
    border-right: 1px solid rgba(32, 32, 32, 0.39);
    
  }
  @media (min-width: 1024px) {
    .login-left { display: flex; }
  }

  /* Logo */
  .left-logo-wrap {
    width: 200px;
    height: 200px;
    position: relative;
    margin-bottom: 40px;
    animation: logoReveal 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    opacity: 0;
    transform: scale(0.85);
  }
  .left-logo-wrap img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 0 40px rgba(80,100,150,0.35));
  }
  .left-glow {
    position: absolute;
    inset: -30%;
    background: radial-gradient(circle, rgba(100,130,180,0.14) 0%, transparent 70%);
    pointer-events: none;
    animation: pulse 4s ease-in-out infinite;
  }

  /* Brand */
  .left-brand {
    backdrop-filter: blur(8px);
    border: 1px solid rgba(230, 239, 248, 0);
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(20,40,80,0.10), 0 1.5px 6px rgba(20,40,80,0.06);
    text-align: center;
    animation: fadeUp 1s 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
    padding: 8px 10px 6px;
  }
  .left-brand-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: 42px;
    font-weight: 400;
    letter-spacing: 6px;
    color: #1a2646;
    text-transform: uppercase;
    line-height: 1;
    margin: 0 0 8px;
    
  }
  .left-brand-name span { color: #244073; }
  .left-brand-sub {
    font-size: 10px;
    letter-spacing: 5px;
    color: rgba(20, 18, 18, 0.93);
    text-transform: uppercase;
    font-weight: 700;
  }

  .left-divider {
    width: 1px;
    height: 60px;
    background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.19), transparent);
    margin: 40px auto;
    animation: fadeUp 1s 0.5s both;
  }
  .left-tagline {
    font-family: 'Cormorant Garamond', serif;
    font-size: 18px;
    font-weight: 400;
    color: rgb(20, 20, 20);
    text-align: center;
    letter-spacing: 2px;
    line-height: 1.8;
    max-width: 300px;
    animation: fadeUp 1s 0.6s both;
        backdrop-filter: blur(8px);
    border: 1px solid rgba(200,210,220,0.45);
    border-radius: 20px;
    padding: 4px 5px 3px;
  }

  /* Stats */
  .left-stats {
    display: flex;
    gap: 40px;
    margin-top: 50px;
    animation: fadeUp 1s 0.7s both;
    backdrop-filter: blur(8px);
    border: 1px solid rgba(200,210,220,0.45);
    border-radius: 20px;
    padding: 4px 5px 3px;
  }
  .stat-item { text-align: center; }
  .stat-val {
    font-family: 'Cormorant Garamond', serif;
    font-size: 28px;
    font-weight: 700;
    color: #12385a;
    letter-spacing: 1px;
  }
  .stat-label {
    font-size: 9px;
    letter-spacing: 3px;
    color: rgb(20, 20, 20);
    text-transform: uppercase;
    margin-top: 4px;
  }

  /* Right panel */
  .login-right {
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 40px 24px;
    position: relative;
    border-radius: 0 20px 20px 0;
    background: rgba(255,255,255,0.18);
    
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.25);
  }
  @media (min-width: 1024px) {
    .login-right { width: 720px; flex-shrink: 0; padding: 48px 52px; }
  }

  .lang-toggle-wrap {
    position: absolute;
    top: 20px;
    right: 20px;
  }

  /* Mobile logo */
  .mobile-logo {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 36px;
  }
  @media (min-width: 1024px) {
    .mobile-logo { display: none; }
  }
  .mobile-logo img {
    width: 80px;
    height: 80px;
    object-fit: contain;
    filter: drop-shadow(0 0 20px rgba(80, 100, 150, 0.23));
    margin-bottom: 12px;
  }
  .mobile-brand-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: 26px;
    font-weight: 400;
    letter-spacing: 4px;
    color: #0a0a0a;
    text-transform: uppercase;
  }
  .mobile-brand-name span { color: #243f6b; }

  /* Form card */
  .form-card {
    width: 100%;
    max-width: 420px;
    animation: fadeUp 0.8s 0.1s both;
    backdrop-filter: blur(4px);
    border: 1px solid rgba(200,210,220,0.45);
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(20,40,80,0.10), 0 1.5px 6px rgba(20,40,80,0.06);
    backdrop-filter: blur(6px);
    padding: 36px 40px 32px;
    overflow: hidden;
  }
  .form-heading {
    font-family: 'Cormorant Garamond', serif;
    font-size: 30px;
    font-weight: 400;
    color: #0a0a0a;
    letter-spacing: 3px;
    text-transform: uppercase;
    text-align: center;
    margin: 0 0 8px;
  }
  .form-subheading {
    font-size: 11px;
    letter-spacing: 3px;
    color: rgba(10, 10, 10, 0.92);
    text-transform: uppercase;
    text-align: center;
    margin: 0 0 40px;
  }

  /* Fields */
  .field-wrap { margin-bottom: 20px; }
  .field-label {
    display: block;
    font-size: 10px;
    letter-spacing: 3px;
    color: rgba(10,10,10,0.7);
    text-transform: uppercase;
    margin-bottom: 10px;
    font-weight: 700;
  }
  .field-input-wrap { position: relative; }
  .field-icon {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(20,40,80,0.55);
    width: 15px;
    height: 15px;
    pointer-events: none;
  }
  .field-input {
    width: 100%;
    background: rgba(255,255,255,0.88);
    border: 1px solid rgba(255,255,255,0.4);
    border-radius: 10px;
    padding: 14px 16px 14px 44px;
    color: #0f0f0f;
    font-family: 'Montserrat', sans-serif;
    font-size: 13px;
    font-weight: 400;
    letter-spacing: 1px;
    outline: none;
    transition: border-color 0.3s, background 0.3s;
    box-sizing: border-box;
  }
  .field-input::placeholder { color: rgba(20,20,20,0.45); }
  .field-input:focus {
    border-color: rgba(126, 168, 241, 0.9);
    background: rgba(255,255,255,0.96);
  }
  .field-input-pr { padding-right: 44px; }

  /* Prevent iOS auto-zoom on input focus (requires font-size >= 16px on mobile) */
  @media (max-width: 768px) {
    .field-input { font-size: 16px; }
  }

  /* Eye button */
  .eye-btn {
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(20,40,80,0.55);
    padding: 4px;
    transition: color 0.2s;
    display: flex;
    align-items: center;
  }
  .eye-btn:hover { color: rgba(10,30,70,0.9); }

  /* Submit button */
  .submit-btn {
    width: 100%;
    margin-top: 32px;
    padding: 15px;
    background: transparent;
    border: 1px solid rgba(140,170,220,0.65);
    border-radius: 10px;
    color: #1a2535;
    font-family: 'Montserrat', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 5px;
    text-transform: uppercase;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: border-color 0.3s, color 0.3s;
  }
  .submit-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(100,130,185,0.22), rgba(70,100,160,0.18));
    opacity: 0;
    transition: opacity 0.3s;
  }
  .submit-btn:hover:not(:disabled) {
    border-color: rgba(140,170,220,0.97);
    color: #0d1520;
  }
  .submit-btn:hover:not(:disabled)::before { opacity: 1; }
  .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .submit-btn-inner {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  /* Footer */
  .form-footer {
    margin-top: 28px;
    text-align: center;
  }
  .form-footer-text {
    font-size: 11px;
    letter-spacing: 1px;
    color: rgba(10,10,10,0.6);
  }
  .form-footer-link {
    color: rgba(20,50,100,0.85);
    text-decoration: none;
    letter-spacing: 1px;
    transition: color 0.2s;
    font-weight: 500;
  }
  .form-footer-link:hover { color: rgb(15,40,85); }

  .bottom-line {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18) 50%, transparent);
  }

  /* Animations */
  @keyframes logoReveal {
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50%       { opacity: 1;   transform: scale(1.08); }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
