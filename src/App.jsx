import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import QRCode from 'react-qr-code'
import { Html5Qrcode } from 'html5-qrcode'
import { toPng } from 'html-to-image'

// ============== CONFIG ==============
const CONFIG = {
  storeName: 'Music Box Antimorning',
  tagline: 'Karaoke phòng mini',
  discountPercent: 20,
  openingText: '30/6 – 6/7/2026',
  supabaseUrl: 'https://fpkexhtebxrqzpjwpfco.supabase.co',
  supabaseAnonKey: 'sb_publishable_LB_T-OsxRFgsaN2dMiugQg_kwPhNl3a',
}
// ======================================

let supabase = null
try {
  supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey)
} catch {
  supabase = null
}

const LOCAL_STORAGE_KEY = 'kt_voucher_code'
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // bỏ O,0,I,1

function randomCode() {
  let s = ''
  for (let i = 0; i < 8; i++) {
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return `KT-${s}`
}

function detectDevice() {
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'Khác'
}

function isInAppBrowser() {
  // Trinh duyet nhung cua Zalo/Facebook/Messenger chan hanh dong <a download>
  // (hien dialog "thoat app" roi bao loi). Cac trinh duyet nay deu de lai
  // dau hieu rieng trong User-Agent.
  return /zalo|FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\//i.test(navigator.userAgent || '')
}

function formatDate(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString('vi-VN')
  } catch {
    return String(value)
  }
}

function isUniqueViolation(error) {
  if (!error) return false
  return error.code === '23505' || /duplicate key/i.test(error.message || '')
}

function KaraokeIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="kt-gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff2cc" />
          <stop offset="50%" stopColor="#d4af37" />
          <stop offset="100%" stopColor="#9c7a26" />
        </linearGradient>
      </defs>
      <path
        d="M30 96 q8 -16 24 -16"
        stroke="url(#kt-gold-grad)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M170 96 q-8 -16 -24 -16"
        stroke="url(#kt-gold-grad)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <rect
        x="28"
        y="76"
        width="144"
        height="104"
        rx="20"
        fill="#181c25"
        stroke="url(#kt-gold-grad)"
        strokeWidth="4"
      />
      <circle cx="68" cy="128" r="24" fill="none" stroke="url(#kt-gold-grad)" strokeWidth="4" />
      <circle cx="68" cy="128" r="9" fill="url(#kt-gold-grad)" />
      <circle cx="134" cy="153" r="15" fill="none" stroke="url(#kt-gold-grad)" strokeWidth="3.5" />
      <circle cx="134" cy="153" r="5" fill="url(#kt-gold-grad)" />
      <rect x="120" y="92" width="28" height="10" rx="5" fill="url(#kt-gold-grad)" opacity="0.85" />
      <rect x="86" y="8" width="28" height="58" rx="14" fill="url(#kt-gold-grad)" />
      <rect x="92" y="18" width="16" height="6" rx="3" fill="#181c25" opacity="0.45" />
      <rect x="92" y="30" width="16" height="6" rx="3" fill="#181c25" opacity="0.45" />
      <path
        d="M70 48 a30 30 0 0 0 60 0"
        stroke="url(#kt-gold-grad)"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      <line x1="100" y1="78" x2="100" y2="94" stroke="url(#kt-gold-grad)" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

