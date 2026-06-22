-- 2026061601000_backfill_revenue_receipt_date.sql
-- One-time correction: existing revenue rows were dated by their production /
-- sales month, but the ledger is cash-basis (txn_date = when money is received).
-- Revenue checks land ~one month after the production month, so every revenue
-- row is uniformly one month early. Shift them forward to the receipt month.
--
-- Expenses are unaffected (already dated on the payment/invoice date). The OCR
-- prompt now captures the payment date for revenue, so new rows are correct and
-- do not need this shift.
--
-- NOT idempotent — it mutates dates. Run exactly once.

update transactions
set txn_date = txn_date + interval '1 month'
where kind = 'revenue';
