# SupplyFlow ERP

Responsive purchasing, vendor, billing, price-tracking and inventory ERP for White Saffron.

## Pages

Dashboard, New Bill, Bill History, Products, Vendors, Purchase Orders, Rate History, Price Cards, Inventory, Reports, Analytics, Settings, and Backup and Restore.

## Data flow

- Supabase Auth protects access.
- Products come from `supply_products`.
- Vendors come from `supply_vendors`.
- Selecting a vendor fills TIN and mobile automatically.
- Missing vendors are created through the vendor form and selected immediately.
- Bill entry uses controlled category, product, purchase-unit and packing selections.
- Bill totals support no GST, GST included and GST added.
- Saving a bill writes its line items, rate history, inventory movements and stock balance.
- Purchase orders create a linked order header and product line.
- Inventory supports opening stock, usage and positive/negative adjustments.
- Reports filter purchases by date, vendor, category, payment status and GST type.
- Analytics summarizes vendor performance, category spending and rate changes.
- Price Cards use the latest recorded rate per product.

## Database security

- All ERP tables use Row Level Security.
- Access is restricted to users listed in `supply_members`.
- The browser uses only a Supabase publishable key.

## Setup

1. Create an authorized user in Supabase Authentication.
2. Enable GitHub Pages for the `main` branch and repository root.
3. Open `https://napatos.github.io/supply/`.

Never add a secret or service-role key to this repository.
