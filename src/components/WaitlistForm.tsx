'use client'

import { useState, type FormEvent, type ReactNode } from 'react'

type FormStatus = 'idle' | 'loading' | 'success' | 'error'

export default function WaitlistForm(): ReactNode {
  const [email, setEmail] = useState<string>('')
  const [status, setStatus] = useState<FormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    setErrorMessage(null)
    setStatus('loading')

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data: { success: boolean; message?: string } = await res.json()

      if (!data.success) {
        throw new Error(data.message || 'Something went wrong')
      }

      setStatus('success')
      setTimeout((): void => {
        setEmail('')
        setStatus('idle')
      }, 3000)
    } catch (error) {
      setStatus('error')
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Connection failed. Please try again.'
      )
    }
  }

  return (
    <form className="waitlist-form" onSubmit={handleSubmit} aria-label="Join waitlist">
      <label htmlFor="waitlist-email" className="sr-only">
        Email address
      </label>
      <input
        id="waitlist-email"
        type="email"
        className="waitlist-input"
        placeholder="your@email.com"
        value={email}
        onChange={(e): void => setEmail(e.target.value)}
        disabled={status === 'loading'}
        required
        aria-invalid={status === 'error'}
        aria-describedby={
          status === 'error' ? 'waitlist-error' :
          status === 'success' ? 'waitlist-success' :
          undefined
        }
      />
      <button
        type="submit"
        className="waitlist-btn"
        disabled={status === 'loading'}
        aria-busy={status === 'loading'}
      >
        {status === 'loading' ? 'joining...' : 'join waitlist'}
      </button>

      {status === 'success' && (
        <div id="waitlist-success" role="status" aria-live="polite" className="waitlist-msg">
          you're on the list!
        </div>
      )}

      {status === 'error' && errorMessage && (
        <div id="waitlist-error" role="alert" aria-live="polite" className="waitlist-msg">
          {errorMessage}
        </div>
      )}
    </form>
  )
}
