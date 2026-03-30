import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../../i18n';
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
  const { t } = useTranslation();
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
      title: t('admin.dashboard.createPost'),
      description: t('admin.dashboard.createPostDesc'),
      icon: FileText,
      href: '/admin/posts/new',
    },
    {
      title: t('admin.dashboard.addProject'),
      description: t('admin.dashboard.addProjectDesc'),
      icon: Briefcase,
      href: '/admin/projects/new',
    },
    {
      title: t('admin.dashboard.editResume'),
      description: t('admin.dashboard.editResumeDesc'),
      icon: File,
      href: '/admin/resume',
    },
  ];

  const getActionTestId = (title: string): string | undefined => {
    switch (title) {
      case t('admin.dashboard.createPost'): return 'create-post-action';
      case t('admin.dashboard.addProject'): return 'create-project-action';
      case t('admin.dashboard.editResume'): return 'edit-resume-quick-action';
      default: return undefined;
    }
  };

  return (
    <div className="container mx-auto px-4 py-12" data-testid="admin-dashboard">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{t('admin.dashboard.title')}</h1>
        <p className="text-muted-foreground">{t('admin.dashboard.welcome', { username: user?.username })}</p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="text-center py-8">{t('common.loading')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.dashboard.totalPosts')}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.postsCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.dashboard.totalProjects')}</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.projectsCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.dashboard.totalComments')}</CardTitle>
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
        <h2 className="text-2xl font-bold mb-4">{t('admin.dashboard.quickActions')}</h2>
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
        <h2 className="text-2xl font-bold mb-4">{t('admin.dashboard.manageContent')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button asChild variant="outline" className="h-24">
            <Link to="/admin/posts" className="flex flex-col gap-2" data-testid="manage-posts-action">
              <FileText className="h-6 w-6" />
              <span>{t('admin.dashboard.managePosts')}</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24">
            <Link to="/admin/projects" className="flex flex-col gap-2" data-testid="manage-projects-action">
              <Briefcase className="h-6 w-6" />
              <span>{t('admin.dashboard.manageProjects')}</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24">
            <Link to="/admin/comments" className="flex flex-col gap-2" data-testid="manage-comments-action">
              <MessageCircle className="h-6 w-6" />
              <span>{t('admin.dashboard.manageComments')}</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24">
            <Link to="/admin/resume" className="flex flex-col gap-2" data-testid="edit-resume-action">
              <File className="h-6 w-6" />
              <span>{t('admin.dashboard.editResumeBtn')}</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}