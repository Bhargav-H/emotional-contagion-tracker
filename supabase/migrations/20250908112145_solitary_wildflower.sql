/*
  # TeamTone Database Schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text, unique)
      - `name` (text)
      - `role` (text, check constraint for EMPLOYEE/MANAGER/ADMIN)
      - `team_id` (uuid, foreign key to teams.id)
      - `created_at` (timestamp)
    
    - `teams`
      - `id` (uuid, primary key)
      - `name` (text)
      - `manager_id` (uuid, foreign key to users.id)
      - `created_at` (timestamp)
    
    - `emotion_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users.id)
      - `team_id` (uuid, foreign key to teams.id)
      - Mood and stress tracking fields
      - Emotional contagion tracking fields
      - `anonymized` (boolean, default true)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access control
    - Employees can only access their own data
    - Managers can access aggregated team data
    - Admins have full access
*/

-- Create teams table first
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  manager_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Create users table with role constraints
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('EMPLOYEE', 'MANAGER', 'ADMIN')),
  team_id uuid REFERENCES teams(id),
  created_at timestamptz DEFAULT now()
);

-- Add foreign key constraint for teams.manager_id after users table exists
ALTER TABLE teams ADD CONSTRAINT fk_teams_manager 
  FOREIGN KEY (manager_id) REFERENCES users(id);

-- Create emotion_logs table
CREATE TABLE IF NOT EXISTS emotion_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id),
  
  -- Mood tracking fields
  overall_mood integer CHECK (overall_mood >= 1 AND overall_mood <= 5),
  current_mood integer CHECK (current_mood >= 1 AND current_mood <= 5),
  stress integer NOT NULL CHECK (stress >= 1 AND stress <= 5),
  workload integer CHECK (workload >= 1 AND workload <= 5),
  productivity integer NOT NULL CHECK (productivity >= 0 AND productivity <= 10),
  
  -- Additional context
  key_event text,
  from_interaction boolean,
  
  -- Emotional contagion fields
  absorb_frequency integer CHECK (absorb_frequency >= 1 AND absorb_frequency <= 5),
  transmit_frequency integer CHECK (transmit_frequency >= 1 AND transmit_frequency <= 5),
  absorb_from text[],
  transmit_to text[],
  
  -- Privacy
  anonymized boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotion_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Managers can read team members"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    role = 'ADMIN' OR 
    (role = 'MANAGER' AND team_id IN (
      SELECT id FROM teams WHERE manager_id = auth.uid()
    ))
  );

-- RLS Policies for teams table
CREATE POLICY "Team members can read their team"
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (SELECT id FROM users WHERE team_id = teams.id) OR
    manager_id = auth.uid()
  );

CREATE POLICY "Managers can manage their teams"
  ON teams
  FOR ALL
  TO authenticated
  USING (manager_id = auth.uid() OR auth.uid() IN (
    SELECT id FROM users WHERE role = 'ADMIN'
  ));

-- RLS Policies for emotion_logs table
CREATE POLICY "Users can insert own logs"
  ON emotion_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own logs"
  ON emotion_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Managers can read team aggregated data"
  ON emotion_logs
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    auth.uid() IN (
      SELECT manager_id FROM teams WHERE id = emotion_logs.team_id
    ) OR
    auth.uid() IN (
      SELECT id FROM users WHERE role = 'ADMIN'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_emotion_logs_user_id ON emotion_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_emotion_logs_team_id ON emotion_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_emotion_logs_created_at ON emotion_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id);

-- Insert sample data
INSERT INTO teams (id, name) VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'Engineering Team'),
  ('550e8400-e29b-41d4-a716-446655440001', 'Marketing Team')
ON CONFLICT (id) DO NOTHING;