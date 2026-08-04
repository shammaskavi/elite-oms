-- M1: Schema Extension for Locations and Stock Units
CREATE TABLE IF NOT EXISTS public.locations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code text UNIQUE NOT NULL,
    label text NOT NULL,
    location_type text NOT NULL CHECK (location_type IN ('ZONE', 'RACK', 'SHELF', 'BIN', 'FLOOR', 'TRIAL_ROOM', 'WORKSHOP', 'TRANSIT', 'SOLD_OUT')),
    parent_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
    barcode text UNIQUE NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.stock_units (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    unit_code text UNIQUE NOT NULL,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    current_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'on_floor', 'with_customer', 'reserved', 'in_workshop', 'sold', 'returned', 'damaged', 'lost', 'written_off')),
    source_type text NOT NULL DEFAULT 'supplier' CHECK (source_type IN ('supplier', 'in_house')),
    cost_price numeric(12,2),
    date_received date DEFAULT current_date NOT NULL,
    date_sold timestamp with time zone,
    last_moved_at timestamp with time zone DEFAULT now() NOT NULL,
    last_counted_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    unit_id uuid REFERENCES public.stock_units(id) ON DELETE CASCADE NOT NULL,
    movement_type text NOT NULL CHECK (movement_type IN ('receive', 'relocate', 'to_floor', 'to_customer', 'return_to_stock', 'reserve', 'sell', 'return_from_sale', 'to_workshop', 'from_workshop', 'adjust', 'damage', 'write_off', 'stock_count')),
    from_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
    to_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
    old_status text,
    new_status text NOT NULL,
    actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
    moved_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Seed static virtual locations
INSERT INTO public.locations (code, label, location_type, barcode)
VALUES
  ('SOLD_OUT', 'Sold Items Virtual Area', 'SOLD_OUT', 'LOC-SOLDOUT'),
  ('RETURNED', 'Returned Items Area', 'BIN', 'LOC-RETURNED'),
  ('INTAKE', 'Supplier Intake / Temporary Area', 'ZONE', 'LOC-INTAKE')
ON CONFLICT (code) DO NOTHING;

-- RLS Configurations
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Locations Policies
CREATE POLICY "Authenticated users can read locations" ON public.locations FOR SELECT USING (public.is_authenticated_user());
CREATE POLICY "Authenticated users can insert locations" ON public.locations FOR INSERT WITH CHECK (public.is_authenticated_user());
CREATE POLICY "Authenticated users can update locations" ON public.locations FOR UPDATE USING (public.is_authenticated_user());
CREATE POLICY "Admins can delete locations" ON public.locations FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Stock Units Policies
CREATE POLICY "Authenticated users can read stock units" ON public.stock_units FOR SELECT USING (public.is_authenticated_user());
CREATE POLICY "Authenticated users can insert stock units" ON public.stock_units FOR INSERT WITH CHECK (public.is_authenticated_user());
CREATE POLICY "Authenticated users can update stock units" ON public.stock_units FOR UPDATE USING (public.is_authenticated_user());
CREATE POLICY "Admins can delete stock units" ON public.stock_units FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Stock Movements Policies
CREATE POLICY "Authenticated users can read stock movements" ON public.stock_movements FOR SELECT USING (public.is_authenticated_user());
CREATE POLICY "Authenticated users can insert stock movements" ON public.stock_movements FOR INSERT WITH CHECK (public.is_authenticated_user());
CREATE POLICY "Authenticated users can update stock movements" ON public.stock_movements FOR UPDATE USING (public.is_authenticated_user());
CREATE POLICY "Admins can delete stock movements" ON public.stock_movements FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger: apply_stock_movement
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.stock_units
  SET
    current_location_id = NEW.to_location_id,
    status = NEW.new_status,
    last_moved_at = NEW.moved_at,
    date_sold = CASE WHEN NEW.new_status = 'sold' THEN NEW.moved_at ELSE date_sold END
  WHERE id = NEW.unit_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_apply_stock_movement ON public.stock_movements;
CREATE TRIGGER tr_apply_stock_movement
AFTER INSERT ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.apply_stock_movement();

