-- 20260614001100_inventory.sql
-- Inventory items held in the operator's yards / warehouses.

create type inventory_status as enum ('In Stock', 'Low', 'On Order');

create table inventory_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text,
  quantity    numeric not null default 0,
  unit        text,
  location    text,
  unit_cost   numeric not null default 0,
  status      inventory_status not null default 'In Stock',
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger inventory_items_set_updated_at
  before update on inventory_items
  for each row execute function set_updated_at();
