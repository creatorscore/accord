# Accord iOS Subscription Pricing Update Instructions

## Overview
This guide helps you update subscription prices in App Store Connect to implement fair worldwide pricing based on income levels.

## Your Subscription Products (5 subscriptions found)
1. **3 Month Premium** - 3-month subscription
2. **Accord Platinum Monthly** - Monthly platinum tier
3. **Accord Platinum Yearly** - Annual platinum tier
4. **Accord Premium Monthly** - Monthly premium tier
5. **Accord Premium Yearly** - Annual premium tier

## Step-by-Step Instructions

### Step 1: Access App Store Connect
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **My Apps** → Select **Accord**
3. Click **Subscriptions** in the left sidebar
4. Select your subscription group

### Step 2: Update Each Subscription's Pricing

For each subscription product:

1. Click on the subscription name (e.g., "Accord Premium Monthly")
2. Click **Subscription Prices** on the left
3. You'll see your current base price (USA)
4. Click **Add Pricing** or manage existing prices

### Step 3: Set Base Country Price (USA)

| Subscription | USA Base Price |
|--------------|----------------|
| Premium Monthly | $14.99 |
| Premium 3-Month | $34.99 |
| Premium Annual | $119.99 |
| Platinum Monthly | (your platinum price) |
| Platinum Annual | (your platinum price) |

### Step 4: Customize Territory Prices

Click **"Prices by Storefront"** to set custom prices for each country.

#### High Income Countries ($14.99/mo equivalent)
Keep at default Apple-calculated prices or match USA:
- United States, Canada, United Kingdom, Germany, France, Australia, Japan, Singapore, etc.

#### Upper-Middle Income (~$8-10/mo equivalent)
Set these countries to lower tiers:
- Mexico, Brazil (partial), Turkey, Poland, Chile, South Africa, Thailand, Malaysia

#### Lower-Middle Income (~$5-7/mo equivalent)
- India, Indonesia, Vietnam, Philippines, Egypt, Nigeria, Pakistan, Bangladesh, Kenya

#### Very Low Income (~$2-4/mo equivalent)
- Yemen, Rwanda, Uganda, Sierra Leone, Malawi, Chad, etc.

## Reference Price Tables

### Monthly Subscription Target Prices

| Country | Currency | Local Price | USD Equiv |
|---------|----------|-------------|-----------|
| United States | USD | 14.99 | $14.99 |
| India | INR | 399 | $4.80 |
| Nigeria | NGN | 5,900 | $3.60 |
| Pakistan | PKR | 999 | $3.60 |
| Brazil | BRL | 39.90 | $6.80 |
| Mexico | MXN | 149 | $7.40 |
| Indonesia | IDR | 79,000 | $4.80 |
| Vietnam | VND | 129,000 | $5.00 |
| Egypt | EGP | 249 | $5.00 |
| Turkey | TRY | 299 | $8.50 |
| South Africa | ZAR | 149 | $8.00 |
| Philippines | PHP | 249 | $4.50 |
| Kenya | KES | 699 | $5.40 |
| Germany | EUR | 14.99 | $15.99 |
| United Kingdom | GBP | 11.99 | $15.49 |
| Japan | JPY | 1,999 | $13.49 |
| Australia | AUD | 24.99 | $16.50 |
| Canada | CAD | 19.99 | $14.75 |

### 3-Month Subscription Target Prices

| Country | Currency | Local Price | USD Equiv |
|---------|----------|-------------|-----------|
| United States | USD | 34.99 | $34.99 |
| India | INR | 930 | $11.22 |
| Nigeria | NGN | 13,749 | $8.40 |
| Pakistan | PKR | 2,327 | $8.40 |
| Brazil | BRL | 92.99 | $15.90 |
| Mexico | MXN | 347 | $17.28 |
| Indonesia | IDR | 184,210 | $11.22 |
| Vietnam | VND | 300,570 | $11.67 |
| Egypt | EGP | 580 | $11.64 |

### Annual Subscription Target Prices

