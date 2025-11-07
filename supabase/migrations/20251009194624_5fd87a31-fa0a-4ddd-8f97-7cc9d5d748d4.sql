-- Enable required extensions
create extension if not exists "pgcrypto";

-- Create app_role enum for user roles
create type public.app_role as enum ('admin', 'staff');

-- Create profiles table (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  full_name text,
  role app_role default 'staff' not null,
  created_at timestamptz default now() not null
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Create security definer function to check user role
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = _user_id and role = _role
  );
$$;

-- Create security definer function to check if user has admin or staff role
create or replace function public.is_authenticated_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
  );
$$;

-- Profiles RLS policies
create policy "Users can view their own profile"
  on public.profiles for select
  using (user_id = auth.uid());

create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "Users can update their own profile"
  on public.profiles for update
  using (user_id = auth.uid());

create policy "Admins can update any profile"
  on public.profiles for update
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete profiles"
  on public.profiles for delete
  using (public.has_role(auth.uid(), 'admin'));

-- Create customers table
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  dob date,
  anniversary date,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_customers_phone on public.customers(phone);
create index if not exists idx_customers_email on public.customers(email);

-- Enable RLS on customers
alter table public.customers enable row level security;

-- Customers RLS policies
create policy "Authenticated users can view customers"
  on public.customers for select
  using (public.is_authenticated_user());

create policy "Staff and admins can insert customers"
  on public.customers for insert
  with check (public.is_authenticated_user());

create policy "Staff and admins can update customers"
  on public.customers for update
  using (public.is_authenticated_user());

create policy "Admins can delete customers"
  on public.customers for delete
  using (public.has_role(auth.uid(), 'admin'));

-- Create products table
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  price numeric(12,2),
  stock integer default 0,
  category text,
  created_at timestamptz default now() not null
);

-- Enable RLS on products
alter table public.products enable row level security;

-- Products RLS policies
create policy "Authenticated users can view products"
  on public.products for select
  using (public.is_authenticated_user());

create policy "Staff and admins can insert products"
  on public.products for insert
  with check (public.is_authenticated_user());

create policy "Staff and admins can update products"
  on public.products for update
  using (public.is_authenticated_user());

create policy "Admins can delete products"
  on public.products for delete
  using (public.has_role(auth.uid(), 'admin'));

-- Create invoices table
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null,
  customer_id uuid references public.customers(id) on delete set null,
  date timestamptz default now() not null,
  subtotal numeric(12,2) default 0,
  tax numeric(12,2) default 0,
  total numeric(12,2) default 0 not null,
  payment_method text,
  uploaded_by uuid references public.profiles(id),
  file_url text,
  raw_payload jsonb,
  created_at timestamptz default now() not null
);

-- Enable RLS on invoices
alter table public.invoices enable row level security;

-- Invoices RLS policies
create policy "Authenticated users can view invoices"
  on public.invoices for select
  using (public.is_authenticated_user());

create policy "Staff and admins can insert invoices"
  on public.invoices for insert
  with check (public.is_authenticated_user());

create policy "Staff and admins can update invoices"
  on public.invoices for update
  using (public.is_authenticated_user());

create policy "Admins can delete invoices"
  on public.invoices for delete
  using (public.has_role(auth.uid(), 'admin'));

-- Create invoice_items table
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete set null,
  sku text,
  name text not null,
  qty numeric(12,2) default 1 not null,
  unit_price numeric(12,2) default 0 not null,
  total numeric(12,2) default 0 not null
);

-- Enable RLS on invoice_items
alter table public.invoice_items enable row level security;

-- Invoice items RLS policies
create policy "Authenticated users can view invoice items"
  on public.invoice_items for select
  using (public.is_authenticated_user());

create policy "Staff and admins can insert invoice items"
  on public.invoice_items for insert
  with check (public.is_authenticated_user());

create policy "Staff and admins can update invoice items"
  on public.invoice_items for update
  using (public.is_authenticated_user());

