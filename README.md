# DJ LitKick Booking — Setup

A standalone booking calendar. Customers pick an open date and submit a request; you get notified by email and can confirm or decline from `admin.html`. No server — just this static site + Supabase (database) + EmailJS (email).

This site will not work until you complete the two setup steps below.

## 1. Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run the block below in one go (edit the password on the `insert into admin_settings` line first — pick a genuinely strong password, this is what protects your Confirm/Decline actions).

```sql
create table public.bookings (
  id                uuid primary key default gen_random_uuid(),
  first_name        text not null,
  last_name         text not null,
  location          text not null,
  event_type        text not null check (event_type in ('club','wedding','private','business')),
  technique_needed  boolean not null default false,
  email             text not null,
  event_date        date not null check (event_date >= current_date and event_date <= date '2030-12-31'),
  status            text not null default 'pending' check (status in ('pending','confirmed','declined')),
  created_at        timestamptz not null default now()
);
create index bookings_event_date_idx on public.bookings (event_date);

create unique index bookings_date_active_uidx
  on public.bookings (event_date) where status in ('pending', 'confirmed');

alter table public.bookings enable row level security;

create policy "anon can insert pending bookings"
  on public.bookings for insert to anon
  with check (status = 'pending');

create view public.booked_dates as
  select event_date, status from public.bookings
  where status in ('pending', 'confirmed');
grant select on public.booked_dates to anon;

create view public.upcoming_shows as
  select
    event_date,
    event_type,
    case when event_type = 'private' then null else location end as location
  from public.bookings
  where status = 'confirmed' and event_date >= current_date
  order by event_date asc;
grant select on public.upcoming_shows to anon;

create table public.admin_settings (
  id int primary key default 1,
  password_hash text not null,
  constraint admin_settings_singleton check (id = 1)
);
alter table public.admin_settings enable row level security;

insert into public.admin_settings (id, password_hash)
values (1, crypt('CHANGE_ME_STRONG_PASSWORD', gen_salt('bf')));

create or replace function public.admin_list_pending(p_password text)
returns setof public.bookings
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from admin_settings where id = 1 and password_hash = crypt(p_password, password_hash)) then
    raise exception 'invalid password';
  end if;
  return query select * from bookings where status = 'pending' order by event_date asc;
end;
$$;

create or replace function public.admin_update_booking_status(p_password text, p_booking_id uuid, p_new_status text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_new_status not in ('confirmed', 'declined') then raise exception 'invalid status'; end if;
  if not exists (select 1 from admin_settings where id = 1 and password_hash = crypt(p_password, password_hash)) then
    raise exception 'invalid password';
  end if;
  update bookings set status = p_new_status where id = p_booking_id;
end;
$$;

create or replace function public.admin_list_all_bookings(p_password text)
returns setof public.bookings
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from admin_settings where id = 1 and password_hash = crypt(p_password, password_hash)) then
    raise exception 'invalid password';
  end if;
  return query select * from bookings order by event_date asc;
end;
$$;

create or replace function public.admin_delete_booking(p_password text, p_booking_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from admin_settings where id = 1 and password_hash = crypt(p_password, password_hash)) then
    raise exception 'invalid password';
  end if;
  delete from bookings where id = p_booking_id;
end;
$$;

create or replace function public.admin_add_booking(
  p_password text,
  p_first_name text,
  p_last_name text,
  p_location text,
  p_event_type text,
  p_technique_needed boolean,
  p_email text,
  p_event_date date
)
returns public.bookings
language plpgsql security definer set search_path = public, extensions as $$
declare
  new_row public.bookings;
begin
  if not exists (select 1 from admin_settings where id = 1 and password_hash = crypt(p_password, password_hash)) then
    raise exception 'invalid password';
  end if;

  insert into bookings (first_name, last_name, location, event_type, technique_needed, email, event_date, status)
  values (p_first_name, p_last_name, p_location, p_event_type, p_technique_needed, p_email, p_event_date, 'confirmed')
  returning * into new_row;

  return new_row;
end;
$$;

grant execute on function public.admin_list_pending(text) to anon;
grant execute on function public.admin_update_booking_status(text, uuid, text) to anon;
grant execute on function public.admin_list_all_bookings(text) to anon;
grant execute on function public.admin_delete_booking(text, uuid) to anon;
grant execute on function public.admin_add_booking(text, text, text, text, text, boolean, text, date) to anon;
```

3. Go to **Project Settings → API**. Copy the **Project URL** and the **`anon` `public`** key (not the `service_role` key — never use that one here).
4. Open `js/supabase-client.js` and paste them in:
   ```js
   const SUPABASE_URL = "https://xxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJ...";
   ```

**To change the admin password later**, re-run just this in the SQL Editor with your new password:
```sql
update public.admin_settings
set password_hash = crypt('YOUR_NEW_PASSWORD', gen_salt('bf'))
where id = 1;
```

## 2. EmailJS setup

1. Create a free account at [emailjs.com](https://www.emailjs.com) and connect the email inbox you want to send from (e.g. your Gmail).
2. Note your **Service ID** and **Public Key** (Account → General).
3. Create two email templates:

   Customers can select more than one date in a single request, so both templates receive **`{{event_dates}}`** — a single semicolon-separated string listing every date in the request (e.g. `Friday, July 24, 2026; Saturday, August 8, 2026`), not a separate email per date.

   **Template 1 — sent to the customer.** Name it anything, e.g. `customer_confirm`. In the template's "To Email" field, put `{{email}}`. Body example:
   > Hi {{first_name}}, your DJ LitKick booking request for {{event_dates}} ({{event_type}} — {{location}}) has been received. Your request is being processed — you'll hear back shortly. Just reply to this email if you have questions.

   **Template 2 — sent to you.** Name it e.g. `owner_notify`. In "To Email" put your own address (`info@dj-litkick.com` or whichever inbox you're monitoring). In **"Reply To"** put `{{reply_to}}` — this is what makes hitting Reply in your inbox go straight to the customer. Body example:
   > New booking request
   > Name: {{first_name}} {{last_name}}
   > Date(s): {{event_dates}}
   > Event type: {{event_type}}
   > Location: {{location}}
   > Technique needed: {{technique_needed}}
   > Customer email: {{email}}

4. Note both template IDs.
5. Open `js/booking.js` and paste in all four values near the top of the file:
   ```js
   const EMAILJS_PUBLIC_KEY = "...";
   const EMAILJS_SERVICE_ID = "...";
   const EMAILJS_TEMPLATE_CUSTOMER = "...";   // template 1
   const EMAILJS_TEMPLATE_OWNER = "...";      // template 2
   ```

Check EmailJS's current free-tier monthly send limit on their pricing page before launch — each booking sends 2 emails.

## Testing locally

From this folder, run:
```bash
npx serve .
```
Then open the printed local URL. Submit a real test booking with an email you control, confirm both emails arrive, then open `admin.html` to confirm/decline it.

## Deploying

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create litkick-booking --public --source=. --remote=origin --push
npx vercel --prod
```

## Notes

- The calendar always starts on today's date and goes through December 2030. Extending past 2030 later just means changing `MAX_YEAR` in `js/booking.js` and the `event_date` check in the `bookings` table.
- Customers can select multiple dates in one request. Each date is stored as its own row in `bookings` (same name/email/event type on each), and both emails list all the dates together. In `admin.html` you'll see one row per date — confirm or decline each date individually, even if they came from the same request.
- Declining a request automatically frees that date back up for other customers — no extra step needed.
- `admin.html` uses a single shared password (set in Supabase, see above) rather than individual logins — keep it private, and rotate it if you ever suspect it's been shared.