function exportVouchersCsv(rows) {
  const header = ['Mã', 'Ngày nhận', 'Thiết bị', 'Trạng thái', 'Ngày dùng']
  const body = rows.map((v) => [
    v.code,
    formatDate(v.created_at),
    v.device || '',
    v.used_at ? 'Đã dùng' : 'Chưa dùng',
    v.used_at ? formatDate(v.used_at) : '',
  ])
  const csv = [header, ...body]
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `vouchers_${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ============== GLOBAL STYLES ==============
function GlobalStyles() {
  return (
    <style>{`
      :root {
        color-scheme: dark;
      }
      body {
        background: #0f1115;
        color: #e8e8ea;
      }
      .kt-app {
        min-height: 100svh;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 24px 16px 48px;
      }
      .kt-container {
        width: 100%;
        max-width: 480px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .kt-capture {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .kt-card {
        background: #14171e;
        border: 1px solid #232936;
        border-radius: 20px;
        padding: 24px;
      }
      .kt-title {
        font-size: 26px;
        font-weight: 700;
        margin: 0;
        color: #f3f3f5;
        text-align: center;
      }
      .kt-tagline {
        margin: 6px 0 0;
        text-align: center;
        color: #9aa0ad;
        font-size: 15px;
      }
      .kt-hero {
        position: relative;
        overflow: hidden;
        text-align: center;
        padding: clamp(28px, 8vw, 44px) 16px clamp(26px, 7vw, 38px);
        background:
          radial-gradient(120% 90% at 50% -15%, rgba(212, 175, 55, 0.22), transparent 60%),
          linear-gradient(180deg, #181c25 0%, #14171e 100%);
        border: 1px solid #2a2f3b;
        border-radius: 28px;
      }
      .kt-hero::before,
      .kt-hero::after {
        content: '';
        position: absolute;
        border-radius: 50%;
        filter: blur(30px);
        pointer-events: none;
        opacity: 0.5;
      }
      .kt-hero::before {
        width: clamp(180px, 60vw, 320px);
        height: clamp(180px, 60vw, 320px);
        top: -18%;
        left: 50%;
        transform: translateX(-50%);
        background: radial-gradient(circle, rgba(212, 175, 55, 0.45), transparent 70%);
      }
      .kt-hero::after {
        width: 140px;
        height: 140px;
        bottom: -40px;
        right: -30px;
        background: radial-gradient(circle, rgba(255, 105, 180, 0.18), transparent 70%);
      }
      .kt-coming-soon {
        position: relative;
        display: block;
        font-size: clamp(22px, 7.5vw, 38px);
        font-weight: 900;
        letter-spacing: 3px;
        color: #fff3c4;
        text-shadow: 0 0 14px rgba(255, 216, 107, 0.95), 0 0 30px rgba(212, 175, 55, 0.7);
        margin-bottom: clamp(6px, 2vw, 10px);
        animation: kt-blink 1s steps(1, end) infinite;
      }
      .kt-capturing .kt-coming-soon {
        animation: none;
        opacity: 1;
      }
      @keyframes kt-blink {
        0%, 49% {
          opacity: 1;
        }
        50%, 100% {
          opacity: 0.25;
        }
      }
      .kt-hero-icon {
        position: relative;
        display: block;
        width: clamp(190px, 52vw, 300px);
        height: auto;
        margin: 0 auto clamp(8px, 2vw, 14px);
        filter: drop-shadow(0 10px 28px rgba(212, 175, 55, 0.45));
      }
      .kt-hero-name {
        position: relative;
        font-size: clamp(34px, 10.5vw, 58px);
        font-weight: 900;
        line-height: 1.04;
        margin: 0;
        letter-spacing: -0.5px;
        background: linear-gradient(135deg, #fff6dd 0%, #e9c558 35%, #d4af37 65%, #a67c1f 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: 0 2px 24px rgba(212, 175, 55, 0.25);
      }
      .kt-hero-pill {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: clamp(12px, 3vw, 18px);
        padding: 9px 20px;
        border-radius: 999px;
        background: rgba(212, 175, 55, 0.12);
        border: 1px solid rgba(212, 175, 55, 0.45);
        color: #f0d98c;
        font-size: clamp(12.5px, 3.4vw, 15px);
        font-weight: 700;
        letter-spacing: 0.2px;
      }
      .kt-hero-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #f0d98c;
        box-shadow: 0 0 8px 2px rgba(240, 217, 140, 0.7);
      }
      .kt-gold {
        color: #d4af37;
      }
      .kt-btn {
        appearance: none;
        border: none;
        border-radius: 14px;
        background: #d4af37;
        color: #14171e;
        font-size: 16px;
        font-weight: 700;
        padding: 14px 18px;
        cursor: pointer;
        width: 100%;
        transition: opacity 0.15s ease, transform 0.05s ease;
      }
      .kt-btn:active {
        transform: scale(0.98);
      }
      .kt-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .kt-btn-secondary {
        background: transparent;
        color: #d4af37;
        border: 1px solid #d4af37;
      }
      .kt-btn-ghost {
        background: transparent;
        color: #9aa0ad;
        border: 1px solid #232936;
      }
      .kt-input {
        width: 100%;
        background: #0f1115;
        border: 1px solid #232936;
        border-radius: 12px;
        color: #e8e8ea;
        font-size: 16px;
        padding: 12px 14px;
        outline: none;
      }
      .kt-input:focus {
        border-color: #d4af37;
      }
      .kt-label {
        font-size: 13px;
        color: #9aa0ad;
        margin-bottom: 6px;
        display: block;
      }
      .kt-badge {
        display: inline-block;
        background: #d4af37;
        color: #14171e;
        font-weight: 800;
        font-size: 22px;
        border-radius: 999px;
        padding: 8px 20px;
        margin: 0 auto;
      }
      .kt-center {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
      }
      .kt-qr-wrap {
        background: #fff;
        padding: 16px;
        border-radius: 16px;
      }
      .kt-code {
        font-family: ui-monospace, Menlo, Consolas, monospace;
        font-size: 20px;
        letter-spacing: 1px;
        font-weight: 700;
        color: #f3f3f5;
        background: #0f1115;
        border: 1px solid #232936;
        border-radius: 12px;
        padding: 10px 16px;
        text-align: center;
        width: 100%;
      }
      .kt-result {
        border-radius: 16px;
        padding: 18px;
        text-align: center;
      }
      .kt-result-ok {
        background: rgba(46, 204, 113, 0.12);
        border: 1px solid #2ecc71;
        color: #2ecc71;
      }
      .kt-result-warn {
        background: rgba(241, 196, 15, 0.12);
        border: 1px solid #f1c40f;
        color: #f1c40f;
      }
      .kt-result-err {
        background: rgba(231, 76, 60, 0.12);
        border: 1px solid #e74c3c;
        color: #e74c3c;
      }
      .kt-result-icon {
        font-size: 38px;
        line-height: 1;
        margin-bottom: 8px;
      }
      .kt-result-title {
        font-size: 18px;
        font-weight: 800;
        margin: 0 0 4px;
      }
      .kt-result-sub {
        font-size: 14px;
        opacity: 0.9;
      }
      .kt-stat-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .kt-stat {
        background: #0f1115;
        border: 1px solid #232936;
        border-radius: 14px;
        padding: 14px;
        text-align: center;
      }
      .kt-stat-value {
        font-size: 24px;
        font-weight: 800;
        color: #d4af37;
      }
      .kt-stat-label {
        font-size: 12px;
        color: #9aa0ad;
        margin-top: 4px;
      }
      .kt-tabs {
        display: flex;
        gap: 8px;
      }
      .kt-tab {
        flex: 1;
        text-align: center;
        padding: 9px 8px;
        border-radius: 10px;
        font-size: 13px;
        border: 1px solid #232936;
        color: #9aa0ad;
        cursor: pointer;
      }
      .kt-tab-active {
        background: #d4af37;
        color: #14171e;
        border-color: #d4af37;
        font-weight: 700;
      }
      .kt-table-wrap {
        width: 100%;
        overflow-x: auto;
      }
      table.kt-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      table.kt-table th,
      table.kt-table td {
        padding: 8px 6px;
        text-align: left;
        border-bottom: 1px solid #232936;
        white-space: nowrap;
      }
      table.kt-table th {
        color: #9aa0ad;
        font-weight: 600;
      }
      .kt-pill {
        display: inline-block;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 9px;
        border-radius: 999px;
      }
      .kt-pill-used {
        background: rgba(46, 204, 113, 0.15);
        color: #2ecc71;
      }
      .kt-pill-unused {
        background: rgba(154, 160, 173, 0.15);
        color: #9aa0ad;
      }
      .kt-row {
        display: flex;
        gap: 10px;
      }
      .kt-row > * {
        flex: 1;
      }
      .kt-muted {
        color: #9aa0ad;
        font-size: 13px;
      }
      #kt-qr-reader {
        width: 100%;
        border-radius: 14px;
        overflow: hidden;
      }
      .kt-screenshot-hint {
        margin: 4px 0 0;
        text-align: center;
        font-size: clamp(14px, 4vw, 17px);
        font-weight: 800;
        color: #ffd86b;
        text-shadow: 0 0 10px rgba(255, 216, 107, 0.8), 0 0 20px rgba(212, 175, 55, 0.5);
        animation: kt-pulse 1.2s ease-in-out infinite;
      }
      @keyframes kt-pulse {
        0%, 100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.08);
        }
      }
      .kt-download-link {
        appearance: none;
        background: transparent;
        border: none;
        margin: 2px 0 0;
        padding: 4px;
        color: #d4af37;
        font-size: 13px;
        font-weight: 700;
        text-decoration: underline;
        cursor: pointer;
      }
      .kt-download-link:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .kt-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.78);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        z-index: 50;
      }
      .kt-modal-box {
        width: 100%;
        max-width: 380px;
        max-height: 92svh;
        overflow-y: auto;
        background: #14171e;
        border: 1px solid #232936;
        border-radius: 20px;
        padding: 18px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }
      .kt-modal-close {
        position: fixed;
        top: max(16px, env(safe-area-inset-top));
        right: 16px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 1px solid #232936;
        background: #1c2029;
        color: #e8e8ea;
        font-size: 16px;
        line-height: 1;
        cursor: pointer;
        z-index: 51;
      }
      .kt-modal-hint {
        margin: 0;
        text-align: center;
        font-size: 14px;
        font-weight: 700;
        color: #f0d98c;
      }
      .kt-modal-img {
        width: 100%;
        max-width: 240px;
        border-radius: 14px;
        display: block;
      }
      .kt-toggle {
        background: transparent;
        border: 1px solid #232936;
        color: #9aa0ad;
        border-radius: 10px;
        padding: 8px 12px;
        font-size: 13px;
        cursor: pointer;
      }
    `}</style>
  )
}

// ============== AUDIO ==============
function useBeeper() {
  const ctxRef = useRef(null)
  const enabledRef = useRef(true)
  const [enabled, setEnabled] = useState(true)

  function getCtx() {
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      ctxRef.current = new AudioCtx()
    }
    return ctxRef.current
  }

  function tone(freq, duration, delay = 0) {
    if (!enabledRef.current) return
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(ctx.destination)
    const startAt = ctx.currentTime + delay
    gain.gain.setValueAtTime(0, startAt)
    gain.gain.linearRampToValueAtTime(0.25, startAt + 0.01)
    gain.gain.linearRampToValueAtTime(0, startAt + duration)
    osc.start(startAt)
    osc.stop(startAt + duration + 0.02)
  }

  function beepOk() {
    tone(1100, 0.15)
  }

  function beepError() {
    tone(220, 0.18)
    tone(220, 0.18, 0.22)
  }

  function toggle() {
    enabledRef.current = !enabledRef.current
    setEnabled(enabledRef.current)
  }

  return { beepOk, beepError, enabled, toggle }
}

// ============== TRANG KHÁCH ==============
function GuestPage() {
  const [code, setCode] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [previewSrc, setPreviewSrc] = useState(null)
  const captureRef = useRef(null)

  async function loadExisting(existingCode) {
    const { data, error: err } = await supabase
      .from('vouchers')
      .select('code')
      .eq('code', existingCode)
      .maybeSingle()
    if (err || !data) {
      setError('Không tìm thấy mã của bạn, vui lòng thử lại.')
      return
    }
    setCode(data.code)
  }

  async function createNew() {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = randomCode()
      const { error: err } = await supabase
        .from('vouchers')
        .insert({ code: candidate, device: detectDevice() })
      if (!err) {
        localStorage.setItem(LOCAL_STORAGE_KEY, candidate)
        setCode(candidate)
        return
      }
      if (!isUniqueViolation(err)) {
        setError('Có lỗi xảy ra, vui lòng thử lại sau.')
        return
      }
    }
    setError('Có lỗi xảy ra, vui lòng thử lại sau.')
  }

  async function handleGetVoucher() {
    if (!supabase) {
      setError('Chưa cấu hình Supabase (xem CONFIG ở đầu App.jsx).')
      return
    }
    setLoading(true)
    setError('')
    const existing = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (existing) {
      await loadExisting(existing)
    } else {
      await createNew()
    }
    setLoading(false)
  }

  async function handleCopy() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      // ignore
    }
  }

  async function handleDownloadImage() {
    if (!captureRef.current) return
    setDownloading(true)
    captureRef.current.classList.add('kt-capturing')
    try {
      const dataUrl = await toPng(captureRef.current, {
        backgroundColor: '#0f1115',
        pixelRatio: 2,
      })
      setPreviewSrc(dataUrl)
    } catch {
      setError('Không tải được ảnh, vui lòng chụp màn hình thay thế.')
    } finally {
      captureRef.current.classList.remove('kt-capturing')
      setDownloading(false)
    }
  }

  function handleConfirmDownload() {
    if (!previewSrc) return
    const link = document.createElement('a')
    link.download = `voucher-${code}.png`
    link.href = previewSrc
    link.click()
  }

  return (
    <div className="kt-app">
      <div className="kt-container">
        <div ref={captureRef} className="kt-capture">
          <div className="kt-hero">
            <span className="kt-coming-soon">COMING SOON</span>
            <KaraokeIcon className="kt-hero-icon" />
            <h1 className="kt-hero-name">{CONFIG.storeName}</h1>
            <span className="kt-hero-pill">
              <span className="kt-hero-dot" />
              {CONFIG.tagline} · {CONFIG.openingText}
            </span>
          </div>

          {code && (
            <div className="kt-card kt-center">
              <span className="kt-badge">-{CONFIG.discountPercent}%</span>
              <div className="kt-qr-wrap">
                <QRCode value={code} size={180} />
              </div>
              <div className="kt-code">{code}</div>
            </div>
          )}
        </div>

        {!code && (
          <div className="kt-card kt-center">
            <p className="kt-muted" style={{ textAlign: 'center' }}>
              Nhận voucher giảm giá ngay để dùng trong tuần lễ khai trương!
            </p>
            <button className="kt-btn" onClick={handleGetVoucher} disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Bấm để nhận voucher'}
            </button>
            {error && <p style={{ color: '#e74c3c', fontSize: 13 }}>{error}</p>}
          </div>
        )}

        {code && (
          <div className="kt-card kt-center">
            <button className="kt-btn kt-btn-secondary" onClick={handleCopy}>
              Sao chép mã
            </button>
            <p className="kt-screenshot-hint">📸 Hãy chụp màn hình để lưu lại voucher nhé!</p>
            <button className="kt-download-link" onClick={handleDownloadImage} disabled={downloading}>
              {downloading ? 'Đang tạo ảnh...' : '📥 Hoặc bấm vào đây để tải ảnh'}
            </button>
            {error && <p style={{ color: '#e74c3c', fontSize: 13 }}>{error}</p>}
          </div>
        )}
      </div>

      {previewSrc && (
        <div className="kt-modal-overlay" onClick={() => setPreviewSrc(null)}>
          <div className="kt-modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="kt-modal-close" onClick={() => setPreviewSrc(null)} aria-label="Đóng">
              ✕
            </button>
            <p className="kt-modal-hint">👇 Bấm giữ vào ảnh bên dưới để lưu về máy</p>
            <img className="kt-modal-img" src={previewSrc} alt="Voucher" />
            {!isInAppBrowser() && (
              <button className="kt-btn" onClick={handleConfirmDownload}>
                Tải xuống
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============== TRANG NHÂN VIÊN ==============
function StaffPage() {
  const [pin, setPin] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [result, setResult] = useState(null)
  const [checking, setChecking] = useState(false)
  const [scanning, setScanning] = useState(false)
  const scannerRef = useRef(null)
  const beeper = useBeeper()

  async function redeem(code) {
    if (!supabase) {
      setResult({ status: 'error', message: 'Chưa cấu hình Supabase (xem CONFIG ở đầu App.jsx).' })
      beeper.beepError()
      return
    }
    if (!code || !pin) {
      setResult({ status: 'wrong_pin', message: 'Vui lòng nhập PIN và mã voucher.' })
      beeper.beepError()
      return
    }
    setChecking(true)
    try {
      const { data, error } = await supabase.rpc('redeem_voucher', {
        p_code: code.trim(),
        p_staff_pin: pin,
      })
      if (error) {
        setResult({ status: 'error', message: error.message })
        beeper.beepError()
        return
      }
      const row = Array.isArray(data) ? data[0] : data
      setResult(row)
      if (row && row.status === 'ok') {
        beeper.beepOk()
      } else {
        beeper.beepError()
      }
    } catch (e) {
      setResult({ status: 'error', message: String(e) })
      beeper.beepError()
    } finally {
      setChecking(false)
    }
  }

  async function handleCheck() {
    await redeem(codeInput)
  }

  async function startScan() {
    setScanning(true)
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode('kt-qr-reader')
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 220 },
          async (decodedText) => {
            setCodeInput(decodedText)
            await stopScan()
            redeem(decodedText)
          },
          () => {}
        )
      } catch (e) {
        setScanning(false)
        setResult({ status: 'error', message: 'Không thể mở camera: ' + e })
      }
    }, 0)
  }

  async function stopScan() {
    const scanner = scannerRef.current
    if (scanner) {
      try {
        await scanner.stop()
        await scanner.clear()
      } catch {
        // ignore
      }
      scannerRef.current = null
    }
    setScanning(false)
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  const resultView = (() => {
    if (!result) return null
    const map = {
      ok: { cls: 'kt-result-ok', icon: '✓', title: 'Hợp lệ - Đã đổi voucher' },
      already_used: { cls: 'kt-result-warn', icon: '!', title: 'Mã đã được sử dụng' },
      not_found: { cls: 'kt-result-err', icon: '✕', title: 'Không tìm thấy mã' },
      expired: { cls: 'kt-result-warn', icon: '!', title: 'Mã đã hết hạn' },
      wrong_pin: { cls: 'kt-result-err', icon: '✕', title: 'Sai PIN nhân viên' },
      error: { cls: 'kt-result-err', icon: '✕', title: 'Có lỗi xảy ra' },
    }
    const info = map[result.status] || map.error
    return (
      <div className={`kt-result ${info.cls}`}>
        <div className="kt-result-icon">{info.icon}</div>
        <p className="kt-result-title">{info.title}</p>
        {result.status === 'already_used' && result.used_at && (
          <p className="kt-result-sub">Đã dùng lúc: {formatDate(result.used_at)}</p>
        )}
        {result.created_at && (
          <p className="kt-result-sub">Khách nhận lúc: {formatDate(result.created_at)}</p>
        )}
        {result.message && result.status === 'error' && (
          <p className="kt-result-sub">{result.message}</p>
        )}
      </div>
    )
  })()

  return (
    <div className="kt-app">
      <div className="kt-container">
        <div className="kt-card">
          <h1 className="kt-title" style={{ fontSize: 20 }}>
            Trang nhân viên
          </h1>
          <p className="kt-tagline">{CONFIG.storeName}</p>
        </div>

        <div className="kt-card">
          <label className="kt-label">PIN nhân viên</label>
          <input
            className="kt-input"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Nhập PIN"
          />
        </div>

        <div className="kt-card">
          <label className="kt-label">Mã voucher</label>
          <input
            className="kt-input"
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder="KT-XXXXXXXX"
            style={{ marginBottom: 12 }}
          />
          <div className="kt-row">
            <button className="kt-btn" onClick={handleCheck} disabled={checking}>
              {checking ? 'Đang kiểm tra...' : 'Kiểm tra'}
            </button>
          </div>
          <div style={{ height: 10 }} />
          {!scanning ? (
            <button className="kt-btn kt-btn-secondary" onClick={startScan}>
              Quét mã QR của khách
            </button>
          ) : (
            <>
              <div id="kt-qr-reader" />
              <div style={{ height: 10 }} />
              <button className="kt-btn kt-btn-ghost" onClick={stopScan}>
                Dừng quét
              </button>
            </>
          )}
        </div>

        {resultView && <div className="kt-card">{resultView}</div>}

        <button className="kt-toggle" onClick={beeper.toggle}>
          {beeper.enabled ? '🔊 Âm thanh: Bật' : '🔇 Âm thanh: Tắt'}
        </button>
      </div>
    </div>
  )
}

// ============== TRANG THỐNG KÊ ==============
function AdminPage() {
  const [pin, setPin] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [loading, setLoading] = useState(false)
  const [vouchers, setVouchers] = useState([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')

  async function handleLogin() {
    if (!supabase) {
      setAuthError('Chưa cấu hình Supabase (xem CONFIG ở đầu App.jsx).')
      return
    }
    setLoading(true)
    setAuthError('')
    const { data, error } = await supabase.rpc('list_vouchers', { p_admin_pin: pin })
    setLoading(false)
    if (error) {
      setAuthError('Sai mã PIN hoặc lỗi kết nối.')
      return
    }
    setVouchers(data || [])
    setAuthed(true)
  }

  async function refresh() {
    if (!supabase) return
    setLoading(true)
    const { data, error } = await supabase.rpc('list_vouchers', { p_admin_pin: pin })
    setLoading(false)
    if (!error) {
      setVouchers(data || [])
    }
  }

  const total = vouchers.length
  const used = vouchers.filter((v) => v.used_at).length
  const unused = total - used
  const rate = total > 0 ? Math.round((used / total) * 100) : 0

  const filtered = vouchers
    .filter((v) => {
      if (tab === 'used') return !!v.used_at
      if (tab === 'unused') return !v.used_at
      return true
    })
    .filter((v) => v.code.toLowerCase().includes(search.toLowerCase()))

  if (!authed) {
    return (
      <div className="kt-app">
        <div className="kt-container">
          <div className="kt-card">
            <h1 className="kt-title" style={{ fontSize: 20 }}>
              Trang thống kê
            </h1>
            <p className="kt-tagline">{CONFIG.storeName}</p>
          </div>
          <div className="kt-card">
            <label className="kt-label">PIN quản trị</label>
            <input
              className="kt-input"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Nhập PIN admin"
              style={{ marginBottom: 12 }}
            />
            <button className="kt-btn" onClick={handleLogin} disabled={loading}>
              {loading ? 'Đang kiểm tra...' : 'Đăng nhập'}
            </button>
            {authError && (
              <p style={{ color: '#e74c3c', fontSize: 13, marginTop: 10 }}>{authError}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="kt-app">
      <div className="kt-container" style={{ maxWidth: 720 }}>
        <div className="kt-card">
          <h1 className="kt-title" style={{ fontSize: 20 }}>
            Thống kê voucher
          </h1>
          <p className="kt-tagline">{CONFIG.storeName}</p>
        </div>

        <div className="kt-stat-grid">
          <div className="kt-stat">
            <div className="kt-stat-value">{total}</div>
            <div className="kt-stat-label">Đã phát</div>
          </div>
          <div className="kt-stat">
            <div className="kt-stat-value">{used}</div>
            <div className="kt-stat-label">Đã dùng</div>
          </div>
          <div className="kt-stat">
            <div className="kt-stat-value">{unused}</div>
            <div className="kt-stat-label">Chưa dùng</div>
          </div>
          <div className="kt-stat">
            <div className="kt-stat-value">{rate}%</div>
            <div className="kt-stat-label">Tỷ lệ dùng</div>
          </div>
        </div>

        <div className="kt-card">
          <input
            className="kt-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã voucher..."
            style={{ marginBottom: 12 }}
          />
          <div className="kt-tabs" style={{ marginBottom: 12 }}>
            <div
              className={`kt-tab ${tab === 'all' ? 'kt-tab-active' : ''}`}
              onClick={() => setTab('all')}
            >
              Tất cả
            </div>
            <div
              className={`kt-tab ${tab === 'unused' ? 'kt-tab-active' : ''}`}
              onClick={() => setTab('unused')}
            >
              Chưa dùng
            </div>
            <div
              className={`kt-tab ${tab === 'used' ? 'kt-tab-active' : ''}`}
              onClick={() => setTab('used')}
            >
              Đã dùng
            </div>
          </div>

          <div className="kt-row" style={{ marginBottom: 14 }}>
            <button className="kt-btn kt-btn-ghost" onClick={refresh} disabled={loading}>
              {loading ? 'Đang tải...' : 'Làm mới'}
            </button>
            <button className="kt-btn kt-btn-secondary" onClick={() => exportVouchersCsv(filtered)}>
              Xuất CSV
            </button>
          </div>

          <div className="kt-table-wrap">
            <table className="kt-table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Ngày nhận</th>
                  <th>Thiết bị</th>
                  <th>Trạng thái</th>
                  <th>Ngày dùng</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.code}>
                    <td>{v.code}</td>
                    <td>{formatDate(v.created_at)}</td>
                    <td>{v.device || '-'}</td>
                    <td>
                      <span
                        className={`kt-pill ${v.used_at ? 'kt-pill-used' : 'kt-pill-unused'}`}
                      >
                        {v.used_at ? 'Đã dùng' : 'Chưa dùng'}
                      </span>
                    </td>
                    <td>{v.used_at ? formatDate(v.used_at) : '-'}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="kt-muted" style={{ textAlign: 'center' }}>
                      Không có dữ liệu
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============== APP ROOT ==============
function App() {
  const params = new URLSearchParams(window.location.search)
  let page = 'guest'
  if (params.has('admin')) page = 'admin'
  else if (params.has('staff')) page = 'staff'

  return (
    <>
      <GlobalStyles />
      {page === 'guest' && <GuestPage />}
      {page === 'staff' && <StaffPage />}
      {page === 'admin' && <AdminPage />}
    </>
  )
}

export default App
