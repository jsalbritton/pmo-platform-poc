import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Gear,
  Bell,
  Shield,
  Palette,
  Brain,
  GitBranch,
  Users,
  Buildings,
  Globe,
  ToggleLeft,
  CaretRight,
  CheckCircle,
} from '@phosphor-icons/react'

/**
 * Settings — Full settings management page for PMO Platform.
 *
 * COMPETITIVE ANALYSIS:
 * ─────────────────────
 * • Most PMO tools bury settings behind 10 clicks (Jira, Monday.com)
 * • Linear: Clean, well-organized settings with clear sections and toggles
 * • Asana: Notification preferences scattered across multiple pages
 *
 * OUR ADVANTAGE:
 * ──────────────
 * Settings as a first-class page with:
 *   - Left sidebar navigation (no accordion collapse fatigue)
 *   - All approval workflow configs visible at once
 *   - ML model tuning directly accessible
 *   - Notification preferences with visual toggles
 *   - Compliance settings (session timeout, audit logs, MFA)
 *   - Integration status at a glance
 *
 * This page demonstrates the VISION of complete settings visibility.
 * For Sprint 1+: Add API endpoints for mutations, real toggle state, form submission.
 */

type SettingSection = 'general' | 'appearance' | 'notifications' | 'workflows' | 'ml' | 'security' | 'integrations'

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingSection>('general')

  // Mock data for approval workflows
  const approvalWorkflows = [
    { id: 'wf-001', name: 'Budget Approval', steps: 3, entity: 'Project Budget', active: true },
    { id: 'wf-002', name: 'Change Request', steps: 4, entity: 'Project Change', active: true },
    { id: 'wf-003', name: 'Resource Allocation', steps: 2, entity: 'Resource', active: true },
    { id: 'wf-004', name: 'Risk Escalation', steps: 5, entity: 'Risk', active: false },
    { id: 'wf-005', name: 'Health Score Review', steps: 2, entity: 'Portfolio Health', active: true },
  ]

  // Mock data for integrations
  const integrations = [
    { name: 'Supabase', icon: GitBranch, status: 'connected', version: 'v1.2.0' },
    { name: 'GitHub', icon: GitBranch, status: 'connected', version: 'Enterprise' },
    { name: 'Railway', icon: Globe, status: 'connected', version: 'Production' },
    { name: 'Slack', icon: Users, status: 'pending', version: 'N/A' },
    { name: 'Azure AD', icon: Buildings, status: 'planned', version: 'Coming Q2' },
    { name: 'OKTA', icon: Shield, status: 'planned', version: 'Coming Q2' },
  ]

  const sections = [
    { id: 'general' as const, label: 'General', icon: Gear },
    { id: 'appearance' as const, label: 'Appearance', icon: Palette },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'workflows' as const, label: 'Approval Workflows', icon: ToggleLeft },
    { id: 'ml' as const, label: 'ML Configuration', icon: Brain },
    { id: 'security' as const, label: 'Security & Compliance', icon: Shield },
    { id: 'integrations' as const, label: 'Integrations', icon: Globe },
  ]

  return (
    <div className="min-h-screen bg-[#f4f6f9] p-8">
      <div className="max-w-7xl mx-auto">
        {/* ──── Header ──────────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600 text-sm">
            Manage organization settings, integrations, and platform configuration
          </p>
        </div>

        <div className="flex gap-8">
          {/* ──── Sidebar Navigation ──────────────────────────────────────── */}
          <div className="w-56 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              {sections.map((section) => {
                const Icon = section.icon
                const isActive = activeSection === section.id
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 border-l-2 border-blue-600'
                        : 'text-gray-700 hover:bg-gray-50 border-l-2 border-transparent'
                    }`}
                  >
                    <Icon size={18} weight={isActive ? 'fill' : 'regular'} />
                    <span>{section.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ──── Main Content ────────────────────────────────────────────── */}
          <div className="flex-1">
            <AnimatePresence mode="wait">
              {activeSection === 'general' && (
                <motion.div
                  key="general"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">General Settings</h2>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Organization Name
                        </label>
                        <input
                          type="text"
                          disabled
                          defaultValue="Global Transportation Inc."
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">Contact an admin to change</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Timezone
                        </label>
                        <input
                          type="text"
                          disabled
                          defaultValue="Eastern Time (ET)"
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date Format
                        </label>
                        <input
                          type="text"
                          disabled
                          defaultValue="MMM DD, YYYY"
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeSection === 'appearance' && (
                <motion.div
                  key="appearance"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Appearance</h2>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Theme
                        </label>
                        <div className="flex gap-3">
                          {['Light', 'Dark', 'System'].map((theme) => (
                            <button
                              key={theme}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                theme === 'Light'
                                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                  : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                              }`}
                            >
                              {theme}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Data Density
                        </label>
                        <div className="flex gap-3">
                          {['Compact', 'Comfortable', 'Spacious'].map((density) => (
                            <button
                              key={density}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                density === 'Comfortable'
                                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                  : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                              }`}
                            >
                              {density}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Accent Color
                        </label>
                        <div className="flex gap-3">
                          {['#003595', '#33BBFF', '#00C896', '#FF6B6B'].map((color) => (
                            <button
                              key={color}
                              className="w-12 h-12 rounded-lg border-2 border-gray-200 hover:border-gray-400 transition-all"
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Alcon color foundation: Navy #003595, Cyan #33BBFF
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeSection === 'notifications' && (
                <motion.div
                  key="notifications"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Notification Preferences</h2>
                    <div className="space-y-4">
                      {[
                        { name: 'Email Digests', desc: 'Daily summary of portfolio updates' },
                        { name: 'Slack Integration', desc: 'Real-time alerts to Slack channel' },
                        { name: 'Approval Alerts', desc: 'Notify when action required' },
                        { name: 'Health Score Changes', desc: 'Alert on significant health changes' },
                        { name: 'SLA Warnings', desc: 'Notify when SLA approaching threshold' },
                      ].map((notif, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{notif.name}</p>
                            <p className="text-xs text-gray-500 mt-1">{notif.desc}</p>
                          </div>
                          <button className="ml-4 w-10 h-6 bg-blue-500 rounded-full relative transition-all hover:bg-blue-600">
                            <span className="absolute right-1 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeSection === 'workflows' && (
                <motion.div
                  key="workflows"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Approval Workflows</h2>
                    <div className="space-y-3">
                      {approvalWorkflows.map((workflow) => (
                        <div
                          key={workflow.id}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{workflow.name}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {workflow.entity} • {workflow.steps} approval steps
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-xs font-medium px-2 py-1 rounded ${
                                workflow.active
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {workflow.active ? 'Active' : 'Inactive'}
                            </span>
                            <button className="text-gray-400 hover:text-gray-600">
                              <CaretRight size={18} weight="bold" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeSection === 'ml' && (
                <motion.div
                  key="ml"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">ML Model Configuration</h2>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Current Model Version
                        </label>
                        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <CheckCircle size={18} className="text-blue-600" weight="fill" />
                          <span className="text-sm font-medium text-blue-900">v2.1.4 (Production)</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Auto-Retrain Enabled
                        </label>
                        <div className="flex items-center">
                          <button className="w-10 h-6 bg-blue-500 rounded-full relative transition-all hover:bg-blue-600">
                            <span className="absolute right-1 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
                          </button>
                          <p className="text-xs text-gray-500 ml-3">Retrains weekly with new project data</p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Confidence Threshold
                        </label>
                        <input
                          type="range"
                          min="0.5"
                          max="0.99"
                          step="0.01"
                          defaultValue="0.75"
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>50%</span>
                          <span className="font-medium text-gray-700">75% (Current)</span>
                          <span>99%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Excluded Signals
                        </label>
                        <div className="text-xs text-gray-600 p-3 bg-gray-50 rounded-lg">
                          None configured. All data sources active.
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeSection === 'security' && (
                <motion.div
                  key="security"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Security & Compliance</h2>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Session Timeout
                        </label>
                        <input
                          type="text"
                          disabled
                          defaultValue="30 minutes of inactivity"
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">21 CFR Part 11.300(c) compliant</p>
                      </div>
                      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Multi-Factor Authentication</p>
                          <p className="text-xs text-gray-500 mt-1">Enforcement for admin accounts</p>
                        </div>
                        <span className="text-sm font-medium px-3 py-1 rounded bg-emerald-50 text-emerald-700">
                          Enabled
                        </span>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Audit Log Retention
                        </label>
                        <input
                          type="text"
                          disabled
                          defaultValue="7 years (per FDA requirement)"
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Data Classification
                        </label>
                        <div className="text-xs text-gray-600 p-3 bg-gray-50 rounded-lg space-y-1">
                          <p>• Internal use only (level 1)</p>
                          <p>• Confidential medical device data (level 2)</p>
                          <p>• Personally identifiable information (PII) - encrypted</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeSection === 'integrations' && (
                <motion.div
                  key="integrations"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Integrations</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {integrations.map((integration) => {
                        const Icon = integration.icon
                        const statusColors: Record<string, string> = {
                          connected: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                          pending: 'bg-amber-50 text-amber-700 border-amber-200',
                          planned: 'bg-gray-100 text-gray-700 border-gray-200',
                        }
                        const statusLabels: Record<string, string> = {
                          connected: '✓ Connected',
                          pending: '◐ Pending',
                          planned: '○ Planned',
                        }
                        return (
                          <div
                            key={integration.name}
                            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 rounded-lg">
                                  <Icon size={20} className="text-gray-700" weight="fill" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {integration.name}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {integration.version}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="mt-3">
                              <span
                                className={`text-xs font-medium px-2 py-1 rounded border ${
                                  statusColors[integration.status]
                                }`}
                              >
                                {statusLabels[integration.status]}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
