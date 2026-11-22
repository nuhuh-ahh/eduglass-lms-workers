/**
 * EduGlass LMS — Shared TypeScript Contract Definitions
 * Shared between frontend ES modules (JSDoc @ts-check) and backend Pydantic schemas.
 */

export type UserRole = 'super_admin' | 'school_admin' | 'teacher' | 'student';
export type ThemeMode = 'liquid-glass' | 'classic-education';
export type LanguageCode = 'vi' | 'en';
export type AnimationLevel = 'full' | 'reduced' | 'none';
export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'multiple_select'
  | 'fill_blank'
  | 'short_answer'
  | 'matching';

export interface UserProfile {
  id: string;
  school_id?: string | null;
  role_name: UserRole;
  email: string;
  full_name: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  email_verified?: boolean;
}

export interface UserPreferences {
  theme_mode: ThemeMode;
  language: LanguageCode;
  accent_color: string;
  wallpaper: string;
  glass_opacity: number;
  glass_blur: number;
  animation_level: AnimationLevel;
  sound_enabled: boolean;
}

export interface VideoQuestion {
  id: string;
  lesson_id: string;
  question_type: QuestionType;
  title: string;
  description: string;
  options: string[];
  correct_answer?: unknown;
  explanation: string;
  score: number;
  is_required: boolean;
  timestamp_seconds: number;
  time_limit_seconds?: number | null;
  order_index: number;
}

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  core: boolean;
  enabledByDefault: boolean;
  dependencies: string[];
  permissions: string[];
  apiPrefix: string;
  routes: string[];
}
