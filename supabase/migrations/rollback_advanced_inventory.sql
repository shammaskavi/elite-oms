-- ROLLBACK SCRIPT FOR ADVANCED PHYSICAL INVENTORY TRACKING MODULE

-- 1. Restore the trigger handle_order_inventory_adjustment to its original legacy version
CREATE OR REPLACE FUNCTION public.handle_order_inventory_adjustment()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id UUID;
  v_qty INT;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_product_id := (NEW.metadata->>'product_id')::UUID;
    v_qty := (NEW.metadata->>'qty')::INT;
  ELSE
    v_product_id := (OLD.metadata->>'product_id')::UUID;
    v_qty := (OLD.metadata->>'qty')::INT;
  END IF;

  IF v_product_id IS NOT NULL AND v_qty IS NOT NULL AND v_qty > 0 THEN
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

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the stock units recount trigger and function
DROP TRIGGER IF EXISTS tr_recount_product_stock ON public.stock_units;
DROP FUNCTION IF EXISTS public.recount_product_stock();

-- 3. Drop RPC relocate function
DROP FUNCTION IF EXISTS public.relocate(text, text, text);

-- 4. Drop Deadstock view
DROP VIEW IF EXISTS public.v_stock_units_deadstock;

-- 5. Drop new tables (which automatically drops their triggers/policies/indexes cascade)
DROP TABLE IF EXISTS public.stock_movements CASCADE;
DROP TABLE IF EXISTS public.stock_units CASCADE;
DROP TABLE IF EXISTS public.locations CASCADE;
