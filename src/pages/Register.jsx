import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Eye, EyeOff, Loader2, Mail, Lock, User } from 'lucide-react';
import logo from '@/assets/logo.jpeg';

export default function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const { data, error } = await signUp(email, password, { 
      full_name: fullName,
      role: 'user' // Default role for new registrations
    });

    if (error) {
      setError(error.message || 'Registration failed. Please try again.');
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      // Optional: Auto-redirect to login after a few seconds
      setTimeout(() => navigate('/login'), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#0d1b2e] via-[#0f2744] to-[#0d1b2e] -z-10" />
      <div className="fixed inset-0 opacity-30 -z-10"
        style={{
          background: 'radial-gradient(ellipse at 20% 50%, rgba(32, 178, 170, 0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(32, 178, 170, 0.1) 0%, transparent 50%)'
        }}
      />

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="RazziStaff" className="w-20 h-20 rounded-2xl shadow-2xl mb-4 object-cover" />
          <h1 className="text-2xl font-bold text-white tracking-tight">RazziStaff</h1>
          <p className="text-sm text-white/50 mt-1">HR Management Platform</p>
        </div>

        <Card className="border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
          <CardHeader className="pb-4 pt-6 px-6">
            <h2 className="text-lg font-semibold text-white">Create your account</h2>
            <p className="text-sm text-white/50">Join the internal staff platform</p>
          </CardHeader>

          <CardContent className="px-6 pb-6 space-y-4">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {success ? (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-6 text-sm text-emerald-400 text-center space-y-3">
                <p className="text-lg font-semibold">✓ Registration Successful!</p>
                <p>A verification email has been sent to <strong>{email}</strong>. Please check your inbox to confirm your account.</p>
                <p className="text-xs text-white/40 pt-2">Redirecting to login in a few seconds...</p>
                <Button 
                  onClick={() => navigate('/login')} 
                  variant="link" 
                  className="text-[#20b2aa]"
                >
                  Go to Login now
                </Button>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-xs font-medium uppercase tracking-wider">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-1 focus-visible:ring-[#20b2aa] focus-visible:border-[#20b2aa]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-white/70 text-xs font-medium uppercase tracking-wider">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-1 focus-visible:ring-[#20b2aa] focus-visible:border-[#20b2aa]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-white/70 text-xs font-medium uppercase tracking-wider">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-1 focus-visible:ring-[#20b2aa] focus-visible:border-[#20b2aa]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-white/30">Minimum 6 characters required</p>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#20b2aa] hover:bg-[#1a9a93] text-[#0d1b2e] font-semibold h-11 transition-all"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
                </Button>
              </form>
            )}

            <div className="pt-2 text-center">
              <p className="text-sm text-white/40">
                Already have an account?{' '}
                <Link to="/login" className="text-[#20b2aa] hover:text-[#20b2aa]/80 transition-colors font-medium">
                  Sign In
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-white/25 mt-6">
          © {new Date().getFullYear()} RazziStaff · Powered by Razzi
        </p>
      </div>
    </div>
  );
}