-- Views for Deadstock and Valuation (IST / Asia/Kolkata boundary)
CREATE OR REPLACE VIEW public.v_stock_units_deadstock AS
SELECT 
    su.id AS unit_id,
    su.unit_code,
    su.product_id,
    su.current_location_id,
    su.status,
    su.cost_price,
    su.date_received,
    su.last_moved_at,
    p.name AS product_name,
    p.category AS product_category,
    p.mrp AS product_mrp,
    l.label AS location_label,
    l.code AS location_code,
    (CURRENT_DATE - su.date_received) AS age_days,
    CASE 
        WHEN (CURRENT_DATE - su.date_received) < 180 THEN 'fresh'
        WHEN (CURRENT_DATE - su.date_received) >= 180 AND (CURRENT_DATE - su.date_received) < 365 THEN 'slow_moving'
        WHEN (CURRENT_DATE - su.date_received) >= 365 AND (CURRENT_DATE - su.date_received) < 730 THEN 'aging'
        ELSE 'deadstock'
    END AS age_bucket
FROM public.stock_units su
JOIN public.products p ON su.product_id = p.id
LEFT JOIN public.locations l ON su.current_location_id = l.id
WHERE su.status IN ('in_stock', 'on_floor', 'with_customer', 'reserved');

-- M2: products.stock recount logic
CREATE OR REPLACE FUNCTION public.recount_product_stock(p_product_id uuid)
RETURNS void AS $$
DECLARE
  v_count int;
  v_is_unitised boolean;
