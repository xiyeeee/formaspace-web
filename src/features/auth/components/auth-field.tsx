import { useId, useState } from 'react'
import type { ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type AuthFieldProps = ComponentProps<'input'> & { label: string; error?: string; password?: boolean }

export const AuthField = ({ label, error, password = false, ...props }: AuthFieldProps) => {
  const id = useId()
  const [visible, setVisible] = useState(false)
  return (
    <div className="auth-field">
      <Label htmlFor={id}>{label}</Label>
      <div className="auth-input-wrap">
        <Input {...props} id={id} className={`auth-input ${password ? 'auth-input-password' : ''}`} type={password ? (visible ? 'text' : 'password') : props.type}
          aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />
        {password && <button type="button" className="auth-password-toggle" aria-label={`${visible ? '隐藏' : '显示'}${label}`} aria-pressed={visible} onClick={() => setVisible((value) => !value)}>
          {visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
        </button>}
      </div>
      <p id={`${id}-error`} className="auth-field-error">{error || '\u00a0'}</p>
    </div>
  )
}
