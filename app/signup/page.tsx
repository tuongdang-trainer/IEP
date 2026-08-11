'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [team, setTeam] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setLoading(true)
    setMessage('')

    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          team,
        },
      },
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setMessage(
      'Đăng ký thành công. Vui lòng kiểm tra email để xác nhận tài khoản.'
    )

    setLoading(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold">
          Đăng ký IEP
        </h1>

        <p className="mb-6 text-sm text-gray-600">
          Tạo tài khoản để bắt đầu bài kiểm tra.
        </p>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Họ và tên
            </label>

            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Nguyễn Văn A"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Team
            </label>

            <input
              type="text"
              value={team}
              onChange={(event) => setTeam(event.target.value)}
              required
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Team 1"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-lg border px-3 py-2"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Mật khẩu
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Tối thiểu 6 ký tự"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>

          {message && (
            <p className="text-sm text-gray-700">
              {message}
            </p>
          )}
        </form>
      </div>
    </main>
  )
}