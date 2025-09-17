import React, { useState } from 'react'
import { Heart, Activity, Zap, Users, MessageSquare, Save } from 'lucide-react'
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
    productivity: 5,
    key_event: '',
    absorb_frequency: 3,
    transmit_frequency: 3,
    absorb_from: '',      // Changed from array to string
    transmit_to: '',      // Changed from array to string
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('emotion_logs')
        .insert({
          user_id: profile.id,
          team_id: profile.team_id,
          overall_mood: form.overall_mood,
          stress: form.stress,
          workload: form.workload,
          productivity: form.productivity,
          key_event: form.key_event || null,
          absorb_frequency: form.absorb_frequency,
          transmit_frequency: form.transmit_frequency,
          absorb_from: form.absorb_from || null,
          transmit_to: form.transmit_to || null,
        })
      if (error) throw error

      toast.success('Check-in completed! 🎉')

      setForm({
        overall_mood: 3,
        stress: 3,
        workload: 3,
        productivity: 5,
        key_event: '',
        absorb_frequency: 3,
        transmit_frequency: 3,
        absorb_from: '',
        transmit_to: '',
      })
    } catch (error) {
      console.error('Error submitting check-in:', error)
      toast.error('Failed to submit check-in')
    } finally {
      setLoading(false)
    }
  }

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
          onChange={e => onChange(Number(e.target.value))}
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
          <div>
            <h2 className="text-lg font-semibold mb-6">Overall Assessment</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <ScaleInput
                label="Overall Mood"
                value={form.overall_mood}
                onChange={v => setForm(f => ({ ...f, overall_mood: v }))}
                icon={Heart}
              />
              <ScaleInput
                label="Stress Level"
                value={form.stress}
                onChange={v => setForm(f => ({ ...f, stress: v }))}
                icon={Activity}
              />
              <ScaleInput
                label="Workload"
                value={form.workload}
                onChange={v => setForm(f => ({ ...f, workload: v }))}
              />
              <ScaleInput
                label="Productivity"
                value={form.productivity}
                onChange={v => setForm(f => ({ ...f, productivity: v }))}
                min={0}
                max={10}
                icon={Zap}
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <MessageSquare className="w-4 h-4" />
              <span>Key Event (Optional)</span>
            </label>
            <textarea
              value={form.key_event}
              onChange={e => setForm(f => ({ ...f, key_event: e.target.value }))}
              rows={3}
              placeholder="Describe any positive or negative event that influenced your mood today..."
              className="w-full min-h-[56px] p-3 border border-gray-300 rounded-md resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

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
                  onChange={v => setForm(f => ({ ...f, absorb_frequency: v }))}
                />
                <label className="block mt-4 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Who do you most often absorb emotions from?
                </label>
                <textarea
                  value={form.absorb_from}
                  onChange={e => setForm(f => ({ ...f, absorb_from: e.target.value }))}
                  rows={2}
                  placeholder="Type people or sources here..."
                  className="w-full min-h-[40px] p-3 border border-gray-300 rounded-md resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  style={{ minHeight: '48px' }}
                />
              </div>
              {/* Transmitting */}
              <div>
                <ScaleInput
                  label="How often do you transmit emotions to others?"
                  value={form.transmit_frequency}
                  onChange={v => setForm(f => ({ ...f, transmit_frequency: v }))}
                />
                <label className="block mt-4 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Who do you most often transmit emotions to?
                </label>
                <textarea
                  value={form.transmit_to}
                  onChange={e => setForm(f => ({ ...f, transmit_to: e.target.value }))}
                  rows={2}
                  placeholder="Type people or groups here..."
                  className="w-full min-h-[40px] p-3 border border-gray-300 rounded-md resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  style={{ minHeight: '48px' }}
                />
              </div>
            </div>
          </div>

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
