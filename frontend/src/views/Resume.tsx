import { useState, useEffect } from 'react';
import { resumeAPI } from '../api';
import type { Resume } from '../types';
import { SafeMarkdown } from '../components/SafeMarkdown';
import { Button } from '../components/ui/button';
import { Download, FileText } from 'lucide-react';

export function Resume() {
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResume();
  }, []);

  const fetchResume = async () => {
    setLoading(true);
    try {
      const data = await resumeAPI.get();
      setResume(data);
    } catch (error) {
      console.error('Failed to fetch resume:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!resume) return;
    // Create a blob with the resume content
    const blob = new Blob([resume.content], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${resume.title.replace(/\s+/g, '_')}.md`;
    window.document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-4">Resume</h1>
          <p className="text-muted-foreground">
            Professional experience, skills, and educational background.
          </p>
        </div>
        <Button onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </div>

      {/* Resume Content */}
      {resume ? (
        <div className="max-w-4xl mx-auto bg-card border rounded-lg p-8 shadow-sm">
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <SafeMarkdown content={resume.content} />
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No resume content available yet.</p>
        </div>
      )}
    </div>
  );
}