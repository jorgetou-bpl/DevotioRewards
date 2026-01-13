# Devotio Rewards Scanner App - PRD

## Original Problem Statement
Build a custom scanner app for "Devotio Rewards" SaaS whitelabel service connecting to the Boomerangme API. The app needs to:
- Prevent display of PII (email, phone) when scanning loyalty cards
- Display customer name (visible), customer ID, transaction status, loyalty points
- Process loyalty actions (add stamps/points, redeem rewards, apply discounts)
- Be mobile-first for field staff use

## Product Requirements

### Core Features
1. **PII Masking**:
   - ✅ Customer name and surname: **VISIBLE** (for identification)
   - ✅ Email: **MASKED** (***@***.***) 
   - ✅ Phone: **MASKED** (***-***-****)

2. **Data Display**:
   - ✅ Card ID, Customer ID, loyalty status (stamps, points, rewards)
   - ✅ Multi-currency support (14 Latin American currencies)

3. **Scanning**:
   - ✅ Barcode scanning support
   - ✅ QR code scanning support
   - ✅ Manual card ID entry

4. **Transaction Flow**:
   - ✅ Add stamps/points, redeem rewards, apply discounts
   - ✅ Confirmation modal with read-only purchase amount
   - ✅ **Mandatory comment field** with asterisk indicator
   - ✅ Transaction confirmation display

5. **Language**:
   - ✅ **Spanish** as primary language throughout entire app

6. **Branding**:
   - ✅ Devotio Rewards logo
   - ✅ Pink/purple gradient colors (#F040A0 to #8A2BE2)
   - ✅ Figtree typography

7. **Mobile Responsiveness**:
   - ✅ All pages optimized for mobile (tested on iPhone SE 375x667)
   - ✅ Touch-friendly buttons and controls
   - ✅ Proper viewport configuration

8. **Currency Selection**:
   - ✅ User-selectable currency in Settings
   - ✅ 14 supported currencies (CRC, USD, EUR, MXN, COP, PEN, ARS, CLP, GTQ, HNL, NIO, PAB, DOP, BRL)
   - ✅ Currency persists per user

### Card Types Supported
- ✅ Stamp Card (Tarjeta de Sellos)
- ✅ Cashback Card (Tarjeta Cashback)
- ✅ Discount Card (Tarjeta de Descuento)
- ✅ Gift Card (Tarjeta de Regalo)
- ✅ Coupon (Cupón)
- ✅ Multipass (Multipase)
- ✅ Points Card (Tarjeta de Puntos)
- ✅ VIP Card (Tarjeta VIP)

## What's Been Implemented

### Session 3 Changes (January 13, 2026)
1. **Boomerang API Key Integration**
   - UAT API key configured: `542bcbc61866b65b2e63851267128679`
   - DEMO cards (DEMO-001 to DEMO-007) use mock data fallback
   - Real API ready for production cards

2. **Mobile Responsiveness**
   - All pages optimized for mobile viewports
   - Using `sm:` Tailwind breakpoints for responsive design
   - Touch-friendly interface elements
   - PWA-ready meta tags (apple-mobile-web-app-capable)

3. **Currency Selection Feature**
   - Settings page now includes currency selector
   - 14 Latin American currencies supported
   - Currency setting persists in database
   - `formatCurrency()` helper uses selected currency

### Previous Session Work
- Spanish localization
- QR + barcode scanning
- Mandatory comments in confirmation modal
- Customer name visible (PII masking updated)
- Devotio branding applied

## Code Architecture
```
/app
├── backend/
│   ├── .env              # BOOMERANG_API_KEY configured
│   └── server.py         # API with mock fallback for DEMO cards
├── frontend/
│   ├── public/
│   │   └── fonts/        # Figtree fonts, logo.png
│   ├── src/
│   │   ├── context/
│   │   │   ├── AuthContext.js
│   │   │   └── SettingsContext.js  # CURRENCIES array, formatCurrency
│   │   ├── pages/        # All mobile-responsive
│   │   ├── index.css     # Mobile-first CSS
│   │   └── App.js
│   └── package.json
└── memory/
    └── PRD.md
```

## Supported Currencies
| Code | Symbol | Name |
|------|--------|------|
| CRC | ₡ | Colón Costarricense |
| USD | $ | Dólar Estadounidense |
| EUR | € | Euro |
| MXN | $ | Peso Mexicano |
| COP | $ | Peso Colombiano |
| PEN | S/ | Sol Peruano |
| ARS | $ | Peso Argentino |
| CLP | $ | Peso Chileno |
| GTQ | Q | Quetzal Guatemalteco |
| HNL | L | Lempira Hondureño |
| NIO | C$ | Córdoba Nicaragüense |
| PAB | B/. | Balboa Panameño |
| DOP | RD$ | Peso Dominicano |
| BRL | R$ | Real Brasileño |

## API Configuration

### Environment Variables
```bash
# /app/backend/.env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
CORS_ORIGINS="*"
BOOMERANG_API_KEY="542bcbc61866b65b2e63851267128679"  # UAT key
```

### Demo vs Real Cards
- **DEMO-*** cards: Always use mock data (for proposal demo)
- **Real cards**: Use Boomerang API with configured key

## Demo Credentials
- **Email**: demo@devotio.com
- **Password**: demo123
- **Demo Cards**: DEMO-001 through DEMO-007

## Testing Status
- `/app/test_reports/iteration_1.json` - Initial testing
- `/app/test_reports/iteration_2.json` - Spanish localization (100% pass)
- `/app/test_reports/iteration_3.json` - Mobile + Currency (100% pass)

## Deployment Readiness
- ✅ Mobile-responsive design
- ✅ Spanish language
- ✅ Branding applied
- ✅ API key configured
- ✅ Currency selection
- ⏳ Production API key (replace UAT key)

## Next Steps
1. **Replace UAT API key** with production key when ready
2. **Test with real Boomerang cards** (non-DEMO)
3. **Deploy to production**
