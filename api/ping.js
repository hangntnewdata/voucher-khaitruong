// Cron ping giữ Supabase khỏi bị auto-pause.
// Supabase free tự pause project sau 7 ngày không có hoạt động; mỗi lần chạm
// vào REST API sẽ reset lại đồng hồ đó. Vercel Cron gọi endpoint này mỗi ngày.
export default async function handler(req, res) {
  // Vercel Cron tự gắn header "Authorization: Bearer <CRON_SECRET>" nếu biến
  // môi trường CRON_SECRET được set. Nếu có set thì mới chặn, để không ai
  // ngoài cron gọi được; nếu chưa set thì bỏ qua cho đơn giản.
  const secret = process.env.CRON_SECRET
  if (secret && req.headers['authorization'] !== `Bearer ${secret}`) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' })
  }

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    return res.status(500).json({ ok: false, message: 'Thiếu SUPABASE_URL / SUPABASE_ANON_KEY.' })
  }

  try {
    // Truy vấn cực nhẹ: lấy tối đa 1 dòng, chỉ cột code. Mục đích duy nhất là
    // tạo 1 request để Supabase tính là "có hoạt động", không cần dữ liệu.
    const r = await fetch(`${url}/rest/v1/vouchers?select=code&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!r.ok) throw new Error(`Supabase trả về HTTP ${r.status}`)
    return res.status(200).json({ ok: true, pinged_at: new Date().toISOString() })
  } catch (e) {
    console.error('ping thất bại:', e)
    return res.status(502).json({ ok: false, message: 'Không kết nối được Supabase.' })
  }
}
