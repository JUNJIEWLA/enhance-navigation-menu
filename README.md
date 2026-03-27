# Enhance Navigation Menu

This is a code bundle for Enhance Navigation Menu. The original project is available at https://www.figma.com/design/2DOTdACjboOdIdxWKAPlUs/Enhance-Navigation-Menu.

## Running the code

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

## Email delivery for reports

To enable direct email sending from the Reports screen, configure these variables in your `.env` file:

- `VITE_EMAILJS_SERVICE_ID`
- `VITE_EMAILJS_TEMPLATE_ID`
- `VITE_EMAILJS_PUBLIC_KEY`

If these are not configured, the app will automatically fall back to opening the default mail client using `mailto:`.

## Private login and multi-company setup

To enable the new professional login module with tenant isolation:

1. Run the SQL script `sql/auth_private_multiempresa.sql` in Supabase SQL Editor.
2. Ensure your business tables contain `empresa_id` and that RLS is enabled.
3. Create users only from a secure backend flow (Edge Function or server with `service_role`), not from public frontend screens.

Important:

- There is no public registration screen in the app.
- Login is username + password only.
- "Remember username" stores only the username in local browser storage.

## Super Admin private panel

- Private route: `/admin/usuarios`
- Access: only users with role `super_admin`
- Purpose: create users for any company without public registration

### Required backend step (Supabase Edge Function)

Deploy the function included in `supabase/functions/admin-create-user/index.ts`:

1. `supabase functions deploy admin-create-user`
2. Ensure these secrets are available in your Supabase project:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

The panel calls this secure function to create:

- Auth user (`auth.users`)
- App profile (`public.perfiles`) linked to a company (`empresa_id`)
