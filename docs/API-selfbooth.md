# API voucher Antimorning — tài liệu tích hợp selfbooth

Tài liệu cho bên phát triển hệ thống selfbooth, để khách nhập mã giảm giá
đã nhận từ web Antimorning và được giảm **20%**.

## Tổng quan

Khách nhận mã trên web Antimorning và lưu lại. Khi đến cửa hàng, khách nhập
mã vào selfbooth. Selfbooth gọi 2 endpoint theo đúng thứ tự:

1. **`/api/voucher/check`** — lúc khách vừa nhập mã, để hiện mức giảm giá.
   Endpoint này **không** đánh dấu mã đã dùng.
2. **`/api/voucher/redeem`** — **chỉ gọi sau khi khách đã thanh toán xong**.
   Endpoint này đốt mã và **không hoàn tác được**.

Tách 2 bước để nếu khách bỏ ngang hoặc thanh toán lỗi thì mã vẫn còn dùng được.

Base URL: `https://antimorning-musicbox.vercel.app`

## Xác thực

Mọi request cần header:

```
Authorization: Bearer <API_KEY>
```

API key sẽ được cấp riêng cho selfbooth qua kênh riêng, không nằm trong tài liệu này.

> **Quan trọng:** chỉ gọi API từ **server** của selfbooth, không gọi từ trình duyệt
> của khách. Gọi từ trình duyệt sẽ để lộ API key cho bất kỳ ai mở DevTools, và
> người đó có thể đốt mã của khách khác. Nếu selfbooth cần gọi từ phía client,
> hãy tự dựng một endpoint trung gian ở server của mình.

## Endpoint

Cả 2 endpoint đều dùng `POST`, body JSON giống nhau:

```json
{ "code": "MA-CUA-KHACH" }
```

### `POST /api/voucher/check`

Kiểm tra mã, không thay đổi gì. Gọi bao nhiêu lần cũng được.

### `POST /api/voucher/redeem`

Đốt mã. Chỉ gọi sau khi thanh toán thành công.

## Kết quả trả về

Cả 2 endpoint trả về cùng cấu trúc:

```json
{
  "status": "ok",
  "valid": true,
  "discount_percent": 20,
  "message": "Mã hợp lệ, được giảm 20%.",
  "code": "MA-CUA-KHACH",
  "created_at": "2026-07-01T10:23:11.000Z",
  "used_at": null
}
```

Kiểm tra trường `valid` (boolean) là đủ để quyết định có áp giảm giá hay không.
Trường `message` đã là tiếng Việt, hiện thẳng cho khách được.

### Các giá trị `status` (HTTP 200)

| `status` | `valid` | Ý nghĩa |
|---|---|---|
| `ok` | `true` | Mã hợp lệ, áp giảm `discount_percent`% |
| `not_found` | `false` | Mã không tồn tại |
| `already_used` | `false` | Mã đã dùng rồi (xem `used_at`) |
| `expired` | `false` | Mã đã hết hạn |

### Các mã lỗi HTTP

| HTTP | Ý nghĩa | Xử lý |
|---|---|---|
| 400 | Thiếu trường `code` | Lỗi phía selfbooth |
| 401 | API key sai hoặc thiếu | Kiểm tra lại header `Authorization` |
| 405 | Không phải POST | Lỗi phía selfbooth |
| 500 | Lỗi cấu hình phía Antimorning | Báo lại cho bên Antimorning |
| 502 | Không kết nối được database | Thử lại, nếu vẫn lỗi thì báo lại |

Với 500/502, **không** coi là mã không hợp lệ — đó là lỗi hệ thống, nên cho khách
thử lại hoặc chuyển sang nhờ nhân viên xử lý tay.

## Ví dụ

```bash
# Bước 1: khách vừa nhập mã
curl -X POST https://antimorning-musicbox.vercel.app/api/voucher/check \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"code":"MA-CUA-KHACH"}'

# Bước 2: sau khi khách thanh toán xong
curl -X POST https://antimorning-musicbox.vercel.app/api/voucher/redeem \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"code":"MA-CUA-KHACH"}'
```

```js
async function checkVoucher(code) {
  const res = await fetch('https://antimorning-musicbox.vercel.app/api/voucher/check', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.ANTIMORNING_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  })
  return res.json()
}
```

## Lưu ý khi tích hợp

- **Mã không phân biệt hoa thường?** Có phân biệt. Nên chuẩn hoá đầu vào của khách
  (viết hoa toàn bộ, bỏ khoảng trắng thừa) trước khi gửi. Khoảng trắng đầu/cuối
  đã được API tự cắt.
- **Một mã dùng được mấy lần?** Một lần duy nhất.
- **Nếu 2 booth cùng đổi 1 mã cùng lúc?** Bước `redeem` là atomic, chỉ 1 bên nhận
  `ok`, bên còn lại nhận `already_used`.
- **Đổi nhầm thì hoàn tác thế nào?** Hiện chưa có API hoàn tác, phải sửa tay trong
  database. Vì vậy đừng gọi `redeem` trước khi khách thanh toán xong.
