import { useState } from 'react';
import { UtensilsCrossed, Heart, Shield, Mail, Lock, Building2, Phone, MapPin } from 'lucide-react';

interface AuthProps {
  onLogin: (user: { email: string; type: string; id: string; name: string; organizationName: string; organizationType: string }) => void;
}

type UserCategory = 'donor' | 'receiver' | 'admin';
type DonorType = 'restaurant' | 'hotel';
type ReceiverType = 'ngo' | 'orphanage' | 'old_age_home';

export default function Auth({ onLogin }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [userCategory, setUserCategory] = useState<UserCategory>('donor');
  const [donorType, setDonorType] = useState<DonorType>('restaurant');
  const [receiverType, setReceiverType] = useState<ReceiverType>('ngo');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const users = JSON.parse(localStorage.getItem('users') || '[]');

    if (isLogin) {
      // Login logic
      const user = users.find((u: any) => u.email === email && u.password === password);
      if (user) {
        onLogin({
          email: user.email,
          type: user.userCategory,
          id: user.id,
          name: user.name,
          organizationName: user.organizationName,
          organizationType: user.organizationType
        });
      } else {
        alert('Invalid credentials');
      }
    } else {
      // Register logic
      const existingUser = users.find((u: any) => u.email === email);
      if (existingUser) {
        alert('User already exists with this email');
        return;
      }

      const organizationType = userCategory === 'donor' ? donorType : userCategory === 'receiver' ? receiverType : 'admin';

      const newUser = {
        id: Date.now().toString(),
        email,
        password,
        name,
        organizationName,
        phone,
        address,
        userCategory,
        organizationType,
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      localStorage.setItem('users', JSON.stringify(users));

      onLogin({
        email: newUser.email,
        type: newUser.userCategory,
        id: newUser.id,
        name: newUser.name,
        organizationName: newUser.organizationName,
        organizationType: newUser.organizationType
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-emerald-50 to-teal-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Heart className="text-emerald-500" size={40} />
            <h1 className="text-4xl font-bold text-gray-800">Food Donation System</h1>
          </div>
          <p className="text-gray-600 text-lg">
            {isLogin ? 'Welcome back! Fighting hunger together' : 'Join us in reducing food waste'}
          </p>
        </div>

        {!isLogin && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Register As</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setUserCategory('donor')}
                className={`py-4 px-4 rounded-lg flex flex-col items-center justify-center gap-2 transition-all ${
                  userCategory === 'donor'
                    ? 'bg-emerald-400 text-emerald-950 shadow-lg ring-2 ring-emerald-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <UtensilsCrossed size={24} />
                <span className="text-sm font-semibold">Food Donor</span>
              </button>
              <button
                type="button"
                onClick={() => setUserCategory('receiver')}
                className={`py-4 px-4 rounded-lg flex flex-col items-center justify-center gap-2 transition-all ${
                  userCategory === 'receiver'
                    ? 'bg-emerald-400 text-emerald-950 shadow-lg ring-2 ring-emerald-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Heart size={24} />
                <span className="text-sm font-semibold">Receiver</span>
              </button>
              <button
                type="button"
                onClick={() => setUserCategory('admin')}
                className={`py-4 px-4 rounded-lg flex flex-col items-center justify-center gap-2 transition-all ${
                  userCategory === 'admin'
                    ? 'bg-emerald-400 text-emerald-950 shadow-lg ring-2 ring-emerald-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Shield size={24} />
                <span className="text-sm font-semibold">Admin</span>
              </button>
            </div>

            {userCategory === 'donor' && (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setDonorType('restaurant')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                    donorType === 'restaurant'
                      ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Restaurant
                </button>
                <button
                  type="button"
                  onClick={() => setDonorType('hotel')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                    donorType === 'hotel'
                      ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Hotel
                </button>
              </div>
            )}

            {userCategory === 'receiver' && (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setReceiverType('ngo')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                    receiverType === 'ngo'
                      ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  NGO
                </button>
                <button
                  type="button"
                  onClick={() => setReceiverType('orphanage')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                    receiverType === 'orphanage'
                      ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Orphanage
                </button>
                <button
                  type="button"
                  onClick={() => setReceiverType('old_age_home')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                    receiverType === 'old_age_home'
                      ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Old Age Home
                </button>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="Enter name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organization Name
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      placeholder="Organization name"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="+1 (555) 000-0000"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-gray-400" size={18} />
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                    placeholder="Full address"
                    rows={2}
                    required
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="your@email.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Enter password"
                required
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-emerald-300 to-emerald-400 text-emerald-950 py-3 rounded-lg hover:from-emerald-200 hover:to-emerald-300 transition-all font-semibold shadow-lg text-lg"
          >
            {isLogin ? 'Login to Continue' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-emerald-500 hover:text-emerald-700 font-medium"
          >
            {isLogin ? "Don't have an account? Register Now" : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
}
