-- M5: Seed physical locations as per store layout
DO $$
DECLARE
  v_gf_id UUID;
  v_ff_id UUID;
  v_rack_id UUID;
  v_rack_char CHAR;
  v_shelf_idx INT;
BEGIN
  -- 1. Insert Zones
  INSERT INTO public.locations (code, label, location_type, barcode)
  VALUES ('GF_ZONE', 'Ground Floor Showroom', 'ZONE', 'LOC-ZONE-GF')
  ON CONFLICT (code) DO NOTHING
  RETURNING id INTO v_gf_id;

  -- Fallback lookup if already exists
  IF v_gf_id IS NULL THEN
    SELECT id INTO v_gf_id FROM public.locations WHERE code = 'GF_ZONE';
  END IF;

  INSERT INTO public.locations (code, label, location_type, barcode)
  VALUES ('FF_ZONE', '1st Floor Storage', 'ZONE', 'LOC-ZONE-FF')
  ON CONFLICT (code) DO NOTHING
  RETURNING id INTO v_ff_id;

  IF v_ff_id IS NULL THEN
    SELECT id INTO v_ff_id FROM public.locations WHERE code = 'FF_ZONE';
  END IF;

  -- 2. Insert Trial Rooms & Workshops
  INSERT INTO public.locations (code, label, location_type, barcode)
  VALUES 
    ('TRIAL_1', 'Trial Room 1', 'TRIAL_ROOM', 'LOC-TRIAL-1'),
    ('TRIAL_2', 'Trial Room 2', 'TRIAL_ROOM', 'LOC-TRIAL-2'),
    ('WORKSHOP_A', 'Karigar Workshop A', 'WORKSHOP', 'LOC-WORK-A')
  ON CONFLICT (code) DO NOTHING;

  -- 3. Seed Ground Floor Racks (Rack A to Rack E) and Shelves (Shelf 1 to Shelf 4)
  FOREACH v_rack_char IN ARRAY ARRAY['A', 'B', 'C', 'D', 'E'] LOOP
    INSERT INTO public.locations (code, label, location_type, parent_id, barcode)
    VALUES (
      'GF-RACK-' || v_rack_char,
      'Ground Floor - Rack ' || v_rack_char,
      'RACK',
      v_gf_id,
      'LOC-GF-RK' || v_rack_char
    )
    ON CONFLICT (code) DO NOTHING
    RETURNING id INTO v_rack_id;

    IF v_rack_id IS NULL THEN
      SELECT id INTO v_rack_id FROM public.locations WHERE code = 'GF-RACK-' || v_rack_char;
    END IF;

    FOR v_shelf_idx IN 1..4 LOOP
      INSERT INTO public.locations (code, label, location_type, parent_id, barcode)
      VALUES (
        'GF-RACK-' || v_rack_char || '-S' || v_shelf_idx,
        'GF Rack ' || v_rack_char || ' - Shelf ' || v_shelf_idx,
        'SHELF',
        v_rack_id,
        'LOC-GF-RK' || v_rack_char || '-S' || v_shelf_idx
      )
      ON CONFLICT (code) DO NOTHING;
    END LOOP;
  END LOOP;

  -- 4. Seed 1st Floor Storage Racks (Rack X, Y, Z) and Shelves (Shelf 1 to Shelf 4)
  FOREACH v_rack_char IN ARRAY ARRAY['X', 'Y', 'Z'] LOOP
    INSERT INTO public.locations (code, label, location_type, parent_id, barcode)
    VALUES (
      'FF-RACK-' || v_rack_char,
      '1st Floor - Rack ' || v_rack_char,
      'RACK',
      v_ff_id,
      'LOC-FF-RK' || v_rack_char
    )
    ON CONFLICT (code) DO NOTHING
    RETURNING id INTO v_rack_id;

    IF v_rack_id IS NULL THEN
      SELECT id INTO v_rack_id FROM public.locations WHERE code = 'FF-RACK-' || v_rack_char;
    END IF;

    FOR v_shelf_idx IN 1..4 LOOP
      INSERT INTO public.locations (code, label, location_type, parent_id, barcode)
      VALUES (
        'FF-RACK-' || v_rack_char || '-S' || v_shelf_idx,
        'FF Rack ' || v_rack_char || ' - Shelf ' || v_shelf_idx,
        'SHELF',
        v_rack_id,
        'LOC-FF-RK' || v_rack_char || '-S' || v_shelf_idx
      )
      ON CONFLICT (code) DO NOTHING;
    END LOOP;
  END LOOP;

END;
$$;
