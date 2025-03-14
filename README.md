# Golf Tour

A modern web application for organizing and managing golf tournaments, tracking scores, and connecting with fellow golfers.

![Golf Tour Screenshot](https://via.placeholder.com/800x400?text=Golf+Tour+Screenshot)

[![Vercel](https://img.shields.io/badge/Vercel-Deployment-black?style=for-the-badge&logo=vercel)](https://golfer-app.vercel.app/)

## Features

- **User Authentication**: Secure login and registration with Firebase Authentication
- **Profile Management**: Create and manage your golf profile with handicap tracking
- **Tournament Creation**: Organize golf tournaments with customizable formats
- **Quick Games**: Set up casual rounds with friends
- **Real-time Scoring**: Enter scores hole-by-hole with automatic calculations
- **Multiple Game Formats**: Support for stroke play, match play, stableford, and team competitions
- **Leaderboards**: Real-time leaderboards for tournaments and games
- **Course Management**: Add and manage golf courses with hole details
- **Mobile Responsive**: Fully responsive design for desktop and mobile use

## Technology Stack

- **Frontend**: React with Next.js 14 App Router
- **Styling**: TailwindCSS for responsive design
- **Backend**: Firebase (Firestore, Authentication, Storage)
- **Hosting**: Vercel

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Firebase account

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ghuroux/golfer-app.git
   cd golfer-app
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env.local` file in the root directory with your Firebase configuration:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```

4. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Firebase Setup

1. Create a new Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Enable Authentication with Email/Password and Google sign-in methods
3. Create a Firestore database
4. Set up Firestore security rules (see `firestore.rules` in the repository)
5. Configure Firebase Storage for profile pictures and other uploads

## Deployment

The application is configured for easy deployment to Vercel:

1. Push your code to a GitHub repository
2. Import the project in Vercel
3. Configure environment variables in the Vercel dashboard
4. Deploy!

Alternatively, you can use the Vercel CLI:

```bash
npm install -g vercel
vercel login
vercel
```

## Project Structure

```
/src
  /app                 # Next.js App Router pages
    /(protected)       # Protected routes requiring authentication
      /dashboard       # User dashboard
      /profile         # User profile management
      /tours           # Tournament management
      /quick-game      # Quick game setup and scoring
    /api               # API routes
  /components          # React components
  /lib                 # Utility functions and hooks
    /contexts          # React contexts (Auth, etc.)
    /firebase          # Firebase configuration and utilities
    /hooks             # Custom React hooks
    /utils             # Helper functions
```

## Scoring Formats

The application supports multiple golf scoring formats:

- **Stroke Play**: Traditional scoring where the total number of strokes determines the winner
- **Match Play**: Hole-by-hole competition between players or teams
- **Stableford**: Points-based scoring system that rewards good play on individual holes
- **Team Competitions**: Various team formats including best ball and alternate shot

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

For any questions or inquiries about this project, please contact:

- **Email**: [your-email@example.com](mailto:your-email@example.com)
- **Website**: [your-website.com](https://your-website.com)

## Acknowledgments

- [Next.js](https://nextjs.org/) - The React framework
- [TailwindCSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Firebase](https://firebase.google.com/) - Backend services
- [Vercel](https://vercel.com/) - Deployment platform