| Country | Currency | Local Price | USD Equiv |
|---------|----------|-------------|-----------|
| United States | USD | 119.99 | $119.99 |
| India | INR | 3,190 | $38.40 |
| Nigeria | NGN | 47,190 | $28.80 |
| Pakistan | PKR | 7,990 | $28.80 |
| Brazil | BRL | 319 | $54.40 |

## Apple Price Tier Mapping

Apple uses predefined price tiers. Find the closest tier to your target:

| Target USD | Apple Tier |
|------------|------------|
| $2.99 | Tier 3 |
| $3.99 | Tier 4 |
| $4.99 | Tier 5 |
| $5.99 | Tier 6 |
| $6.99 | Tier 7 |
| $7.99 | Tier 8 |
| $8.99 | Tier 9 |
| $9.99 | Tier 10 |
| $10.99 | Tier 11 |
| $11.99 | Tier 12 |
| $12.99 | Tier 13 |
| $13.99 | Tier 14 |
| $14.99 | Tier 15 |
| $19.99 | Tier 20 |
| $24.99 | Tier 25 |
| $29.99 | Tier 30 |
| $34.99 | Tier 35 |
| $49.99 | Tier 50 |
| $99.99 | Tier 87 |
| $119.99 | Tier 94 |

## Quick Reference: Countries by Income Tier

### Very Low Income (Tier 3-4: $2.99-$3.99)
Chad, Congo-Kinshasa, Eritrea, Gambia, Guinea, Haiti, Liberia, Mozambique, Rwanda, Sierra Leone, Somalia, Uganda, Yemen

### Low Income (Tier 5: $4.99)
Angola, Bangladesh, Burkina Faso, Cambodia, Ethiopia, India, Indonesia, Madagascar, Malawi, Mali, Myanmar, Nepal, Niger, Nigeria, Pakistan, Philippines, Senegal, Tanzania, Togo, Vietnam, Zimbabwe

### Lower-Middle Income (Tier 6-7: $5.99-$6.99)
Albania, Algeria, Armenia, Azerbaijan, Belarus, Belize, Bolivia, Bosnia, Brazil, Colombia, Dominican Republic, Ecuador, Egypt, El Salvador, Georgia, Ghana, Guatemala, Honduras, Jamaica, Jordan, Kenya, Kyrgyzstan, Laos, Moldova, Mongolia, Morocco, Nicaragua, Sri Lanka, Tunisia, Ukraine, Uzbekistan

### Upper-Middle Income (Tier 8-10: $7.99-$9.99)
Argentina, Bulgaria, Chile, China, Costa Rica, Croatia, Ecuador, Gabon, Kazakhstan, Lebanon, Malaysia, Maldives, Mauritius, Mexico, Panama, Paraguay, Peru, Romania, Russia, Serbia, South Africa, Thailand, Turkey, Uruguay, Venezuela

### High Income (Tier 15: $14.99)
Australia, Austria, Bahamas, Bahrain, Belgium, Bermuda, Canada, Cyprus, Czech Republic, Denmark, Estonia, Finland, France, Germany, Greece, Hong Kong, Hungary, Iceland, Ireland, Israel, Italy, Japan, Kuwait, Latvia, Lithuania, Luxembourg, Malta, Netherlands, New Zealand, Norway, Oman, Poland, Portugal, Qatar, Saudi Arabia, Singapore, Slovakia, Slovenia, South Korea, Spain, Sweden, Switzerland, Taiwan, Trinidad, UAE, UK, USA

## Full CSV Files

For complete pricing data, see:
- `scripts/asc-monthly-prices.csv`
- `scripts/asc-3month-prices.csv`
- `scripts/asc-annual-prices.csv`
- `scripts/asc-all-prices-reference.csv`

## Notes

1. **Apple calculates equivalent prices** - When you set a base price in USD, Apple automatically calculates equivalent prices in other currencies. You can then customize individual territories.

2. **Price changes take effect** - After saving, price changes typically take effect within 24 hours.

3. **Existing subscribers** - Current subscribers keep their existing price until their subscription renews after a price change.

4. **Tax considerations** - Prices shown to customers include applicable taxes in many countries.
