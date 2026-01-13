# Devotio Rewards Scanner App - PRD

## Original Problem Statement
Build a custom scanner app for "Devotio Rewards" SaaS whitelabel service connecting to the Boomerangme API. The app needs to:
- Prevent display of PII (full name, email, phone) when scanning loyalty cards
- Display non-sensitive data (customer ID, transaction status, loyalty points)
- Process loyalty actions (add stamps/points, redeem rewards, apply discounts)

## Product Requirements

### Core Features
1. **PII Masking** (UPDATED):
   - ✅ Customer name and surname: **VISIBLE** (for identification)
   - ✅ Email: **MASKED** (***@***.***) 
   - ✅ Phone: **MASKED** (***-***-****)

2. **Data Display**:
   - ✅ Card ID, Customer ID, loyalty status (stamps, points, rewards)
   - ✅ Currency: Costa Rican Colón (₡)

3. **Scanning**:
   - ✅ Barcode scanning support (html5-qrcode library)
   - ✅ QR code scanning support (same library supports both)
   - ✅ Manual card ID entry

4. **Transaction Flow**:
   - ✅ Add stamps/points, redeem rewards, apply discounts
   - ✅ Confirmation modal with read-only purchase amount
   - ✅ **Mandatory comment field** with asterisk indicator
   - ✅ Transaction confirmation display

5. **Language**:
   - ✅ **Spanish** as primary language throughout entire app
   - English can be secondary (not implemented yet)

6. **Branding**:
   - ✅ Devotio Rewards logo displayed
   - ✅ Pink/purple gradient colors (#F040A0 to #8A2BE2)
   - ✅ Figtree typography
   - ✅ App title: "Devotio Rewards - Escáner de Tarjetas"

### Card Types Supported
- ✅ Stamp Card (Tarjeta de Sellos)
- ✅ Cashback Card (Tarjeta Cashback)
- ✅ Discount Card (Tarjeta de Descuento)
- ✅ Gift Card (Tarjeta de Regalo)
- ✅ Coupon (Cupón)
- ✅ Multipass (Multipase)
- ✅ Points Card (Tarjeta de Puntos)
- ✅ VIP Card (Tarjeta VIP)

## What's Been Implemented (January 13, 2026)

### Session 2 Changes
1. **Language Localization to Spanish**
   - All UI text translated to Spanish
   - Labels, buttons, error messages, toasts in Spanish
   - Settings, Support, Search pages fully translated

2. **QR + Barcode Scanning**
   - html5-qrcode library already supports both formats
   - Format support includes: QR_CODE, CODE_128, EAN_13, EAN_8, UPC_A, etc.
   - Scanner label updated to "Escáner de códigos de barras y QR"

3. **Confirmation Modal Updates**
   - Purchase amount displayed as read-only (from initial entry)
   - Comment field marked as mandatory with asterisk (*)
   - Validation prevents submission without comment
   - Spanish error message: "El comentario es obligatorio"

4. **PII Masking Update**
   - Customer firstName and surname now **VISIBLE**
   - Email and phone remain **MASKED**
   - Updated `mask_pii()` function in server.py

5. **Branding & Design**
   - Added Devotio Rewards logo (/fonts/logo.png)
   - Implemented pink/purple gradient colors
   - Added Figtree font family
   - Updated CSS variables and styling

6. **Currency**
   - Costa Rican Colón (₡) displayed correctly
   - Using `Intl.NumberFormat('es-CR', { currency: 'CRC' })`

### Previous Session Work
- Full-stack scaffolding (React + FastAPI + MongoDB)
- Core app pages (Login, Scanner, Result, Settings, Search, Support)
- Barcode scanner integration
- PII masking backend logic
- Comprehensive demo data (DEMO-001 through DEMO-007)
- Dynamic transaction UI for different card types
- JWT authentication

## Code Architecture
```
/app
├── backend/
│   ├── .env
│   └── server.py         # FastAPI, endpoints, PII masking, mock data
├── frontend/
│   ├── public/
│   │   └── fonts/        # Figtree fonts, logo.png
│   ├── src/
│   │   ├── context/      # AuthContext, SettingsContext
│   │   ├── pages/        # All pages in Spanish
│   │   ├── components/   # Shadcn UI
│   │   ├── index.css     # Custom CSS, brand colors
│   │   └── App.js        # Router
│   └── package.json
└── memory/
    └── PRD.md
```

## Key API Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/cards/{card_id}` - Get card details (PII masked)
- `POST /api/cards/{card_id}/add-stamp` - Add stamps
- `POST /api/cards/{card_id}/add-point` - Add points
- `POST /api/cards/{card_id}/redeem-*` - Redeem actions
- `GET /api/customers` - Search customers

## Demo Credentials
- **Email**: demo@devotio.com
- **Password**: demo123
- **Demo Cards**: DEMO-001 through DEMO-007

## Current Status
- ✅ App running on **MOCK data** for proposal demo
- ✅ All UI in Spanish
- ✅ Customer names visible, email/phone masked
- ✅ Confirmation modal with mandatory comments
- ✅ Devotio branding applied
- ✅ QR + Barcode scanning ready

## Upcoming Tasks (P1)
- Connect to real Boomerang API (when API key provided)
- Add API key to `/app/backend/.env` as `BOOMERANG_API_KEY`

## Future Tasks (P2)
- Multi-tenant architecture
- Analytics dashboard
- Webhook integration
- App Store publishing

## Tech Stack
- **Frontend**: React, React Router, Tailwind CSS, Shadcn UI, axios, html5-qrcode
- **Backend**: FastAPI, Pydantic, python-jose (JWT), bcrypt
- **Database**: MongoDB
- **Typography**: Figtree (custom), JetBrains Mono (monospace)

## Test Reports
- `/app/test_reports/iteration_1.json` - Initial testing
- `/app/test_reports/iteration_2.json` - Spanish localization & features (100% pass)
