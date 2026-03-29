import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { projectsAPI, uploadAPI } from '../../api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Card, CardContent } from '../../components/ui/card';
import { ArrowLeft, Save, Upload } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

type ProjectStatus = 'active' | 'planning' | 'in_progress' | 'completed' | 'archived';

export function ProjectEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    techStack: '',
    status: 'active' as ProjectStatus,
    sortOrder: 0,
    coverImage: '',
    demoUrl: '',
    githubUrl: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) {
      fetchProject();
    }
  }, [id]);

  const fetchProject = async () => {
    setLoading(true);
    try {
      const project = await projectsAPI.getByIdAdmin(Number(id));
      // Handle snake_case field names from backend
      const techStack = project.tech_stack || '';
      setFormData({
        title: project.title,
        description: project.description || '',
        techStack: Array.isArray(techStack) ? techStack.join(', ') : techStack,
        status: project.status || 'active',
        sortOrder: project.sort_order || 0,
        coverImage: project.cover_image || '',
        demoUrl: project.demo_url || '',
        githubUrl: project.github_url || '',
      });
    } catch (error) {
      console.error('Failed to fetch project:', error);
      toast({
        title: 'Error',
        description: 'Failed to load project',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'sortOrder' ? parseInt(value) || 0 : value,
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadAPI.uploadImage(file);
      setFormData((prev) => ({ ...prev, coverImage: result.url }));
      toast({
        title: 'Success',
        description: 'Image uploaded successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to upload image',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const projectData = {
        title: formData.title,
        description: formData.description,
        tech_stack: formData.techStack.split(',').map(t => t.trim()).filter(Boolean).join(','),
        status: formData.status,
        sort_order: formData.sortOrder,
        cover_image: formData.coverImage,
        demo_url: formData.demoUrl,
        github_url: formData.githubUrl,
      };

      if (isEdit) {
        await projectsAPI.update(Number(id), projectData);
        toast({
          title: 'Success',
          description: 'Project updated successfully',
        });
      } else {
        const project = await projectsAPI.create(projectData);
        toast({
          title: 'Success',
          description: 'Project created successfully',
        });
        navigate(`/admin/projects/${project.id}`);
        return;
      }

      navigate('/admin/projects');
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${isEdit ? 'update' : 'create'} project`,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12" data-testid="project-editor-page">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/admin/projects" data-testid="back-to-projects-btn">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Link>
        </Button>
        <h1 className="text-4xl font-bold">{isEdit ? 'Edit Project' : 'Create New Project'}</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    placeholder="Enter project title"
                    data-testid="project-title-input"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    required
                    rows={3}
                    placeholder="Brief description of the project"
                    data-testid="project-description-input"
                  />
                </div>

                <div>
                  <Label htmlFor="techStack">Tech Stack (comma-separated)</Label>
                  <Input
                    id="techStack"
                    name="techStack"
                    value={formData.techStack}
                    onChange={handleChange}
                    placeholder="React, TypeScript, Go, PostgreSQL"
                    data-testid="project-tech-stack-input"
                  />
                </div>

                <div>
                  <Label htmlFor="demoUrl">Demo URL</Label>
                  <Input
                    id="demoUrl"
                    name="demoUrl"
                    type="url"
                    value={formData.demoUrl}
                    onChange={handleChange}
                    placeholder="https://demo.example.com"
                    data-testid="project-demo-url-input"
                  />
                </div>

                <div>
                  <Label htmlFor="githubUrl">GitHub URL</Label>
                  <Input
                    id="githubUrl"
                    name="githubUrl"
                    type="url"
                    value={formData.githubUrl}
                    onChange={handleChange}
                    placeholder="https://github.com/user/repo"
                    data-testid="project-github-url-input"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                    data-testid="project-status-select"
                  >
                    <option value="active">Active</option>
                    <option value="planning">Planning</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="sortOrder">Sort Order</Label>
                  <Input
                    id="sortOrder"
                    name="sortOrder"
                    type="number"
                    value={formData.sortOrder}
                    onChange={handleChange}
                    min={0}
                    data-testid="project-sort-order-input"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={saving} data-testid="project-save-btn">
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Project'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <Label>Cover Image</Label>
                {formData.coverImage && (
                  <img
                    src={formData.coverImage}
                    alt="Cover"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                )}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="cover-image"
                    data-testid="project-cover-image-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => document.getElementById('cover-image')?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Image
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
