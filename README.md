# Golf Tour Manager

A comprehensive web application for managing golf tours, rounds, and scorecards. Perfect for organizing golf events with friends, tracking scores, and creating competitive tournaments.

## Features

- **Tour Management**
  - Create and manage golf tours
  - Invite players to join tours
  - Track tour leaderboards and statistics

- **Course Management**
  - Create and save golf courses
  - Define hole details (par, stroke index, distance)
  - Support for both 9-hole and 18-hole courses

- **Round Management**
  - Create rounds within tours
  - Support for various game formats:
    - Stroke Play
    - Match Play
    - Stableford
    - Team formats (Four-ball, Foursomes)
    - Ryder Cup format

- **Scoring**
  - Real-time score entry
  - Automatic handicap calculations
  - Mobile-friendly scorecard interface
  - Leaderboard views

- **Quick Games**
  - Create one-off games without setting up a tour
  - Invite friends or add manual players
  - Choose from various game formats

- **User Management**
  - User registration and authentication
  - Player profiles with handicap tracking
  - Friend management

## Technology Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **Authentication**: Firebase Authentication (Email/Password, Google)
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Firebase account

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/golftour.git
   cd golftour
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

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Firebase Setup

1. Create a new Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password and Google providers)
3. Create a Firestore database
4. Set up Storage
5. Add your web app to the Firebase project to get the configuration values

## Usage Guide

### Creating a Tour

1. Register and log in to your account
2. Navigate to the dashboard
3. Click "Create New Tour"
4. Fill in the tour details:
   - Tour name
   - Description
   - Select or create a golf course
   - Configure tour settings (teams, leaderboard visibility)
   - Invite friends

### Creating a Course

1. From the dashboard, go to "Golf Courses"
2. Click "Add New Course"
3. Enter course details:
   - Course name
   - Location
   - Number of holes (9 or 18)
   - For each hole: par, stroke index, and distance

### Creating a Round

1. Navigate to a tour
2. Click "Add Round"
3. Select a course
4. Choose the game format
5. Select players
6. Configure team settings (if applicable)
7. Set the date and time

### Entering Scores

1. Navigate to an active round
2. Click "Enter Scores"
3. Fill in your scores for each hole
4. Save your scorecard

### Quick Games

1. From the dashboard, click "Quick Game"
2. Select a course
3. Choose the game format
4. Add players (friends or manual entries)
5. Start the game and enter scores

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [Next.js](https://nextjs.org/)
- [React](https://reactjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Firebase](https://firebase.google.com/)
- [Vercel](https://vercel.com/)