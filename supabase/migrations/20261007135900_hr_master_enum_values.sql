-- Keep enum additions in their own migration so later migrations can safely use
-- the new labels after PostgreSQL commits these ALTER TYPE statements.
alter type public.lifecycle_event_type add value if not exists 'ONBOARDING';
alter type public.lifecycle_event_type add value if not exists 'CLIENT_ASSIGNMENT';
alter type public.lifecycle_event_type add value if not exists 'LEAVE_START';
alter type public.lifecycle_event_type add value if not exists 'LEAVE_RETURN';
alter type public.resource_status add value if not exists 'RESERVED';
alter type public.resource_status add value if not exists 'RETIRED';