BEGIN
  -- Check if product is unitised (has >=1 stock_unit)
  SELECT EXISTS(
    SELECT 1 FROM public.stock_units WHERE product_id = p_product_id
  ) INTO v_is_unitised;

  IF v_is_unitised THEN
    -- Count units in active sellable statuses
    SELECT count(*) INTO v_count
    FROM public.stock_units
    WHERE product_id = p_product_id
      AND status IN ('in_stock', 'on_floor', 'with_customer', 'reserved');

    -- Update products stock
    UPDATE public.products
    SET stock = v_count
    WHERE id = p_product_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_stock_units_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recount_product_stock(OLD.product_id);
    RETURN OLD;
  ELSE
    PERFORM public.recount_product_stock(NEW.product_id);
    IF TG_OP = 'UPDATE' AND OLD.product_id <> NEW.product_id THEN
      PERFORM public.recount_product_stock(OLD.product_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_recount_product_stock ON public.stock_units;
CREATE TRIGGER tr_recount_product_stock
AFTER INSERT OR UPDATE OR DELETE ON public.stock_units
FOR EACH ROW
EXECUTE FUNCTION public.handle_stock_units_change();

-- M3: Overriding Order Adjustment Function
-- Legacy function preserved inside comment below:
/*
CREATE OR REPLACE FUNCTION public.handle_order_inventory_adjustment_legacy()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id UUID;
  v_qty INT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (NEW.metadata->>'product_id') IS NOT NULL AND NEW.order_status != 'cancelled' THEN
      v_product_id := (NEW.metadata->>'product_id')::UUID;
      v_qty := (NEW.metadata->>'qty')::INT;
      IF v_qty IS NOT NULL AND v_qty > 0 THEN
        UPDATE public.products SET stock = COALESCE(stock, 0) - v_qty WHERE id = v_product_id;
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (NEW.metadata->>'product_id') IS NOT NULL AND OLD.order_status != 'cancelled' AND NEW.order_status = 'cancelled' THEN
      v_product_id := (NEW.metadata->>'product_id')::UUID;
      v_qty := (NEW.metadata->>'qty')::INT;
      IF v_qty IS NOT NULL AND v_qty > 0 THEN
        UPDATE public.products SET stock = COALESCE(stock, 0) + v_qty WHERE id = v_product_id;
      END IF;
    ELSIF (NEW.metadata->>'product_id') IS NOT NULL AND OLD.order_status = 'cancelled' AND NEW.order_status != 'cancelled' THEN
      v_product_id := (NEW.metadata->>'product_id')::UUID;
      v_qty := (NEW.metadata->>'qty')::INT;
      IF v_qty IS NOT NULL AND v_qty > 0 THEN
        UPDATE public.products SET stock = COALESCE(stock, 0) - v_qty WHERE id = v_product_id;
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF (OLD.metadata->>'product_id') IS NOT NULL AND OLD.order_status != 'cancelled' THEN
      v_product_id := (OLD.metadata->>'product_id')::UUID;
      v_qty := (OLD.metadata->>'qty')::INT;
      IF v_qty IS NOT NULL AND v_qty > 0 THEN
        UPDATE public.products SET stock = COALESCE(stock, 0) + v_qty WHERE id = v_product_id;
      END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
*/

CREATE OR REPLACE FUNCTION public.handle_order_inventory_adjustment()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id UUID;
  v_qty INT;
  v_is_unitised BOOLEAN;
  v_sold_out_id UUID;
  v_returned_id UUID;
  v_unit_code TEXT;
  v_unit_id UUID;
  v_current_loc_id UUID;
  v_current_status TEXT;
  v_actor_profile_id UUID;
  v_scanned_codes TEXT[];
  v_idx INT;
  v_actual_sold INT := 0;
  v_order_code TEXT;
  v_order_id UUID;
BEGIN
  -- Get virtual locations
  SELECT id INTO v_sold_out_id FROM public.locations WHERE code = 'SOLD_OUT';
  SELECT id INTO v_returned_id FROM public.locations WHERE code = 'RETURNED';

  -- Retrieve actor
  SELECT id INTO v_actor_profile_id FROM public.profiles WHERE user_id = auth.uid();

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_product_id := (NEW.metadata->>'product_id')::UUID;
    v_qty := (NEW.metadata->>'qty')::INT;
    v_order_code := NEW.order_code;
    v_order_id := NEW.id;
  ELSE
    v_product_id := (OLD.metadata->>'product_id')::UUID;
    v_qty := (OLD.metadata->>'qty')::INT;
    v_order_code := OLD.order_code;
    v_order_id := OLD.id;
  END IF;

  IF v_product_id IS NOT NULL AND v_qty IS NOT NULL AND v_qty > 0 THEN
    -- Check if product is unitised
    SELECT EXISTS(
      SELECT 1 FROM public.stock_units WHERE product_id = v_product_id
    ) INTO v_is_unitised;

    IF v_is_unitised THEN
      -- UNITISED STOCK lifecycle logic
      IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.order_status = 'cancelled' AND NEW.order_status <> 'cancelled') THEN
        -- Parse scanned unit codes if they exist in order metadata
        IF NEW.metadata ? 'unit_codes' THEN
          SELECT ARRAY(SELECT jsonb_array_elements_text(NEW.metadata->'unit_codes')) INTO v_scanned_codes;
        END IF;

        IF COALESCE(array_length(v_scanned_codes, 1), 0) > 0 THEN
          -- Sell the specific scanned units
          FOR v_idx IN 1..array_length(v_scanned_codes, 1) LOOP
            SELECT id, current_location_id, status INTO v_unit_id, v_current_loc_id, v_current_status
            FROM public.stock_units
            WHERE unit_code = v_scanned_codes[v_idx] AND product_id = v_product_id;

            IF v_unit_id IS NOT NULL AND v_current_status IN ('in_stock', 'on_floor', 'with_customer', 'reserved') THEN
              INSERT INTO public.stock_movements (unit_id, movement_type, from_location_id, to_location_id, old_status, new_status, actor_profile_id, order_id, notes)
              VALUES (v_unit_id, 'sell', v_current_loc_id, v_sold_out_id, v_current_status, 'sold', v_actor_profile_id, v_order_id, 'Scanned sell for order ' || v_order_code);
              v_actual_sold := v_actual_sold + 1;
            END IF;
          END LOOP;
        END IF;

        -- Auto-FIFO allocation for remaining count
        IF v_actual_sold < v_qty THEN
          DECLARE
            r_unit RECORD;
          BEGIN
            FOR r_unit IN (
              SELECT id, current_location_id, status 
              FROM public.stock_units
              WHERE product_id = v_product_id AND status IN ('in_stock', 'on_floor', 'with_customer', 'reserved')
              ORDER BY date_received ASC, created_at ASC
              LIMIT (v_qty - v_actual_sold)
              FOR UPDATE SKIP LOCKED
            ) LOOP
              INSERT INTO public.stock_movements (unit_id, movement_type, from_location_id, to_location_id, old_status, new_status, actor_profile_id, order_id, notes)
              VALUES (r_unit.id, 'sell', r_unit.current_location_id, v_sold_out_id, r_unit.status, 'sold', v_actor_profile_id, v_order_id, 'FIFO sell for order ' || v_order_code);
              v_actual_sold := v_actual_sold + 1;
            END LOOP;
          END;
        END IF;

        -- Set warning flag if we oversold
        IF v_actual_sold < v_qty AND NEW.metadata->>'stock_warning' IS DISTINCT FROM 'true' THEN
          UPDATE public.orders
          SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{stock_warning}', 'true')
          WHERE id = v_order_id;
        END IF;

      ELSIF (TG_OP = 'UPDATE' AND OLD.order_status <> 'cancelled' AND NEW.order_status = 'cancelled') OR TG_OP = 'DELETE' THEN
        -- Restore sold units back to in_stock
        DECLARE
          r_sold RECORD;
        BEGIN
          FOR r_sold IN (
            SELECT m.unit_id, m.from_location_id, su.status
            FROM public.stock_movements m
            JOIN public.stock_units su ON m.unit_id = su.id
            WHERE m.order_id = v_order_id AND m.movement_type = 'sell'
          ) LOOP
            IF r_sold.status = 'sold' THEN
              INSERT INTO public.stock_movements (unit_id, movement_type, from_location_id, to_location_id, old_status, new_status, actor_profile_id, order_id, notes)
              VALUES (r_sold.unit_id, 'return_from_sale', v_sold_out_id, COALESCE(r_sold.from_location_id, v_returned_id), 'sold', 'in_stock', v_actor_profile_id, v_order_id, 'Restored: Order ' || v_order_code || ' cancelled');
            END IF;
          END LOOP;
        END;
      END IF;

    ELSE
      -- LEGACY STOCK count lifecycle logic (for non-unitised products)
      IF TG_OP = 'INSERT' THEN
        IF NEW.order_status <> 'cancelled' THEN
          UPDATE public.products SET stock = COALESCE(stock, 0) - v_qty WHERE id = v_product_id;
        END IF;
      ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.order_status <> 'cancelled' AND NEW.order_status = 'cancelled' THEN
          UPDATE public.products SET stock = COALESCE(stock, 0) + v_qty WHERE id = v_product_id;
        ELSIF OLD.order_status = 'cancelled' AND NEW.order_status <> 'cancelled' THEN
          UPDATE public.products SET stock = COALESCE(stock, 0) - v_qty WHERE id = v_product_id;
        END IF;
      ELSIF TG_OP = 'DELETE' THEN
        IF OLD.order_status <> 'cancelled' THEN
          UPDATE public.products SET stock = COALESCE(stock, 0) + v_qty WHERE id = v_product_id;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rebind trigger
