# PromptStyle 🎨

> India's #1 AI Style Marketplace - Transform Your Photos with Protected AI Prompts

![PromptStyle Banner](https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&h=400&fit=crop)

## 🌟 What is PromptStyle?

PromptStyle is an Indian AI prompt marketplace where:
- **Sellers** upload AI prompts with sample output images
- **Buyers** browse styles, upload their photo, and see it transformed
- **Prompts stay encrypted** - buyers never see the actual prompt
- **Instant previews** with watermark (free)
- **Pay ₹49-₹299** to download HD without watermark
- **Platform takes 35%**, seller gets 65%

## 🚀 Current Status

### ✅ Phase 1: Foundation (COMPLETED)

**Database & Backend**
- [x] Supabase PostgreSQL database setup
- [x] 5 tables with Row Level Security (RLS)
- [x] Automatic triggers for ratings and sales
- [x] Storage buckets (public + private)
- [x] Prompt encryption (never exposed to frontend)
- [x] Google OAuth authentication
- [x] TypeScript types generated from schema

**Frontend Integration**
- [x] Supabase client setup
- [x] Authentication hooks (useAuth)
- [x] Data fetching hooks (useStyles)
- [x] All components updated for real data
- [x] Loading states and error handling
- [x] Toast notifications
- [x] Mobile-first responsive design

**Features Working**
- [x] Browse 12 styles from database
- [x] Category filtering (8 categories)
- [x] Search by title, category, creator
- [x] Sort by popular, newest, price, rating
- [x] Trending section (top 5 by sales)
- [x] Style detail modal
- [x] Wishlist (local state)
- [x] Follow creators (local state)
- [x] Google sign in/out
- [x] Session persistence

### 🚧 Phase 2: Seller Features (NEXT)

- [ ] Real seller dashboard with earnings
- [ ] Style upload with image to Supabase Storage
- [ ] Seller profile management
- [ ] Withdrawal request system
- [ ] Sales analytics

### 🚧 Phase 3: AI Integration (IN PROGRESS)

- [x] Gemini API integration (Google Generative AI)
- [x] React hooks for image generation (useGemini)
- [x] Demo page at `/gemini-demo`
- [ ] Replicate API integration (alternative)
- [ ] Photo upload to Supabase Storage
- [ ] Supabase Edge Function for AI processing
- [ ] Watermark generation for previews
- [ ] HD image storage after payment

### 🚧 Phase 4: Payments (PLANNED)

- [ ] Razorpay integration
- [ ] Order creation
- [ ] Payment webhook handling
- [ ] HD unlock after successful payment
- [ ] Commission split (35% platform, 65% seller)

### 🚧 Phase 5: Advanced Features (PLANNED)

- [ ] Real ratings and reviews
- [ ] Purchase history page
- [ ] Wishlist persistence in database
- [ ] Following system in database
- [ ] Email notifications
- [ ] Seller verification system
- [ ] Admin dashboard

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 + TanStack Router
- **Styling**: Tailwind CSS 4
- **UI Components**: Radix UI
- **State Management**: TanStack Query + React Context
- **Notifications**: Sonner
- **Icons**: Lucide React

### Backend
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (Google OAuth)
- **Storage**: Supabase Storage (3 buckets)
- **AI Processing**: Google Gemini API (integrated), Replicate.com (planned)
- **Payments**: Razorpay (planned)

### Deployment
- **Frontend**: Vercel (planned)
- **Edge Functions**: Supabase Edge Functions (planned)
- **Proxy**: Cloudflare Worker (optional, for Jio ISP)

## 📦 Installation

### Prerequisites
- Node.js 22+
- Supabase account

### Steps

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd style-fusion-main
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up Supabase**
- Create a new Supabase project
- Run the SQL migration from `supabase-setup.sql`
- Create 3 storage buckets (see SETUP_GUIDE.md)
- Enable Google OAuth (optional)

4. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

5. **Start development server**
```bash
npm run dev
```

Visit `http://localhost:3000`

## 📖 Documentation

- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Complete setup instructions
- **[GEMINI_INTEGRATION.md](./GEMINI_INTEGRATION.md)** - Gemini AI integration guide
- **[supabase-setup.sql](./supabase-setup.sql)** - Database migration script

## 🔒 Security Features

