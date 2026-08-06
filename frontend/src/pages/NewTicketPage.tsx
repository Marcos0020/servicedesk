import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { ticketsApi, usersApi } from '../services/api';
import { PageHeader } from '../components/common';
import CategoryPicker, {
  loadCategories,
  saveCategories,
  loadSubcategories,
  saveSubcategories,
} from '../components/CategoryPicker';

interface FormData {
  title: string;
  description: string;
  requester_name: string;
  requester_email: string;
  category: string;
  subcategory: string;
  responsible_id: string;
}

export default function NewTicketPage() {
  const navigate = useNavigate();
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<string[]>(loadCategories);
  const [subcategories, setSubcategories] = useState<string[]>([]);

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } =
    useForm<FormData>({
      defaultValues: {
        category:    loadCategories()[0] ?? 'SUPORTE',
        subcategory: '',
      },
    });

  const watchCategory = watch('category');

  useEffect(() => {
    const subs = loadSubcategories(watchCategory);
    setSubcategories(subs);
    setValue('subcategory', subs[0] ?? 'OUTRO');
  }, [watchCategory]);

  useEffect(() => {
    usersApi.technicians().then(setTechnicians).catch(() => {});
  }, []);

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      const ticket = await ticketsApi.create({
        title:           data.title,
        description:     data.description || undefined,
        requester_name:  data.requester_name || undefined,
        requester_email: data.requester_email || undefined,
        category:        data.category,
        subcategory:     data.subcategory,
        responsible_id:  data.responsible_id ? Number(data.responsible_id) : undefined,
      });
      toast.success('Chamado aberto com sucesso!');
      navigate(`/chamados/${ticket.ID ?? ticket.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao criar chamado');
    } finally {
      setSaving(false);
    }
  };

  const handleCategoriesChange = (updated: string[]) => {
    saveCategories(updated);
    setCategories(updated);
  };

  const handleSubcategoriesChange = (updated: string[]) => {
    saveSubcategories(watchCategory, updated);
    setSubcategories(updated);
  };

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Novo Chamado"
        subtitle="Preencha as informações do chamado"
        actions={
          <button className="btn-secondary" onClick={() => navigate('/chamados')}>
            <ArrowLeftIcon className="w-4 h-4" />
            Voltar
          </button>
        }
      />

      <div className="card">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>

          <div>
            <label className="form-label">Título *</label>
            <input
              className="form-input"
              placeholder="Descreva o problema brevemente"
              {...register('title', { required: 'Título é obrigatório' })}
            />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="form-label">Descrição</label>
            <textarea rows={4} className="form-input resize-none"
              placeholder="Descreva o problema em detalhes..."
              {...register('description')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Nome do Solicitante</label>
              <input className="form-input" {...register('requester_name')} />
            </div>
            <div>
              <label className="form-label">E-mail do Solicitante</label>
              <input type="email" className="form-input" {...register('requester_email')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Controller name="category" control={control}
                render={({ field }) => (
                  <CategoryPicker kind="category" label="Categoria *"
                    options={categories} value={field.value}
                    onChange={field.onChange} onOptionsChange={handleCategoriesChange} />
                )}
              />
            </div>
            <div>
              <Controller name="subcategory" control={control}
                render={({ field }) => (
                  <CategoryPicker kind="subcategory" label="Subcategoria *"
                    options={subcategories} value={field.value}
                    onChange={field.onChange} onOptionsChange={handleSubcategoriesChange} />
                )}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Responsável (Técnico)</label>
            <select className="form-input" {...register('responsible_id')}>
              <option value="">Não atribuído</option>
              {technicians.map((u) => (
                <option key={u.ID} value={u.ID}>{u.NAME}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => navigate('/chamados')}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Criando...' : 'Criar Chamado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
