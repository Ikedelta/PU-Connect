# Advertisement Placement System - Implementation Guide

## Overview
A comprehensive ad placement system has been implemented across the Campus Konnect platform to display advertisements in strategic locations with proper tracking and analytics.

## Components Created

### 1. AdBanner Component (`src/components/feature/AdBanner.tsx`)
A reusable component that displays ads based on placement area with the following features:
- **Dynamic Ad Fetching**: Automatically fetches active ads for specific placement areas
- **Impression Tracking**: Tracks when ads are viewed
- **Click Tracking**: Tracks when ads are clicked
- **Loading States**: Shows skeleton loaders while fetching
- **Responsive Design**: Adapts to different screen sizes
- **Hover Effects**: Smooth animations and overlays on hover
- **External Link Support**: Opens destination URLs in new tabs

### 2. Ad Placement Areas

#### **Home Hero** (`home_hero`)
- **Location**: Homepage, between Campus Vibe section and Popular Categories
- **Dimensions**: Full width, responsive height (200px mobile, 300px desktop)
- **Purpose**: High-visibility placement for premium advertisers
- **File**: `src/pages/home/page.tsx`

#### **Marketplace Sidebar** (`marketplace_sidebar`)
- **Location**: Marketplace page, after AdSense banner
- **Dimensions**: Full width, max-width 4xl, 400px height
- **Purpose**: Targeted ads for marketplace shoppers
- **File**: `src/pages/marketplace/Marketplace.tsx`

#### **News Feed** (`news_feed`)
- **Location**: Campus News page, after AdSense banner
- **Dimensions**: Full width, max-width 5xl, 150px height
- **Purpose**: Contextual ads for news readers
- **File**: `src/pages/news/CampusNews.tsx`

#### **Global Popup** (`global_popup`)
- **Location**: Appears globally across the site
- **Component**: `GlobalAdPopup.tsx` (already existed)
- **Behavior**: Shows once per session, dismissible
- **File**: `src/components/feature/GlobalAdPopup.tsx`

## Database Functions

### RPC Functions for Tracking
Located in: `database/migrations/create_ad_tracking_functions.sql`

```sql
-- Increment impression count
increment_ad_impression(ad_id UUID)

-- Increment click count
increment_ad_click(ad_id UUID)
```

Both functions are:
- **SECURITY DEFINER**: Runs with elevated privileges
- **Safe**: Uses COALESCE to handle NULL values
- **Accessible**: Granted to both anon and authenticated users

## Ad Management

### Creating Ads
Admins can create ads through the Ads Management page (`/admin/ads`) with:
- Title
- Image URL
- Destination URL (optional)
- Placement Area (home_hero, marketplace_sidebar, news_feed, global_popup)
- Status (active, paused, expired)
- Start Date
- End Date (optional)

### Ad Display Logic
Ads are displayed when:
1. Status is 'active'
2. Current date >= start_date
3. Current date <= end_date (or end_date is null)
4. Placement area matches the component's placement prop

### Analytics
Each ad tracks:
- **Impressions**: How many times the ad was viewed
- **Clicks**: How many times the ad was clicked
- **CTR**: Click-through rate (calculated as clicks/impressions)

## Usage Examples

### Adding a New Ad Placement

```tsx
import AdBanner from '../../components/feature/AdBanner';

// In your component
<AdBanner placement="home_hero" className="w-full" />
```

### Checking Ad Performance
Admins can view ad performance in the Ads Management dashboard:
- Total Active Campaigns
- Total Views (impressions)
- Total Clicks
- Average CTR

## Best Practices

1. **Placement Strategy**:
   - Use `home_hero` for maximum visibility
   - Use `marketplace_sidebar` for product-related ads
   - Use `news_feed` for informational/educational ads
   - Use `global_popup` sparingly for important announcements

2. **Image Requirements**:
   - High-quality images (minimum 800x600px)
   - Optimized file sizes (< 500KB)
   - Appropriate aspect ratios for each placement

3. **Performance**:
   - Ads are cached per session
   - Tracking is non-blocking (won't slow down page load)
   - Failed tracking calls are logged but don't break the UI

4. **User Experience**:
   - All ads are clearly labeled as "Sponsored"
   - Hover effects provide visual feedback
   - External links open in new tabs
   - Loading states prevent layout shifts

## Testing

To test the ad system:

1. **Create a test ad** in the Ads Management page
2. **Set appropriate dates** (start_date in the past, end_date in the future)
3. **Mark as active**
4. **Visit the corresponding page** to see the ad
5. **Check analytics** in the Ads Management dashboard

## Troubleshooting

### Ads not showing?
- Check if the ad status is 'active'
- Verify start_date and end_date
- Ensure the placement_area matches
- Check browser console for errors

### Tracking not working?
- Run the SQL migration: `create_ad_tracking_functions.sql`
- Verify RPC functions exist in Supabase
- Check function permissions

### Performance issues?
- Optimize ad images
- Check network tab for slow requests
- Consider implementing client-side caching

## Future Enhancements

Potential improvements:
- A/B testing for ad variations
- Geo-targeting based on user location
- Time-based scheduling (show ads only during certain hours)
- Frequency capping (limit impressions per user)
- Ad rotation (show multiple ads in the same slot)
- Advanced analytics dashboard with charts
- Automated ad approval workflow
- Integration with third-party ad networks

## Files Modified

1. `src/components/feature/AdBanner.tsx` - New component
2. `src/pages/home/page.tsx` - Added home_hero placement
3. `src/pages/marketplace/Marketplace.tsx` - Added marketplace_sidebar placement
4. `src/pages/news/CampusNews.tsx` - Added news_feed placement
5. `database/migrations/create_ad_tracking_functions.sql` - New migration

## Conclusion

The advertisement placement system is now fully functional and ready for use. Admins can create and manage ads through the dashboard, and ads will automatically appear in the designated locations with full tracking capabilities.
