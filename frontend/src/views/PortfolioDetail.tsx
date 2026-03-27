import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsAPI } from '../api';
import type { Project } from '../types';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ExternalLink, ArrowLeft, Calendar } from 'lucide-react';

// Custom Github icon
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

export function PortfolioDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchProject();
    }
  }, [id]);

  const fetchProject = async () => {
    setLoading(true);
    try {
      const data = await projectsAPI.getById(Number(id));
      setProject(data);
    } catch (error) {
      console.error('Failed to fetch project:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });
  };

  // Helper to get field from project
  const getCoverImage = (project: Project) => project.cover_image;
  const getGithubUrl = (project: Project) => project.github_url;
  const getDemoUrl = (project: Project) => project.demo_url;
  const getTechStack = (project: Project): string[] => {
    const tech = project.tech_stack;
    if (Array.isArray(tech)) return tech;
    if (typeof tech === 'string' && tech) return tech.split(',').map((t: string) => t.trim()).filter(Boolean);
    return [];
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      active: 'Active',
      planning: 'Planning',
      in_progress: 'In Progress',
      completed: 'Completed',
      archived: 'Archived',
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      active: 'bg-emerald-500',
      planning: 'bg-yellow-500',
      in_progress: 'bg-blue-500',
      completed: 'bg-green-500',
      archived: 'bg-gray-500',
    };
    return colorMap[status] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Project not found</h1>
          <Button asChild>
            <Link to="/portfolio">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Portfolio
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Back Button */}
      <Button variant="ghost" asChild className="mb-6">
        <Link to="/portfolio">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Portfolio
        </Link>
      </Button>

      <article className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-4xl font-bold">{project.title}</h1>
            <Badge className={`${getStatusColor(project.status)} text-white`}>
              {getStatusLabel(project.status)}
            </Badge>
          </div>
          <p className="text-xl text-muted-foreground mb-4">{project.description}</p>

          <div className="flex flex-wrap items-center gap-4 mb-4">
            {getGithubUrl(project) && (
              <Button asChild>
                <a href={getGithubUrl(project)!} target="_blank" rel="noopener noreferrer">
                  <GithubIcon className="mr-2 h-4 w-4" />
                  View Code
                </a>
              </Button>
            )}
            {getDemoUrl(project) && (
              <Button variant="outline" asChild>
                <a href={getDemoUrl(project)!} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Live Demo
                </a>
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>
                {formatDate(project.created_at)}
              </span>
            </div>
          </div>

          {/* Tech Stack */}
          {getTechStack(project).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {getTechStack(project).map((tech, index) => (
                <Badge key={index} variant="secondary">
                  {tech}
                </Badge>
              ))}
            </div>
          )}
        </header>

        {/* Cover Image */}
        {getCoverImage(project) && (
          <img
            src={getCoverImage(project)!}
            alt={project.title}
            className="w-full h-[400px] object-cover rounded-lg mb-8"
          />
        )}
      </article>
    </div>
  );
}