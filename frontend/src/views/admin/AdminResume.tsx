import { useState, useEffect } from 'react';
import { resumeAPI } from '../../api';
import type { ResumeItem } from '../../types';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Plus, Save, Trash2, Edit, X } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

type ResumeItemType = 'work' | 'education' | 'project';

interface FormData {
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
  type: ResumeItemType;
  sort_order: number;
}

const emptyForm: FormData = {
  title: '',
  company: '',
  location: '',
  startDate: '',
  endDate: '',
  description: '',
  type: 'work',
  sort_order: 0,
};

export function AdminResume() {
  const [items, setItems] = useState<ResumeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const { toast } = useToast();

  useEffect(() => {
    fetchResume();
  }, []);

  const fetchResume = async () => {
    setLoading(true);
    try {
      const data = await resumeAPI.getAll();
      setItems(data);
    } catch (error) {
      console.error('Failed to fetch resume:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
  };

  const handleEdit = (item: ResumeItem) => {
    setEditingId(item.id);
    setFormData({
      title: item.title,
      company: item.company || '',
      location: item.location || '',
      startDate: item.start_date ? item.start_date.split('T')[0] : '',
      endDate: item.end_date ? item.end_date.split('T')[0] : '',
      description: item.description || '',
      type: item.type,
      sort_order: item.sort_order ?? 0,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Map camelCase form fields to snake_case for backend
      const data = {
        title: formData.title,
        company: formData.company || undefined,
        location: formData.location || undefined,
        start_date: formData.startDate,
        end_date: formData.endDate || undefined,
        description: formData.description || undefined,
        type: formData.type,
        sort_order: formData.sort_order,
      };

      if (editingId) {
        await resumeAPI.update(editingId, data);
        toast({
          title: 'Success',
          description: 'Resume item updated successfully',
        });
      } else {
        await resumeAPI.create(data);
        toast({
          title: 'Success',
          description: 'Resume item created successfully',
        });
      }

      resetForm();
      fetchResume();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${editingId ? 'update' : 'create'} resume item`,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      await resumeAPI.delete(id);
      setItems(items.filter((item) => item.id !== id));
      if (editingId === id) {
        resetForm();
      }
      toast({
        title: 'Success',
        description: 'Resume item deleted successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete resume item',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  };

  // Helper functions removed - using item.start_date / item.end_date directly

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12" data-testid="admin-resume-page">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Edit Resume</h1>
        <p className="text-muted-foreground">
          Manage your professional experience, education, and projects
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{editingId ? 'Edit Item' : 'Add New Item'}</CardTitle>
              {editingId && (
                <Button variant="ghost" size="sm" onClick={resetForm} data-testid="cancel-edit-btn">
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                  data-testid="resume-type-select"
                >
                  <option value="work">Work Experience</option>
                  <option value="education">Education</option>
                  <option value="project">Project</option>
                </select>
              </div>

              <div>
                <Label htmlFor="title">Title / Position</Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  placeholder="Software Engineer"
                  data-testid="resume-title-input"
                />
              </div>

              <div>
                <Label htmlFor="company">Company / Institution</Label>
                <Input
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  placeholder="Company Name"
                  data-testid="resume-company-input"
                />
              </div>

              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="San Francisco, CA"
                  data-testid="resume-location-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={handleChange}
                    required
                    data-testid="resume-start-date-input"
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date (leave empty if current)</Label>
                  <Input
                    id="endDate"
                    name="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={handleChange}
                    data-testid="resume-end-date-input"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description (Markdown)</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={6}
                  placeholder="Describe your responsibilities and achievements..."
                  data-testid="resume-description-input"
                />
              </div>

              <Button type="submit" disabled={saving} className="w-full" data-testid="resume-save-btn">
                {saving ? 'Saving...' : editingId ? 'Update Item' : 'Add Item'}
                {!saving && (editingId ? <Save className="ml-2 h-4 w-4" /> : <Plus className="ml-2 h-4 w-4" />)}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Items List */}
        <Card>
          <CardHeader>
            <CardTitle>Resume Items ({items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No resume items yet. Add your first item using the form.
              </p>
            ) : (
              <div className="space-y-4">
                {items
                  .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
                  .map((item) => (
                    <div
                      key={item.id}
                      className={`border rounded-lg p-4 ${
                        editingId === item.id ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{item.title}</h4>
                          {item.company && (
                            <p className="text-sm text-muted-foreground">{item.company}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(item.start_date)}
                            {item.end_date ? ` - ${formatDate(item.end_date)}` : ' - Present'}
                          </p>
                          <span className="inline-block mt-2 px-2 py-1 text-xs rounded bg-muted capitalize">
                            {item.type}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(item)}
                            data-testid={`edit-resume-btn-${item.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
                            data-testid={`delete-resume-btn-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}