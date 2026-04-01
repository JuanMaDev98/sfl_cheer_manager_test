# SFL Farm Helper Hub 🌻

A community miniapp for Sunflower Land players to find others for mutual farm help exchange.

## Features

- Players can post their need for help on their farms
- Browse requests from other players
- Contact helpers directly via Telegram
- Requests auto-expire after 24 hours
- Users can manually remove their request

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Database**: Supabase
- **Deployment**: Cloudflare Pages

## Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to SQL Editor and run the schema from `supabase/schema.sql`
3. Get your project URL and anon key from Settings > API

### 2. Configure Environment Variables

Create a `.env` file with your Supabase credentials:

```
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

For Cloudflare Pages, add these as environment variables in your project settings.

### 3. Connect to GitHub

1. Push this repo to GitHub
2. Go to Cloudflare Pages
3. Import the repository
4. Set build command to empty (static site)
5. Set publish directory to `.`
6. Add the environment variables

### 4. Deploy

```bash
# Install dependencies
npm install

# Local development
npm run dev

# Deploy to Cloudflare Pages
npm run deploy
```

## Database Schema

The `help_requests` table stores all help requests with:
- Player's in-game name
- Telegram username
- Optional details about the help needed
- Timestamp (auto-expires after 24 hours)

## License

MIT
