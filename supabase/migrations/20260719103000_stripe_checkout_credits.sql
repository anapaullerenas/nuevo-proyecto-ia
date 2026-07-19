create table if not exists public.stripe_checkout_sessions (
  id text primary key check (id like 'cs_%'),
  user_id uuid not null references auth.users(id) on delete cascade,
  package_id text not null check (package_id in ('impulso', 'crecimiento', 'estudio')),
  price_id text not null check (price_id like 'price_%'),
  credits integer not null check (credits > 0),
  amount_total bigint not null check (amount_total > 0),
  currency text not null check (currency = 'usd'),
  stripe_mode text not null check (stripe_mode in ('test', 'live')),
  status text not null default 'created' check (status in ('created', 'paid', 'failed', 'expired')),
  stripe_event_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stripe_checkout_sessions_user_created_idx
  on public.stripe_checkout_sessions (user_id, created_at desc);

alter table public.stripe_checkout_sessions enable row level security;
revoke all on public.stripe_checkout_sessions from public, anon, authenticated;
grant select, insert, update on public.stripe_checkout_sessions to service_role;

create or replace function public.apply_stripe_credit_purchase(
  p_user_id uuid,
  p_stripe_event_id text,
  p_checkout_session_id text,
  p_price_id text,
  p_credits integer,
  p_amount_total bigint,
  p_currency text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  checkout_row public.stripe_checkout_sessions%rowtype;
begin
  if p_stripe_event_id is null or p_stripe_event_id !~ '^evt_'
    or p_checkout_session_id is null or p_checkout_session_id !~ '^cs_'
    or p_price_id is null or p_price_id !~ '^price_'
    or p_credits <= 0 or p_amount_total <= 0 or lower(p_currency) <> 'usd' then
    raise exception 'invalid_stripe_purchase';
  end if;

  select * into checkout_row
  from public.stripe_checkout_sessions
  where id = p_checkout_session_id
  for update;

  if not found then raise exception 'unknown_checkout_session'; end if;

  if checkout_row.user_id <> p_user_id
    or checkout_row.price_id <> p_price_id
    or checkout_row.credits <> p_credits
    or checkout_row.amount_total <> p_amount_total
    or checkout_row.currency <> lower(p_currency) then
    raise exception 'checkout_session_mismatch';
  end if;

  if checkout_row.status = 'paid' then return false; end if;

  if exists (
    select 1 from public.stripe_checkout_sessions
    where stripe_event_id = p_stripe_event_id and id <> p_checkout_session_id
  ) then
    raise exception 'stripe_event_reused';
  end if;

  perform public.grant_credits(
    p_user_id,
    p_credits,
    'recharge',
    jsonb_build_object(
      'provider','stripe',
      'model','stripe-checkout',
      'stripe_event_id',p_stripe_event_id,
      'stripe_checkout_session_id',p_checkout_session_id,
      'stripe_price_id',p_price_id,
      'package',checkout_row.package_id,
      'amount_usd',p_amount_total::numeric / 100,
      'currency','usd',
      'counts_as_revenue',true,
      'input_tokens',0,
      'output_tokens',0,
      'images',0,
      'cost_usd',0
    )
  );

  update public.stripe_checkout_sessions
  set status='paid', stripe_event_id=p_stripe_event_id, updated_at=now()
  where id=p_checkout_session_id;

  return true;
end;
$$;

revoke all on function public.apply_stripe_credit_purchase(uuid,text,text,text,integer,bigint,text)
  from public,anon,authenticated;
grant execute on function public.apply_stripe_credit_purchase(uuid,text,text,text,integer,bigint,text)
  to service_role;
