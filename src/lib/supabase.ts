import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN'
          team_id: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN'
          team_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: 'EMPLOYEE' | 'MANAGER' | 'ADMIN'
          team_id?: string | null
          created_at?: string
        }
      }
      teams: {
        Row: {
          id: string
          name: string
          manager_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          manager_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          manager_id?: string | null
          created_at?: string
        }
      }
      emotion_logs: {
        Row: {
          id: string
          user_id: string
          team_id: string | null
          overall_mood: number | null
          current_mood: number | null
          stress: number
          workload: number | null
          productivity: number
          key_event: string | null
          from_interaction: boolean | null
          absorb_frequency: number | null
          transmit_frequency: number | null
          absorb_from: string[] | null
          transmit_to: string[] | null
          anonymized: boolean
          created_at: string

          // ✅ Newly added fields
          team_interaction_mode: 'Chat' | 'Voice' | 'In-person' | 'Hybrid' | null
          time_spent_with_team_today: number | null
          perceived_team_mood: number | null
        }
        Insert: {
          id?: string
          user_id: string
          team_id?: string | null
          overall_mood?: number | null
          current_mood?: number | null
          stress: number
          workload?: number | null
          productivity: number
          key_event?: string | null
          from_interaction?: boolean | null
          absorb_frequency?: number | null
          transmit_frequency?: number | null
          absorb_from?: string[] | null
          transmit_to?: string[] | null
          anonymized?: boolean
          created_at?: string

          // ✅ Newly added fields
          team_interaction_mode?: 'Chat' | 'Voice' | 'In-person' | 'Hybrid' | null
          time_spent_with_team_today?: number | null
          perceived_team_mood?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          team_id?: string | null
          overall_mood?: number | null
          current_mood?: number | null
          stress?: number
          workload?: number | null
          productivity?: number
          key_event?: string | null
          from_interaction?: boolean | null
          absorb_frequency?: number | null
          transmit_frequency?: number | null
          absorb_from?: string[] | null
          transmit_to?: string[] | null
          anonymized?: boolean
          created_at?: string

          // ✅ Newly added fields
          team_interaction_mode?: 'Chat' | 'Voice' | 'In-person' | 'Hybrid' | null
          time_spent_with_team_today?: number | null
          perceived_team_mood?: number | null
        }
      }
    }
  }
}
