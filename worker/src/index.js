/**
 * EduGlass LMS — Cloudflare Workers Main Entrypoint (24/7 Serverless Edge)
 * Serves both REST API (/api/v1/*) backed by D1 + R2 and Static SPA Assets ([assets]).
 */
import { errorResponse, jsonResponse, SECURITY_HEADERS } from './core/http.js';
import { checkRateLimit } from './core/security.js';
import { handleAuthRoutes } from './routes/auth.js';
import { handleClassroomRoutes } from './routes/classrooms.js';
import { handleVideoLearningRoutes } from './routes/video_learning.js';
import { handleQuizAssignmentRoutes } from './routes/quizzes_assignments.js';
import { handleAnalyticsReportRoutes } from './routes/analytics_reports.js';
import { handleMiscAdminRoutes } from './routes/notifications_calendar_admin.js';
import { handleSubAccountRoutes } from './routes/sub_accounts.js';

export default {
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: SECURITY_HEADERS });
    }

    // Health check
    if (path === '/api/health') {
      return jsonResponse({
        status: 'ok',
        app: env.EDUGLASS_APP_NAME || 'EduGlass LMS',
        runtime: 'Cloudflare Workers + D1 + R2',
        version: '1.0.0',
      });
    }

    // API Routing
    if (path.startsWith('/api/')) {
      const ip = request.headers.get('CF-Connecting-IP') || 'local';
      const rl = checkRateLimit(`${ip}:${path.slice(0, 24)}`);
      if (!rl.allowed) {
        return jsonResponse(
          { detail: 'Quá nhiều yêu cầu. Vui lòng thử lại sau giây lát.' },
          429,
          { 'Retry-After': String(rl.retryAfter) }
        );
      }

      if (!env.DB) {
        return errorResponse('Cloudflare D1 binding (DB) chưa được cấu hình trong wrangler.toml.', 500);
      }

      try {
        const handlers = [
          handleAuthRoutes,
          handleSubAccountRoutes,
          handleClassroomRoutes,
          handleVideoLearningRoutes,
          handleQuizAssignmentRoutes,
          handleAnalyticsReportRoutes,
          handleMiscAdminRoutes,
        ];
        for (const handler of handlers) {
          const res = await handler(request, env, path);
          if (res) return res;
        }
        return errorResponse('API endpoint không tồn tại.', 404);
      } catch (err) {
        return errorResponse(`Lỗi máy chủ Workers: ${err?.message || 'Unknown error'}`, 500);
      }
    }

    // Serve Static Frontend SPA via Cloudflare Workers [assets]
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response('EduGlass LMS Worker running. Configure [assets] in wrangler.toml to serve frontend.', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
};
