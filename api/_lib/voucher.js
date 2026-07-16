// Phần dùng chung cho 2 endpoint selfbooth: xác thực API key và gọi Supabase.
// File bắt đầu bằng dấu _ nên Vercel không tạo route riêng cho nó.

const DISCOUNT_PERCENT = Number(process.env.DISCOUNT_PERCENT || 20)

// Thông điệp tiếng Việt cho từng trạng thái, selfbooth hiện thẳng cho khách.
const MESSAGES = {
  ok: `Mã hợp lệ, được giảm ${DISCOUNT_PERCENT}%.`,
  not_found: 'Mã không tồn tại, vui lòng kiểm tra lại.',
  already_used: 'Mã này đã được sử dụng.',
  expired: 'Mã đã hết hạn sử dụng.',
}

// So sánh chuỗi theo thời gian cố định, tránh lộ độ dài key qua thời gian phản hồi.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Trả về null nếu hợp lệ, ngược lại trả về object lỗi để handler gửi về client.
function authenticate(req) {
  const expected = process.env.SELFBOOTH_API_KEY
  if (!expected) {
    return { code: 500, body: { status: 'error', message: 'Server chưa cấu hình SELFBOOTH_API_KEY.' } }
  }
  const header = req.headers['authorization'] || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!safeEqual(token, expected)) {
    return { code: 401, body: { status: 'unauthorized', message: 'API key không hợp lệ.' } }
  }
  return null
}

async function callRpc(fn, code) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  const pin = process.env.STAFF_PIN
  if (!url || !key || !pin) {
    throw new Error('Thiếu SUPABASE_URL / SUPABASE_ANON_KEY / STAFF_PIN.')
  }

  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_code: code, p_staff_pin: pin }),
  })
  if (!res.ok) throw new Error(`Supabase trả về HTTP ${res.status}`)

  const data = await res.json()
  return Array.isArray(data) ? data[0] : data
}

// Dùng chung cho cả check và redeem, khác nhau đúng ở tên hàm RPC.
export async function handleVoucher(req, res, rpcName) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Chỉ hỗ trợ POST.' })
  }

  const denied = authenticate(req)
  if (denied) return res.status(denied.code).json(denied.body)

  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
  if (!code) {
    return res.status(400).json({ status: 'error', message: 'Thiếu trường "code".' })
  }

  let row
  try {
    row = await callRpc(rpcName, code)
  } catch (e) {
    console.error(`${rpcName} thất bại:`, e)
    return res.status(502).json({ status: 'error', message: 'Không kết nối được hệ thống voucher.' })
  }

  // wrong_pin nghĩa là STAFF_PIN trên Vercel không khớp PIN trong app_settings.
  // Đây là lỗi cấu hình phía mình, không phải lỗi của khách.
  if (!row || row.status === 'wrong_pin' || row.status === 'error') {
    console.error(`${rpcName} trả về trạng thái bất thường:`, row?.status)
    return res.status(500).json({ status: 'error', message: 'Lỗi cấu hình hệ thống voucher.' })
  }

  return res.status(200).json({
    status: row.status,
    valid: row.status === 'ok',
    discount_percent: row.status === 'ok' ? DISCOUNT_PERCENT : 0,
    message: MESSAGES[row.status] || 'Không xác định được trạng thái mã.',
    code,
    created_at: row.created_at ?? null,
    used_at: row.used_at ?? null,
  })
}
