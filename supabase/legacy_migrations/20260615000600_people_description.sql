-- 20260615000600_people_description.sql
-- Free-form notes / description for each kind of person.

alter table contractors       add column description text;
alter table service_providers add column description text;
alter table royalty_owners    add column description text;
