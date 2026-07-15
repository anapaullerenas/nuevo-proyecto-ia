do $$
declare
  test_user uuid;
  before_wallet public.credit_wallets%rowtype;
  current_wallet public.credit_wallets%rowtype;
  operation_id text := 'credit-self-test-' || gen_random_uuid()::text;
  initial_total integer;
begin
  select w.user_id into test_user
  from public.credit_wallets w
  left join lateral (
    select coalesce(sum(abs(l.amount)),0)::integer as spent_today
    from public.credit_ledger l
    where l.user_id=w.user_id and l.amount<0 and l.created_at>=date_trunc('day',now())
  ) usage on true
  where usage.spent_today<=750
  order by usage.spent_today asc
  limit 1;

  if test_user is null then raise exception 'credit_self_test_requires_wallet'; end if;
  select * into before_wallet from public.credit_wallets where user_id=test_user for update;
  initial_total:=before_wallet.balance+greatest(before_wallet.monthly_allowance-before_wallet.allowance_used,0);

  perform public.grant_credits(test_user,37,'admin_grant',jsonb_build_object('self_test',operation_id));
  select * into current_wallet from public.credit_wallets where user_id=test_user;
  if current_wallet.balance+greatest(current_wallet.monthly_allowance-current_wallet.allowance_used,0)<>initial_total+37 then
    raise exception 'credit_grant_self_test_failed';
  end if;

  perform public.spend_credits(test_user,23,'static_brief',jsonb_build_object('operation_id',operation_id,'self_test',operation_id));
  select * into current_wallet from public.credit_wallets where user_id=test_user;
  if current_wallet.balance+greatest(current_wallet.monthly_allowance-current_wallet.allowance_used,0)<>initial_total+14 then
    raise exception 'credit_spend_self_test_failed';
  end if;

  perform public.refund_credit_charge(test_user,operation_id);
  perform public.refund_credit_charge(test_user,operation_id);
  select * into current_wallet from public.credit_wallets where user_id=test_user;
  if current_wallet.balance+greatest(current_wallet.monthly_allowance-current_wallet.allowance_used,0)<>initial_total+37 then
    raise exception 'credit_refund_self_test_failed';
  end if;
  if (select count(*) from public.credit_ledger where user_id=test_user and reason='refund' and metadata->>'refund_of'=operation_id)<>1 then
    raise exception 'credit_refund_idempotency_self_test_failed';
  end if;

  delete from public.credit_ledger where user_id=test_user and (metadata->>'self_test'=operation_id or metadata->>'refund_of'=operation_id);
  update public.credit_wallets set
    balance=before_wallet.balance,
    monthly_allowance=before_wallet.monthly_allowance,
    allowance_used=before_wallet.allowance_used,
    allowance_reset_at=before_wallet.allowance_reset_at,
    lifetime_purchased=before_wallet.lifetime_purchased,
    lifetime_spent=before_wallet.lifetime_spent,
    updated_at=before_wallet.updated_at
  where user_id=test_user;
end $$;
