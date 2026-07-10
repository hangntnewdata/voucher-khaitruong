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
const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

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
        justify-content: center;
        padding: 24px 16px 48px;
      }
      .kt-container {
        width: 100%;
        max-width: 480px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .kt-stage-app {
        min-height: 100svh;
        width: 100%;
        position: relative;
        overflow-x: hidden;
        background: #0a0000;
      }
      .kt-scene {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
      .kt-voucher-screen {
        position: relative;
        width: 100%;
        min-height: max(100svh, 720px);
      }
      .kt-curtain-bg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .kt-curtain-veil {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transform-origin: center;
        transition: opacity 0.9s ease, transform 0.9s ease;
      }
      .kt-curtain-veil-open {
        opacity: 0;
        transform: scale(1.06);
        pointer-events: none;
      }
      .kt-scene-hit {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: none;
        padding: 0;
        margin: 0;
        background: transparent;
        cursor: pointer;
      }
      .kt-curtain-text {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 86%;
        max-width: 420px;
        text-align: center;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .kt-curtain-line1 {
        font-family: 'Playfair Display', 'Times New Roman', serif;
        font-size: clamp(22px, 7vw, 34px);
        font-weight: 700;
        color: #fff8ec;
        text-shadow: 0 2px 18px rgba(0, 0, 0, 0.65);
      }
      .kt-curtain-line2 {
        font-family: 'Dancing Script', cursive;
        font-size: clamp(28px, 9vw, 46px);
        font-weight: 700;
        color: #ffd86b;
        text-shadow: 0 2px 18px rgba(0, 0, 0, 0.6);
        animation: kt-pulse 1.6s ease-in-out infinite;
      }
      .kt-stage-content {
        position: absolute;
        left: 50%;
        bottom: 7%;
        transform: translateX(-50%);
        width: 94%;
        max-width: 420px;
        text-align: center;
      }
      .kt-stage-tagline {
        margin: 0 0 18px;
        font-family: 'Playfair Display', 'Times New Roman', serif;
        font-size: clamp(12px, 3.4vw, 16px);
        line-height: 1.5;
        color: #fff8ec;
        text-shadow: 0 2px 14px rgba(0, 0, 0, 0.75);
      }
      .kt-script-accent {
        font-family: 'Dancing Script', cursive;
        font-size: 1.2em;
        color: #ffe9a8;
        -webkit-text-stroke: 0.5px rgba(0, 0, 0, 0.55);
        text-shadow:
          0 0 5px rgba(0, 0, 0, 0.9),
          0 0 12px rgba(0, 0, 0, 0.75),
          0 2px 5px rgba(0, 0, 0, 0.95);
      }
      .kt-tagline-gold {
        display: inline-block;
        font-weight: 800;
        color: #ffd86b;
        padding: 3px 12px;
        border-radius: 10px;
        background: rgba(10, 6, 0, 0.45);
        -webkit-text-stroke: 0.4px rgba(0, 0, 0, 0.6);
        text-shadow: 0 1px 5px rgba(0, 0, 0, 0.9);
      }
      .kt-claim-btn {
        width: auto;
        min-width: 220px;
        margin: 0 auto;
      }
      .kt-stage-error {
        margin: 10px 0 0;
        color: #ff8a80;
        font-size: 13px;
        text-shadow: 0 1px 6px rgba(0, 0, 0, 0.8);
      }
      .kt-voucher-content {
        position: absolute;
        inset: 0;
      }
      .kt-voucher-actions-wrap {
        position: absolute;
        left: 50%;
        top: calc(56% + 105px);
        transform: translateX(-50%);
        width: 88%;
        max-width: 360px;
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
      @keyframes kt-drop-in {
        0% {
          opacity: 0;
          transform: translateY(-48px) scale(0.96);
        }
        60% {
          opacity: 1;
          transform: translateY(8px) scale(1.01);
        }
        100% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      .kt-voucher-drop {
        animation: kt-drop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }
      .kt-voucher-drop-delay {
        animation-delay: 0.12s;
      }
      .kt-gift-card {
        position: absolute;
        left: 50%;
        top: 56%;
        width: min(37%, 150px);
        padding: 10px;
        transform: translate(-50%, -50%);
        z-index: 5;
        box-shadow:
          0 0 0 1px rgba(212, 175, 55, 0.5),
          0 10px 26px rgba(0, 0, 0, 0.6),
          0 0 22px rgba(212, 175, 55, 0.4);
        animation: kt-gift-pop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }
      .kt-gift-card .kt-badge {
        font-size: 12px;
        padding: 4px 10px;
      }
      .kt-gift-card .kt-qr-wrap {
        padding: 6px;
      }
      .kt-gift-card .kt-code {
        font-size: 10px;
        padding: 5px 6px;
      }
      @keyframes kt-gift-pop {
        0% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.1) rotate(-14deg);
        }
        50% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1.06) rotate(4deg);
        }
        72% {
          transform: translate(-50%, -50%) scale(0.97) rotate(-2deg);
        }
        100% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1) rotate(0deg);
        }
      }
      .kt-burst-flash {
        position: absolute;
        left: 50%;
        top: 56%;
        width: 36px;
        height: 36px;
        margin: -18px 0 0 -18px;
        border-radius: 50%;
        background: radial-gradient(
          circle,
          rgba(255, 246, 221, 0.95) 0%,
          rgba(255, 216, 107, 0.65) 35%,
          rgba(212, 175, 55, 0) 70%
        );
        z-index: 4;
        pointer-events: none;
        animation: kt-flash-burst 0.3s ease-out both;
      }
      @keyframes kt-flash-burst {
        0% {
          transform: scale(0.3);
          opacity: 1;
        }
        100% {
          transform: scale(9);
          opacity: 0;
        }
      }
      .kt-spark-wrap {
        position: absolute;
        left: 50%;
        top: 56%;
        width: 0;
        height: 0;
        z-index: 4;
        pointer-events: none;
      }
      .kt-spark {
        position: absolute;
        left: 0;
        top: -4px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: radial-gradient(circle, #fff6dd, #d4af37);
        animation: kt-spark-fly 0.35s ease-out both;
      }
      @keyframes kt-spark-fly {
        0% {
          transform: translateX(0) scale(1);
          opacity: 1;
        }
        100% {
          transform: translateX(50px) scale(0);
          opacity: 0;
        }
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
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [previewSrc, setPreviewSrc] = useState(null)
  const [screen, setScreen] = useState('curtain') // 'curtain' | 'stage' | 'voucher'
  const [claiming, setClaiming] = useState(false)
  const [giftVisible, setGiftVisible] = useState(false)
  const captureRef = useRef(null)
  const audioRef = useRef(null)
  const bgLoadedRef = useRef(null)

  useEffect(() => {
    if (!supabase) return
    // "Làm nóng" kết nối tới Supabase ngay khi vào trang, để lúc khách bấm
    // cửa không phải chờ round-trip đầu tiên (DNS/TLS + cold start) nữa.
    // Query builder của supabase-js chỉ gửi request khi được .then()/await.
    supabase.from('vouchers').select('code', { head: true, count: 'exact' }).limit(1).then(() => {})
  }, [])

  useEffect(() => {
    // Tải trước ảnh render công trình ngay từ màn rèm, để lúc chuyển sang
    // màn mã khuyến mãi thì ảnh đã sẵn sàng hiện ngay, không phải chờ tải.
    bgLoadedRef.current = new Promise((resolve) => {
      const img = new Image()
      img.src = '/image.png'
      img.onload = resolve
      img.onerror = resolve
    })
  }, [])

  async function loadExisting(existingCode) {
    const { data, error: err } = await supabase
      .from('vouchers')
      .select('code')
      .eq('code', existingCode)
      .maybeSingle()
    if (err || !data) {
      setError('Không tìm thấy mã của bạn, vui lòng thử lại.')
      return false
    }
    setCode(data.code)
    return true
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
        return true
      }
      if (!isUniqueViolation(err)) {
        setError('Có lỗi xảy ra, vui lòng thử lại sau.')
        return false
      }
    }
    setError('Có lỗi xảy ra, vui lòng thử lại sau.')
    return false
  }

  async function handleGetVoucher() {
    if (!supabase) {
      setError('Chưa cấu hình Supabase (xem CONFIG ở đầu App.jsx).')
      return false
    }
    setError('')
    const existing = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (existing) {
      return loadExisting(existing)
    }
    return createNew()
  }

  function handleCurtainTap() {
    if (screen !== 'curtain') return
    audioRef.current?.play().catch(() => {})
    setScreen('stage')
  }

  async function handleClaimClick() {
    if (claiming) return
    setClaiming(true)
    const [ok] = await Promise.all([handleGetVoucher(), bgLoadedRef.current])
    setClaiming(false)
    if (ok) {
      setScreen('voucher')
      setTimeout(() => setGiftVisible(true), 300)
    }
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
    <div className="kt-stage-app">
      <audio ref={audioRef} src="/bgm.mp3" loop preload="none" />

      {screen !== 'voucher' && (
        <div className="kt-scene">
          <img src="/2.png" alt="" className="kt-curtain-bg" />
          <img
            src="/1.png"
            alt=""
            className={`kt-curtain-veil ${screen === 'stage' ? 'kt-curtain-veil-open' : ''}`}
          />

          {screen === 'curtain' && (
            <button
              type="button"
              className="kt-scene-hit"
              onClick={handleCurtainTap}
              aria-label="Chạm để trình diễn"
            >
              <span className="kt-curtain-text">
                <span className="kt-curtain-line1">Sân khấu này là của bạn</span>
                <span className="kt-curtain-line2">Chạm để trình diễn</span>
              </span>
            </button>
          )}

          {screen === 'stage' && (
            <div className="kt-stage-content">
              <p className="kt-stage-tagline">
                <span className="kt-tagline-gold">Hát hết mình, tạo dáng hết cỡ</span>
                <br />
                tại tổ hợp <span className="kt-script-accent">self-booth &amp; music box</span> đầu tiên tại Cần
                Thơ
              </p>
              <button
                type="button"
                className="kt-btn kt-claim-btn"
                onClick={handleClaimClick}
                disabled={claiming}
              >
                {claiming ? 'Đang lấy mã...' : 'Nhận mã giảm giá'}
              </button>
              {error && <p className="kt-stage-error">{error}</p>}
            </div>
          )}
        </div>
      )}

      {screen === 'voucher' && (
        <div className="kt-voucher-screen">
          <img src="/image.png" alt={CONFIG.storeName} className="kt-curtain-bg" />

          {giftVisible && (
            <>
              <div ref={captureRef} className="kt-voucher-content">
                <span className="kt-burst-flash" />
                {SPARK_ANGLES.map((angle) => (
                  <span key={angle} className="kt-spark-wrap" style={{ transform: `rotate(${angle}deg)` }}>
                    <span className="kt-spark" />
                  </span>
                ))}
                <div className="kt-card kt-center kt-gift-card">
                  <span className="kt-badge">-{CONFIG.discountPercent}%</span>
                  <div className="kt-qr-wrap">
                    <QRCode value={code} size={80} />
                  </div>
                  <div className="kt-code">{code}</div>
                </div>
              </div>

              <div className="kt-voucher-actions-wrap">
                <div className="kt-card kt-center kt-voucher-drop kt-voucher-drop-delay">
                  <button className="kt-btn kt-btn-secondary" onClick={handleCopy}>
                    Sao chép mã
                  </button>
                  <p className="kt-screenshot-hint">📸 Hãy chụp màn hình để lưu lại voucher nhé!</p>
                  <button className="kt-download-link" onClick={handleDownloadImage} disabled={downloading}>
                    {downloading ? 'Đang tạo ảnh...' : '📥 Hoặc bấm vào đây để tải ảnh'}
                  </button>
                  {error && <p style={{ color: '#e74c3c', fontSize: 13 }}>{error}</p>}
                </div>
              </div>
            </>
          )}
        </div>
      )}

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
