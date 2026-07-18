# SupplyFlow

Mobile-first procurement, bill, price and inventory application for White Saffron.

## Pages

Dashboard, New Bill, Bill History, Products, Vendors, Rate History, Price Cards, Inventory, Reports, Settings, and Backup and Restore.

## Data flow

- Supabase Auth protects access.
- Products come from `supply_products`.
- Vendors come from `supply_vendors`.
- Selecting a vendor fills TIN and mobile automatically.
- Missing vendors are created through the vendor form and selected immediately.
- Saving a bill writes the bill, its line items, and rate history.
- Price Cards use the latest recorded rate per product.

## Setup

1. Create an authorized user in Supabase Authentication.
2. Enable GitHub Pages for the `main` branch and repository root.
3. Open `https://napatos.github.io/supply/`.

The browser contains only the Supabase publishable key. Never add a secret or service-role key to this repository.
