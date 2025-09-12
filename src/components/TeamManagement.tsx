import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Database } from '../lib/supabase'

type User = Database['public']['Tables']['users']['Row']
type Team = Database['public']['Tables']['teams']['Row']

export function TeamManagement() {
  const { profile } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null)

  useEffect(() => {
    if (!profile || profile.role !== 'ADMIN') return

    async function loadData() {
      setLoadingUsers(true)
      setLoadingTeams(true)
      try {
        // Select including created_at for type compatibility
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, email, name, role, team_id, created_at')

        if (usersError) throw usersError
        setUsers(usersData || [])

        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('id, name, manager_id, created_at')

        if (teamsError) throw teamsError
        setTeams(teamsData || [])
      } catch (error) {
        alert('Error loading data: ' + (error as any).message)
      } finally {
        setLoadingUsers(false)
        setLoadingTeams(false)
      }
    }
    loadData()
  }, [profile])

  if (!profile) return <div>Loading...</div>
  if (profile.role !== 'ADMIN') return <div className="text-red-600">Unauthorized: Admins only</div>

  async function updateUserTeam(userId: string, teamId: string | null) {
    setSavingUserId(userId)
    try {
      const { error } = await supabase
        .from('users')
        .update({ team_id: teamId })
        .eq('id', userId)
      if (error) throw error

      setUsers(us =>
        us.map(u => (u.id === userId ? { ...u, team_id: teamId } : u))
      )
      alert('User team updated.')
    } catch (error) {
      alert('Error updating user team: ' + (error as any).message)
    } finally {
      setSavingUserId(null)
    }
  }

  async function updateTeamManager(teamId: string, managerId: string | null) {
    setSavingTeamId(teamId)
    try {
      const { error } = await supabase
        .from('teams')
        .update({ manager_id: managerId })
        .eq('id', teamId)
      if (error) throw error

      setTeams(ts =>
        ts.map(t => (t.id === teamId ? { ...t, manager_id: managerId } : t))
      )
      alert('Team manager updated.')
    } catch (error) {
      alert('Error updating team manager: ' + (error as any).message)
    } finally {
      setSavingTeamId(null)
    }
  }

  function renderLoading() {
    return <div className="py-6 text-center text-gray-500">Loading...</div>
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-12">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Team Management</h1>

      {/* User Assignments */}
      <section>
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Assign Users to Teams</h2>
        {loadingUsers ? renderLoading() : (
          <div className="overflow-x-auto rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="w-1/4 p-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                  <th className="w-1/4 p-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Email</th>
                  <th className="w-1/6 p-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Role</th>
                  <th className="w-1/4 p-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Team</th>
                  <th className="w-1/12 p-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                    <td className="p-3 text-sm text-gray-900 dark:text-white">{user.name}</td>
                    <td className="p-3 text-sm text-gray-900 dark:text-gray-300">{user.email}</td>
                    <td className="p-3 text-sm text-gray-900 dark:text-gray-300 capitalize">{user.role.toLowerCase()}</td>
                    <td className="p-3">
                      <select
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        value={user.team_id ?? ''}
                        onChange={e => updateUserTeam(user.id, e.target.value || null)}
                        disabled={savingUserId === user.id}
                      >
                        <option value="">Unassigned</option>
                        {teams.map(team => (
                          <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 text-center text-sm text-gray-500">
                      {savingUserId === user.id ? "Saving..." : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Team Assignments */}
      <section>
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Assign Managers to Teams</h2>
        {loadingTeams ? renderLoading() : (
          <div className="overflow-x-auto rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="w-1/2 p-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Team Name</th>
                  <th className="w-1/3 p-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Manager</th>
                  <th className="w-1/6 p-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {teams.map(team => (
                  <tr key={team.id} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                    <td className="p-3 text-sm text-gray-900 dark:text-white">{team.name}</td>
                    <td className="p-3">
                      <select
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        value={team.manager_id ?? ''}
                        onChange={e => updateTeamManager(team.id, e.target.value || null)}
                        disabled={savingTeamId === team.id}
                      >
                        <option value="">Unassigned</option>
                        {users.filter(u => u.role === 'MANAGER').map(manager => (
                          <option key={manager.id} value={manager.id}>{manager.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 text-center text-sm text-gray-500">
                      {savingTeamId === team.id ? "Saving..." : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
