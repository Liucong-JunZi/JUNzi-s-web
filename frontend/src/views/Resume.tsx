import { useState, useEffect } from 'react';
import { resumeAPI } from '../api';
import type { ResumeItem } from '../types';
import { SafeMarkdown } from '../components/SafeMarkdown';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Download, Briefcase, GraduationCap, FolderKanban, MapPin } from 'lucide-react';

export function Resume() {
  const [resumeItems, setResumeItems] = useState<ResumeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResume();
  }, []);

  const fetchResume = async () => {
    setLoading(true);
    try {
      const data = await resumeAPI.getAll();
      setResumeItems(data);
    } catch (error) {
      console.error('Failed to fetch resume:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'work':
        return <Briefcase className="h-5 w-5" />;
      case 'education':
        return <GraduationCap className="h-5 w-5" />;
      case 'project':
        return <FolderKanban className="h-5 w-5" />;
      default:
        return <Briefcase className="h-5 w-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      work: 'Work Experience',
      education: 'Education',
      project: 'Project',
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      work: 'bg-blue-500',
      education: 'bg-green-500',
      project: 'bg-purple-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  const handleDownload = () => {
    // Generate markdown content from resume items
    const content = resumeItems
      .map((item) => {
        const header = `## ${item.title}${item.company ? ` at ${item.company}` : ''}`;
        const meta = [
          item.location ? `**Location:** ${item.location}` : '',
          `**Period:** ${formatDate(item.start_date)}${item.end_date ? ` - ${formatDate(item.end_date)}` : ' - Present'}`,
        ]
          .filter(Boolean)
          .join('\n');
        const description = item.description ? `\n${item.description}` : '';
        return `${header}\n${meta}${description}`;
      })
      .join('\n\n');

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = 'resume.md';
    window.document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  // Group items by type
  const groupedItems = resumeItems.reduce((acc, item) => {
    const type = item.type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(item);
    return acc;
  }, {} as Record<string, ResumeItem[]>);

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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-4">Resume</h1>
          <p className="text-muted-foreground">
            Professional experience, education, and projects.
          </p>
        </div>
        {resumeItems.length > 0 && (
          <Button onClick={handleDownload} data-testid="resume-download-btn">
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        )}
      </div>

      {/* Resume Timeline */}
      {resumeItems.length > 0 ? (
        <div className="max-w-4xl mx-auto space-y-12">
          {Object.entries(groupedItems).map(([type, items]) => (
            <div key={type}>
              <div className="flex items-center gap-2 mb-6">
                <div className={`p-2 rounded-lg ${getTypeColor(type)} text-white`}>
                  {getTypeIcon(type)}
                </div>
                <h2 className="text-2xl font-semibold">{getTypeLabel(type)}</h2>
              </div>

              <div className="space-y-6">
                {items
                  .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
                  .map((item) => (
                    <div
                      key={item.id}
                      className="bg-card border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-lg font-semibold">{item.title}</h3>
                          {item.company && (
                            <p className="text-primary font-medium">{item.company}</p>
                          )}
                        </div>
                        <Badge variant="outline">
                          {formatDate(item.start_date)}
                          {item.end_date ? ` - ${formatDate(item.end_date)}` : ' - Present'}
                        </Badge>
                      </div>

                      {item.location && (
                        <div className="flex items-center gap-1 text-muted-foreground text-sm mb-3">
                          <MapPin className="h-4 w-4" />
                          <span>{item.location}</span>
                        </div>
                      )}

                      {item.description && (
                        <div className="prose prose-neutral dark:prose-invert max-w-none text-sm">
                          <SafeMarkdown content={item.description} />
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Briefcase className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No resume content available yet.</p>
        </div>
      )}
    </div>
  );
}
