import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { TicketIcon } from '@heroicons/react/24/outline';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

interface FormData { email: string; password: string; }

export default function LoginPage() {
  const navigate = useNavigate();
  const login    = useAuthStore((s) => s.login);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await authApi.login(data.email, data.password);
      login(res.access_token, res.user);
      toast.success(`Bem-vindo, ${res.user.name}!`);
      navigate('/');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Credenciais inválidas';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 to-brand-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-brand-800 px-8 py-8 text-center">
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <TicketIcon className="w-8 h-8 text-brand-700" />
            </div>
            <h1 className="text-white text-2xl font-bold">Service Desk</h1>
            <p className="text-blue-200 text-sm mt-1">Sistema de Chamados</p>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <h2 className="text-gray-800 text-lg font-semibold mb-6">Acesso ao Sistema</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div>
                <label className="form-label">E-mail</label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  className="form-input"
                  {...register('email', {
                    required: 'E-mail é obrigatório',
                    pattern: { value: /\S+@\S+\.\S+/, message: 'E-mail inválido' },
                  })}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="form-label">Senha</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="form-input"
                  {...register('password', { required: 'Senha é obrigatória' })}
                />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <p className="text-xs text-gray-400 text-center mt-6">
              Acesso restrito a usuários autorizados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
