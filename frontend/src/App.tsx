import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdminRoute } from './components/ProtectedRoute';
import { Home } from './views/Home';
import { Blog } from './views/Blog';
import { BlogPost } from './views/BlogPost';
import { Portfolio } from './views/Portfolio';
import { PortfolioDetail } from './views/PortfolioDetail';
import { Resume } from './views/Resume';
import { Login } from './views/Login';
import { AuthCallback } from './views/AuthCallback';
import { NotFound } from './views/NotFound';
import { AdminDashboard } from './views/admin/Dashboard';
import { AdminPosts } from './views/admin/AdminPosts';
import { PostEditor } from './views/admin/PostEditor';
import { AdminProjects } from './views/admin/AdminProjects';
import { ProjectEditor } from './views/admin/ProjectEditor';
import { AdminResume } from './views/admin/AdminResume';
import { AdminComments } from './views/admin/AdminComments';
import { Toaster } from './components/ui/toaster';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* Public Routes */}
          <Route index element={<Home />} />
          <Route path="blog" element={<Blog />} />
          <Route path="blog/:slug" element={<BlogPost />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="portfolio/:id" element={<PortfolioDetail />} />
          <Route path="resume" element={<Resume />} />
          <Route path="login" element={<Login />} />

          {/* Auth Callback Route */}
          <Route path="auth/callback" element={<AuthCallback />} />

          {/* Admin Routes */}
          <Route
            path="admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="admin/posts"
            element={
              <AdminRoute>
                <AdminPosts />
              </AdminRoute>
            }
          />
          <Route
            path="admin/posts/new"
            element={
              <AdminRoute>
                <PostEditor />
              </AdminRoute>
            }
          />
          <Route
            path="admin/posts/:id"
            element={
              <AdminRoute>
                <PostEditor />
              </AdminRoute>
            }
          />
          <Route
            path="admin/projects"
            element={
              <AdminRoute>
                <AdminProjects />
              </AdminRoute>
            }
          />
          <Route
            path="admin/projects/new"
            element={
              <AdminRoute>
                <ProjectEditor />
              </AdminRoute>
            }
          />
          <Route
            path="admin/projects/:id"
            element={
              <AdminRoute>
                <ProjectEditor />
              </AdminRoute>
            }
          />
          <Route
            path="admin/comments"
            element={
              <AdminRoute>
                <AdminComments />
              </AdminRoute>
            }
          />
          <Route
            path="admin/resume"
            element={
              <AdminRoute>
                <AdminResume />
              </AdminRoute>
            }
          />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;