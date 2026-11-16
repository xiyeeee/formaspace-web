import { Link } from 'react-router'

export const AuthBrand = () => (
  <Link to="/login" className="auth-brand" aria-label="形境 FormaSpace 登录首页">
    <svg viewBox="0 0 56 48" width="52" height="45" fill="none" aria-hidden="true"><path d="M2 30 24 4h17L19 30H2Zm19 14 22-26h11L32 44H21Z" fill="currentColor" /><path d="m21 32 15-18v17L21 44V32Z" fill="currentColor" opacity=".6" /></svg>
    <span><strong>形境</strong><small>FORMA SPACE</small></span>
  </Link>
)
