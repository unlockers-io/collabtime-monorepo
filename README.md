# Collab Time

A real-time team timezone visualizer that helps distributed teams find the best time to collaborate across different timezones.

## Features

- **Real-time Collaboration**: Changes sync instantly across all connected browsers using Upstash Realtime
- **Timezone Visualization**: See team members' working hours mapped to your local timezone
- **Overlap Detection**: Automatically calculate overlapping working hours between team members
- **Drag & Drop Reordering**: Organize team members with smooth drag-and-drop (mobile-friendly handles included)
- **Shareable Teams**: Each team gets a unique URL that can be shared with colleagues
- **Dark Mode Support**: Fully responsive design with light and dark theme support
- **No Account Required**: Create and share teams without signing up

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Database**: [Upstash Redis](https://upstash.com/redis) for serverless data storage
- **Real-time**: [Upstash Realtime](https://upstash.com/docs/redis/sdks/realtime) for live synchronization
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Animations**: [Motion](https://motion.dev/) (Framer Motion)
- **Forms**: [React Hook Form](https://react-hook-form.com/) with [Zod](https://zod.dev/) validation
- **Notifications**: [Sonner](https://sonner.emilkowal.ski/) for toast notifications

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Upstash Redis database

### Environment Variables

Create a `.env.local` file in the root directory:

```bash
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
```

### Installation

```bash
# Install dependencies
pnpm install

# Run the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## How It Works

1. **Create a Team**: Click "Create New Team" on the homepage
2. **Add Members**: Add team members with their name, timezone, and working hours
3. **Share the Link**: Copy the team URL and share it with your colleagues
4. **Visualize Overlap**: Use the timezone visualizer to find the best meeting times

## Deployment

Deploy to [Vercel](https://vercel.com) with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/collab-time)

Make sure to add your Upstash Redis environment variables in the Vercel dashboard.

## License

MIT
