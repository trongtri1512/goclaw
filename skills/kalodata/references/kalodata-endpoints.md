# Kalodata API Endpoints Reference

Internal API endpoints discovered through reverse engineering of kalodata.com web app.

## Common Parameters

All POST endpoints accept JSON body with these common fields:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `region` | string | `"VN"` | Country code: VN, US, TH, MY, PH, ID, SG, GB |
| `date_range` | string[] | - | `["YYYY-MM-DD", "YYYY-MM-DD"]` |
| `page` | number | 1 | Pagination page |
| `size` | number | 20 | Results per page (max 100) |
| `language` | string | `"vi-VN"` | UI language |
| `currency` | string | `"VND"` | Currency for monetary values |

## Authentication

All requests require the `SESSION` cookie. The session token is a base64-encoded UUID set as the cookie value.

## Endpoints

### Creator Module

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/creatorRank` | POST | Creator/KOC ranking by revenue, sales |
| `/api/creator/search` | POST | Search creators by keyword |
| `/api/creator/profile` | POST | Creator profile detail |
| `/api/creator/products` | POST | Products sold by a creator |
| `/api/creator/videos` | POST | Videos by a creator |

**creatorRank extra params:** `sort_by` (revenue, sales, followers), `category_id`

### Product Module

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/productRank` | POST | Product ranking by revenue, sales, growth |
| `/api/product/search` | POST | Search products by keyword |
| `/api/product/detail` | POST | Product detail |
| `/api/product/creators` | POST | Creators selling this product |

**productRank extra params:** `sort_by` (revenue, sales, growth), `category_id`, `price_min`, `price_max`

### Shop Module

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/shopRank` | POST | Shop ranking |
| `/api/shop/search` | POST | Search shops |
| `/api/shop/detail` | POST | Shop detail |
| `/api/shop/products` | POST | Products in a shop |

### Category Module

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/category/list` | POST | All categories tree |
| `/api/category/detail` | POST | Category analytics |

**category/detail extra params:** `id` (category ID, e.g., `601450`)

### Video Module

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/videoRank` | POST | Top performing videos |
| `/api/video/detail` | POST | Video analytics detail |

### Livestream Module

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/liveRank` | POST | Top livestreams |
| `/api/live/detail` | POST | Livestream analytics detail |

## Web Page URLs (for browser navigation)

| Page | URL |
|------|-----|
| Creator Rank | `https://www.kalodata.com/creator-rank?region=VN` |
| Product Rank | `https://www.kalodata.com/product-rank?region=VN` |
| Shop Rank | `https://www.kalodata.com/shop-rank?region=VN` |
| Category Detail | `https://www.kalodata.com/category/detail?id={ID}&region=VN` |
| Creator Profile | `https://www.kalodata.com/creator/detail?id={CREATOR_ID}` |
| Video Rank | `https://www.kalodata.com/video-rank?region=VN` |
| Live Rank | `https://www.kalodata.com/live-rank?region=VN` |

## Response Format (typical)

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "list": [...],
    "total": 1000,
    "page": 1,
    "size": 20
  }
}
```

Error response: `code` != 0, `msg` contains error description.

## Cloudflare Protection

All endpoints are behind Cloudflare. Direct HTTP calls from non-browser user agents will receive a Cloudflare challenge page. Solutions:
1. Use cookies from an authenticated browser session (includes `cf_clearance`)
2. Use Playwright to navigate pages and intercept API responses
3. Maintain valid session by refreshing cookies before expiry
