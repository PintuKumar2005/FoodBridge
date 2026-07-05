import { useState, useEffect } from 'react';
import { LogOut, Users, Package, FileText, TrendingUp, Trash2, Eye } from 'lucide-react';

interface AdminDashboardProps {
  user: any;
  onLogout: () => void;
}

export default function AdminDashboard({ user, onLogout }: AdminDashboardProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [donations, setDonations] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'donations' | 'requests'>('overview');
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const allUsers = JSON.parse(localStorage.getItem('users') || '[]');
    const allDonations = JSON.parse(localStorage.getItem('foodDonations') || '[]');
    const allRequests = JSON.parse(localStorage.getItem('foodRequests') || '[]');

    setUsers(allUsers.filter((u: any) => u.userCategory !== 'admin'));
    setDonations(allDonations);
    setRequests(allRequests);
  };

  const handleDeleteUser = (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This will also delete their donations and requests.')) return;

    const allUsers = JSON.parse(localStorage.getItem('users') || '[]');
    const updatedUsers = allUsers.filter((u: any) => u.id !== userId);
    localStorage.setItem('users', JSON.stringify(updatedUsers));

    // Delete user's donations
    const allDonations = JSON.parse(localStorage.getItem('foodDonations') || '[]');
    const updatedDonations = allDonations.filter((d: any) => d.donorId !== userId);
    localStorage.setItem('foodDonations', JSON.stringify(updatedDonations));

    // Delete user's requests
    const allRequests = JSON.parse(localStorage.getItem('foodRequests') || '[]');
    const updatedRequests = allRequests.filter((r: any) => r.receiverId !== userId);
    localStorage.setItem('foodRequests', JSON.stringify(updatedRequests));

    loadData();
  };

  const handleDeleteDonation = (donationId: string) => {
    if (!confirm('Are you sure you want to delete this donation?')) return;

    const allDonations = JSON.parse(localStorage.getItem('foodDonations') || '[]');
    const updatedDonations = allDonations.filter((d: any) => d.id !== donationId);
    localStorage.setItem('foodDonations', JSON.stringify(updatedDonations));

    loadData();
  };

  const handleDeleteRequest = (requestId: string) => {
    if (!confirm('Are you sure you want to delete this request?')) return;

    const allRequests = JSON.parse(localStorage.getItem('foodRequests') || '[]');
    const updatedRequests = allRequests.filter((r: any) => r.id !== requestId);
    localStorage.setItem('foodRequests', JSON.stringify(updatedRequests));

    loadData();
  };

  const getStats = () => {
    const donors = users.filter(u => u.userCategory === 'donor');
    const receivers = users.filter(u => u.userCategory === 'receiver');
    const availableDonations = donations.filter(d => d.status === 'available');
    const collectedDonations = donations.filter(d => d.status === 'collected');
    const pendingRequests = requests.filter(r => r.status === 'pending');
    const approvedRequests = requests.filter(r => r.status === 'approved');

    return {
      totalUsers: users.length,
      donors: donors.length,
      receivers: receivers.length,
      totalDonations: donations.length,
      availableDonations: availableDonations.length,
      collectedDonations: collectedDonations.length,
      totalRequests: requests.length,
      pendingRequests: pendingRequests.length,
      approvedRequests: approvedRequests.length
    };
  };

  const stats = getStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <nav className="bg-white shadow-md border-b border-purple-100">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-purple-800">Admin Dashboard</h1>
            <p className="text-sm text-gray-600">{user.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-4 mb-6 flex-wrap">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'overview'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <TrendingUp size={18} className="inline mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'users'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Users size={18} className="inline mr-2" />
            Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('donations')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'donations'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Package size={18} className="inline mr-2" />
            Donations ({donations.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'requests'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <FileText size={18} className="inline mr-2" />
            Requests ({requests.length})
          </button>
        </div>

        {activeTab === 'overview' && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">System Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
                <Users size={32} className="mb-3 opacity-80" />
                <p className="text-3xl font-bold mb-1">{stats.totalUsers}</p>
                <p className="text-blue-100">Total Users</p>
                <div className="mt-3 text-sm">
                  <p>Donors: {stats.donors}</p>
                  <p>Receivers: {stats.receivers}</p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-300 to-emerald-400 text-emerald-950 p-6 rounded-xl shadow-lg">
                <Package size={32} className="mb-3 opacity-80" />
                <p className="text-3xl font-bold mb-1">{stats.totalDonations}</p>
                <p className="text-emerald-100">Total Donations</p>
                <div className="mt-3 text-sm">
                  <p>Available: {stats.availableDonations}</p>
                  <p>Collected: {stats.collectedDonations}</p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg">
                <FileText size={32} className="mb-3 opacity-80" />
                <p className="text-3xl font-bold mb-1">{stats.totalRequests}</p>
                <p className="text-orange-100">Total Requests</p>
                <div className="mt-3 text-sm">
                  <p>Pending: {stats.pendingRequests}</p>
                  <p>Approved: {stats.approvedRequests}</p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
                <TrendingUp size={32} className="mb-3 opacity-80" />
                <p className="text-3xl font-bold mb-1">{stats.collectedDonations}</p>
                <p className="text-purple-100">Successful Donations</p>
                <div className="mt-3 text-sm">
                  <p>Impact: Food distributed</p>
                  <p>to those in need</p>
                </div>
              </div>
            </div>

            <div className="mt-8 bg-white p-6 rounded-xl shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {donations.slice(-5).reverse().map((donation) => (
                  <div key={donation.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Package size={18} className="text-emerald-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">
                        {donation.organizationName} donated {donation.foodType}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(donation.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      donation.status === 'available' ? 'bg-emerald-100 text-emerald-800' :
                      donation.status === 'requested' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {donation.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">User Management</h2>
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-purple-600 text-white">
                  <tr>
                    <th className="px-6 py-3 text-left">Name</th>
                    <th className="px-6 py-3 text-left">Organization</th>
                    <th className="px-6 py-3 text-left">Email</th>
                    <th className="px-6 py-3 text-left">Type</th>
                    <th className="px-6 py-3 text-left">Phone</th>
                    <th className="px-6 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, index) => (
                    <tr key={u.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="px-6 py-4">{u.name}</td>
                      <td className="px-6 py-4">{u.organizationName}</td>
                      <td className="px-6 py-4">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          u.userCategory === 'donor' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {u.organizationType}
                        </span>
                      </td>
                      <td className="px-6 py-4">{u.phone}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedItem(u)}
                          className="mr-2 text-blue-600 hover:text-blue-800"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'donations' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Food Donations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {donations.map((donation) => (
                <div key={donation.id} className="bg-white rounded-lg shadow-md p-6 border border-purple-100">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{donation.foodType}</h3>
                      <p className="text-sm text-gray-600">{donation.organizationName}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      donation.status === 'available' ? 'bg-emerald-100 text-emerald-800' :
                      donation.status === 'requested' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {donation.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600 mb-4">
                    <p>Quantity: {donation.quantity}</p>
                    <p>Location: {donation.location}</p>
                    <p>Pickup: {new Date(donation.pickupTime).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteDonation(donation.id)}
                    className="w-full bg-red-50 text-red-600 py-2 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Food Requests</h2>
            <div className="space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="bg-white rounded-lg shadow-md p-6 border border-purple-100">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">{request.foodType}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          request.status === 'pending' ? 'bg-blue-100 text-blue-700' :
                          request.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {request.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <p className="font-medium">Receiver:</p>
                          <p>{request.receiverOrg}</p>
                          <p className="text-xs">{request.receiverType}</p>
                        </div>
                        <div>
                          <p className="font-medium">Donor:</p>
                          <p>{request.donorOrg}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Requested: {new Date(request.requestedAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteRequest(request.id)}
                      className="ml-4 text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">User Details</h3>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Name:</span> {selectedItem.name}</p>
                <p><span className="font-medium">Organization:</span> {selectedItem.organizationName}</p>
                <p><span className="font-medium">Email:</span> {selectedItem.email}</p>
                <p><span className="font-medium">Phone:</span> {selectedItem.phone}</p>
                <p><span className="font-medium">Address:</span> {selectedItem.address}</p>
                <p><span className="font-medium">Type:</span> {selectedItem.organizationType}</p>
                <p><span className="font-medium">Joined:</span> {new Date(selectedItem.createdAt).toLocaleString()}</p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="mt-4 w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
