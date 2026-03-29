import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { postsAPI, projectsAPI } from '../../api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { FileText, Briefcase, MessageCircle, File } from 'lucide-react';

interface DashboardStats {
  postsCount: number;
  projectsCount: number;
  commentsCount: number;
}

export function AdminDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats>({
    postsCount: 0,
    projectsCount: 0,
    commentsCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [postsRes, projectsRes] = await Promise.all([
        postsAPI.adminListPosts({ limit: 1 }),
        projectsAPI.adminListProjects({ limit: 1 }),
      ]);

      setStats({
        postsCount: postsRes.total,
        projectsCount: projectsRes.total,
        commentsCount: 0, // Would need a separate endpoint
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      title: 'Create Post',
      description: 'Write a new blog post',
      icon: FileText,
      href: '/admin/posts/new',
    },
    {
      title: 'Add Project',
      description: 'Add a new portfolio project',
      icon: Briefcase,
      href: '/admin/projects/new',
    },
    {
      title: 'Edit Resume',
      description: 'Update your resume',
      icon: File,
      href: '/admin/resume',
    },
  ];

  const getActionTestId = (title: string): string | undefined => {
    switch (title) {
      case 'Create Post': return 'create-post-action';
      case 'Add Project': return 'create-project-action';
      case 'Edit Resume': return 'edit-resume-quick-action';
      default: return undefined;
    }
  };

  return (
    <div className="container mx-auto px-4 py-12" data-testid="admin-dashboard">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.username}!</p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.postsCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.projectsCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Comments</CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.commentsCount}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <Card key={action.title} className="hover:shadow-lg transition-shadow" data-testid={getActionTestId(action.title)}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <action.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{action.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{action.description}</p>
                    <Button asChild size="sm">
                      <Link to={action.href}>Go</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Navigation Cards */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Manage Content</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button asChild variant="outline" className="h-24">
            <Link to="/admin/posts" className="flex flex-col gap-2" data-testid="manage-posts-action">
              <FileText className="h-6 w-6" />
              <span>Manage Posts</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24">
            <Link to="/admin/projects" className="flex flex-col gap-2" data-testid="manage-projects-action">
              <Briefcase className="h-6 w-6" />
              <span>Manage Projects</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24">
            <Link to="/admin/comments" className="flex flex-col gap-2" data-testid="manage-comments-action">
              <MessageCircle className="h-6 w-6" />
              <span>Manage Comments</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24">
            <Link to="/admin/resume" className="flex flex-col gap-2" data-testid="edit-resume-action">
              <File className="h-6 w-6" />
              <span>Edit Resume</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}