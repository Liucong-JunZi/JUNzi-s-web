import { useState, useEffect } from 'react';
import { resumeAPI } from '../../api';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Save } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

export function AdminResume() {
  const [title, setTitle] = useState('My Resume');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchResume();
  }, []);

  const fetchResume = async () => {
    setLoading(true);
    try {
      const resume = await resumeAPI.get();
      setTitle(resume.title);
      setContent(resume.content);
    } catch (error) {
      console.error('Failed to fetch resume:', error);
      // If no resume exists, start with default content
      setContent(`# John Doe

## Contact
- Email: john@example.com
- Phone: (555) 123-4567
- Location: San Francisco, CA
- LinkedIn: linkedin.com/in/johndoe
- GitHub: github.com/johndoe

## Summary
Experienced software developer with a passion for building scalable web applications and solving complex problems. Proficient in modern web technologies and cloud infrastructure.

## Experience

### Senior Software Engineer
**Tech Company** | *2020 - Present*
- Led development of microservices architecture serving 1M+ users
- Implemented CI/CD pipelines reducing deployment time by 60%
- Mentored junior developers and conducted code reviews

### Software Engineer
**Startup Inc** | *2018 - 2020*
- Developed RESTful APIs using Node.js and Express
- Built responsive frontends with React and TypeScript
- Improved application performance by 40% through optimization

## Skills
- **Languages**: TypeScript, JavaScript, Python, Go
- **Frontend**: React, Vue.js, Next.js, Tailwind CSS
- **Backend**: Node.js, Express, PostgreSQL, MongoDB
- **DevOps**: Docker, Kubernetes, AWS, CI/CD
- **Tools**: Git, Linux, VS Code

## Education

### Bachelor of Science in Computer Science
**University Name** | *2014 - 2018*
- GPA: 3.8/4.0
- Dean's List: 6 semesters
- Relevant coursework: Data Structures, Algorithms, Software Engineering

## Projects

### Personal Blog Platform
- Full-stack blog application with React and Go
- Features: Markdown support, comment system, admin dashboard
- Technologies: React, TypeScript, Gin, PostgreSQL, Redis

### Task Management App
- Real-time collaborative task management tool
- Implemented WebSocket for real-time updates
- Technologies: Vue.js, Node.js, Socket.io, MongoDB
`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await resumeAPI.update({ title, content });
      toast({
        title: 'Success',
        description: 'Resume updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update resume',
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
        <h1 className="text-4xl font-bold mb-2">Edit Resume</h1>
        <p className="text-muted-foreground">
          Update your resume content using Markdown formatting
        </p>
      </div>

      {/* Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Editor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Resume Title"
              />
            </div>

            <div>
              <Label htmlFor="content">Content (Markdown)</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={30}
                className="font-mono text-sm"
                placeholder="Write your resume in Markdown..."
              />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Resume'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-neutral dark:prose-invert max-w-none min-h-[600px]">
              <pre className="whitespace-pre-wrap text-sm">{content}</pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}