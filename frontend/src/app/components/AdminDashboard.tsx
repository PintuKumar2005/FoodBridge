import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import {
  deleteAdminDonation,
  deleteAdminFoodRequest,
  deleteAdminUser,
  getAdminUsers,
  getDonations,
  getFoodRequests,
  isAuthError,
  type AuthUser,
  type FoodDonation,
  type FoodRequest,
} from '../api';

interface AdminDashboardProps {
  user: AuthUser;
  onLogout: () => void;
}

type TabKey = 'overview' | 'users' | 'donations' | 'requests';

const tabItems: Array<{ key: TabKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'donations', label: 'Donations', icon: Package },
  { key: 'requests', label: 'Requests', icon: FileText },
];

const statusStyle: Record<string, string> = {
  available: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  requested: 'bg-amber-50 text-amber-700 ring-amber-200',
  collected: 'bg-slate-100 text-slate-700 ring-slate-200',
  pending: 'bg-blue-50 text-blue-700 ring-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
};

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ${statusStyle[value] || statusStyle.pending}`}>
      {value}
    </span>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/70 p-10 text-center text-slate-500 shadow-sm">
      <Package className="mx-auto mb-3 text-emerald-500" size={34} />
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm">New activity will appear here automatically.</p>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not provided' : date.toLocaleString();
}

export default function AdminDashboard({ user, onLogout }: AdminDashboardProps) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [donations, setDonations] = useState<FoodDonation[]>([]);
  const [requests, setRequests] = useState<FoodRequest[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [selectedItem, setSelectedItem] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [usersResponse, donationsResponse, requestsResponse] = await Promise.all([
        getAdminUsers(),
        getDonations(),
        getFoodRequests({}),
      ]);
      setUsers(usersResponse.users);
      setDonations(donationsResponse.donations);
      setRequests(requestsResponse.requests);
    } catch (err) {
      if (isAuthError(err)) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to load live data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This will also delete their donations and requests.')) return;
    try {
      await deleteAdminUser(userId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete user');
    }
  };

  const handleDeleteDonation = async (donationId: string) => {
    if (!confirm('Are you sure you want to delete this donation?')) return;
    try {
      await deleteAdminDonation(donationId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete donation');
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to delete this request?')) return;
    try {
      await deleteAdminFoodRequest(requestId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete request');
    }
  };

  const donors = users.filter((u) => u.type === 'donor');
  const receivers = users.filter((u) => u.type === 'receiver');
  const currentDonations = donations.filter((d) => d.status !== 'collected');
  const availableDonations = donations.filter((d) => d.status === 'available');
  const collectedDonations = donations.filter((d) => d.status === 'collected');
  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const approvedRequests = requests.filter((r) => r.status === 'approved');
  const completionRate = donations.length ? Math.round((collectedDonations.length / donations.length) * 100) : 0;

  const kpis = [
    { label: 'Total Users', value: users.length, detail: `${donors.length} donors • ${receivers.length} receivers`, icon: Users, tone: 'from-emerald-500 to-teal-500' },
    { label: 'Food Donations', value: donations.length, detail: `${availableDonations.length} available • ${collectedDonations.length} collected`, icon: Package, tone: 'from-amber-500 to-orange-500' },
    { label: 'Food Requests', value: requests.length, detail: `${pendingRequests.length} pending • ${approvedRequests.length} approved`, icon: FileText, tone: 'from-sky-500 to-blue-600' },
    { label: 'Success Rate', value: `${completionRate}%`, detail: 'Completed donation flow', icon: TrendingUp, tone: 'from-slate-800 to-slate-600' },
  ];

  const recentDonations = donations.slice(0, 5);

  return (
    <div className="admin-workspace min-h-screen bg-[linear-gradient(180deg,#F8FAFC_0%,#F0FDF4_52%,#ECFDF5_100%)] text-[#111827] dark:bg-[linear-gradient(180deg,#020617_0%,#0B1220_52%,#111827_100%)] dark:text-[#F9FAFB]">
      <div className="mx-auto flex max-w-[1500px] gap-6 px-4 py-5 lg:px-6">
        <aside className="sticky top-5 hidden h-[calc(100vh-40px)] w-72 shrink-0 rounded-[28px] border border-[#E5E7EB] bg-white/90 p-5 shadow-xl shadow-slate-900/5 backdrop-blur-xl dark:border-white/[.08] dark:bg-[#111827]/90 lg:flex lg:flex-col">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#16A34A] to-[#0F766E] text-white shadow-lg shadow-emerald-500/25 dark:from-[#15803D] dark:to-[#0F766E] dark:shadow-emerald-950/40">
              <HeartHandshake size={23} />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight">FoodBridge</p>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Admin OS</p>
            </div>
          </div>

          <div className="mt-8 space-y-2">
            {tabItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                    active ? 'bg-[#111827] text-white shadow-xl shadow-slate-900/20 dark:bg-gradient-to-r dark:from-[#166534] dark:to-[#0F766E] dark:text-white dark:shadow-emerald-950/40' : 'text-[#6B7280] hover:bg-slate-100 dark:text-[#9CA3AF] dark:hover:bg-white/[.06] dark:hover:text-[#F9FAFB]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={18} />
                    {item.label}
                  </span>
                  {item.key === 'requests' && pendingRequests.length > 0 && (
                    <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs text-slate-950">{pendingRequests.length}</span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="mb-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-emerald-700 ring-1 ring-emerald-200">
                    <ShieldCheck size={14} /> Admin Control Center
                  </span>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                    {pendingRequests.length} pending requests
                  </span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-5xl">Good morning, Admin</h1>
                <p className="mt-2 text-slate-500">{user.email} • Real-time FoodBridge operations overview</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={onLogout}
                  className="flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-slate-900/15 transition hover:bg-red-600"
                >
                  <LogOut size={18} />
                  Logout
                </button>
              </div>
            </div>
          </header>

          <div className="mb-6 grid grid-cols-2 gap-3 lg:hidden">
            {tabItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm ${
                    activeTab === item.key ? 'bg-slate-950 text-white' : 'bg-white text-slate-600'
                  }`}
                >
                  <Icon className="mx-auto mb-1" size={18} />
                  {item.label}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {isLoading && (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
              Loading live FoodBridge data...
            </div>
          )}

          {activeTab === 'overview' && (
            <section className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {kpis.map((kpi) => {
                  const Icon = kpi.icon;
                  return (
                    <article key={kpi.label} className="overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-xl shadow-slate-900/5">
                      <div className={`h-2 bg-gradient-to-r ${kpi.tone}`} />
                      <div className="p-5">
                        <div className="mb-5 flex items-center justify-between">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${kpi.tone} text-white shadow-lg`}>
                            <Icon size={23} />
                          </div>
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Live</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-500">{kpi.label}</p>
                        <p className="mt-2 text-4xl font-bold tracking-tight">{kpi.value}</p>
                        <p className="mt-2 text-sm text-slate-500">{kpi.detail}</p>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="grid gap-6 xl:grid-cols-[1fr_0.72fr]">
                <div className="rounded-[28px] border border-white/80 bg-white p-6 shadow-xl shadow-slate-900/5">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-emerald-600">Recent Activity</p>
                      <h2 className="text-2xl font-bold tracking-tight">Donation stream</h2>
                    </div>
                    <button onClick={() => setActiveTab('donations')} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                      View all
                    </button>
                  </div>
                  {recentDonations.length === 0 ? (
                    <EmptyState title="No donations yet" />
                  ) : (
                    <div className="space-y-3">
                      {recentDonations.map((donation) => (
                        <div key={donation.id} className="flex flex-wrap items-center gap-4 rounded-[22px] border border-slate-100 bg-slate-50/70 p-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                            <Package size={21} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-slate-900">{donation.organizationName} donated {donation.foodName}</p>
                            <p className="mt-1 text-sm text-slate-500">{new Date(donation.createdAt).toLocaleString()}</p>
                          </div>
                          <StatusBadge value={donation.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-[28px] border border-white/80 bg-slate-950 p-6 text-white shadow-xl shadow-slate-900/15">
                  <p className="text-sm font-semibold text-emerald-300">Network Health</p>
                  <h2 className="mt-2 text-2xl font-bold">Impact pulse</h2>
                  <div className="mt-8 space-y-5">
                    {[
                      ['Receiver coverage', receivers.length, Math.min(100, receivers.length * 12), HeartHandshake],
                      ['Food availability', availableDonations.length, Math.min(100, availableDonations.length * 16), Package],
                      ['Request approval', approvedRequests.length, Math.min(100, approvedRequests.length * 18), CheckCircle2],
                    ].map(([label, value, width, Icon]) => (
                      <div key={label as string}>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-slate-300"><Icon size={16} />{label as string}</span>
                          <span className="font-semibold">{value as number}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-300" style={{ width: `${width as number}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'users' && (
            <section className="rounded-[28px] border border-white/80 bg-white p-6 shadow-xl shadow-slate-900/5">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-600">User Management</p>
                  <h2 className="text-2xl font-bold tracking-tight">All user data</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">{users.length} total</span>
              </div>
              {users.length === 0 ? (
                <EmptyState title="No users registered" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1240px] border-separate border-spacing-y-3">
                    <thead>
                      <tr className="text-left text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                        <th className="px-4">User ID</th>
                        <th className="px-4">Name</th>
                        <th className="px-4">Organization</th>
                        <th className="px-4">Email</th>
                        <th className="px-4">Phone</th>
                        <th className="px-4">Type</th>
                        <th className="px-4">District</th>
                        <th className="px-4">State</th>
                        <th className="px-4">Pincode</th>
                        <th className="px-4">Status</th>
                        <th className="px-4">Joined</th>
                        <th className="px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="rounded-[20px] bg-slate-50 shadow-sm">
                          <td className="rounded-l-[20px] px-4 py-4 font-mono text-xs text-slate-500">{u.id}</td>
                          <td className="px-4 py-4 font-semibold text-slate-900">{u.name || 'Not provided'}</td>
                          <td className="px-4 py-4 text-slate-600">{u.organizationName}</td>
                          <td className="px-4 py-4 text-slate-600">{u.email}</td>
                          <td className="px-4 py-4 text-slate-600">{u.phone}</td>
                          <td className="px-4 py-4">
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold capitalize text-emerald-700 ring-1 ring-emerald-200">
                              {u.type}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-slate-600">{u.city || 'Not provided'}</td>
                          <td className="px-4 py-4 text-slate-600">{u.state || 'Not provided'}</td>
                          <td className="px-4 py-4 text-slate-600">{u.pincode || 'Not provided'}</td>
                          <td className="px-4 py-4">
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700 ring-1 ring-blue-200">
                              {u.status || 'active'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-slate-600">{formatDate(u.createdAt)}</td>
                          <td className="rounded-r-[20px] px-4 py-4">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setSelectedItem(u)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200 transition hover:text-emerald-600">
                                <Eye size={18} />
                              </button>
                              <button onClick={() => handleDeleteUser(u.id)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100 transition hover:bg-red-600 hover:text-white">
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeTab === 'donations' && (
            <section>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-600">Current Donations</p>
                  <h2 className="text-2xl font-bold tracking-tight">Live donation inventory</h2>
                </div>
                <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm">{currentDonations.length} current • {donations.length} total</span>
              </div>
              {currentDonations.length === 0 ? (
                <EmptyState title="No current food donations found" />
              ) : (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {currentDonations.map((donation) => (
                    <article key={donation.id} className="rounded-[28px] border border-white/80 bg-white p-5 shadow-xl shadow-slate-900/5 transition hover:-translate-y-1 hover:shadow-2xl">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                          <Package size={22} />
                        </div>
                        <StatusBadge value={donation.status} />
                      </div>
                      <h3 className="mt-5 text-xl font-bold text-slate-950">{donation.foodName}</h3>
                      <p className="mt-1 text-sm font-semibold text-emerald-700">{donation.organizationName}</p>
                      <div className="mt-5 space-y-3 text-sm text-slate-600">
                        <p className="flex items-center gap-2"><Package size={16} /> {donation.quantity} {donation.unit}</p>
                        <p className="flex items-start gap-2"><MapPin className="mt-0.5" size={16} /> <span>{donation.location}</span></p>
                        <p className="flex items-center gap-2"><Clock size={16} /> {new Date(donation.pickupTime).toLocaleString()}</p>
                        <p className="text-xs font-semibold text-slate-400">Donation ID: {donation.id}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteDonation(donation.id)}
                        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-600 hover:text-white"
                      >
                        <Trash2 size={16} />
                        Delete Donation
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'requests' && (
            <section className="space-y-4">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-600">Food Requests</p>
                  <h2 className="text-2xl font-bold tracking-tight">Receiver demand queue</h2>
                </div>
                <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm">{requests.length} requests</span>
              </div>
              {requests.length === 0 ? (
                <EmptyState title="No requests submitted" />
              ) : (
                requests.map((request) => (
                  <article key={request.id} className="rounded-[28px] border border-white/80 bg-white p-5 shadow-xl shadow-slate-900/5">
                    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-bold text-slate-950">{request.foodName}</h3>
                          <StatusBadge value={request.status} />
                        </div>
                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                          <div className="rounded-[20px] bg-slate-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Receiver</p>
                            <p className="mt-2 font-semibold text-slate-900">{request.receiverOrg}</p>
                            <p className="text-sm capitalize text-slate-500">{request.receiverType}</p>
                          </div>
                          <div className="rounded-[20px] bg-slate-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Donor</p>
                            <p className="mt-2 font-semibold text-slate-900">{request.donorOrg}</p>
                            <p className="text-sm text-slate-500">{new Date(request.requestedAt).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteRequest(request.id)}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100 transition hover:bg-red-600 hover:text-white"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </article>
                ))
              )}
            </section>
          )}
        </main>
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="bg-gradient-to-br from-slate-950 to-emerald-900 p-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-emerald-200">User Details</p>
                  <h3 className="mt-2 text-2xl font-bold">{selectedItem.name}</h3>
                  <p className="mt-1 text-white/70">{selectedItem.organizationName}</p>
                </div>
                <button onClick={() => setSelectedItem(null)} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white hover:bg-white/20">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="grid gap-3 p-6 text-sm">
              {[
                ['User ID', selectedItem.id],
                ['Email', selectedItem.email],
                ['Phone', selectedItem.phone],
                ['Status', selectedItem.status || 'active'],
                ['User Type', selectedItem.type],
                ['Organization Type', selectedItem.organizationType],
                ['Address', selectedItem.address],
                ['District', selectedItem.city],
                ['State', selectedItem.state],
                ['Pincode', selectedItem.pincode],
                ['Documents', selectedItem.documents ? `${Object.keys(selectedItem.documents).length} uploaded` : 'Not provided'],
                ['Joined', formatDate(selectedItem.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
                  <p className="mt-1 font-semibold text-slate-800">{value || 'Not provided'}</p>
                </div>
              ))}
              <button onClick={() => setSelectedItem(null)} className="mt-2 rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
