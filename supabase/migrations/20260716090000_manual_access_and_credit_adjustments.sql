create table if not exists public.manual_access_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text not null unique,
  full_name text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.manual_access_emails enable row level security;

drop trigger if exists touch_manual_access_emails_updated_at on public.manual_access_emails;
create trigger touch_manual_access_emails_updated_at before update on public.manual_access_emails
for each row execute function public.touch_updated_at();

create or replace function public.admin_adjust_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_admin_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer set search_path=public
as $$
declare
  w public.credit_wallets%rowtype;
  remaining_allowance integer;
  subtract_amount integer;
  from_balance integer;
  from_allowance integer;
  enriched_metadata jsonb;
begin
  if p_amount = 0 then
    raise exception 'invalid_credit_adjustment';
  end if;

  if p_amount > 100000 or p_amount < -100000 then
    raise exception 'credit_adjustment_too_large';
  end if;

  select * into w from public.credit_wallets where user_id=p_user_id for update;

  if not found then
    insert into public.credit_wallets(user_id,balance,monthly_allowance,allowance_used,allowance_reset_at)
    values(p_user_id,0,600,0,date_trunc('month',now())::date)
    returning * into w;
  end if;

  if w.monthly_allowance is distinct from 600 then
    w.monthly_allowance:=600;
  end if;

  remaining_allowance:=greatest(w.monthly_allowance-w.allowance_used,0);
  enriched_metadata:=coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object(
    'module','admin_manual_adjustment',
    'admin_id',p_admin_id,
    'manual_adjustment',true,
    'counts_as_revenue',false,
    'provider','manual',
    'model','manual',
    'input_tokens',0,
    'output_tokens',0,
    'images',0,
    'cost_usd',0
  );

  if p_amount > 0 then
    update public.credit_wallets
    set balance=w.balance+p_amount,
        monthly_allowance=w.monthly_allowance
    where user_id=p_user_id
    returning * into w;

    insert into public.credit_ledger(user_id,amount,reason,source,metadata,balance_after,allowance_remaining_after)
    values(p_user_id,p_amount,p_reason,'admin_manual',enriched_metadata,w.balance,greatest(w.monthly_allowance-w.allowance_used,0));
  else
    subtract_amount:=abs(p_amount);

    if w.balance + remaining_allowance < subtract_amount then
      raise exception 'insufficient_credits';
    end if;

    from_balance:=least(w.balance,subtract_amount);
    from_allowance:=subtract_amount-from_balance;

    update public.credit_wallets
    set balance=w.balance-from_balance,
        monthly_allowance=w.monthly_allowance,
        allowance_used=w.allowance_used+from_allowance
    where user_id=p_user_id
    returning * into w;

    insert into public.credit_ledger(user_id,amount,reason,source,metadata,balance_after,allowance_remaining_after)
    values(
      p_user_id,
      p_amount,
      p_reason,
      'admin_manual',
      enriched_metadata || jsonb_build_object('balance_removed',from_balance,'allowance_removed',from_allowance),
      w.balance,
      greatest(w.monthly_allowance-w.allowance_used,0)
    );
  end if;

  return jsonb_build_object(
    'balance',w.balance,
    'allowance_remaining',greatest(w.monthly_allowance-w.allowance_used,0),
    'total_available',w.balance+greatest(w.monthly_allowance-w.allowance_used,0)
  );
end;
$$;

revoke all on function public.admin_adjust_credits(uuid,integer,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_adjust_credits(uuid,integer,text,uuid,jsonb) to service_role;
