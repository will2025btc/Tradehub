# Binance Trading Review Dashboard

A comprehensive trading analytics dashboard for reviewing your Binance futures trading history. Built with Next.js 14, TypeScript, Prisma, and PostgreSQL.

## Features

- 🔐 **Google OAuth Authentication** - Secure login with Google
- 📊 **Interactive Charts** - View your trading performance with Recharts
- 💰 **Account Metrics** - Track total returns, win rate, drawdown, and more
- 📈 **Asset Curve** - Visualize your account equity over time
- 🔄 **Binance API Integration** - Sync trading data from Binance Futures
- 🔒 **Secure API Key Storage** - AES-256 encryption for API credentials
- 📱 **Responsive Design** - Works on desktop and mobile devices

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Charts**: Recharts
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: NextAuth.js with Google OAuth
- **API Integration**: Binance Futures REST API

## Prerequisites

Before you begin, ensure you have installed:
- Node.js 18+ and npm
- PostgreSQL database
- Google OAuth credentials
- Binance API keys (read-only recommended)

## Quick Start

### 1. Clone and Install

```bash
cd binance-trading-dashboard
npm install
```

### 2. Database Setup

Create a PostgreSQL database and note the connection string.

### 3. Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/binance_dashboard"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Encryption Key (32 bytes for AES-256)
ENCRYPTION_KEY="generate-with: openssl rand -hex 32"

# Binance API
BINANCE_API_URL="https://fapi.binance.com"
```

### 4. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Client Secret to `.env`

### 5. Database Migration

```bash
# Push the schema to database
npm run db:push

# Or use Prisma migrations (production)
npx prisma migrate dev --name init
```

### 6. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Project Structure

```
binance-trading-dashboard/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── encryption.ts      # API key encryption utilities
│   │   └── binance.ts         # Binance API client
│   ├── pages/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth].ts  # NextAuth config
│   │   │   └── account/
│   │   │       ├── metrics.ts        # Account metrics endpoint
│   │   │       └── snapshots.ts      # Account snapshots endpoint
│   │   ├── _app.tsx           # App wrapper with providers
│   │   └── index.tsx          # Dashboard home page
│   └── styles/
│       └── globals.css        # Global styles with Tailwind
├── .env.example               # Environment variables template
├── package.json
├── tsconfig.json
└── README.md
```

## Database Schema

### Users
- Google authentication
- Email and display name

### ApiConfig
- Encrypted Binance API credentials
- Last sync timestamp
- Active status

### Positions
- Trading positions (open/closed)
- Symbol, side, leverage
- PnL calculations
- Max position metrics

### Trades
- Individual trade records
- Order details
- Fees and realized PnL

### AccountSnapshots
- Daily account equity snapshots
- Balance and unrealized PnL
- Used for performance charts

## API Endpoints

### Authentication
- `GET /api/auth/signin` - Google OAuth login
- `GET /api/auth/signout` - Logout

### Account Data
- `GET /api/account/metrics` - Get account performance metrics
- `GET /api/account/snapshots?range=<1month|3month|1year|all>` - Get equity snapshots

## Binance API Integration

### Required API Permissions (Read-Only)
- Enable Reading (No trading permissions needed)
- Futures Account permissions

### Supported Data
- Account balance and positions
- Order history
- Trade history
- Income/commission records

### Data Sync
The dashboard syncs data from Binance API:
- First sync: Last 90 days of trading history
- Incremental: Every 5 minutes (can be configured)
- Manual sync available in settings

## Security Best Practices

1. **API Keys**: Always use read-only Binance API keys
2. **Encryption**: API keys are encrypted with AES-256-GCM
3. **Environment Variables**: Never commit `.env` files
4. **HTTPS**: Use HTTPS in production
5. **Session Security**: NextAuth handles secure sessions

## Deployment

### Vercel (Recommended for Frontend)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Add environment variables in Vercel dashboard.

### Database
- Use managed PostgreSQL (Railway, Render, Supabase, etc.)
- Update `DATABASE_URL` in environment variables

### Production Checklist
- [ ] Set up production PostgreSQL database
- [ ] Configure Google OAuth for production domain
- [ ] Generate secure `NEXTAUTH_SECRET` and `ENCRYPTION_KEY`
- [ ] Enable HTTPS
- [ ] Set `NEXTAUTH_URL` to production URL
- [ ] Test API key encryption/decryption
- [ ] Configure CORS if needed

## Key Metrics Explained

- **Total Return Rate**: (Current Equity - Initial Capital) / Initial Capital × 100%
- **Win Rate**: Winning Trades / Total Trades × 100%
- **Max Drawdown**: Maximum % decline from peak equity
- **Monthly Return**: Performance over the last 30 days

## Development

### Run Prisma Studio (Database GUI)
```bash
npm run db:studio
```

### Type Generation
```bash
npx prisma generate
```

### Linting
```bash
npm run lint
```

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` format
- Check PostgreSQL is running
- Ensure database exists

### Google OAuth Errors
- Check redirect URI matches exactly
- Verify Google credentials
- Ensure Google+ API is enabled

### API Key Encryption Errors
- Verify `ENCRYPTION_KEY` is 32 bytes (64 hex characters)
- Don't change encryption key after storing API keys

### Binance API Errors
- Check API key permissions
- Verify API keys are correct
- Ensure IP whitelist (if configured)

## Future Enhancements

- [ ] WebSocket for real-time data
- [ ] More detailed position analytics
- [ ] Risk metrics (Sharpe ratio, etc.)
- [ ] Export reports to PDF/CSV
- [ ] Multiple exchange support
- [ ] Advanced filtering and search
- [ ] Push notifications for trades
- [ ] Dark mode toggle

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Disclaimer

This dashboard is for informational purposes only. Always verify trading data directly with Binance. Past performance does not guarantee future results.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review Binance API documentation

---

Built with ❤️ using Next.js and TypeScript
