-- ============================================================
-- Voucher khai trương - schema cho Supabase
-- Dán toàn bộ nội dung file này vào Supabase Dashboard
-- -> SQL Editor -> New query -> Run
-- ============================================================

-- 1. Bảng cấu hình nội bộ (PIN nhân viên / admin, ngày hết hạn voucher)
-- Bảng này KHÔNG có policy public nào, nên chỉ các hàm SECURITY DEFINER
-- bên dưới (chạy với quyền chủ sở hữu) mới đọc được, client (anon key)
-- không thể truy vấn trực tiếp.
create table if not exists app_settings (
  key text primary key,
  value text not null
);
alter table app_settings enable row level security;

insert into app_settings (key, value) values
  ('staff_pin', '8318'),
  ('admin_pin', '599865'),
  ('voucher_expires_at', '2026-07-06 23:59:59+07')
on conflict (key) do nothing;

-- 2. Bảng voucher
-- LƯU Ý: KHÔNG drop bảng này nữa vì production đã có dữ liệu khách thật.
-- Mọi thay đổi cấu trúc về sau dùng "alter table ... add column if not exists"
-- để không bao giờ làm mất dữ liệu hiện có.
create table if not exists vouchers (
  code text primary key,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
alter table vouchers enable row level security;

-- Loại thiết bị khách dùng khi nhận voucher (iOS/Android/Windows/macOS/Linux/Khác).
alter table vouchers add column if not exists device text;

-- RLS policy thôi chưa đủ - Postgres còn cần GRANT quyền ở mức bảng cho role anon.
grant select, insert on vouchers to anon;

-- Khách (anon key) được phép tạo mã mới và đọc lại mã của chính mình.
-- Không cho phép update/delete trực tiếp từ client (chỉ qua hàm redeem_voucher).
drop policy if exists "anon can insert voucher" on vouchers;
create policy "anon can insert voucher"
  on vouchers for insert
  to anon
  with check (true);

drop policy if exists "anon can select voucher" on vouchers;
create policy "anon can select voucher"
  on vouchers for select
  to anon
  using (true);

-- 3. Hàm đổi voucher (trang nhân viên)
-- Drop trước để loại bỏ mọi overload cũ (phòng trường hợp project đã có
-- sẵn hàm cùng tên với chữ ký khác trước khi chạy script này).
drop function if exists redeem_voucher(text, text);

create or replace function redeem_voucher(p_code text, p_staff_pin text)
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

  update vouchers v set used_at = now() where v.code = p_code
    returning v.created_at, v.used_at into v_row.created_at, v_row.used_at;

  return query select 'ok'::text, v_row.created_at, v_row.used_at;
exception when others then
  return query select 'error'::text, null::timestamptz, null::timestamptz;
end;
$$;

grant execute on function redeem_voucher(text, text) to anon;

-- 4. Hàm liệt kê voucher (trang thống kê)
-- Nếu sai PIN, hàm raise exception -> supabase.rpc trả về error,
-- đúng theo yêu cầu UI ("Sai mã PIN hoặc lỗi kết nối").
drop function if exists list_vouchers(text);

create or replace function list_vouchers(p_admin_pin text)
returns table (
  code text,
  created_at timestamptz,
  used_at timestamptz,
  device text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_pin text;
begin
  select value into v_admin_pin from app_settings where key = 'admin_pin';
  if v_admin_pin is null or p_admin_pin is distinct from v_admin_pin then
    raise exception 'invalid admin pin';
  end if;

  return query
    select v.code, v.created_at, v.used_at, v.device
    from vouchers v
    order by v.created_at desc;
end;
$$;

grant execute on function list_vouchers(text) to anon;
