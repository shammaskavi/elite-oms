-- Create function for handling stock adjustment on order changes
CREATE OR REPLACE FUNCTION public.handle_order_inventory_adjustment()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id UUID;
  v_qty INT;
BEGIN
  -- Trigger type check
  IF TG_OP = 'INSERT' THEN
    -- If the order is created, we deduct stock
    IF (NEW.metadata->>'product_id') IS NOT NULL AND NEW.order_status != 'cancelled' THEN
      v_product_id := (NEW.metadata->>'product_id')::UUID;
      v_qty := (NEW.metadata->>'qty')::INT;
      IF v_qty IS NOT NULL AND v_qty > 0 THEN
        UPDATE public.products
        SET stock = COALESCE(stock, 0) - v_qty
        WHERE id = v_product_id;
      END IF;
    END IF;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- If status changes to 'cancelled', we restore stock
    IF (NEW.metadata->>'product_id') IS NOT NULL AND OLD.order_status != 'cancelled' AND NEW.order_status = 'cancelled' THEN
      v_product_id := (NEW.metadata->>'product_id')::UUID;
      v_qty := (NEW.metadata->>'qty')::INT;
      IF v_qty IS NOT NULL AND v_qty > 0 THEN
        UPDATE public.products
        SET stock = COALESCE(stock, 0) + v_qty
        WHERE id = v_product_id;
      END IF;
    -- If status changes FROM 'cancelled' back to active, we re-deduct stock
    ELSIF (NEW.metadata->>'product_id') IS NOT NULL AND OLD.order_status = 'cancelled' AND NEW.order_status != 'cancelled' THEN
      v_product_id := (NEW.metadata->>'product_id')::UUID;
      v_qty := (NEW.metadata->>'qty')::INT;
      IF v_qty IS NOT NULL AND v_qty > 0 THEN
        UPDATE public.products
        SET stock = COALESCE(stock, 0) - v_qty
        WHERE id = v_product_id;
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    -- If order is deleted (e.g. invoice deleted) and wasn't already cancelled, we restore stock
    IF (OLD.metadata->>'product_id') IS NOT NULL AND OLD.order_status != 'cancelled' THEN
      v_product_id := (OLD.metadata->>'product_id')::UUID;
      v_qty := (OLD.metadata->>'qty')::INT;
      IF v_qty IS NOT NULL AND v_qty > 0 THEN
        UPDATE public.products
        SET stock = COALESCE(stock, 0) + v_qty
        WHERE id = v_product_id;
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger to the orders table
DROP TRIGGER IF EXISTS tr_handle_order_inventory_adjustment ON public.orders;
CREATE TRIGGER tr_handle_order_inventory_adjustment
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_order_inventory_adjustment();
