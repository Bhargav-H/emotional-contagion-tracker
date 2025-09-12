import React, { useState } from 'react'
import { Heart, Activity, Zap, Users, MessageSquare, Save } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export function CheckIn() {
  const { profile } = useAuth()
  const [checkInType, setCheckInType] = useState<'quick' | 'detailed'>('quick')
  const [loading, setLoading] = useState(false)

  // Quick check-in uses overall_mood now (NOT current_mood)
  const [quickForm, setQuickForm] = useState({
    overall_mood: 3,
    stress: 3,
    productivity: 5,
    from_interaction: false,
  })

  const [detailedForm, setDetailedForm] = useState({
    overall_mood: 3,
    stress: 3,
    workload: 3,
    productivity: 5,
    key_event: '',
    absorb_frequency: 3,
    transmit_frequency: 3,
    absorb_from: [] as string[],
    transmit_to: [] as string[],
  })

  const emotionSources = ['Leaders', 'Colleagues', 'Clients']

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('emotion_logs')
        .insert({
          user_id: profile.id,
          team_id: profile.team_id,
          overall_mood: quickForm.overall_mood, // changed from current_mood
          stress: quickForm.stress,
          productivity: quickForm.productivity,
          from_interaction: quickForm.from_interaction,
        })
      if (error) throw error

      toast.success('Quick check-in completed! 🎉')

      setQuickForm({
        overall_mood: 3,
        stress: 3,
        productivity: 5,
        from_interaction: false,
      })
    } catch (error) {
      console.error('Error submitting check-in:', error)
      toast.error('Failed to submit check-in')
    } finally {
      setLoading(false)
    }
  }

  const handleDetailedSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('emotion_logs')
        .insert({
          user_id: profile.id,
          team_id: profile.team_id,
          overall_mood: detailedForm.overall_mood,
          stress: detailedForm.stress,
          workload: detailedForm.workload,
          productivity: detailedForm.productivity,
          key_event: detailedForm.key_event || null,
          absorb_frequency: detailedForm.absorb_frequency,
          transmit_frequency: detailedForm.transmit_frequency,
          absorb_from: detailedForm.absorb_from.length > 0 ? detailedForm.absorb_from : null,
          transmit_to: detailedForm.transmit_to.length > 0 ? detailedForm.transmit_to : null,
        })
      if (error) throw error

      toast.success('Detailed check-in completed! 🎉')

      setDetailedForm({
        overall_mood: 3,
        stress: 3,
        workload: 3,
        productivity: 5,
        key_event: '',
        absorb_frequency: 3,
        transmit_frequency: 3,
        absorb_from: [],
        transmit_to: [],
      })
    } catch (error) {
      console.error('Error submitting check-in:', error)
      toast.error('Failed to submit check-in')
    } finally {
      setLoading(false)
    }
  }

  const toggleEmotionSource = (sources: string[], source: string) => {
    return sources.includes(source)
      ? sources.filter(s => s !== source)
      : [...sources, source]
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
    icon?: React.ComponentType<any>
  }) => (
    <div className="space-y-2">
      <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {Icon && <Icon className="w-4 h-4" />}
        <span>{label}</span>
      </label>
      <div className="flex items-center space-x-4">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
        <span className="w-8 text-center text-sm font-medium text-gray-900 dark:text-white">
          {value}
        </span>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Emotional Check-In
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Take a moment to reflect on your current emotional state
        </p>
      </div>

      {/* Check-in Type Selector */}
      <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
        <button
          onClick={() => setCheckInType('quick')}
          className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
            checkInType === 'quick'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          Quick Check-In (2 min)
        </button>
        <button
          onClick={() => setCheckInType('detailed')}
          className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
            checkInType === 'detailed'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          Detailed Check-In (5 min)
        </button>
      </div>

      {/* Quick Check-In Form */}
      {checkInType === 'quick' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <form onSubmit={handleQuickSubmit} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                <Heart className="w-5 h-5" />
                <span>Overall Mood</span>
              </h3>
              {/* Replaces old emoji picker with 1-5 slider */}
              <ScaleInput
                label=""
                value={quickForm.overall_mood}
                onChange={(value) => setQuickForm(prev => ({ ...prev, overall_mood: value }))}
                min={1}
                max={5}
                icon={undefined}
              />
            </div>

            {/* Scales */}
            <div className="space-y-4">
              <ScaleInput
                label="Stress Level"
                value={quickForm.stress}
                onChange={(value) => setQuickForm(prev => ({ ...prev, stress: value }))}
                icon={Activity}
              />
              <ScaleInput
                label="Productivity"
                value={quickForm.productivity}
                onChange={(value) => setQuickForm(prev => ({ ...prev, productivity: value }))}
                min={0}
                max={10}
                icon={Zap}
              />
            </div>

            {/* Interaction Question */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Did this mood arise from interaction with someone else?
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={quickForm.from_interaction === true}
                    onChange={() => setQuickForm(prev => ({ ...prev, from_interaction: true }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Yes</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={quickForm.from_interaction === false}
                    onChange={() => setQuickForm(prev => ({ ...prev, from_interaction: false }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">No</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
            >
              <Save className="w-5 h-5" />
              <span>{loading ? 'Saving...' : 'Complete Check-In'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Detailed Check-In Form */}
      {checkInType === 'detailed' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <form onSubmit={handleDetailedSubmit} className="space-y-8">
            {/* Overall Assessment */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Overall Assessment</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <ScaleInput
                  label="Overall Mood"
                  value={detailedForm.overall_mood}
                  onChange={(value) => setDetailedForm(prev => ({ ...prev, overall_mood: value }))}
                  icon={Heart}
                />
                <ScaleInput
                  label="Stress Level"
                  value={detailedForm.stress}
                  onChange={(value) => setDetailedForm(prev => ({ ...prev, stress: value }))}
                  icon={Activity}
                />
                <ScaleInput
                  label="Workload"
                  value={detailedForm.workload}
                  onChange={(value) => setDetailedForm(prev => ({ ...prev, workload: value }))}
                />
                <ScaleInput
                  label="Productivity"
                  value={detailedForm.productivity}
                  onChange={(value) => setDetailedForm(prev => ({ ...prev, productivity: value }))}
                  min={0}
                  max={10}
                  icon={Zap}
                />
              </div>
            </div>

            {/* Key Event */}
            <div className="space-y-3">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <MessageSquare className="w-4 h-4" />
                <span>Key Event (Optional)</span>
              </label>
              <textarea
                value={detailedForm.key_event}
                onChange={(e) => setDetailedForm(prev => ({ ...prev, key_event: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                placeholder="Describe any positive or negative event that influenced your mood today..."
              />
            </div>

            {/* Emotional Contagion */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Emotional Contagion</span>
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Absorbing Emotions */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900 dark:text-white">Absorbing Emotions</h4>
                  <ScaleInput
                    label="How often do you absorb emotions from others?"
                    value={detailedForm.absorb_frequency}
                    onChange={(value) => setDetailedForm(prev => ({ ...prev, absorb_frequency: value }))}
                  />
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Who do you most often absorb emotions from?
                    </label>
                    <div className="space-y-2">
                      {emotionSources.map((source) => (
                        <label key={source} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={detailedForm.absorb_from.includes(source)}
                            onChange={() => {
                              setDetailedForm(prev => ({
                                ...prev,
                                absorb_from: toggleEmotionSource(prev.absorb_from, source),
                              }))
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{source}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Transmitting Emotions */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900 dark:text-white">Transmitting Emotions</h4>
                  <ScaleInput
                    label="How often do you transmit emotions to others?"
                    value={detailedForm.transmit_frequency}
                    onChange={(value) => setDetailedForm(prev => ({ ...prev, transmit_frequency: value }))}
                  />
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Who do you most often transmit emotions to?
                    </label>
                    <div className="space-y-2">
                      {emotionSources.map((source) => (
                        <label key={source} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={detailedForm.transmit_to.includes(source)}
                            onChange={() => {
                              setDetailedForm(prev => ({
                                ...prev,
                                transmit_to: toggleEmotionSource(prev.transmit_to, source),
                              }))
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{source}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
            >
              <Save className="w-5 h-5" />
              <span>{loading ? 'Saving...' : 'Complete Detailed Check-In'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
