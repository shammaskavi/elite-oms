-- M4: Backfill stock units from existing products
DO $$
DECLARE
  r_prod RECORD;
  v_idx INT;
  v_unit_code TEXT;
  v_unit_id UUID;
  v_intake_loc_id UUID;
  v_cost NUMERIC(12,2);
  v_date_received DATE;
  v_source_type TEXT;
BEGIN
  -- Get INTAKE location
  SELECT id INTO v_intake_loc_id FROM public.locations WHERE code = 'INTAKE';

  FOR r_prod IN (
    SELECT id, name, sku, company_barcode, stock, purchase_price, inward_date, supplier_name
    FROM public.products
    WHERE stock > 0
  ) LOOP
    -- Define parameters
    v_cost := COALESCE(r_prod.purchase_price, 0);
    v_date_received := COALESCE(r_prod.inward_date::date, CURRENT_DATE);

    -- Map source type
    IF r_prod.supplier_name ILIKE '%workshop%' OR r_prod.supplier_name ILIKE '%karigar%' OR r_prod.supplier_name ILIKE '%in-house%' THEN
      v_source_type := 'in_house';
    ELSE
      v_source_type := 'supplier';
    END IF;

    IF r_prod.stock = 1 THEN
      -- Single-unit barcode reuse
      v_unit_code := COALESCE(r_prod.sku, r_prod.company_barcode, 'SPE-PROD-' || r_prod.id::text);

      -- Insert unit
      INSERT INTO public.stock_units (unit_code, product_id, current_location_id, status, source_type, cost_price, date_received)
      VALUES (v_unit_code, r_prod.id, v_intake_loc_id, 'in_stock', v_source_type, v_cost, v_date_received)
      ON CONFLICT (unit_code) DO NOTHING
      RETURNING id INTO v_unit_id;

      -- Log receive movement
      IF v_unit_id IS NOT NULL THEN
        INSERT INTO public.stock_movements (unit_id, movement_type, from_location_id, to_location_id, old_status, new_status, notes)
        VALUES (v_unit_id, 'receive', NULL, v_intake_loc_id, NULL, 'in_stock', 'Initial backfill receive');
      END IF;

    ELSIF r_prod.stock > 1 THEN
      -- Multi-unit suffix generation
      FOR v_idx IN 1..r_prod.stock LOOP
        v_unit_code := COALESCE(r_prod.sku, r_prod.company_barcode, 'SPE-PROD-' || r_prod.id::text) || '-' || lpad(v_idx::text, 2, '0');

        -- Insert unit
        INSERT INTO public.stock_units (unit_code, product_id, current_location_id, status, source_type, cost_price, date_received)
        VALUES (v_unit_code, r_prod.id, v_intake_loc_id, 'in_stock', v_source_type, v_cost, v_date_received)
        ON CONFLICT (unit_code) DO NOTHING
        RETURNING id INTO v_unit_id;

        -- Log receive movement
        IF v_unit_id IS NOT NULL THEN
          INSERT INTO public.stock_movements (unit_id, movement_type, from_location_id, to_location_id, old_status, new_status, notes)
          VALUES (v_unit_id, 'receive', NULL, v_intake_loc_id, NULL, 'in_stock', 'Initial backfill receive');
        END IF;
      END LOOP;

    END IF;
  END LOOP;
END;
$$;
