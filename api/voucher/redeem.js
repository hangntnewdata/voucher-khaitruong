import { handleVoucher } from '../_lib/voucher.js'

// Bước 2: đốt mã, gọi sau khi khách đã thanh toán xong.
// Thao tác này không hoàn tác được, đừng gọi trước lúc thanh toán.
export default async function handler(req, res) {
  return handleVoucher(req, res, 'redeem_voucher')
}
