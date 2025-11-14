# Weather API Migration Setup Guide

## Overview
Successfully migrated from OpenWeather API to WeatherAPI.com with database caching to prevent rate limiting issues.

## What Changed

### 1. Database Schema
- **New Table**: `golfsync_weather_cache`
- Stores weather data with 15-minute refresh intervals
- Includes current temperature, conditions, rainfall, and 6-hour forecast

### 2. API Migration
- **Old API**: OpenWeather (2 endpoints)
- **New API**: WeatherAPI.com (1 unified endpoint)
- **Rate Limiting Solution**: Database caching reduces API calls from 60+/min to 4/hour

### 3. New Files Created
- `src/server/weather/cache.ts` - Cache management functions
- `src/app/api/cron/update-weather/route.ts` - Cron endpoint for background updates
- `vercel.json` - Vercel cron configuration

### 4. Modified Files
- `src/server/db/schema.ts` - Added weatherCache table
- `src/server/weather/actions.ts` - Now reads from cache instead of API
- `src/env.js` - Added new environment variables
- `.env.example` - Updated with weather configuration

## Setup Instructions

### Step 1: Get WeatherAPI.com API Key
1. Sign up at [WeatherAPI.com](https://www.weatherapi.com/)
2. Get your free API key from the dashboard
3. Free tier includes 1M calls/month (more than enough)

### Step 2: Update Environment Variables

Add these to your `.env` file:

```env
# Weather API Configuration
WEATHER_API_KEY="your_weatherapi_key_here"
DEFAULT_LAT="49.2827"  # Your golf course latitude
DEFAULT_LON="-123.1207"  # Your golf course longitude

# Cron Job Security
CRON_SECRET="your_secure_random_string_here"
```

**Generate a secure CRON_SECRET:**
```bash
# On Linux/Mac:
openssl rand -base64 32

# On Windows (PowerShell):
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### Step 3: Configure Vercel Cron (if using Vercel)

The `vercel.json` file is already configured to run the weather update every 15 minutes.

**Important**: Add the `CRON_SECRET` to your Vercel environment variables:
1. Go to your Vercel project settings
2. Navigate to Environment Variables
3. Add `CRON_SECRET` with the same value from your `.env`

### Step 4: Initial Cache Population

After deployment, manually trigger the cron endpoint to populate the cache:

```bash
curl -X GET https://your-domain.com/api/cron/update-weather \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Or wait 15 minutes for the first automatic update.

### Step 5: For Non-Vercel Deployments

If not using Vercel, set up a cron job to call the endpoint every 15 minutes:

**Using cron-job.org (Free external service):**
1. Sign up at [cron-job.org](https://cron-job.org)
2. Create a new cron job
3. URL: `https://your-domain.com/api/cron/update-weather`
4. Schedule: Every 15 minutes (`*/15 * * * *`)
5. Add header: `Authorization: Bearer YOUR_CRON_SECRET`

**Using a Linux server cron:**
```bash
# Add to crontab (crontab -e)
*/15 * * * * curl -X GET https://your-domain.com/api/cron/update-weather -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## How It Works

### Data Flow
1. **Background Job** (every 15 minutes):
   - Cron triggers `/api/cron/update-weather`
   - Fetches weather from WeatherAPI.com
   - Stores in database cache

2. **User Requests**:
   - User visits page → `WeatherDisplay` component loads
   - Component calls `getWeatherData()` server action
   - Server action reads from database cache (fast!)
   - If cache is stale (>20 min), auto-refreshes

### Cache Strategy
- **Primary**: Cron updates cache every 15 minutes
- **Fallback**: If cache is empty/stale, fetch directly from API
- **Resilience**: Uses stale data if API fails

## Benefits

✅ **Solves Rate Limiting**: 4 API calls/hour vs 60+/minute
✅ **Faster Response**: Database reads vs external API calls
✅ **Better Reliability**: Cached data survives API downtime
✅ **Cost Effective**: Stays within free tier limits
✅ **Consistent Data**: All users see same weather

## Testing

### Test the Cron Endpoint
```bash
# Should return success with timestamp
curl -X GET http://localhost:3000/api/cron/update-weather \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Check Database Cache
```sql
-- View cached weather data
SELECT * FROM golfsync_weather_cache
ORDER BY last_updated DESC
LIMIT 1;
```

### Test Weather Display
1. Start dev server: `npm run dev`
2. Navigate to the page with weather
3. Should display cached weather data
4. Check browser console for any errors

## Monitoring

### Check Cache Status
The cache automatically:
- Keeps last 10 entries
- Auto-refreshes if stale (>20 minutes)
- Logs updates to console

### Verify Cron is Running
Check your deployment logs for:
```
"Starting weather cache update..."
"Weather cache updated successfully at [timestamp]"
```

## Troubleshooting

### Weather Not Displaying
1. Check environment variables are set
2. Verify database migration ran successfully
3. Manually trigger cron endpoint to populate cache
4. Check server logs for errors

### Cron Not Running
1. Verify `CRON_SECRET` matches in both .env and Vercel
2. Check Vercel cron logs in dashboard
3. Ensure `vercel.json` is deployed

### API Errors
1. Verify `WEATHER_API_KEY` is valid
2. Check API usage limits at WeatherAPI.com dashboard
3. Verify lat/lon coordinates are correct

## Optional Enhancements

Future improvements you can add:
- Admin UI to view cache status
- Manual refresh button for admins
- Weather alerts/warnings
- Extended forecast (3-5 days)
- Historical weather data tracking

## Support

- WeatherAPI.com Docs: https://www.weatherapi.com/docs/
- Vercel Cron Docs: https://vercel.com/docs/cron-jobs
- Drizzle ORM Docs: https://orm.drizzle.team/

---

**Migration completed successfully!** 🎉

The weather feature now uses database caching and will stay well within API rate limits even with high traffic.
