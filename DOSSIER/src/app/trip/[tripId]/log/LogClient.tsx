'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Message } from '@/lib/types'

// Built on first use, never while rendering. A browser client constructed in a
// component body is also constructed during that component's server render,
// where there is no browser environment — which made `next build` depend on
// runtime configuration being present and fail wherever it was not.
let _sb: ReturnType<typeof createClient> | null = null
const sb = () => (_sb ??= createClient())


function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function formatDateDivider(ts: string) {
  const dt = new Date(ts)
  const weekday  = dt.toLocaleDateString('en-GB', { weekday: 'short' })
  const dayMonth = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${weekday} ${dayMonth}`
}

function MessageTypeBadge({ type }: { type: string | null }) {
  const map: Record<string, { bg: string; text: string }> = {
    update:   { bg: 'rgb(var(--night-rgb) / 0.10)',   text: 'var(--color-text-muted)' },
    feedback: { bg: 'rgb(var(--borges-rgb) / 0.2)',   text: 'var(--color-text-accent)' },
    request:  { bg: 'rgb(var(--night-rgb) / 0.10)',   text: 'var(--color-text-secondary)' },
    note:     { bg: 'rgb(var(--borges-rgb) / 0.10)', text: 'var(--color-text-muted)' },
  }
  if (!type) return null
  const style = map[type.toLowerCase()] ?? map['note']
  return (
    <span
      className="font-optima"
      style={{
        fontSize: 'var(--text-caption)',
        letterSpacing: '0.01em',
        padding: '2px 8px',
        borderRadius: '999px',
        backgroundColor: style.bg,
        color: style.text,
      }}
    >
      {type}
    </span>
  )
}

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  const isCQ = message.sender === 'cq' || message.sender === 'team'

  return (
    <div
      className="flex"
      style={{
        gap: '10px',
        flexDirection: isOwn ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
      }}
    >
      {/* Avatar */}
      <div className="flex-shrink-0" style={{ marginTop: '2px' }}>
        {isCQ ? (
          <div
            className="flex items-center justify-center"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-text-accent)',
            }}
          >
            <span className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-inverse)' }}>CQ</span>
          </div>
        ) : (
          <div
            className="flex items-center justify-center"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-text-secondary)',
              border: '0.5px solid rgb(var(--borges-rgb) / 0.17)',
            }}
          >
            <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
              {(message.sender_name?.[0] ?? 'C').toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div
        className="flex flex-col"
        style={{
          maxWidth: '72%',
          alignItems: isOwn ? 'flex-end' : 'flex-start',
          gap: '4px',
        }}
      >
        {/* Name + type badge */}
        <div className="flex items-center gap-2">
          {!isOwn && (
            <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
              {message.sender_name ?? (isCQ ? 'CloseQuarters' : 'You')}
            </span>
          )}
          <MessageTypeBadge type={message.message_type} />
        </div>

        {/* Bubble */}
        <div
          className="font-optima"
          style={{
            padding: '12px 16px',
            fontSize: 'var(--text-body)',
            lineHeight: 1.65,
            color: 'var(--color-text)',
            ...(isOwn
              ? {
                  backgroundColor: 'var(--color-text-secondary)',
                  border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
                  borderRadius: '12px 2px 12px 12px',
                }
              : {
                  backgroundColor: 'var(--color-surface-sunken)',
                  border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
                  borderRadius: '2px 12px 12px 12px',
                }
            ),
          }}
        >
          {message.content}
        </div>

        {/* Timestamp */}
        <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  )
}

const TYPE_OPTIONS = [
  { value: 'feedback', label: 'Feedback' },
  { value: 'request',  label: 'Request'  },
]

export default function LogClient({
  tripId,
  initialMessages,
  userId,
  tripStatus,
}: {
  tripId: string
  initialMessages: Message[]
  userId: string
  tripStatus?: string | null
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [content, setContent]   = useState('')
  const [messageType, setMessageType] = useState('feedback')
  const [sending, setSending]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isCrafting = (tripStatus ?? '').toLowerCase().includes('craft')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const channel = sb()
      .channel(`messages:${tripId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `trip_id=eq.${tripId}`,
      }, (payload) => setMessages(prev => [...prev, payload.new as Message]))
      .subscribe()
    return () => { sb().removeChannel(channel) }
  }, [tripId, sb()])

  const handleSend = async () => {
    if (!content.trim() || sending) return
    setSending(true)
    const { error } = await sb().from('messages').insert({
      trip_id:      tripId,
      sender:       'client',
      sender_name:  'You',
      message_type: messageType,
      content:      content.trim(),
      timestamp:    new Date().toISOString(),
    })
    setSending(false)
    if (!error) setContent('')
  }

  const grouped = messages.reduce<{ day: string; messages: Message[] }[]>((acc, msg) => {
    const day  = formatDateDivider(msg.timestamp)
    const last = acc[acc.length - 1]
    if (last && last.day === day) { last.messages.push(msg) }
    else { acc.push({ day, messages: [msg] }) }
    return acc
  }, [])

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 300px)', minHeight: '440px' }}>

      {/* ── Crafting stage info bar ── */}
      {isCrafting && (
        <div style={{
          backgroundColor: 'rgb(var(--borges-rgb) / 0.07)',
          border: '0.5px solid rgb(var(--borges-rgb) / 0.2)',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: '2px' }}>
            <circle cx="7" cy="7" r="6" stroke="#706E56" strokeWidth="1.1"/>
            <path d="M7 5v4M7 3.5v.5" stroke="#706E56" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
            You&rsquo;re in the <strong>Crafting</strong> stage. Share your feedback on the Blueprint &mdash; we&rsquo;re listening.
          </p>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: '16px' }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div
              className="flex items-center justify-center mb-5"
              style={{
                width: '52px', height: '52px', borderRadius: '50%',
                border: '0.5px solid rgb(var(--borges-rgb) / 0.14)', backgroundColor: 'var(--color-surface-sunken)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
                <path d="M20 2H2v14l4-4h14V2z" stroke="#6B696C" strokeWidth="1.3" strokeLinejoin="round"/>
                <path d="M7 8h8M7 11h5" stroke="#6B696C" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="font-optima" style={{ fontSize: 'var(--text-body)', marginBottom: '6px', color: 'var(--color-text)' }}>No messages yet.</p>
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
              Send feedback or requests to your CQ team.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {grouped.map(({ day, messages: dayMsgs }) => (
              <div key={day}>
                {/* Date divider */}
                <div className="flex items-center gap-3" style={{ margin: '4px 0 20px' }}>
                  <div style={{ flex: 1, height: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.10)' }} />
                  <span
                    className="font-optima whitespace-nowrap"
                    style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)' }}
                  >
                    ——— {day} ———
                  </span>
                  <div style={{ flex: 1, height: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.10)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {dayMsgs.map(msg => (
                    <MessageBubble key={msg.id} message={msg} isOwn={msg.sender === 'client'} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Compose area ── */}
      <div
        style={{
          marginTop: '12px',
          borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
          paddingTop: '16px',
        }}
      >
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Send a message to your CQ team…" aria-label="Send a message to your CQ team"
          className="w-full font-optima resize-none outline-none"
          style={{
            fontSize: 'var(--text-body)',
            color: 'var(--color-text)',
            backgroundColor: 'transparent',
            border: 'none',
            minHeight: '60px',
            lineHeight: 1.6,
            paddingBottom: '12px',
            caretColor: 'var(--color-text-accent)',
          }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
        />

        {/* Bottom bar: type pills + send */}
        <div
          className="flex items-center justify-between"
          style={{ borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.10)', paddingTop: '10px' }}
        >
          {/* Type pills */}
          <div className="flex gap-2">
            {TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setMessageType(opt.value)}
                className="font-optima transition-all"
                style={{
                  fontSize: 'var(--text-caption)',
                  letterSpacing: '0.01em',
                  padding: '5px 12px',
                  borderRadius: '999px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  ...(messageType === opt.value
                    ? opt.value === 'feedback'
                      ? { backgroundColor: 'rgb(var(--borges-rgb) / 0.2)', color: 'var(--color-text-accent)' }
                      : { backgroundColor: 'rgb(var(--night-rgb) / 0.3)', color: 'var(--color-text-secondary)' }
                    : { backgroundColor: 'rgb(var(--borges-rgb) / 0.10)', color: 'var(--color-text-muted)' }
                  ),
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Send button — ochre circle */}
          <button
            onClick={handleSend}
            disabled={!content.trim() || sending}
            className="flex items-center justify-center"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: !content.trim() || sending ? 'rgb(var(--borges-rgb) / 0.2)' : 'var(--color-text-accent)',
              border: 'none',
              cursor: !content.trim() || sending ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease',
              flexShrink: 0,
            }}
            aria-label="Send message"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M12 7H2M8 2l5 5-5 5" stroke={!content.trim() || sending ? 'var(--color-text-muted)' : 'var(--color-surface-sunken)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
