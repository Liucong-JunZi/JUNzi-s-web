import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { postsAPI, tagsAPI, uploadAPI } from '../../api';
import type { Tag } from '../../types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { ArrowLeft, Save, Upload } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

type PostStatus = 'draft' | 'published';

export function PostEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    summary: '',
    coverImage: '',
    status: 'draft' as PostStatus,
  });
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTags();
    if (isEdit) {
      fetchPost();
    }
  }, [id]);

  const fetchTags = async () => {
    try {
      const tags = await tagsAPI.getAll();
      setAvailableTags(tags);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  };

  const fetchPost = async () => {
    setLoading(true);
    try {
      // Use getById for admin editing
      const post = await postsAPI.getById(Number(id));
      setFormData({
        title: post.title,
        slug: post.slug,
        content: post.content,
        summary: post.summary || '',
        coverImage: post.cover_image || '',
        status: post.status || 'draft',
      });
      setSelectedTags(post.tags.map((t) => t.id));
    } catch (error) {
      console.error('Failed to fetch post:', error);
      toast({
        title: 'Error',
        description: 'Failed to load post',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Auto-generate slug from title
    if (name === 'title' && !isEdit) {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setFormData((prev) => ({ ...prev, slug }));
    }
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

  const toggleTag = (tagId: number) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const postData = {
        title: formData.title,
        slug: formData.slug,
        content: formData.content,
        summary: formData.summary,
        coverImage: formData.coverImage,
        status: formData.status,
        tags: selectedTags,  // Will be mapped to tag_ids in API layer
      };

      if (isEdit) {
        await postsAPI.update(Number(id), postData as any);
        toast({
          title: 'Success',
          description: 'Post updated successfully',
        });
      } else {
        const post = await postsAPI.create(postData as any);
        toast({
          title: 'Success',
          description: 'Post created successfully',
        });
        navigate(`/admin/posts/${post.id}`);
        return;
      }

      navigate('/admin/posts');
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${isEdit ? 'update' : 'create'} post`,
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
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/admin/posts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Posts
          </Link>
        </Button>
        <h1 className="text-4xl font-bold">{isEdit ? 'Edit Post' : 'Create New Post'}</h1>
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
                    placeholder="Enter post title"
                    data-testid="post-title-input"
                  />
                </div>

                <div>
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    name="slug"
                    value={formData.slug}
                    onChange={handleChange}
                    required
                    placeholder="post-url-slug"
                    data-testid="post-slug-input"
                  />
                </div>

                <div>
                  <Label htmlFor="content">Content (Markdown)</Label>
                  <Textarea
                    id="content"
                    name="content"
                    value={formData.content}
                    onChange={handleChange}
                    required
                    rows={20}
                    placeholder="Write your post content in Markdown..."
                    data-testid="post-content-input"
                  />
                </div>

                <div>
                  <Label htmlFor="summary">Summary</Label>
                  <Textarea
                    id="summary"
                    name="summary"
                    value={formData.summary}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Brief description of the post"
                    data-testid="post-summary-input"
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
                    onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as PostStatus }))}
                    className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                    data-testid="post-status-select"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>

                <Button type="submit" className="w-full" disabled={saving} data-testid="post-save-btn">
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Post'}
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
                    className="sr-only"
                    id="cover-image"
                    data-testid="cover-image-upload"
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

            <Card>
              <CardContent className="pt-6 space-y-4">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={selectedTags.includes(tag.id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleTag(tag.id)}
                      data-testid={`tag-badge-${tag.id}`}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
