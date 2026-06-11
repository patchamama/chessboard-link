import { useState } from 'react'
import PendingUsersTable from './PendingUsersTable'
import ActiveUsersTable from './ActiveUsersTable'
import BlockedUsersTable from './BlockedUsersTable'

type Tab = 'Pending' | 'Active' | 'Blocked'

const tabs: Tab[] = ['Pending', 'Active', 'Blocked']

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Pending')

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-white text-blue-700 shadow border border-b-white border-slate-200'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Pending' && <PendingUsersTable />}
      {activeTab === 'Active' && <ActiveUsersTable />}
      {activeTab === 'Blocked' && <BlockedUsersTable />}
    </div>
  )
}
