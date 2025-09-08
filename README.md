<<<<<<< HEAD
# TeamTone - Emotional Contagion Tracker

A comprehensive web application for tracking emotional well-being across teams, built with React.js and Supabase.

## Features

### 🎯 Core Functionality
- **Quick & Detailed Check-ins**: Two-tiered emotional logging system
- **Personal History**: Interactive trend charts showing mood, stress, and productivity over time
- **Team Insights**: Aggregated team-level analytics for managers
- **Emotional Contagion Tracking**: Track how emotions spread within teams
- **Role-based Access Control**: Employee, Manager, and Admin roles with appropriate permissions

### 🎨 User Experience
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Dark/Light Mode**: Toggle between themes with persistent preference
- **Modern UI**: Clean design with subtle animations and micro-interactions
- **Interactive Charts**: Powered by Recharts for beautiful data visualization

### 🔐 Security & Privacy
- **Row Level Security**: Supabase RLS ensures data privacy
- **Anonymization Options**: Personal data protection in team aggregations
- **Authentication**: Secure email/password authentication with Supabase Auth

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Charts**: Recharts
- **Icons**: Lucide React
- **Notifications**: React Hot Toast

## Quick Start

1. **Clone and install**:
   ```bash
   git clone <repository-url>
   cd teamtone
   npm install
   ```

2. **Set up Supabase**:
   - Create a new Supabase project at [supabase.com](https://supabase.com)
   - Copy your project URL and anon key
   - Create `.env` file:
     ```
     VITE_SUPABASE_URL=your_supabase_project_url
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

3. **Set up the database**:
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Run the migration from `supabase/migrations/create_schema.sql`

4. **Start development**:
   ```bash
   npm run dev
   ```

## Database Schema

### Tables

#### `users`
- User profiles with role-based access
- Links to Supabase Auth users
- Team membership tracking

#### `teams`
- Team organization structure
- Manager assignment

#### `emotion_logs`
- Core emotion tracking data
- Support for both quick and detailed check-ins
- Emotional contagion metrics
- Privacy controls

## User Roles

### Employee
- Complete quick and detailed check-ins
- View personal emotional history
- Track personal trends and patterns

### Manager
- All employee features
- View aggregated team insights
- Monitor team emotional health trends
- Access team heatmaps and analytics

### Admin
- Full system access
- User and team management
- Complete data visibility

## API Endpoints

The application uses Supabase's auto-generated REST API with the following main operations:

- `POST /emotion_logs` - Submit check-in data
- `GET /emotion_logs` - Retrieve personal history
- `GET /users` - User profile management
- `GET /teams` - Team data (with RLS)

## Development

### Project Structure
```
src/
├── components/          # React components
├── hooks/              # Custom React hooks
├── lib/                # Utilities and configurations
└── types/              # TypeScript type definitions
```

### Key Components
- `AuthProvider` - Authentication context and state management
- `Layout` - Main application layout with navigation
- `Dashboard` - Role-based dashboard with quick actions
- `CheckIn` - Emotional check-in forms (quick & detailed)
- `PersonalHistory` - Individual trend visualization
- `TeamInsights` - Manager dashboard with team analytics

### Customization

The application is designed to be easily customizable:

- **Styling**: Modify Tailwind classes or extend the config
- **Charts**: Replace Recharts with alternative charting libraries
- **Authentication**: Extend or replace Supabase Auth
- **Database**: Modify schema in migration files

## Deployment

### Supabase Setup
1. Enable Row Level Security on all tables
2. Set up authentication providers as needed
3. Configure email templates (optional)

### Environment Variables
Ensure these are set in your deployment environment:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Build
```bash
npm run build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the GitHub issues
2. Review Supabase documentation
3. Consult React and Tailwind CSS docs

---

Built with ❤️ for better team emotional health
=======
# Emotional-Contagion-Tracker
Emotional Contagion Tracker for teams to track the spread of emotions within the workplace.
>>>>>>> f1ff56d3a69e8aed950682874fb7d15b3a4fdf48