### Prompt Protection (Core Business Logic)
- Prompts stored encrypted in database
- `prompt_encrypted` column NEVER selected in frontend queries
- Only Supabase Edge Functions access prompts server-side
- Buyers only receive the OUTPUT image, never the prompt

### Row Level Security (RLS)
- Users can only see their own purchases
- Sellers can only edit their own styles
- Buyers can only rate styles they purchased
- Withdrawals visible only to that seller

### Storage Security
- `style-samples`: Public (sample images)
- `user-uploads`: Private (buyer photos)
- `hd-outputs`: Private (unlocked after payment)

## 🎨 Design System

### Colors
- **Background**: `#0A0A0F` (dark)
- **Card Surface**: `#1A1A24` (slightly lighter)
- **Primary (Orange)**: `#FF6B35`
- **Secondary (Purple)**: `#A855F7`

### Typography
- **Headings**: Syne (600, 700, 800)
- **Body**: DM Sans (400, 500, 600, 700)

### Components
- Dark theme throughout
- Glassmorphism effects
- Smooth animations
- Mobile-first responsive

## 📱 Mobile Support

- Bottom navigation bar on mobile
- Touch-optimized interactions
- Responsive grid layouts
- Optimized for Indian mobile users

## 🇮🇳 India-Specific Features

- All prices in Indian Rupees (₹)
- UPI payment support (via Razorpay)
- Data stored in Mumbai/Pune region
- Compliant with India DPDP Act 2025
- Cloudflare proxy option (for Jio ISP blocking)

## 🗂️ Project Structure

```
style-fusion-main/
├── src/
│   ├── components/          # React components
│   │   ├── Navbar.tsx      # Navigation with auth
│   │   ├── Hero.tsx        # Landing hero section
│   │   ├── StyleCard.tsx   # Style card component
│   │   ├── StyleModal.tsx  # Style detail modal
│   │   ├── TrendingRow.tsx # Trending styles
│   │   └── ui/             # Radix UI components
│   ├── hooks/              # Custom React hooks
│   │   ├── useAuth.ts      # Authentication
│   │   ├── useStyles.ts    # Styles data fetching
│   │   └── use-mobile.tsx  # Mobile detection
│   ├── lib/                # Utilities
│   │   ├── supabase.ts     # Supabase client
│   │   ├── database.types.ts # TypeScript types
│   │   └── utils.ts        # Helper functions
│   ├── routes/             # Page routes
│   │   ├── __root.tsx      # Root layout
│   │   ├── index.tsx       # Homepage
│   │   └── seller-dashboard.tsx # Seller dashboard
│   ├── context/            # React context
│   │   └── AppContext.tsx  # Global app state
│   └── data/               # Static data (legacy)
├── supabase-setup.sql      # Database migration
├── SETUP_GUIDE.md          # Setup instructions
├── .env.example            # Environment template
└── package.json
```

## 🧪 Testing

Currently manual testing. Automated tests planned for Phase 5.

**Test Checklist:**
- [ ] Sign in with Google
- [ ] Browse styles by category
- [ ] Search styles
- [ ] Sort styles
- [ ] Open style modal
- [ ] Add to wishlist
- [ ] Follow creator
- [ ] Sign out

## 🚀 Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy

### Environment Variables for Production
```env
VITE_SUPABASE_URL=your_production_url
VITE_SUPABASE_ANON_KEY=your_production_key
VITE_REPLICATE_API_TOKEN=your_replicate_token
VITE_RAZORPAY_KEY_ID=your_razorpay_key
```

## 📊 Database Schema

### Tables
1. **sellers** - Seller profiles and earnings
2. **styles** - AI styles with encrypted prompts
3. **purchases** - Transaction records
4. **ratings** - Style ratings and reviews
5. **withdrawals** - Seller withdrawal requests

### Storage Buckets
1. **style-samples** (public) - Sample output images
2. **user-uploads** (private) - Buyer uploaded photos
3. **hd-outputs** (private) - HD results after payment

## 🤝 Contributing

This is a private project. If you have access:
1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📝 License

Proprietary - All rights reserved

## 🙏 Acknowledgments

- Powered by [Supabase](https://supabase.com)
- Icons by [Lucide](https://lucide.dev)
- Fonts from [Google Fonts](https://fonts.google.com)

## 📞 Support

For issues or questions:
1. Check SETUP_GUIDE.md
2. Review Supabase logs
3. Check browser console
4. Contact the development team

---

**Made in India 🇮🇳 with ❤️**
