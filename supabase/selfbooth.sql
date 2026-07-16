-- ============================================================
-- Bổ sung cho tích hợp selfbooth
-- Dán toàn bộ file này vào Supabase Dashboard -> SQL Editor -> Run.
-- An toàn để chạy lại nhiều lần, không đụng tới dữ liệu voucher hiện có.
-- ============================================================

-- Hàm kiểm tra mã mà KHÔNG đánh dấu đã dùng.
-- Selfbooth gọi hàm này lúc khách vừa nhập mã (để hiện mức giảm 20%),
-- rồi chỉ gọi redeem_voucher sau khi khách thanh toán xong.
-- Logic kiểm tra giống hệt redeem_voucher, chỉ bỏ bước update.
drop function if exists check_voucher(text, text);

create or replace function check_voucher(p_code text, p_staff_pin text)
returns table (
  status text,
  created_at timestamptz,
  used_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_pin text;
  v_expires_at timestamptz;
  v_row vouchers%rowtype;
begin
  select s.value into v_staff_pin from app_settings s where s.key = 'staff_pin';
  if v_staff_pin is null or p_staff_pin is distinct from v_staff_pin then
    return query select 'wrong_pin'::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  select v.* into v_row from vouchers v where v.code = p_code;
  if not found then
    return query select 'not_found'::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  if v_row.used_at is not null then
    return query select 'already_used'::text, v_row.created_at, v_row.used_at;
    return;
  end if;

  select s.value::timestamptz into v_expires_at from app_settings s where s.key = 'voucher_expires_at';
  if v_expires_at is not null and now() > v_expires_at then
    return query select 'expired'::text, v_row.created_at, null::timestamptz;
    return;
  end if;

  return query select 'ok'::text, v_row.created_at, null::timestamptz;
exception when others then
  return query select 'error'::text, null::timestamptz, null::timestamptz;
end;
$$;

grant execute on function check_voucher(text, text) to anon;

-- ============================================================
-- Bỏ hạn sử dụng voucher (theo quyết định: voucher không hết hạn)
--
-- Không set null được vì cột value khai báo not null, và cũng không nên xoá
-- hẳn dòng này: schema.sql dùng "on conflict do nothing" nên nếu ai chạy lại
-- file đó thì ngày 06/07/2026 sẽ quay trở lại. Đặt mốc 2099 là cách an toàn
-- nhất để vô hiệu hoá việc hết hạn.
-- ============================================================
update app_settings set value = '2099-12-31 23:59:59+07' where key = 'voucher_expires_at';

-- ============================================================
-- Đổi PIN (nên làm: PIN cũ đã bị lộ trong git history của repo public)
-- Sửa giá trị bên dưới rồi bỏ comment để chạy.
-- Sau khi đổi, cập nhật lại biến STAFF_PIN trên Vercel cho khớp.
-- ============================================================
-- update app_settings set value = 'PIN_MOI_CUA_BAN' where key = 'staff_pin';
-- update app_settings set value = 'PIN_ADMIN_MOI'   where key = 'admin_pin';
