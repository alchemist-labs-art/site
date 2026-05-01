import { NextResponse } from 'next/server'

const LOOPS_API_URL = 'https://app.loops.so/api/contacts/create'

export async function POST(request: Request): Promise<NextResponse> {
  const apiKey = process.env.LOOPS_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: 'Server configuration error' },
      { status: 500 },
    )
  }

  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid request body' },
      { status: 400 },
    )
  }

  const email = body.email?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json(
      { success: false, message: 'Email is required' },
      { status: 400 },
    )
  }

  const res = await fetch(LOOPS_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      source: 'alkera-website',
      subscribed: true,
    }),
  })

  const text = await res.text()
  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(text)
  } catch { /* empty or non-JSON response */ }

  if (!res.ok) {
    const message = res.status === 409
      ? "You're already on the waitlist!"
      : (data.message as string) || 'Something went wrong'
    return NextResponse.json({ success: false, message }, { status: res.status })
  }

  return NextResponse.json({ success: true, id: data.id })
}
