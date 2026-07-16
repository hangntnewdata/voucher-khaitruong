import { handleVoucher } from '../_lib/voucher.js'

// Bước 1: kiểm tra mã lúc khách vừa nhập. KHÔNG đánh dấu đã dùng,
// nên khách bỏ ngang giữa chừng thì mã vẫn còn nguyên.
export default async function handler(req, res) {
  return handleVoucher(req, res, 'check_voucher')
}