DROP TRIGGER IF EXISTS tr_handle_order_inventory_adjustment ON public.orders;
CREATE TRIGGER tr_handle_order_inventory_adjustment
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_order_inventory_adjustment();

-- RPC for relocation movements
CREATE OR REPLACE FUNCTION public.relocate(
  p_unit_code text,
  p_location_code text,
  p_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_unit_id uuid;
  v_current_location_id uuid;
  v_old_status text;
  v_to_location_id uuid;
  v_location_type text;
  v_new_status text;
  v_movement_type text;
  v_actor_profile_id uuid;
  v_movement_id uuid;
BEGIN
  -- 1. Retrieve unit
  SELECT id, current_location_id, status INTO v_unit_id, v_current_location_id, v_old_status
  FROM public.stock_units
  WHERE unit_code = p_unit_code;

  IF v_unit_id IS NULL THEN
    RAISE EXCEPTION 'Garment tag % not registered in inventory.', p_unit_code;
  END IF;

  -- 2. Retrieve location
  SELECT id, location_type INTO v_to_location_id, v_location_type
  FROM public.locations
  WHERE code = p_location_code OR barcode = p_location_code;

  IF v_to_location_id IS NULL THEN
    RAISE EXCEPTION 'Shelf or area % not found.', p_location_code;
  END IF;

  -- 3. Check statuses
  IF v_old_status IN ('sold', 'written_off', 'lost') THEN
    RAISE EXCEPTION 'Item % is marked as % and cannot be reshelved. Reactivate it first.', p_unit_code, v_old_status;
  END IF;

  -- 4. Retrieve actor profile
  SELECT id INTO v_actor_profile_id
  FROM public.profiles
  WHERE user_id = auth.uid();

  -- 5. Determine status and movement type
  IF v_location_type = 'TRIAL_ROOM' THEN
    v_new_status := 'on_floor';
    v_movement_type := 'to_floor';
  ELSIF v_location_type = 'WORKSHOP' THEN
    v_new_status := 'in_workshop';
    v_movement_type := 'to_workshop';
  ELSIF v_location_type = 'SOLD_OUT' THEN
    v_new_status := 'sold';
    v_movement_type := 'sell';
  ELSE
    v_new_status := 'in_stock';
    v_movement_type := 'relocate';
  END IF;

  -- 6. Log movement ledger record
  INSERT INTO public.stock_movements (
    unit_id,
    movement_type,
    from_location_id,
    to_location_id,
    old_status,
    new_status,
    actor_profile_id,
    notes
  ) VALUES (
    v_unit_id,
    v_movement_type,
    v_current_location_id,
    v_to_location_id,
    v_old_status,
    v_new_status,
    v_actor_profile_id,
    COALESCE(p_notes, 'Scanned reshelve')
  ) RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.relocate(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recount_product_stock(uuid) TO authenticated;
