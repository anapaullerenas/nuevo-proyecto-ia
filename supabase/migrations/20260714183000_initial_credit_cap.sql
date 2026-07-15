alter table public.credit_wallets
  alter column monthly_allowance set default 300;

update public.credit_wallets
set monthly_allowance = 300
where monthly_allowance is distinct from 300;

create or replace function public.spend_credits(p_user_id uuid,p_amount integer,p_reason text,p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare w public.credit_wallets%rowtype; remaining integer; quota_available integer; from_quota integer; spent_today integer;
begin
  if p_amount <= 0 then raise exception 'invalid_credit_amount'; end if;
  select coalesce(sum(abs(amount)),0)::integer into spent_today from public.credit_ledger where user_id=p_user_id and amount<0 and created_at>=date_trunc('day',now());
  if spent_today+p_amount>800 then raise exception 'daily_credit_limit'; end if;
  select * into w from public.credit_wallets where user_id=p_user_id for update;
  if not found then insert into public.credit_wallets(user_id,balance,monthly_allowance,allowance_used,allowance_reset_at) values(p_user_id,0,300,0,date_trunc('month',now())::date) returning * into w; end if;
  if w.monthly_allowance is distinct from 300 then w.monthly_allowance:=300; end if;
  if w.allowance_reset_at < date_trunc('month',now())::date then w.allowance_used:=0; w.allowance_reset_at:=date_trunc('month',now())::date; end if;
  quota_available:=greatest(w.monthly_allowance-w.allowance_used,0);
  if quota_available+w.balance<p_amount then raise exception 'insufficient_credits'; end if;
  from_quota:=least(quota_available,p_amount); remaining:=p_amount-from_quota;
  update public.credit_wallets set monthly_allowance=w.monthly_allowance,allowance_used=w.allowance_used+from_quota,balance=w.balance-remaining,lifetime_spent=lifetime_spent+p_amount,allowance_reset_at=w.allowance_reset_at where user_id=p_user_id returning * into w;
  insert into public.credit_ledger(user_id,amount,reason,source,metadata,balance_after,allowance_remaining_after) values(p_user_id,-p_amount,p_reason,'api',coalesce(p_metadata,'{}'::jsonb),w.balance,greatest(w.monthly_allowance-w.allowance_used,0));
  return jsonb_build_object('balance',w.balance,'allowance_remaining',greatest(w.monthly_allowance-w.allowance_used,0),'total_available',w.balance+greatest(w.monthly_allowance-w.allowance_used,0));
end; $$;

create or replace function public.grant_credits(p_user_id uuid,p_amount integer,p_reason text,p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare w public.credit_wallets%rowtype;
begin
  if p_amount <= 0 then raise exception 'invalid_credit_amount'; end if;
  insert into public.credit_wallets(user_id,balance,monthly_allowance,allowance_used,allowance_reset_at) values(p_user_id,p_amount,300,0,date_trunc('month',now())::date)
  on conflict(user_id) do update set balance=credit_wallets.balance+p_amount,monthly_allowance=300,lifetime_purchased=credit_wallets.lifetime_purchased+case when p_reason='recharge' then p_amount else 0 end
  returning * into w;
  insert into public.credit_ledger(user_id,amount,reason,source,metadata,balance_after,allowance_remaining_after) values(p_user_id,p_amount,p_reason,'system',coalesce(p_metadata,'{}'::jsonb),w.balance,greatest(w.monthly_allowance-w.allowance_used,0));
  return jsonb_build_object('balance',w.balance,'allowance_remaining',greatest(w.monthly_allowance-w.allowance_used,0),'total_available',w.balance+greatest(w.monthly_allowance-w.allowance_used,0));
end; $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name) values(new.id,new.email,new.raw_user_meta_data->>'full_name') on conflict(id) do nothing;
  insert into public.credit_wallets(user_id,balance,monthly_allowance,allowance_used,allowance_reset_at) values(new.id,0,300,0,date_trunc('month',now())::date) on conflict(user_id) do nothing;
  return new;
end; $$;
