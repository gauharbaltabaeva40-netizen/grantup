// Дерекқор типтері. Supabase жобасы қосылғаннан кейін автоматты генерациямен ауыстыруға болады:
//   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts

export type UserRole = "student" | "admin";
export type GradeLevel = "10" | "11" | "graduate";
export type AppLocale = "kk" | "ru";
export type DeviceRequestStatus = "pending" | "approved" | "rejected" | "used" | "blocked" | "expired";
export type QuestionType = "single" | "multiple";
export type AttemptKind = "diagnostic" | "lesson_quiz" | "practice" | "mistakes" | "mock";
export type AttemptStatus = "in_progress" | "finished" | "expired" | "abandoned";
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Profile = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  nickname: string | null;
  avatar: string | null;
  grade: GradeLevel | null;
  locale: AppLocale;
  profile_pair: string;
  target_score: number | null;
  xp: number;
  level: number;
  streak: number;
  longest_streak: number;
  last_active_date: string | null;
  streak_freezes: number;
  league_tier: number;
  target_specialty_id: string | null;
  onboarding_completed_at: string | null;
  celebrated_level: number;
  celebrated_streak_date: string | null;
  created_at: string;
  updated_at: string;
};

export type AccessGrant = {
  id: string;
  email: string;
  user_id: string | null;
  starts_at: string;
  ends_at: string;
  revoked_at: string | null;
  granted_by: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type Device = {
  id: string;
  user_id: string;
  device_key: string;
  fingerprint: string;
  label: string;
  user_agent: string | null;
  last_ip: string | null;
  last_city: string | null;
  last_country: string | null;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
};

export type DeviceRequest = {
  id: string;
  user_id: string;
  device_key: string;
  fingerprint: string;
  label: string;
  user_agent: string | null;
  ip: string | null;
  city: string | null;
  country: string | null;
  status: DeviceRequestStatus;
  code_hash: string | null;
  code_expires_at: string | null;
  failed_attempts: number;
  replace_device_id: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SecurityEvent = {
  id: number;
  user_id: string | null;
  type: string;
  severity: "info" | "warning" | "critical";
  ip: string | null;
  city: string | null;
  country: string | null;
  user_agent: string | null;
  device_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export type AuditLog = {
  id: number;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

// ---------------------------------------------------------------------
// 3-кезең: контент
// ---------------------------------------------------------------------
export type Subject = {
  id: number;
  code: string;
  title_kk: string;
  title_ru: string;
  kind: "mandatory" | "profile";
  icon: string | null;
  color: string | null;
  position: number;
  created_at: string;
};

export type Topic = {
  id: string;
  subject_id: number;
  title_kk: string;
  title_ru: string;
  position: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type Lesson = {
  id: string;
  topic_id: string;
  title_kk: string;
  title_ru: string;
  position: number;
  is_free: boolean;
  is_published: boolean;
  duration_seconds: number | null;
  xp_reward: number;
  created_at: string;
  updated_at: string;
};

export type LessonContent = { lesson_id: string; summary_kk: string; summary_ru: string; updated_at: string };
export type LessonVideo = { lesson_id: string; youtube_id: string; updated_at: string };

export type QuestionGroup = {
  id: string;
  subject_id: number;
  topic_id: string | null;
  locale: AppLocale;
  title: string | null;
  passage: string;
  image_path: string | null;
  created_at: string;
  updated_at: string;
};

export type Question = {
  id: string;
  subject_id: number;
  topic_id: string | null;
  group_id: string | null;
  type: QuestionType;
  locale: AppLocale;
  difficulty: number;
  stem: string;
  image_path: string | null;
  explanation: string;
  is_active: boolean;
  source: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type QuestionOption = {
  id: string;
  question_id: string;
  position: number;
  content: string;
  image_path: string | null;
  is_correct: boolean;
};

export type MockExam = {
  id: string;
  title_kk: string;
  title_ru: string;
  locale: AppLocale;
  is_free: boolean;
  is_published: boolean;
  structure: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MockExamQuestion = { mock_exam_id: string; question_id: string; subject_id: number; position: number };

export type Specialty = {
  id: string;
  code: string;
  name_kk: string;
  name_ru: string;
  subject_pair: string;
  threshold_score: number;
  year: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------
// 3-кезең: оқу, тесттер, геймификация, AI, хабарламалар
// ---------------------------------------------------------------------
export type LessonProgress = {
  user_id: string;
  lesson_id: string;
  video_position_seconds: number;
  video_completed: boolean;
  quiz_best_percent: number | null;
  completed_at: string | null;
  updated_at: string;
};

export type Attempt = {
  id: string;
  user_id: string;
  kind: AttemptKind;
  status: AttemptStatus;
  locale: AppLocale;
  lesson_id: string | null;
  topic_id: string | null;
  subject_id: number | null;
  mock_exam_id: string | null;
  question_ids: string[];
  option_order: Json;
  structure: Json | null;
  started_at: string;
  deadline_at: string | null;
  finished_at: string | null;
  score: number | null;
  max_score: number | null;
  section_scores: Json | null;
  time_by_subject: Json | null;
  created_at: string;
  updated_at: string;
};

export type AttemptAnswer = {
  attempt_id: string;
  question_id: string;
  user_id: string;
  selected_option_ids: string[];
  is_correct: boolean | null;
  points: number | null;
  flagged: boolean;
  time_spent_ms: number;
  answered_at: string | null;
  updated_at: string;
};

export type UserMistake = {
  user_id: string;
  question_id: string;
  wrong_count: number;
  last_wrong_at: string;
  resolved_at: string | null;
};

export type StudyPlan = {
  id: string;
  user_id: string;
  source: "diagnostic" | "mock" | "manual" | "weekly";
  source_attempt_id: string | null;
  week_start: string;
  plan: Json;
  is_active: boolean;
  created_at: string;
};

export type XpEvent = { id: number; user_id: string; amount: number; reason: string; ref_id: string | null; created_at: string };

export type Achievement = {
  code: string;
  title_kk: string;
  title_ru: string;
  description_kk: string;
  description_ru: string;
  icon: string;
  xp_reward: number;
  position: number;
};
export type UserAchievement = { user_id: string; achievement_code: string; earned_at: string; seen_at: string | null };

export type League = { tier: number; code: string; name_kk: string; name_ru: string; color: string };
export type LeagueGroup = { id: string; tier: number; week_start: string; closed_at: string | null; created_at: string };
export type LeagueMember = {
  group_id: string;
  user_id: string;
  week_start: string;
  weekly_xp: number;
  final_rank: number | null;
  outcome: "promoted" | "demoted" | "stayed" | null;
  notified_zone: "up" | "down" | "mid" | null;
  joined_at: string;
};

export type AiExplanation = {
  id: string;
  question_id: string;
  answer_key: string;
  locale: AppLocale;
  content: string;
  model: string;
  created_at: string;
};
export type AiUsage = { user_id: string; day: string; kind: "explain" | "plan"; count: number };

export type NotificationsSettings = {
  user_id: string;
  push_streak: boolean;
  push_league: boolean;
  push_weekly: boolean;
  email_weekly: boolean;
  email_access_expiry: boolean;
  updated_at: string;
};

export type PushSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
};

export type NotificationLog = {
  id: number;
  user_id: string;
  kind: string;
  ref: string;
  channel: "push" | "email";
  delivered: number;
  created_at: string;
};

export type AppSetting = { key: string; value: Json; description: string | null; updated_at: string; updated_by: string | null };

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, Pick<Profile, "id" | "email"> & Partial<Profile>>;
      access_grants: Table<AccessGrant, Pick<AccessGrant, "email" | "ends_at"> & Partial<AccessGrant>>;
      devices: Table<
        Device,
        Pick<Device, "user_id" | "device_key" | "fingerprint" | "label"> & Partial<Device>
      >;
      device_requests: Table<
        DeviceRequest,
        Pick<DeviceRequest, "user_id" | "device_key" | "fingerprint" | "label"> & Partial<DeviceRequest>
      >;
      security_events: Table<
        SecurityEvent,
        Pick<SecurityEvent, "type"> & Partial<Omit<SecurityEvent, "id">>
      >;
      audit_log: Table<AuditLog, Pick<AuditLog, "action"> & Partial<Omit<AuditLog, "id">>>;
      admin_emails: Table<{ email: string }>;
      subjects: Table<Subject>;
      topics: Table<Topic>;
      lessons: Table<Lesson>;
      lesson_contents: Table<LessonContent>;
      lesson_videos: Table<LessonVideo>;
      question_groups: Table<QuestionGroup>;
      questions: Table<Question>;
      question_options: Table<QuestionOption>;
      mock_exams: Table<MockExam>;
      mock_exam_questions: Table<MockExamQuestion>;
      specialties: Table<Specialty>;
      lesson_progress: Table<LessonProgress>;
      attempts: Table<Attempt>;
      attempt_answers: Table<AttemptAnswer>;
      user_mistakes: Table<UserMistake>;
      study_plans: Table<StudyPlan>;
      xp_events: Table<XpEvent>;
      achievements: Table<Achievement>;
      user_achievements: Table<UserAchievement>;
      leagues: Table<League>;
      league_groups: Table<LeagueGroup>;
      league_members: Table<LeagueMember>;
      ai_explanations: Table<AiExplanation>;
      ai_usage: Table<AiUsage>;
      notifications_settings: Table<NotificationsSettings>;
      push_subscriptions: Table<PushSubscription>;
      app_settings: Table<AppSetting>;
      notification_log: Table<NotificationLog>;
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      has_full_access: { Args: Record<string, never>; Returns: boolean };
      user_has_full_access: { Args: { p_user: string }; Returns: boolean };
      rate_limit_hit: { Args: { p_key: string; p_max: number; p_window_seconds: number }; Returns: boolean };
      can_access_lesson: { Args: { p_lesson: string }; Returns: boolean };
      level_for_xp: { Args: { p_xp: number }; Returns: number };
      almaty_today: { Args: Record<string, never>; Returns: string };
      admin_overview: { Args: Record<string, never>; Returns: Record<string, number | null> };
      admin_hardest_questions: { Args: { p_min?: number; p_limit?: number }; Returns: { question_id: string; total: number; correct: number }[] };
      admin_students: {
        Args: { p_q?: string | null; p_access?: string | null; p_limit?: number; p_offset?: number };
        Returns: {
          id: string;
          email: string;
          full_name: string;
          grade: GradeLevel | null;
          level: number;
          xp: number;
          streak: number;
          last_active_date: string | null;
          created_at: string;
          has_access: boolean;
        }[];
      };
      admin_question_accuracy: { Args: { p_ids: string[] }; Returns: { question_id: string; total: number; correct: number }[] };
      league_week_start: { Args: { p_day?: string }; Returns: string };
      buy_streak_freeze: { Args: { p_user: string }; Returns: string };
      close_league_week: { Args: { p_week: string }; Returns: number };
      check_achievements: { Args: { p_user: string }; Returns: string[] };
      ai_usage_hit: { Args: { p_user: string; p_day: string; p_kind: string; p_max: number }; Returns: boolean };
      ai_usage_refund: { Args: { p_user: string; p_day: string; p_kind: string }; Returns: undefined };
      award_xp: {
        Args: { p_user: string; p_amount: number; p_reason: string; p_ref: string };
        Returns: { awarded: boolean; xp: number; level: number; level_up: boolean }[];
      };
      my_league_group_ids: { Args: Record<string, never>; Returns: string[] };
      league_standings: {
        Args: { p_group: string };
        Returns: { user_id: string; display_name: string; avatar: string | null; weekly_xp: number; is_me: boolean }[];
      };
    };
    Enums: {
      user_role: UserRole;
      grade_level: GradeLevel;
      app_locale: AppLocale;
      device_request_status: DeviceRequestStatus;
      question_type: QuestionType;
      content_locale: AppLocale;
      attempt_kind: AttemptKind;
      attempt_status: AttemptStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
