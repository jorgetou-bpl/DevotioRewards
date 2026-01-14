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
   - ✅ Dark purple theme (#120627)
   - ✅ Figtree typography

7. **Mobile Responsiveness**:
   - ✅ All pages optimized for mobile (tested on iPhone SE 375x667)
   - ✅ Touch-friendly buttons and controls
   - ✅ Proper viewport configuration

8. **Currency Selection**:
   - ✅ User-selectable currency in Settings
   - ✅ 14 supported currencies (CRC, USD, EUR, MXN, COP, PEN, ARS, CLP, GTQ, HNL, NIO, PAB, DOP, BRL)
   - ✅ Currency persists per user

### Card Types Supported (P0 Bug Fixed - January 14, 2026)
All 8 Boomerangme card types now correctly recognized and rendered:
- ✅ **Stamp** (type ID 0) - Shows stamp grid, Agregar/Canjear tabs
- ✅ **Cashback** (type ID 1) - Shows cashback %, purchase amount input
- ✅ **Multipass** (type ID 2) - Shows 3 tabs: Agregar/Canjear/Puntos
- ✅ **Coupon** (type ID 3) - Shows single "Usar" tab
- ✅ **Discount** (type ID 4) - Shows discount %, purchase amount input
- ✅ **Gift** (type ID 5) - Shows balance, Agregar/Canjear tabs
- ✅ **Membership** (type ID 6) - Shows points, Agregar/Canjear tabs
- ✅ **Reward** (type ID 7) - Shows reward status

## What's Been Implemented

### Session 4 - P0 Bug Fix (January 14, 2026)
1. **Fixed Card Type Handling Bug (CRITICAL)**
   - Added `normalizeCardType()` function in ResultPage.js
   - Frontend now correctly handles Boomerangme API card types without `_card` suffix
   - Both real API cards (type: "discount") and demo cards (type: "stamp_card") work
   - All 8 card types now render correct UI components
   
2. **Enhanced Discount Card UI**
   - Shows discount percentage from `balance.discountPercentage`
   - Shows accumulated amount from `balance.discountAmount`
   - Purchase amount input with selected currency

3. **Improved Stamp Card Display**
   - Handles multiple balance field formats (`currentNumberOfUses`, `stamps`)
   - Stamp grid renders correctly with stars

### Previous Session Work
- Spanish localization
- QR + barcode scanning
- Mandatory comments in confirmation modal
- Customer name visible (PII masking updated)
- Devotio branding applied
- Mobile responsiveness
- Currency selection feature
- Boomerang API UAT key integration

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
│   │   ├── pages/
│   │   │   └── ResultPage.js  # normalizeCardType() function added
│   │   ├── index.css     # Mobile-first CSS
│   │   └── App.js
│   └── package.json
├── tests/
│   └── test_scanner_api.py  # 15 backend tests
└── memory/
    └── PRD.md
```

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
- **Real cards**: Use Boomerang API with configured key (e.g., 955355-486-631)

## Demo Credentials
- **Email**: demo@devotio.com
- **Password**: demo123
- **Demo Cards**: DEMO-001 through DEMO-007
- **Real Test Card**: 955355-486-631 (Discount card)

## Testing Status
- `/app/test_reports/iteration_4.json` - P0 bug fix verification (100% pass)
- `/app/tests/test_scanner_api.py` - 15 backend tests created

## Deployment Readiness
- ✅ Mobile-responsive design
- ✅ Spanish language
- ✅ Branding applied
- ✅ API key configured
- ✅ Currency selection
- ✅ All 8 card types supported
- ⏳ Production API key (replace UAT key when ready)

## Next Steps
1. **UAT Testing**: Test all 8 card types with real Boomerangme cards
2. **Replace UAT API key** with production key when ready
3. **Deploy to production**

## Backlog (P2)
- Fix HTTP status codes (403 → 401 for unauthorized)
- Refactor server.py into smaller modules
- Multi-tenant admin panel
- Analytics dashboard
- Webhook integration
- App store publishing