create policy "Admins can delete invoice items"
  on public.invoice_items for delete
  using (public.has_role(auth.uid(), 'admin'));

-- Create orders table
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text unique not null,
  invoice_id uuid references public.invoices(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  order_status text check (order_status in ('pending','processing','ready','dispatched','delivered','cancelled')) default 'pending' not null,
  payment_status text check (payment_status in ('unpaid','paid','partial')) default 'unpaid' not null,
  total_amount numeric(12,2) default 0 not null,
  metadata jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS on orders
alter table public.orders enable row level security;

-- Orders RLS policies
create policy "Authenticated users can view orders"
  on public.orders for select
  using (public.is_authenticated_user());

create policy "Staff and admins can insert orders"
  on public.orders for insert
  with check (public.is_authenticated_user());

create policy "Staff and admins can update orders"
  on public.orders for update
  using (public.is_authenticated_user());

create policy "Admins can delete orders"
  on public.orders for delete
  using (public.has_role(auth.uid(), 'admin'));

-- Create order_stages table
create table if not exists public.order_stages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade not null,
  stage_name text not null,
  vendor_id uuid references public.profiles(id) on delete set null,
  vendor_name text,
  assigned_employee text,
  start_ts timestamptz,
  end_ts timestamptz,
  status text check (status in ('pending','in_progress','done')) default 'pending' not null,
  notes text,
  metadata jsonb,
  created_at timestamptz default now() not null
);

-- Enable RLS on order_stages
alter table public.order_stages enable row level security;

-- Order stages RLS policies
create policy "Authenticated users can view order stages"
  on public.order_stages for select
  using (public.is_authenticated_user());

create policy "Staff and admins can insert order stages"
  on public.order_stages for insert
  with check (public.is_authenticated_user());

create policy "Staff and admins can update order stages"
  on public.order_stages for update
  using (public.is_authenticated_user());

create policy "Admins can delete order stages"
  on public.order_stages for delete
  using (public.has_role(auth.uid(), 'admin'));

-- Create consents table for marketing
create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade not null,
  channel text check (channel in ('whatsapp','sms','email')) not null,
  granted boolean default true not null,
  granted_at timestamptz default now() not null,
  revoked_at timestamptz
);

-- Enable RLS on consents
alter table public.consents enable row level security;

-- Consents RLS policies
create policy "Authenticated users can view consents"
  on public.consents for select
  using (public.is_authenticated_user());

create policy "Staff and admins can manage consents"
  on public.consents for all
  using (public.is_authenticated_user());

-- Create marketing_events table
create table if not exists public.marketing_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade not null,
  event_type text check (event_type in ('birthday','anniversary','custom')) not null,
  scheduled_date date not null,
  template text,
  data jsonb,
  status text check (status in ('scheduled','sent','skipped')) default 'scheduled' not null,
  created_at timestamptz default now() not null
);

-- Enable RLS on marketing_events
alter table public.marketing_events enable row level security;

-- Marketing events RLS policies
create policy "Authenticated users can view marketing events"
  on public.marketing_events for select
  using (public.is_authenticated_user());

create policy "Admins can manage marketing events"
  on public.marketing_events for all
  using (public.has_role(auth.uid(), 'admin'));

-- Create audit_logs table
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id),
  action_type text not null,
  resource_type text not null,
  resource_id uuid,
  payload jsonb,
  created_at timestamptz default now() not null
);

-- Enable RLS on audit_logs
alter table public.audit_logs enable row level security;

-- Audit logs RLS policies
create policy "Admins can view audit logs"
  on public.audit_logs for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "System can insert audit logs"
  on public.audit_logs for insert
  with check (true);

-- Create function to handle new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'staff'::app_role
  );
  return new;
end;
$$;

-- Create trigger for new user signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Create function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Add triggers for updated_at
create trigger update_customers_updated_at
  before update on public.customers
  for each row execute function public.update_updated_at_column();

create trigger update_orders_updated_at
  before update on public.orders
  for each row execute function public.update_updated_at_column();