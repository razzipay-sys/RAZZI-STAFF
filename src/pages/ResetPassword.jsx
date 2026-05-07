import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import logo from '@/assets/logo.jpeg';
import { toast } from 'sonner';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message || 'Failed to reset password');
      setLoading(false);
    } else {
      toast.success('Password updated successfully');
      setLoading(false);
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-gradient-to-br from-[#0d1b2e] via-[#0f2744] to-[#0d1b2e] -z-10" />
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="RazziStaff" className="w-20 h-20 rounded-2xl shadow-2xl mb-4 object-cover" />
          <h1 className="text-2xl font-bold text-white tracking-tight">RazziStaff</h1>
          <p className="text-sm text-white/50 mt-1">Reset your account password</p>
        </div>

        <Card className="border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
          <CardHeader className="pb-4 pt-6 px-6">
            <h2 className="text-lg font-semibold text-white">New Password</h2>
            <p className="text-sm text-white/50">Enter a secure password for your account</p>
          </CardHeader>

          <CardContent className="px-6 pb-6">
            <form onSubmit={handleReset} className="space-y-4">
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
                    className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-1 focus-visible:ring-[#20b2aa]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs font-medium uppercase tracking-wider">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-1 focus-visible:ring-[#20b2aa]"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#20b2aa] hover:bg-[#1a9a93] text-[#0d1b2e] font-semibold h-11 transition-all"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
