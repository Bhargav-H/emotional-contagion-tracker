import React, { useState } from 'react'
import {
  Heart,
  Activity,
  Zap,
  Users,
  MessageSquare,
  Save,
  Clock,
  MonitorSmartphone,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export function CheckIn() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    overall_mood: 3,
    stress: 3,
    workload: 3,
    productivity: 3, // now 0..5
    key_event: '',
    absorb_frequency: 3,
    transmit_frequency: 3,
    absorb_valence: '', // POSITIVE | NEGATIVE | MIXED
    transmit_valence: '', // POSITIVE | NEGATIVE | MIXED
    team_interaction_mode: '', // radios: In person / Online / Both / Minimal
    time_spent_with_team_today: '', // radios: "0-2 hours", etc.
    perceived_team_mood: 3,
  })

  const validateForm = () => {
    const missing: string[] = []

    // numeric scales are always populated by defaults, so only check text/select/radio fields
    if (!form.key_event.trim()) missing.push('Key event / description')
    if (!form.absorb_valence) missing.push('Type of emotions you mostly absorb')
    if (!form.transmit_valence) missing.push('Type of emotions you mostly transmit')
    if (!form.team_interaction_mode) missing.push('How you mostly interacted with your team today')
    if (!form.time_spent_with_team_today) missing.push('How many hours you spent interacting with your team')

    return missing
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) {
      toast.error('You must be logged in to submit.')
      return
    }

    const missing = validateForm()
    if (missing.length > 0) {
      toast.error(`Please complete: ${missing.join(', ')}`)
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.from('emotion_logs').insert({
        user_id: profile.id,
        team_id: (profile as any).team_id ?? null,
        overall_mood: form.overall_mood,
        stress: form.stress,
        workload: form.workload,
        productivity: form.productivity,
        key_event: form.key_event,
        absorb_frequency: form.absorb_frequency,
        transmit_frequency: form.transmit_frequency,
        absorb_valence: form.absorb_valence,
        transmit_valence: form.transmit_valence,
        team_interaction_mode: form.team_interaction_mode,
        // store the selected bucket string, not a number
        time_spent_with_team_today: form.time_spent_with_team_today,
        perceived_team_mood: form.perceived_team_mood,
      })

      if (error) throw error

      toast.success('Check-in completed! 🎉')

      // reset to defaults
      setForm({
        overall_mood: 3,
        stress: 3,
        workload: 3,
        productivity: 3,
        key_event: '',
        absorb_frequency: 3,
        transmit_frequency: 3,
        absorb_valence: '',
        transmit_valence: '',
        team_interaction_mode: '',
        time_spent_with_team_today: '',
        perceived_team_mood: 3,
      })
    } catch (err) {
      console.error('Error submitting check-in:', err)
      toast.error('Failed to submit check-in')
    } finally {
      setLoading(false)
    }
  }

  // small reusable slider component
  const ScaleInput = ({
    label,
    value,
    onChange,
    min = 1,
    max = 5,
    icon: Icon,
  }: {
    label: string
    value: number
    onChange: (value: number) => void
    min?: number
    max?: number
    icon?: React.ComponentType<{ className?: string }>
  }) => (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {Icon && <Icon className="w-4 h-4" />}
        <span>{label}</span>
      </label>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
        <span className="w-8 text-center text-sm">{value}</span>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Emotional Check-In
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Take a moment to reflect on your emotional state
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Overall Assessment */}
          <div>
            <h2 className="text-lg font-semibold mb-6">Overall Assessment</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <ScaleInput
                label="Overall Mood"
                value={form.overall_mood}
                onChange={(v) => setForm((f) => ({ ...f, overall_mood: v }))}
                icon={Heart}
                min={1}
                max={5}
              />
              <ScaleInput
                label="Stress Level"
                value={form.stress}
                onChange={(v) => setForm((f) => ({ ...f, stress: v }))}
                icon={Activity}
                min={1}
                max={5}
              />
              <ScaleInput
                label="Workload"
                value={form.workload}
                onChange={(v) => setForm((f) => ({ ...f, workload: v }))}
                min={1}
                max={5}
              />
              <ScaleInput
                label="Productivity"
                value={form.productivity}
                onChange={(v) => setForm((f) => ({ ...f, productivity: v }))}
                min={0}
                max={5} // changed: productivity slider only till 5
                icon={Zap}
              />
            </div>
          </div>

          {/* Key event - now required */}
          <div>
            <label className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <MessageSquare className="w-4 h-4" />
              <span>Key Event (describe what influenced your mood today)</span>
            </label>
            <textarea
              value={form.key_event}
              onChange={(e) => setForm((f) => ({ ...f, key_event: e.target.value }))}
              rows={3}
              required
              className="w-full p-3 border border-gray-300 rounded-md resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          {/* Emotional Contagion */}
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-6 text-gray-900 dark:text-white">
              <Users className="w-5 h-5" />
              Emotional Contagion
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              {/* Absorbing */}
              <div>
                <ScaleInput
                  label="How often do you absorb emotions from others?"
                  value={form.absorb_frequency}
                  onChange={(v) => setForm((f) => ({ ...f, absorb_frequency: v }))}
                />
                <label className="block mt-4 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  What type of emotions do you mostly absorb?
                </label>
                <select
                  value={form.absorb_valence}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, absorb_valence: e.target.value }))
                  }
                  required
                  className="w-full p-3 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">Select...</option>
                  <option value="POSITIVE">Positive (joy, excitement, motivation)</option>
                  <option value="NEGATIVE">Negative (stress, sadness, frustration)</option>
                  <option value="MIXED">Mixed (depends on the situation)</option>
                </select>
              </div>

              {/* Transmitting */}
              <div>
                <ScaleInput
                  label="How often do you transmit emotions to others?"
                  value={form.transmit_frequency}
                  onChange={(v) => setForm((f) => ({ ...f, transmit_frequency: v }))}
                />
                <label className="block mt-4 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  What type of emotions do you mostly transmit?
                </label>
                <select
                  value={form.transmit_valence}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, transmit_valence: e.target.value }))
                  }
                  required
                  className="w-full p-3 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">Select...</option>
                  <option value="POSITIVE">Positive (joy, excitement, motivation)</option>
                  <option value="NEGATIVE">Negative (stress, sadness, frustration)</option>
                  <option value="MIXED">Mixed (depends on the situation)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Team Interaction Context (UPDATED options + required) */}
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-6 text-gray-900 dark:text-white">
              <MonitorSmartphone className="w-5 h-5" />
              Team Interaction Context
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Interaction mode - radio list */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  How did you mostly interact with your team today?
                </label>

                <div className="space-y-2 mt-2">
                  {[
                    'In person (class, campus, group study)',
                    'Online (texting, video calls, group chats)',
                    'Both online and offline',
                    'Minimal or no interaction today',
                  ].map((opt, idx) => (
                    <label key={opt} className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="team_interaction_mode"
                        value={opt}
                        checked={form.team_interaction_mode === opt}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, team_interaction_mode: e.target.value }))
                        }
                        // make group required by setting required on the first radio
                        required={idx === 0}
                      />
                      <span className="text-sm">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Time spent with team - radio options */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Approximately how many hours did you spend interacting with your team today?
                </label>

                <div className="space-y-2 mt-2">
                  {['0-2 hours', '2-4 hours', '4-6 hours', '6-8 hours'].map(
                    (opt, idx) => (
                      <label key={opt} className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="time_spent_with_team_today"
                          value={opt}
                          checked={form.time_spent_with_team_today === opt}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, time_spent_with_team_today: e.target.value }))
                          }
                          required={idx === 0}
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <ScaleInput
                label="How would you rate your team's overall mood today?"
                value={form.perceived_team_mood}
                onChange={(v) => setForm((f) => ({ ...f, perceived_team_mood: v }))}
                min={1}
                max={5}
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white py-3 rounded-lg hover:from-pink-600 hover:to-rose-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save />
            {loading ? 'Saving...' : 'Complete Detailed Check-In'}
          </button>
        </form>
      </div>
    </div>
  )
}
