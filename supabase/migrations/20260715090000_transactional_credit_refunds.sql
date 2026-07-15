create unique index if not exists credit_ledger_unique_refund_operation
  on public.credit_ledger ((metadata->>'refund_of'))
  where reason = 'refund' and metadata->>'refund_of' is not null;

create or replace function public.spend_credits(p_user_id uuid,p_amount integer,p_reason text,p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare w public.credit_wallets%rowtype; remaining integer; quota_available integer; from_quota integer; spent_today integer; enriched_metadata jsonb;
begin
  if p_amount <= 0 then raise exception 'invalid_credit_amount'; end if;
  select coalesce(sum(abs(amount)),0)::integer into spent_today from public.credit_ledger where user_id=p_user_id and amount<0 and created_at>=date_trunc('day',now());
  if spent_today+p_amount>800 then raise exception 'daily_credit_limit'; end if;
  select * into w from public.credit_wallets where user_id=p_user_id for update;
  if not found then insert into public.credit_wallets(user_id,balance,monthly_allowance,allowance_used,allowance_reset_at) values(p_user_id,0,5000,0,date_trunc('month',now())::date) returning * into w; end if;
  if w.allowance_reset_at < date_trunc('month',now())::date then w.allowance_used:=0; w.allowance_reset_at:=date_trunc('month',now())::date; end if;
  quota_available:=greatest(w.monthly_allowance-w.allowance_used,0);
  if quota_available+w.balance<p_amount then raise exception 'insufficient_credits'; end if;
  from_quota:=least(quota_available,p_amount); remaining:=p_amount-from_quota;
  enriched_metadata:=coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('allowance_spent',from_quota,'balance_spent',remaining);
  update public.credit_wallets set allowance_used=w.allowance_used+from_quota,balance=w.balance-remaining,lifetime_spent=lifetime_spent+p_amount,allowance_reset_at=w.allowance_reset_at where user_id=p_user_id returning * into w;
  insert into public.credit_ledger(user_id,amount,reason,source,metadata,balance_after,allowance_remaining_after) values(p_user_id,-p_amount,p_reason,'api',enriched_metadata,w.balance,greatest(w.monthly_allowance-w.allowance_used,0));
  return jsonb_build_object('balance',w.balance,'allowance_remaining',greatest(w.monthly_allowance-w.allowance_used,0),'total_available',w.balance+greatest(w.monthly_allowance-w.allowance_used,0));
end; $$;

create or replace function public.refund_credit_charge(p_user_id uuid,p_operation_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare charge public.credit_ledger%rowtype; w public.credit_wallets%rowtype; refund_amount integer; allowance_spent integer; balance_spent integer;
begin
  if coalesce(trim(p_operation_id),'') = '' then raise exception 'invalid_operation_id'; end if;
  select * into charge from public.credit_ledger where user_id=p_user_id and amount<0 and metadata->>'operation_id'=p_operation_id order by created_at desc limit 1 for update;
  if not found then raise exception 'credit_charge_not_found'; end if;
  if exists(select 1 from public.credit_ledger where user_id=p_user_id and reason='refund' and metadata->>'refund_of'=p_operation_id) then
    select * into w from public.credit_wallets where user_id=p_user_id;
    return jsonb_build_object('already_refunded',true,'total_available',w.balance+greatest(w.monthly_allowance-w.allowance_used,0));
  end if;
  select * into w from public.credit_wallets where user_id=p_user_id for update;
  refund_amount:=abs(charge.amount);
  allowance_spent:=coalesce((charge.metadata->>'allowance_spent')::integer,0);
  balance_spent:=coalesce((charge.metadata->>'balance_spent')::integer,refund_amount-allowance_spent);
  if date_trunc('month',charge.created_at)<>date_trunc('month',now()) then allowance_spent:=0; balance_spent:=refund_amount; end if;
  update public.credit_wallets set allowance_used=greatest(allowance_used-allowance_spent,0),balance=balance+balance_spent,lifetime_spent=greatest(lifetime_spent-refund_amount,0) where user_id=p_user_id returning * into w;
  insert into public.credit_ledger(user_id,amount,reason,source,metadata,balance_after,allowance_remaining_after) values(p_user_id,refund_amount,'refund','system',jsonb_build_object('module',charge.reason,'refund_of',p_operation_id,'original_charge_id',charge.id,'brand_id',charge.metadata->'brand_id','provider','system','model','transactional-refund','cost_usd',0),w.balance,greatest(w.monthly_allowance-w.allowance_used,0));
  return jsonb_build_object('already_refunded',false,'refunded',refund_amount,'total_available',w.balance+greatest(w.monthly_allowance-w.allowance_used,0));
end; $$;

revoke all on function public.spend_credits(uuid,integer,text,jsonb) from public,anon,authenticated;
revoke all on function public.refund_credit_charge(uuid,text) from public,anon,authenticated;
grant execute on function public.spend_credits(uuid,integer,text,jsonb) to service_role;
grant execute on function public.refund_credit_charge(uuid,text) to service_role;
